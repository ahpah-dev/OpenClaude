import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ExternalLink, RefreshCw, KeyRound, Play } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import HomeGreeting from './components/HomeGreeting.jsx';
import ChatView from './components/ChatView.jsx';
import ArtifactPanel from './components/ArtifactPanel.jsx';
import ProjectsView from './components/ProjectsView.jsx';
import ChatsArchiveView from './components/ChatsArchiveView.jsx';
import ArtifactsGallery from './components/ArtifactsGallery.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import SetupWizardModal from './components/SetupWizardModal.jsx';
import { NineRouterBadgeIcon } from './components/ClaudeIcons.jsx';

import { apiRequest, consumeSSE } from './lib/api.js';
import {
  createEmptyConversation,
  addMessageNode,
  updateMessageNode,
  getActiveThread,
  switchNodeBranch,
} from './lib/branchTree.js';
import {
  parseMessageSegments,
  collectVersionedArtifacts,
} from './lib/artifactParser.js';

function deriveTitleFromPrompt(text = '') {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New conversation';
  const words = cleaned.split(' ').slice(0, 7).join(' ');
  return words.length < cleaned.length ? `${words}...` : words;
}

export default function App() {
  const [settings, setSettings] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [modelsData, setModelsData] = useState(null);

  const [conversationsList, setConversationsList] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [allSavedArtifacts, setAllSavedArtifacts] = useState([]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState('home'); // 'home' | 'chat' | 'chats' | 'projects' | 'artifacts' | '9router-dashboard'
  const [activeArtifact, setActiveArtifact] = useState(null);

  const [selectedBackend, setSelectedBackend] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('');
  const [extendedThinking, setExtendedThinking] = useState(false);
  const [artifactsEnabled, setArtifactsEnabled] = useState(true);
  const [activeStyleId, setActiveStyleId] = useState('normal');

  const [isStreaming, setIsStreaming] = useState(false);
  const [settingsModalTab, setSettingsModalTab] = useState(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [dashboardFrameKey, setDashboardFrameKey] = useState(0);

  const abortControllerRef = useRef(null);

  // Sync theme & chat font attributes on <html>
  const effectiveTheme = settings?.appearance?.theme || 'light';
  const effectiveFont = settings?.appearance?.chatFont || 'serif';

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = () => {
      if (effectiveTheme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
      } else {
        root.setAttribute('data-theme', effectiveTheme);
      }
    };
    applyTheme();
    root.setAttribute('data-chat-font', effectiveFont);

    if (effectiveTheme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', applyTheme);
      return () => mq.removeEventListener('change', applyTheme);
    }
  }, [effectiveTheme, effectiveFont]);

  const refreshSystemAndModels = useCallback(async () => {
    const [statusRes, modelsRes, settingsRes] = await Promise.allSettled([
      apiRequest('/api/system/status'),
      apiRequest('/api/models'),
      apiRequest('/api/settings'),
    ]);

    if (statusRes.status === 'fulfilled') setSystemStatus(statusRes.value);
    if (settingsRes.status === 'fulfilled') {
      const s = settingsRes.value;
      setSettings(s);
      setActiveStyleId(s.activeStyleId || 'normal');
      setExtendedThinking(!!s.generation?.extendedThinking);
      setArtifactsEnabled(s.generation?.artifactsEnabled !== false);
    }
    if (modelsRes.status === 'fulfilled') {
      const m = modelsRes.value;
      setModelsData(m);
      setSelectedModel((prev) => {
        if (prev) return prev;
        if (m.recommended) {
          setSelectedBackend(m.recommended.backend);
          return m.recommended.model;
        }
        return '';
      });
    }
  }, []);

  const refreshLibrary = useCallback(async () => {
    const [convs, projs, arts] = await Promise.allSettled([
      apiRequest('/api/conversations'),
      apiRequest('/api/projects'),
      apiRequest('/api/artifacts'),
    ]);
    if (convs.status === 'fulfilled') setConversationsList(convs.value.conversations || []);
    if (projs.status === 'fulfilled') setProjects(projs.value.projects || []);
    if (arts.status === 'fulfilled') setAllSavedArtifacts(arts.value.artifacts || []);
  }, []);

  // Initial boot load
  useEffect(() => {
    refreshSystemAndModels();
    refreshLibrary();
    // Poll system status once after 4s in case background 9Router/Ollama daemon just finished booting
    const t = setTimeout(() => {
      refreshSystemAndModels();
    }, 4000);
    return () => clearTimeout(t);
  }, [refreshSystemAndModels, refreshLibrary]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setSettingsModalTab('profile');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleSaveSettings = async (patch) => {
    const updated = await apiRequest('/api/settings', {
      method: 'PUT',
      body: patch,
    });
    setSettings(updated);
    if (patch.activeStyleId) setActiveStyleId(patch.activeStyleId);
    return updated;
  };

  const handleNewChat = () => {
    if (isStreaming) abortControllerRef.current?.abort();
    setActiveConversation(null);
    setActiveArtifact(null);
    setActiveProjectId(null);
    setActiveView('home');
  };

  const handleOpenConversation = async (id) => {
    try {
      const full = await apiRequest(`/api/conversations/${id}`);
      setActiveConversation(full);
      if (full.backend && full.model) {
        setSelectedBackend(full.backend);
        setSelectedModel(full.model);
      }
      setActiveArtifact(null);
      setActiveView('chat');
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  // Active linear thread & versioned artifacts for current conversation
  const activeThread = useMemo(
    () => (activeConversation ? getActiveThread(activeConversation) : []),
    [activeConversation]
  );

  const threadArtifacts = useMemo(
    () => collectVersionedArtifacts(activeThread),
    [activeThread]
  );

  const versionedArtifactsMap = useMemo(() => {
    const map = new Map();
    for (const a of threadArtifacts) {
      map.set(a.id, a);
    }
    return map;
  }, [threadArtifacts]);

  // Keep activeArtifact live-updated while streaming!
  useEffect(() => {
    if (!activeArtifact || !isStreaming) return;
    const latestMatch = threadArtifacts.find((a) => a.id === activeArtifact.id);
    if (latestMatch) {
      setActiveArtifact(latestMatch);
    }
  }, [threadArtifacts, isStreaming, activeArtifact?.id]);

  // Core Unified Streaming Turn Runner
  const executeAssistantStream = async (convSnapshot, userParentNodeId) => {
    const backend = selectedBackend;
    const model = selectedModel;
    if (!model) {
      setShowSetupWizard(true);
      return;
    }

    // Create assistant placeholder node descending from userParentNodeId
    let workingConv = addMessageNode(convSnapshot, {
      parentId: userParentNodeId,
      role: 'assistant',
      content: '',
      thinking: '',
      model,
      backend,
    });
    const assistantNodeId = workingConv.currentLeafId;
    setActiveConversation(workingConv);
    setActiveView('chat');
    setIsStreaming(true);

    // Build message history up to userParentNodeId
    const threadBeforeAssistant = getActiveThread(workingConv).filter(
      (m) => m.id !== assistantNodeId
    );
    const apiMessages = threadBeforeAssistant.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments || [],
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const thinkStart = Date.now();
    let thinkEndRecorded = false;
    let autoOpenedArtifactForTurn = false;

    try {
      await consumeSSE('/api/chat/stream', {
        body: {
          backend,
          model,
          messages: apiMessages,
          conversationId: workingConv.id,
          projectId: workingConv.projectId,
          systemPromptOverride: workingConv.systemPromptOverride,
          styleId: activeStyleId,
          extendedThinking,
          artifactsEnabled,
        },
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === 'thinking' && ev.text) {
            workingConv = updateMessageNode(workingConv, assistantNodeId, (prev) => ({
              thinking: (prev.thinking || '') + ev.text,
            }));
            setActiveConversation(workingConv);
          } else if (ev.type === 'content' && ev.text) {
            if (!thinkEndRecorded) {
              thinkEndRecorded = true;
              const sec = Number(((Date.now() - thinkStart) / 1000).toFixed(1));
              workingConv = updateMessageNode(workingConv, assistantNodeId, (prev) => ({
                thinkingDurationSec: prev.thinking ? sec : null,
              }));
            }
            workingConv = updateMessageNode(workingConv, assistantNodeId, (prev) => ({
              content: (prev.content || '') + ev.text,
            }));
            setActiveConversation(workingConv);

            // Auto-open Artifacts split panel when an artifact starts generating!
            if (
              !autoOpenedArtifactForTurn &&
              settings?.appearance?.autoOpenArtifacts !== false
            ) {
              const currentText = workingConv.nodes[assistantNodeId]?.content || '';
              const { extractedArtifacts } = parseMessageSegments(
                currentText,
                assistantNodeId,
                true
              );
              if (extractedArtifacts.length > 0) {
                autoOpenedArtifactForTurn = true;
                setActiveArtifact(extractedArtifacts[extractedArtifacts.length - 1]);
              }
            }
          } else if (ev.type === 'usage') {
            workingConv = updateMessageNode(workingConv, assistantNodeId, {
              usage: ev.usage,
            });
            setActiveConversation(workingConv);
          } else if (ev.type === 'error') {
            workingConv = updateMessageNode(workingConv, assistantNodeId, (prev) => ({
              content:
                (prev.content ? `${prev.content}\n\n` : '') +
                `> **Connection / Model Notice:** ${ev.error}`,
            }));
            setActiveConversation(workingConv);
          }
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        workingConv = updateMessageNode(workingConv, assistantNodeId, (prev) => ({
          content:
            (prev.content ? `${prev.content}\n\n` : '') +
            `> **Error:** ${err.message}`,
        }));
        setActiveConversation(workingConv);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;

      // Extract & persist artifacts list on conversation for the Artifacts Gallery
      const finalThread = getActiveThread(workingConv);
      const finalArts = collectVersionedArtifacts(finalThread).map(({ versions, ...rest }) => rest);
      workingConv = {
        ...workingConv,
        backend,
        model,
        artifacts: finalArts,
      };
      setActiveConversation(workingConv);

      // Update activeArtifact to finished non-streaming state so Preview iframe activates!
      const fullThreadArts = collectVersionedArtifacts(finalThread);
      if (fullThreadArts.length > 0 && settings?.appearance?.autoOpenArtifacts !== false) {
        setActiveArtifact(fullThreadArts[fullThreadArts.length - 1]);
      }

      try {
        await apiRequest(`/api/conversations/${workingConv.id}`, {
          method: 'PUT',
          body: workingConv,
        });
        await refreshLibrary();
      } catch (e) {
        console.error('Save conversation error:', e);
      }
    }
  };

  // Send New Message (from Home, Active Chat, or Project Workspace)
  const handleSendMessage = async ({ content, attachments = [] }, forcedProjectId = null) => {
    let conv = activeConversation;
    if (!conv || activeView === 'home' || forcedProjectId) {
      conv = createEmptyConversation({
        projectId: forcedProjectId || null,
        styleId: activeStyleId,
        backend: selectedBackend,
        model: selectedModel,
      });
      conv.title = deriveTitleFromPrompt(content || attachments[0]?.name || 'New chat');
    }

    const parentId = conv.currentLeafId || null;
    const withUser = addMessageNode(conv, {
      parentId,
      role: 'user',
      content,
      attachments,
      model: selectedModel,
      backend: selectedBackend,
    });
    const userNodeId = withUser.currentLeafId;

    // Persist immediately so sidebar shows new chat right away
    await apiRequest('/api/conversations', { method: 'POST', body: withUser }).catch(() => {});
    refreshLibrary();

    await executeAssistantStream(withUser, userNodeId);
  };

  // Edit any User Message -> Creates a new Conversation Branch (< 1 / 2 >)!
  const handleEditUserMessage = async (originalMsg, editedText) => {
    if (!activeConversation || isStreaming) return;
    const branched = addMessageNode(activeConversation, {
      parentId: originalMsg.parentId || null,
      role: 'user',
      content: editedText,
      attachments: originalMsg.attachments || [],
      model: selectedModel,
      backend: selectedBackend,
    });
    const newUserNodeId = branched.currentLeafId;
    await executeAssistantStream(branched, newUserNodeId);
  };

  // Regenerate / Retry Assistant Message -> Creates a new Assistant Branch (< 1 / 2 >)!
  const handleRegenerateAssistant = async (assistantMsg) => {
    if (!activeConversation || isStreaming || !assistantMsg.parentId) return;
    await executeAssistantStream(activeConversation, assistantMsg.parentId);
  };

  // Switch < 1 / 2 > Branch on any User or Assistant Node
  const handleSwitchBranch = async (nodeId, targetSiblingId) => {
    if (!activeConversation || isStreaming) return;
    const switched = switchNodeBranch(activeConversation, nodeId, targetSiblingId);
    setActiveConversation(switched);
    await apiRequest(`/api/conversations/${switched.id}`, {
      method: 'PUT',
      body: { ...switched, touchUpdatedAt: false },
    }).catch(() => {});
  };

  const userInitials = (
    settings?.profile?.nickname ||
    settings?.profile?.fullName ||
    'D'
  )
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const sharedComposerProps = {
    isStreaming,
    onSend: (payload) => handleSendMessage(payload),
    onStop: () => abortControllerRef.current?.abort(),
    modelsData,
    onRefreshModels: refreshSystemAndModels,
    selectedBackend,
    selectedModel,
    onSelectModel: (backend, model) => {
      setSelectedBackend(backend);
      setSelectedModel(model);
      handleSaveSettings({
        generation: {
          ...(settings?.generation || {}),
          selectedBackend: backend,
          selectedModel: model,
        },
      });
    },
    extendedThinking,
    onToggleThinking: () => {
      const next = !extendedThinking;
      setExtendedThinking(next);
      handleSaveSettings({
        generation: { ...(settings?.generation || {}), extendedThinking: next },
      });
    },
    artifactsEnabled,
    onToggleArtifacts: () => {
      const next = !artifactsEnabled;
      setArtifactsEnabled(next);
      handleSaveSettings({
        generation: { ...(settings?.generation || {}), artifactsEnabled: next },
      });
    },
    styles: settings?.styles || [],
    activeStyleId,
    onSelectStyle: (id) => {
      setActiveStyleId(id);
      handleSaveSettings({ activeStyleId: id });
    },
    onOpenStyleManager: () => setSettingsModalTab('styles'),
    onOpenNineRouterConnect: () => setSettingsModalTab('9router'),
    onOpenNineRouterDashboard: () => setActiveView('9router-dashboard'),
    sendWithEnter: settings?.appearance?.sendWithEnter !== false,
  };

  const dashboardUrl =
    systemStatus?.nineRouter?.dashboardUrl || 'http://localhost:20128/dashboard';

  return (
    <div className="h-screen w-screen overflow-hidden flex">
      {/* Left Collapsible Claude.ai Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeView={activeView}
        onNavigate={(view) => {
          setActiveView(view);
          if (view !== 'chat' && view !== 'artifacts') {
            setActiveArtifact(null);
          }
        }}
        onNewChat={handleNewChat}
        conversations={conversationsList}
        projects={projects}
        activeConversationId={activeConversation?.id}
        activeProjectId={activeProjectId}
        onSelectConversation={handleOpenConversation}
        onSelectProject={(projId) => {
          setActiveProjectId(projId);
          setActiveView('projects');
        }}
        onToggleStarConversation={async (id, starred) => {
          const full = await apiRequest(`/api/conversations/${id}`);
          const saved = await apiRequest(`/api/conversations/${id}`, {
            method: 'PUT',
            body: { ...full, starred, touchUpdatedAt: false },
          });
          if (activeConversation?.id === id) setActiveConversation(saved);
          refreshLibrary();
        }}
        onRenameConversation={async (id, title) => {
          const full = await apiRequest(`/api/conversations/${id}`);
          const saved = await apiRequest(`/api/conversations/${id}`, {
            method: 'PUT',
            body: { ...full, title, touchUpdatedAt: false },
          });
          if (activeConversation?.id === id) setActiveConversation(saved);
          refreshLibrary();
        }}
        onDeleteConversation={async (id) => {
          await apiRequest(`/api/conversations/${id}`, { method: 'DELETE' });
          if (activeConversation?.id === id) handleNewChat();
          refreshLibrary();
        }}
        systemStatus={systemStatus}
        userProfile={settings?.profile}
        theme={effectiveTheme}
        onChangeTheme={(theme) =>
          handleSaveSettings({
            appearance: { ...(settings?.appearance || {}), theme },
          })
        }
        onOpenSettings={(tab) => setSettingsModalTab(tab || 'profile')}
        onOpenSetupWizard={() => setShowSetupWizard(true)}
        onPopoutNineRouter={() =>
          apiRequest('/api/system/open-9router-dashboard', { method: 'POST' })
        }
      />

      {/* Center Primary Workspace + Right Split-Screen Claude Artifacts Drawer */}
      <main className="flex-1 min-w-0 h-full flex overflow-hidden">
        {activeView === 'home' && (
          <HomeGreeting
            userName={settings?.profile?.nickname || settings?.profile?.fullName || 'Friend'}
            composerProps={sharedComposerProps}
            systemStatus={systemStatus}
            onOpenNineRouterConnect={() => setSettingsModalTab('9router')}
            onOpenNineRouterDashboard={() => setActiveView('9router-dashboard')}
            onOpenSystemPromptEditor={() => setSettingsModalTab('system-prompt')}
          />
        )}

        {activeView === 'chat' && activeConversation && (
          <ChatView
            conversation={activeConversation}
            thread={activeThread}
            projects={projects}
            isStreaming={isStreaming}
            userInitials={userInitials}
            activeArtifact={activeArtifact}
            allThreadArtifacts={threadArtifacts}
            versionedArtifactsMap={versionedArtifactsMap}
            onSelectArtifact={(art) => setActiveArtifact(art)}
            onToggleStar={async (starred) => {
              const updated = { ...activeConversation, starred };
              setActiveConversation(updated);
              await apiRequest(`/api/conversations/${updated.id}`, {
                method: 'PUT',
                body: { ...updated, touchUpdatedAt: false },
              });
              refreshLibrary();
            }}
            onRenameTitle={async (title) => {
              const updated = { ...activeConversation, title };
              setActiveConversation(updated);
              await apiRequest(`/api/conversations/${updated.id}`, {
                method: 'PUT',
                body: { ...updated, touchUpdatedAt: false },
              });
              refreshLibrary();
            }}
            onAssignProject={async (projectId) => {
              const updated = { ...activeConversation, projectId };
              setActiveConversation(updated);
              await apiRequest(`/api/conversations/${updated.id}`, {
                method: 'PUT',
                body: { ...updated, touchUpdatedAt: false },
              });
              refreshLibrary();
            }}
            onSaveChatSystemPrompt={async (systemPromptOverride) => {
              const updated = { ...activeConversation, systemPromptOverride };
              setActiveConversation(updated);
              await apiRequest(`/api/conversations/${updated.id}`, {
                method: 'PUT',
                body: { ...updated, touchUpdatedAt: false },
              });
            }}
            onEditUserMessage={handleEditUserMessage}
            onRegenerateAssistant={handleRegenerateAssistant}
            onSwitchBranch={handleSwitchBranch}
            onFeedback={async (msgId, feedback) => {
              const updated = updateMessageNode(activeConversation, msgId, { feedback });
              setActiveConversation(updated);
              await apiRequest(`/api/conversations/${updated.id}`, {
                method: 'PUT',
                body: { ...updated, touchUpdatedAt: false },
              });
            }}
            showTokenMetrics={settings?.appearance?.showTokenMetrics !== false}
            composerProps={sharedComposerProps}
          />
        )}

        {activeView === 'projects' && (
          <ProjectsView
            projects={projects}
            conversations={conversationsList}
            activeProjectId={activeProjectId}
            onSelectProject={(id) => setActiveProjectId(id)}
            onCreateProject={async (data) => {
              const p = await apiRequest('/api/projects', { method: 'POST', body: data });
              await refreshLibrary();
              return p;
            }}
            onUpdateProject={async (id, patch) => {
              await apiRequest(`/api/projects/${id}`, { method: 'PUT', body: patch });
              await refreshLibrary();
            }}
            onDeleteProject={async (id) => {
              await apiRequest(`/api/projects/${id}`, { method: 'DELETE' });
              await refreshLibrary();
            }}
            onAddKnowledge={async (projId, doc) => {
              await apiRequest(`/api/projects/${projId}/knowledge`, {
                method: 'POST',
                body: doc,
              });
              await refreshLibrary();
            }}
            onRemoveKnowledge={async (projId, docId) => {
              await apiRequest(`/api/projects/${projId}/knowledge/${docId}`, {
                method: 'DELETE',
              });
              await refreshLibrary();
            }}
            onStartProjectChat={(projId, payload) => handleSendMessage(payload, projId)}
            onOpenConversation={handleOpenConversation}
            composerProps={sharedComposerProps}
          />
        )}

        {activeView === 'chats' && (
          <ChatsArchiveView
            conversations={conversationsList}
            onOpenConversation={handleOpenConversation}
            onNewChat={handleNewChat}
            onToggleStar={async (id, starred) => {
              const full = await apiRequest(`/api/conversations/${id}`);
              await apiRequest(`/api/conversations/${id}`, {
                method: 'PUT',
                body: { ...full, starred, touchUpdatedAt: false },
              });
              refreshLibrary();
            }}
            onBulkDelete={async (ids) => {
              await apiRequest('/api/conversations/bulk-delete', {
                method: 'POST',
                body: { ids },
              });
              refreshLibrary();
            }}
          />
        )}

        {activeView === 'artifacts' && (
          <ArtifactsGallery
            userArtifacts={allSavedArtifacts}
            onPreviewArtifact={(art) => setActiveArtifact(art)}
            onOpenConversation={handleOpenConversation}
          />
        )}

        {/* Integrated Live 9Router Dashboard Workspace */}
        {activeView === '9router-dashboard' && (
          <div className="flex-1 h-full flex flex-col min-w-0">
            <header
              className="h-13 px-5 border-b flex items-center justify-between gap-3 shrink-0"
              style={{
                backgroundColor: 'var(--bg-surface-2)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2.5">
                <NineRouterBadgeIcon size={18} className="text-[#D97757]" />
                <span className="font-semibold text-sm">9Router Live Dashboard</span>
                <span className="text-xs font-mono opacity-60 hidden sm:inline">
                  ({dashboardUrl})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!systemStatus?.nineRouter?.running && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('/api/system/start-9router', { method: 'POST' });
                      await refreshSystemAndModels();
                      setDashboardFrameKey((k) => k + 1);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                  >
                    <Play size={12} />
                    <span>Start 9Router</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSettingsModalTab('9router')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium text-[#D97757] border-[#D97757]/40 hover:bg-[#D97757]/10 cursor-pointer"
                >
                  <KeyRound size={12} />
                  <span>Sync API Key to OpenClaude</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardFrameKey((k) => k + 1)}
                  title="Reload dashboard frame"
                  className="p-1.5 rounded-xl border hover:bg-black/5 cursor-pointer"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    apiRequest('/api/system/open-9router-dashboard', { method: 'POST' })
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-medium hover:opacity-90 cursor-pointer"
                >
                  <span>Open in Browser</span>
                  <ExternalLink size={12} />
                </button>
              </div>
            </header>

            <div className="flex-1 bg-white relative">
              <iframe
                key={dashboardFrameKey}
                src={dashboardUrl}
                title="9Router Dashboard"
                className="w-full h-full border-0"
              />
            </div>
          </div>
        )}

        {/* Right Split-Screen Claude Artifacts Panel */}
        {activeArtifact && (
          <ArtifactPanel
            artifact={activeArtifact}
            onClose={() => setActiveArtifact(null)}
            onSelectVersion={(ver) => setActiveArtifact({ ...ver, versions: activeArtifact.versions })}
            onFixWithClaude={
              activeView === 'chat'
                ? (fixPrompt) => handleSendMessage({ content: fixPrompt, attachments: [] })
                : undefined
            }
          />
        )}
      </main>

      {/* Settings & Customizable System Prompt Modal */}
      {settingsModalTab && (
        <SettingsModal
          initialTab={settingsModalTab}
          settings={settings}
          systemStatus={systemStatus}
          modelsData={modelsData}
          onClose={() => setSettingsModalTab(null)}
          onSaveSettings={handleSaveSettings}
          onRefreshSystem={refreshSystemAndModels}
        />
      )}

      {/* Automated System Setup & Diagnostics Modal */}
      {showSetupWizard && (
        <SetupWizardModal
          systemStatus={systemStatus}
          onClose={() => setShowSetupWizard(false)}
          onRefresh={refreshSystemAndModels}
          onOpenConnectKey={() => setSettingsModalTab('9router')}
          onViewEmbeddedDashboard={() => setActiveView('9router-dashboard')}
        />
      )}
    </div>
  );
}
