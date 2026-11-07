import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FolderOpen,
  FilePlus,
  FolderPlus,
  Play,
  Square,
  Save,
  RotateCcw,
  Terminal,
  Eye,
  Code2,
  ExternalLink,
  RefreshCw,
  Trash2,
  ChevronRight,
  ChevronDown,
  FileCode,
  Folder,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowUp,
  Undo2,
  Wrench,
  X,
  Plus,
} from 'lucide-react';
import { ClaudeStarburst, NineRouterBadgeIcon, OllamaIcon } from './ClaudeIcons.jsx';
import MarkdownRenderer from './MarkdownRenderer.jsx';
import { apiRequest, consumeSSE } from '../lib/api.js';
import { parseVibeResponse } from '../lib/vibeParser.js';

function FileTreeItem({ node, depth = 0, activePath, onOpenFile, onDeleteEntry }) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.type === 'directory') {
    return (
      <div>
        <div
          onClick={() => setExpanded(!expanded)}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
          className="group flex items-center justify-between py-1 pr-2 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer select-none"
        >
          <span className="flex items-center gap-1.5 min-w-0 truncate font-medium">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <Folder size={13.5} className="text-[#D97757] shrink-0" />
            <span className="truncate">{node.name}</span>
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteEntry(node.path);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 cursor-pointer"
            title="Delete folder"
          >
            <Trash2 size={11} />
          </button>
        </div>
        {expanded &&
          (node.children || []).map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onOpenFile={onOpenFile}
              onDeleteEntry={onDeleteEntry}
            />
          ))}
      </div>
    );
  }

  const isSelected = activePath === node.path;
  return (
    <div
      onClick={() => onOpenFile(node.path)}
      style={{
        paddingLeft: `${20 + depth * 12}px`,
        backgroundColor: isSelected ? 'var(--accent-claude-soft)' : undefined,
        color: isSelected ? 'var(--accent-claude)' : 'var(--text-secondary)',
      }}
      className="group flex items-center justify-between py-1 pr-2 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer select-none"
    >
      <span className="flex items-center gap-1.5 min-w-0 truncate">
        <FileCode size={13} className="shrink-0 opacity-75" />
        <span className={`truncate ${isSelected ? 'font-semibold' : ''}`}>{node.name}</span>
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDeleteEntry(node.path);
        }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 cursor-pointer"
        title="Delete file"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default function VibeCodingStudio({
  selectedBackend,
  selectedModel,
  modelsData,
  onSelectModel,
  extendedThinking,
}) {
  const [workspace, setWorkspace] = useState({ root: '', name: 'workspace', tree: [], undoStack: [] });
  const [editingRootPath, setEditingRootPath] = useState(false);
  const [rootPathInput, setRootPathInput] = useState('');

  // Open Editor Tabs: [{ path, content, savedContent, runCommand }]
  const [tabs, setTabs] = useState([]);
  const [activeTabPath, setActiveTabPath] = useState(''); // or '__preview__'
  const [previewEntry, setPreviewEntry] = useState('index.html');
  const [customPreviewUrl, setCustomPreviewUrl] = useState('');
  const [previewNonce, setPreviewNonce] = useState(0);

  // New File / New Project modals
  const [newEntryModal, setNewEntryModal] = useState(null); // 'file' | 'folder' | 'project'
  const [newEntryName, setNewEntryName] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState('web');

  // Terminal State
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalCmd, setTerminalCmd] = useState('');
  const [cmdHistory, setCmdHistory] = useState([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [terminalLogs, setTerminalLogs] = useState([
    { kind: 'info', text: '✦ OpenClaude Vibe Terminal ready. Run scripts, git, npm, python, or PowerShell commands directly on your PC.\n' },
  ]);
  const [isExecRunning, setIsExecRunning] = useState(false);
  const [lastFailedOutput, setLastFailedOutput] = useState(null);
  const execAbortRef = useRef(null);
  const termScrollRef = useRef(null);

  // Vibe Agent Chat State
  const [autoApply, setAutoApply] = useState(true);
  const [vibeMessages, setVibeMessages] = useState([]);
  const [vibePrompt, setVibePrompt] = useState('');
  const [vibeStreaming, setVibeStreaming] = useState(false);
  const [actionStatuses, setActionStatuses] = useState({}); // key: `${msgId}_${idx}` -> { status, detail }
  const vibeAbortRef = useRef(null);
  const chatScrollRef = useRef(null);

  const loadWorkspaceTree = useCallback(async (autoSelectFirst = false) => {
    try {
      const data = await apiRequest('/api/workspace/tree');
      setWorkspace(data);
      setRootPathInput(data.root || '');

      // Auto-open index.html or first file if no tabs open yet
      if (autoSelectFirst && data.tree?.length > 0) {
        const findFirstFile = (nodes) => {
          for (const n of nodes) {
            if (n.type === 'file' && n.name === 'index.html') return n.path;
          }
          for (const n of nodes) {
            if (n.type === 'file') return n.path;
            if (n.children) {
              const nested = findFirstFile(n.children);
              if (nested) return nested;
            }
          }
          return null;
        };
        const first = findFirstFile(data.tree);
        if (first) openFileInTab(first);
      }
      return data;
    } catch (err) {
      console.error('Workspace tree error:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    loadWorkspaceTree(true);
  }, [loadWorkspaceTree]);

  useEffect(() => {
    if (termScrollRef.current) {
      termScrollRef.current.scrollTop = termScrollRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [vibeMessages, vibeStreaming]);

  const openFileInTab = async (relPath) => {
    try {
      const fileData = await apiRequest(`/api/workspace/file?path=${encodeURIComponent(relPath)}`);
      setTabs((prev) => {
        const exists = prev.find((t) => t.path === fileData.path);
        if (exists) {
          return prev.map((t) =>
            t.path === fileData.path
              ? { ...t, content: fileData.content, savedContent: fileData.content, runCommand: fileData.runCommand }
              : t
          );
        }
        return [
          ...prev,
          {
            path: fileData.path,
            content: fileData.content,
            savedContent: fileData.content,
            runCommand: fileData.runCommand,
          },
        ];
      });
      setActiveTabPath(fileData.path);
      if (fileData.path.endsWith('.html')) {
        setPreviewEntry(fileData.path);
      }
    } catch (err) {
      console.error('Open file error:', err);
    }
  };

  const activeTab = tabs.find((t) => t.path === activeTabPath) || null;

  const saveTab = useCallback(
    async (targetPath = activeTabPath) => {
      const tab = tabs.find((t) => t.path === targetPath);
      if (!tab) return;
      await apiRequest('/api/workspace/file', {
        method: 'POST',
        body: { path: tab.path, content: tab.content },
      });
      setTabs((prev) =>
        prev.map((t) => (t.path === tab.path ? { ...t, savedContent: t.content } : t))
      );
      setPreviewNonce((n) => n + 1);
      await loadWorkspaceTree(false);
    },
    [activeTabPath, tabs, loadWorkspaceTree]
  );

  // Ctrl+S shortcut inside studio
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        if (activeTab) {
          e.preventDefault();
          saveTab(activeTab.path);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab, saveTab]);

  // Execute terminal command on PC via SSE
  const runCommandOnPc = async (cmdString) => {
    const trimmed = String(cmdString || '').trim();
    if (!trimmed) return { exitCode: 0, output: '' };
    if (isExecRunning) execAbortRef.current?.abort();

    setTerminalOpen(true);
    setIsExecRunning(true);
    setLastFailedOutput(null);
    setCmdHistory((prev) => [trimmed, ...prev.filter((x) => x !== trimmed)].slice(0, 40));
    setHistoryIdx(-1);

    setTerminalLogs((prev) => [
      ...prev,
      { kind: 'cmd', text: `\nPS ${workspace.root}> ${trimmed}\n` },
    ]);

    const controller = new AbortController();
    execAbortRef.current = controller;
    let captured = '';
    let exitCode = 0;

    try {
      await consumeSSE('/api/workspace/exec', {
        body: { command: trimmed },
        signal: controller.signal,
        onEvent: (ev) => {
          if (ev.type === 'stdout' && ev.text) {
            captured += ev.text;
            setTerminalLogs((prev) => [...prev.slice(-250), { kind: 'stdout', text: ev.text }]);
          } else if (ev.type === 'stderr' && ev.text) {
            captured += ev.text;
            setTerminalLogs((prev) => [...prev.slice(-250), { kind: 'stderr', text: ev.text }]);
          } else if (ev.type === 'exit') {
            exitCode = ev.exitCode ?? 0;
            setTerminalLogs((prev) => [
              ...prev.slice(-250),
              {
                kind: exitCode === 0 ? 'exit-ok' : 'exit-err',
                text: `[Process exited with code ${exitCode} in ${ev.durationMs}ms]\n`,
              },
            ]);
          }
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setTerminalLogs((prev) => [...prev, { kind: 'stderr', text: `${err.message}\n` }]);
      }
    } finally {
      setIsExecRunning(false);
      execAbortRef.current = null;
      await loadWorkspaceTree(false);
      setPreviewNonce((n) => n + 1);
    }

    if (exitCode !== 0 && captured.trim()) {
      setLastFailedOutput({ command: trimmed, output: captured.slice(-3000), exitCode });
    }
    return { exitCode, output: captured.slice(-6000) };
  };

  const handleRunActiveFile = async () => {
    if (!activeTab) return;
    if (activeTab.content !== activeTab.savedContent) {
      await saveTab(activeTab.path);
    }
    if (activeTab.path.endsWith('.html')) {
      setPreviewEntry(activeTab.path);
      setCustomPreviewUrl('');
      setActiveTabPath('__preview__');
      setPreviewNonce((n) => n + 1);
      return;
    }
    if (activeTab.runCommand) {
      await runCommandOnPc(activeTab.runCommand);
    }
  };

  // Execute a single parsed <ocAction> on disk
  const applySingleOcAction = async (msgId, action) => {
    const key = `${msgId}_${action.index}`;
    setActionStatuses((prev) => ({ ...prev, [key]: { status: 'running', detail: 'Applying...' } }));
    try {
      if (action.type === 'write_file') {
        const res = await apiRequest('/api/workspace/file', {
          method: 'POST',
          body: { path: action.path, content: action.body },
        });
        await loadWorkspaceTree(false);
        await openFileInTab(res.path);
        setPreviewNonce((n) => n + 1);
        setActionStatuses((prev) => ({
          ...prev,
          [key]: { status: 'done', detail: `${res.created ? 'Created' : 'Wrote'} ${res.lines} lines` },
        }));
        return { kind: 'write', summary: `Wrote ${res.path} (${res.lines} lines)` };
      }

      if (action.type === 'edit_file') {
        const res = await apiRequest('/api/workspace/edit', {
          method: 'POST',
          body: { path: action.path, search: action.search, replace: action.replace },
        });
        await loadWorkspaceTree(false);
        await openFileInTab(res.path);
        setPreviewNonce((n) => n + 1);
        setActionStatuses((prev) => ({
          ...prev,
          [key]: { status: 'done', detail: `Updated (${res.lines} lines)` },
        }));
        return { kind: 'edit', summary: `Edited ${res.path}` };
      }

      if (action.type === 'read_file') {
        const res = await apiRequest(`/api/workspace/file?path=${encodeURIComponent(action.path)}`);
        setActionStatuses((prev) => ({
          ...prev,
          [key]: { status: 'done', detail: `Read ${Math.round(res.size / 1024) || 1} KB` },
        }));
        return {
          kind: 'observation',
          summary: `<file_contents path="${res.path}">\n${res.content.slice(0, 16000)}\n</file_contents>`,
        };
      }

      if (action.type === 'delete_file') {
        await apiRequest('/api/workspace/file', {
          method: 'DELETE',
          body: { path: action.path },
        });
        setTabs((prev) => prev.filter((t) => t.path !== action.path));
        await loadWorkspaceTree(false);
        setActionStatuses((prev) => ({ ...prev, [key]: { status: 'done', detail: 'Deleted' } }));
        return { kind: 'delete', summary: `Deleted ${action.path}` };
      }

      if (action.type === 'run_command') {
        const cmd = action.body.trim();
        const execRes = await runCommandOnPc(cmd);
        setActionStatuses((prev) => ({
          ...prev,
          [key]: { status: execRes.exitCode === 0 ? 'done' : 'error', detail: `Exit ${execRes.exitCode}` },
        }));
        return {
          kind: 'observation',
          summary: `<command_output command="${cmd}" exit_code="${execRes.exitCode}">\n${execRes.output || '(no output)'}\n</command_output>`,
        };
      }
    } catch (err) {
      setActionStatuses((prev) => ({ ...prev, [key]: { status: 'error', detail: err.message } }));
      return {
        kind: 'observation',
        summary: `<action_error type="${action.type}" path="${action.path}">${err.message}</action_error>`,
      };
    }
    return null;
  };

  // Autonomous Vibe Coding Agent Loop
  const sendVibePrompt = async (overridePrompt = null) => {
    const promptText = (overridePrompt ?? vibePrompt).trim();
    if (!promptText || vibeStreaming || !selectedModel) return;
    if (!overridePrompt) setVibePrompt('');

    const userMsg = {
      id: `vmsg_${crypto.randomUUID()}`,
      role: 'user',
      content: promptText,
    };

    // Include open active file context hint if user has a file focused
    let contextAugmented = promptText;
    if (activeTab && activeTab.path !== '__preview__') {
      contextAugmented = `[Currently open file in editor: ${activeTab.path}]\n\n${promptText}`;
    }

    let history = [...vibeMessages, { ...userMsg, apiContent: contextAugmented }];
    setVibeMessages(history);
    setVibeStreaming(true);

    const controller = new AbortController();
    vibeAbortRef.current = controller;

    const MAX_AGENT_STEPS = 4;
    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      if (controller.signal.aborted) break;

      const assistantId = `vmsg_${crypto.randomUUID()}`;
      let assistantText = '';
      let assistantThinking = '';

      history = [
        ...history,
        { id: assistantId, role: 'assistant', content: '', thinking: '' },
      ];
      setVibeMessages([...history]);

      const apiMsgs = history
        .slice(0, -1)
        .filter((m) => !m.isSystemObservationUIHidden)
        .map((m) => ({
          role: m.role,
          content: m.apiContent || m.content,
        }));

      try {
        await consumeSSE('/api/chat/stream', {
          body: {
            backend: selectedBackend,
            model: selectedModel,
            messages: apiMsgs,
            vibeMode: true,
            workspaceRoot: workspace.root,
            extendedThinking,
          },
          signal: controller.signal,
          onEvent: (ev) => {
            if (ev.type === 'thinking' && ev.text) {
              assistantThinking += ev.text;
              history = history.map((m) =>
                m.id === assistantId ? { ...m, thinking: assistantThinking } : m
              );
              setVibeMessages([...history]);
            } else if (ev.type === 'content' && ev.text) {
              assistantText += ev.text;
              history = history.map((m) =>
                m.id === assistantId ? { ...m, content: assistantText } : m
              );
              setVibeMessages([...history]);
            } else if (ev.type === 'error') {
              assistantText += `\n\n> **Error:** ${ev.error}`;
              history = history.map((m) =>
                m.id === assistantId ? { ...m, content: assistantText } : m
              );
              setVibeMessages([...history]);
            }
          },
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          history = history.map((m) =>
            m.id === assistantId ? { ...m, content: `${assistantText}\n\n> **Error:** ${err.message}` } : m
          );
          setVibeMessages([...history]);
        }
        break;
      }

      if (!autoApply || controller.signal.aborted) break;

      const { actions } = parseVibeResponse(assistantText, false);
      if (actions.length === 0) break;

      const observations = [];
      let wroteHtml = false;
      for (const act of actions) {
        const res = await applySingleOcAction(assistantId, act);
        if (act.type === 'write_file' && act.path.endsWith('.html')) {
          wroteHtml = true;
          setPreviewEntry(act.path);
        }
        if (res?.kind === 'observation') {
          observations.push(res.summary);
        }
      }

      if (wroteHtml) {
        setActiveTabPath('__preview__');
        setPreviewNonce((n) => n + 1);
      }

      // Continue autonomous loop ONLY if the model read a file or ran a command and needs to inspect results
      if (observations.length > 0 && step < MAX_AGENT_STEPS - 1) {
        history = [
          ...history,
          {
            id: `obs_${crypto.randomUUID()}`,
            role: 'user',
            content: `Tool execution results:\n${observations.join('\n\n')}\nContinue if further changes are needed, or summarize briefly if complete.`,
            hiddenLabel: 'Fed file / command output to Claude',
          },
        ];
        setVibeMessages([...history]);
      } else {
        break;
      }
    }

    setVibeStreaming(false);
    vibeAbortRef.current = null;
  };

  const handleUndo = async () => {
    try {
      const res = await apiRequest('/api/workspace/undo', { method: 'POST' });
      await loadWorkspaceTree(false);
      // Reload any open tab matching reverted file
      for (const t of tabs) {
        await openFileInTab(t.path).catch(() => {});
      }
      setPreviewNonce((n) => n + 1);
      setTerminalLogs((prev) => [
        ...prev,
        { kind: 'exit-ok', text: `↺ Reverted: ${res.reverted}\n` },
      ]);
    } catch (err) {
      alert(err.message);
    }
  };

  const effectivePreviewSrc = customPreviewUrl.trim()
    ? customPreviewUrl.trim()
    : `/api/workspace/preview/${previewEntry}?t=${previewNonce}`;

  return (
    <div className="flex-1 h-full min-w-0 flex overflow-hidden">
      {/* 1. LEFT PANE: PC WORKSPACE EXPLORER */}
      <div
        className="w-60 h-full border-r flex flex-col shrink-0 select-none"
        style={{
          backgroundColor: 'var(--bg-surface-2)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="p-3 border-b space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
              PC Workspace
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={async () => {
                  const res = await apiRequest('/api/workspace/pick-folder', { method: 'POST' });
                  if (!res.cancelled) {
                    setWorkspace(res);
                    setRootPathInput(res.root);
                    setTabs([]);
                    setActiveTabPath('');
                  }
                }}
                title="Browse & open any folder on your PC"
                className="px-2 py-1 rounded-lg bg-[#D97757] text-white text-[11px] font-medium hover:opacity-90 cursor-pointer flex items-center gap-1"
              >
                <FolderOpen size={11} />
                <span>Browse PC</span>
              </button>
              <button
                type="button"
                onClick={() => setNewEntryModal('project')}
                title="Scaffold new project folder"
                className="p-1 rounded-lg border hover:bg-black/5 cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {editingRootPath ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  const res = await apiRequest('/api/workspace/set-root', {
                    method: 'POST',
                    body: { rootPath: rootPathInput },
                  });
                  setWorkspace(res);
                  setTabs([]);
                  setEditingRootPath(false);
                } catch (err) {
                  alert(err.message);
                }
              }}
              className="flex gap-1"
            >
              <input
                value={rootPathInput}
                onChange={(e) => setRootPathInput(e.target.value)}
                autoFocus
                onBlur={() => setEditingRootPath(false)}
                className="flex-1 min-w-0 px-2 py-1 rounded-lg border text-[11px] font-mono"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
              />
            </form>
          ) : (
            <div
              onClick={() => setEditingRootPath(true)}
              title={`${workspace.root}\nClick to type a custom PC directory path`}
              className="px-2 py-1.5 rounded-lg border text-[11px] font-mono truncate cursor-pointer hover:border-[#D97757]/60"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {workspace.root || 'Loading...'}
            </div>
          )}

          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setNewEntryName('');
                  setNewEntryModal('file');
                }}
                title="New file"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <FilePlus size={13.5} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewEntryName('');
                  setNewEntryModal('folder');
                }}
                title="New folder"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <FolderPlus size={13.5} />
              </button>
              <button
                type="button"
                onClick={() => loadWorkspaceTree(false)}
                title="Refresh files on disk"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <RefreshCw size={13} />
              </button>
              <button
                type="button"
                onClick={() => apiRequest('/api/workspace/open-explorer', { method: 'POST' })}
                title="Reveal in Windows Explorer"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                <ExternalLink size={13} />
              </button>
            </div>

            {workspace.undoStack?.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                title={`Undo: ${workspace.undoStack[0]?.actionLabel}`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-[#D97757] hover:bg-[#D97757]/10 cursor-pointer"
              >
                <Undo2 size={12} />
                <span>Undo</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {workspace.tree?.length === 0 ? (
            <div className="p-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Empty folder. Create a file or ask Claude on the right to build an app!
            </div>
          ) : (
            workspace.tree.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                activePath={activeTabPath}
                onOpenFile={openFileInTab}
                onDeleteEntry={async (p) => {
                  await apiRequest('/api/workspace/file', { method: 'DELETE', body: { path: p } });
                  setTabs((prev) => prev.filter((t) => t.path !== p));
                  loadWorkspaceTree(false);
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* 2. CENTER PANE: MULTI-TAB CODE EDITOR + LIVE PREVIEW + PC TERMINAL */}
      <div className="flex-1 min-w-0 h-full flex flex-col border-r" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* Top Editor & Preview Tabs */}
        <div
          className="h-11 px-2 border-b flex items-center justify-between gap-2 overflow-x-auto shrink-0"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
            {tabs.map((t) => {
              const dirty = t.content !== t.savedContent;
              const active = activeTabPath === t.path;
              return (
                <div
                  key={t.path}
                  onClick={() => setActiveTabPath(t.path)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer shrink-0 border transition"
                  style={{
                    backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                    borderColor: active ? 'var(--border-subtle)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <Code2 size={12} className="text-[#D97757]" />
                  <span className="max-w-[140px] truncate">{t.path.split('/').pop()}</span>
                  {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[#D97757]" />}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = tabs.filter((x) => x.path !== t.path);
                      setTabs(next);
                      if (activeTabPath === t.path) {
                        setActiveTabPath(next[next.length - 1]?.path || '__preview__');
                      }
                    }}
                    className="opacity-50 hover:opacity-100 p-0.5 cursor-pointer"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setActiveTabPath('__preview__')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 border"
              style={{
                backgroundColor: activeTabPath === '__preview__' ? 'var(--accent-claude)' : 'transparent',
                borderColor: activeTabPath === '__preview__' ? 'var(--accent-claude)' : 'transparent',
                color: activeTabPath === '__preview__' ? '#FFF' : 'var(--text-secondary)',
              }}
            >
              <Eye size={13} />
              <span>Live Preview</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeTab && (
              <>
                <button
                  type="button"
                  onClick={() => saveTab(activeTab.path)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium hover:bg-black/5 cursor-pointer"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <Save size={12} />
                  <span>Save</span>
                </button>
                {(activeTab.runCommand || activeTab.path.endsWith('.html')) && (
                  <button
                    type="button"
                    onClick={handleRunActiveFile}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:opacity-90 cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" />
                    <span>{activeTab.path.endsWith('.html') ? 'Preview' : 'Run File'}</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setTerminalOpen(!terminalOpen)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                terminalOpen ? 'border-[#D97757] text-[#D97757]' : ''
              }`}
              style={{ borderColor: terminalOpen ? '#D97757' : 'var(--border-subtle)' }}
            >
              <Terminal size={12} />
              <span>Terminal</span>
            </button>
          </div>
        </div>

        {/* Main Editor or Live Preview Canvas */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTabPath === '__preview__' ? (
            <div className="flex-1 flex flex-col bg-white">
              <div
                className="flex items-center gap-2 px-3 py-1.5 border-b text-xs"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <span className="font-medium shrink-0" style={{ color: 'var(--text-muted)' }}>Preview target:</span>
                <input
                  value={customPreviewUrl || previewEntry}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^https?:\/\//i.test(v)) setCustomPreviewUrl(v);
                    else {
                      setCustomPreviewUrl('');
                      setPreviewEntry(v);
                    }
                  }}
                  placeholder="index.html or http://localhost:5173"
                  className="flex-1 px-2.5 py-1 rounded-lg border font-mono text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                />
                <button
                  type="button"
                  onClick={() => setPreviewNonce((n) => n + 1)}
                  className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                  title="Reload preview"
                >
                  <RotateCcw size={13} />
                </button>
                <a
                  href={effectivePreviewSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-black/5"
                  title="Open in browser tab"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
              <iframe
                key={`${effectivePreviewSrc}_${previewNonce}`}
                src={effectivePreviewSrc}
                title="Local Workspace Preview"
                className="flex-1 w-full border-0 bg-white"
              />
            </div>
          ) : activeTab ? (
            <div className="flex-1 min-h-0 flex overflow-hidden" style={{ backgroundColor: '#181715' }}>
              <div
                className="py-4 px-3 text-right font-mono text-[12px] leading-[1.6] select-none overflow-hidden shrink-0"
                style={{ color: '#6E6B62', backgroundColor: '#141312' }}
              >
                {activeTab.content.split('\n').map((_, idx) => (
                  <div key={idx}>{idx + 1}</div>
                ))}
              </div>
              <textarea
                value={activeTab.content}
                onChange={(e) => {
                  const val = e.target.value;
                  setTabs((prev) =>
                    prev.map((t) => (t.path === activeTab.path ? { ...t, content: val } : t))
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = e.target.selectionStart;
                    const end = e.target.selectionEnd;
                    const updated =
                      activeTab.content.substring(0, start) + '  ' + activeTab.content.substring(end);
                    setTabs((prev) =>
                      prev.map((t) => (t.path === activeTab.path ? { ...t, content: updated } : t))
                    );
                    requestAnimationFrame(() => {
                      e.target.selectionStart = e.target.selectionEnd = start + 2;
                    });
                  }
                }}
                spellCheck={false}
                className="flex-1 p-4 bg-transparent text-[#F2F0E8] font-mono text-[13px] leading-[1.6] resize-none focus:outline-none overflow-auto"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <ClaudeStarburst size={32} />
              <h3 className="text-xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                OpenClaude Vibe Coding Studio
              </h3>
              <p className="text-xs max-w-md leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Select a file on the left, scaffold a new app, or describe what you want to build in the Vibe Agent pane on the right—Claude will create, edit, and run files directly on your PC.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Integrated Streaming PC Terminal */}
        {terminalOpen && (
          <div
            className="h-52 border-t flex flex-col shrink-0"
            style={{ backgroundColor: '#131211', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-[11px] text-[#A8A59C]">
              <div className="flex items-center gap-2">
                <Terminal size={12} className="text-[#D97757]" />
                <span className="font-mono truncate max-w-xs">{workspace.root}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {lastFailedOutput && (
                  <button
                    type="button"
                    onClick={() =>
                      sendVibePrompt(
                        `Command \`${lastFailedOutput.command}\` failed with exit code ${lastFailedOutput.exitCode}:\n\`\`\`\n${lastFailedOutput.output}\n\`\`\`\nPlease inspect the relevant files, fix the root cause on disk, and verify.`
                      )
                    }
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#D97757] text-white font-medium cursor-pointer"
                  >
                    <Wrench size={11} />
                    <span>Fix Error with Claude</span>
                  </button>
                )}
                {isExecRunning && (
                  <button
                    type="button"
                    onClick={() => execAbortRef.current?.abort()}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-white cursor-pointer"
                  >
                    <Square size={10} fill="currentColor" />
                    <span>Kill</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTerminalLogs([])}
                  className="px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>

            <div
              ref={termScrollRef}
              className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap"
            >
              {terminalLogs.map((l, i) => (
                <span
                  key={i}
                  className={
                    l.kind === 'cmd'
                      ? 'text-[#F2B880] font-semibold'
                      : l.kind === 'stderr' || l.kind === 'exit-err'
                      ? 'text-red-400'
                      : l.kind === 'exit-ok'
                      ? 'text-emerald-400'
                      : 'text-[#E6E4DC]'
                  }
                >
                  {l.text}
                </span>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!terminalCmd.trim()) return;
                const c = terminalCmd;
                setTerminalCmd('');
                runCommandOnPc(c);
              }}
              className="flex items-center gap-2 px-3 py-1.5 border-t border-white/10 bg-[#1B1A18]"
            >
              <span className="text-xs font-mono text-[#D97757] font-bold">❯</span>
              <input
                value={terminalCmd}
                onChange={(e) => setTerminalCmd(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp' && cmdHistory.length > 0) {
                    e.preventDefault();
                    const next = Math.min(historyIdx + 1, cmdHistory.length - 1);
                    setHistoryIdx(next);
                    setTerminalCmd(cmdHistory[next]);
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = historyIdx - 1;
                    setHistoryIdx(next);
                    setTerminalCmd(next >= 0 ? cmdHistory[next] : '');
                  }
                }}
                placeholder="Run any command on PC (node, python, npm, git, dir)..."
                className="flex-1 bg-transparent text-xs font-mono text-[#F2F0E8] focus:outline-none"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded bg-[#D97757] text-white text-[11px] font-medium cursor-pointer"
              >
                Run
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 3. RIGHT PANE: AUTONOMOUS CLAUDE VIBE CODING COPILOT */}
      <div
        className="w-[370px] xl:w-[410px] h-full flex flex-col shrink-0"
        style={{ backgroundColor: 'var(--bg-canvas)' }}
      >
        <div
          className="px-4 py-2.5 border-b flex items-center justify-between gap-2 shrink-0"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <ClaudeStarburst size={19} animated={vibeStreaming} />
            <div>
              <div className="text-xs font-semibold">Vibe Coding Agent</div>
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Reads, writes & runs files on your PC
              </div>
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="accent-[#D97757] cursor-pointer"
            />
            <span>Auto-apply</span>
          </label>
        </div>

        {/* Agent Conversation Feed */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {vibeMessages.length === 0 ? (
            <div className="space-y-3 pt-4">
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Describe an app, feature, script, or bugfix. Claude will directly create and edit files inside{' '}
                <code className="text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                  {workspace.name}
                </code>{' '}
                and update the Live Preview.
              </p>
              <div className="space-y-1.5">
                {[
                  'Create a complete playable Neon Synthwave Brick Breaker game in index.html, style.css, and game.js.',
                  'Build a clean Python CLI task tracker in task_cli.py and run it to test.',
                  'Create a Three.js interactive 3D terrain generator in index.html with sliders for elevation and wireframe.',
                ].map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendVibePrompt(starter)}
                    className="w-full text-left p-2.5 rounded-xl border text-xs hover:border-[#D97757]/60 transition cursor-pointer"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            vibeMessages.map((m) => {
              if (m.hiddenLabel) {
                return (
                  <div
                    key={m.id}
                    className="text-[11px] px-3 py-1.5 rounded-xl border flex items-center gap-1.5"
                    style={{
                      backgroundColor: 'var(--bg-surface-2)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                    <span>{m.hiddenLabel}</span>
                  </div>
                );
              }

              if (m.role === 'user') {
                return (
                  <div
                    key={m.id}
                    className="ml-6 rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap"
                    style={{ backgroundColor: 'var(--bg-user-bubble)' }}
                  >
                    {m.content}
                  </div>
                );
              }

              const { parts } = parseVibeResponse(m.content, vibeStreaming);
              return (
                <div key={m.id} className="space-y-2 text-xs">
                  {parts.map((p, i) => {
                    if (p.kind === 'action') {
                      const act = p.action;
                      const st = actionStatuses[`${m.id}_${act.index}`];
                      return (
                        <div
                          key={i}
                          className="rounded-xl border p-2.5 space-y-1.5"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: 'var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono font-semibold text-[11px] truncate text-[#D97757]">
                              {act.type}: {act.path || act.body.slice(0, 36)}
                            </span>
                            {st?.status === 'done' ? (
                              <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 shrink-0">
                                <CheckCircle2 size={11} /> {st.detail}
                              </span>
                            ) : st?.status === 'error' ? (
                              <span className="text-[10px] text-red-500 font-medium flex items-center gap-1 shrink-0">
                                <AlertTriangle size={11} /> Failed
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => applySingleOcAction(m.id, act)}
                                className="px-2 py-0.5 rounded bg-[#D97757] text-white text-[10px] font-medium cursor-pointer"
                              >
                                Apply
                              </button>
                            )}
                          </div>
                          {act.path && act.type !== 'run_command' && (
                            <button
                              type="button"
                              onClick={() => openFileInTab(act.path)}
                              className="text-[11px] underline opacity-75 hover:opacity-100 cursor-pointer"
                            >
                              Open in editor →
                            </button>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="text-xs">
                        <MarkdownRenderer content={p.text} />
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Vibe Agent Input Box */}
        <div className="p-3 border-t space-y-2 shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div
            className="rounded-2xl border p-2.5"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
          >
            <textarea
              rows={2}
              value={vibePrompt}
              onChange={(e) => setVibePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendVibePrompt();
                }
              }}
              placeholder="Ask Claude to create, edit, or run files on your PC..."
              className="w-full bg-transparent text-xs leading-relaxed resize-none focus:outline-none"
            />
            <div className="flex items-center justify-between pt-1.5">
              <select
                value={`${selectedBackend}::${selectedModel}`}
                onChange={(e) => {
                  const [b, ...rest] = e.target.value.split('::');
                  onSelectModel?.(b, rest.join('::'));
                }}
                className="text-[11px] px-2 py-1 rounded-lg border max-w-[220px] truncate cursor-pointer"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
              >
                <optgroup label="Local Ollama">
                  {(modelsData?.ollama?.models || []).map((m) => (
                    <option key={`ol_${m.id}`} value={`ollama::${m.id}`}>
                      Ollama: {m.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="9Router Gateway">
                  {(modelsData?.nineRouter?.models || []).slice(0, 60).map((m) => (
                    <option key={`9r_${m.id}`} value={`9router::${m.id}`}>
                      9Router: {m.id}
                    </option>
                  ))}
                </optgroup>
              </select>

              {vibeStreaming ? (
                <button
                  type="button"
                  onClick={() => vibeAbortRef.current?.abort()}
                  className="w-7 h-7 rounded-xl bg-[#141413] dark:bg-[#F2F0E8] text-white dark:text-[#141413] flex items-center justify-center cursor-pointer"
                >
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!vibePrompt.trim()}
                  onClick={() => sendVibePrompt()}
                  className="w-7 h-7 rounded-xl bg-[#D97757] text-white flex items-center justify-center disabled:opacity-35 cursor-pointer"
                >
                  <ArrowUp size={15} />
                </button>
              )}
            </div>
          </div>

          {vibeMessages.length > 0 && (
            <button
              type="button"
              onClick={() => setVibeMessages([])}
              className="text-[11px] hover:underline cursor-pointer"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear agent session
            </button>
          )}
        </div>
      </div>

      {/* Modal for New File / New Folder / Scaffold Project */}
      {newEntryModal && (
        <div
          onClick={() => setNewEntryModal(null)}
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newEntryName.trim()) return;
              if (newEntryModal === 'file') {
                await apiRequest('/api/workspace/file', {
                  method: 'POST',
                  body: { path: newEntryName.trim(), content: '' },
                });
                await loadWorkspaceTree(false);
                await openFileInTab(newEntryName.trim());
              } else if (newEntryModal === 'folder') {
                await apiRequest('/api/workspace/mkdir', {
                  method: 'POST',
                  body: { path: newEntryName.trim() },
                });
                await loadWorkspaceTree(false);
              } else if (newEntryModal === 'project') {
                const res = await apiRequest('/api/workspace/new-project', {
                  method: 'POST',
                  body: { name: newEntryName.trim(), template: newProjectTemplate },
                });
                setWorkspace(res);
                setRootPathInput(res.root);
                setTabs([]);
                await loadWorkspaceTree(true);
              }
              setNewEntryName('');
              setNewEntryModal(null);
            }}
            className="w-full max-w-sm rounded-2xl border p-5 space-y-4"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <h3 className="font-semibold text-sm">
              {newEntryModal === 'file'
                ? 'Create New File on PC'
                : newEntryModal === 'folder'
                ? 'Create New Folder on PC'
                : 'Scaffold New Vibe Project'}
            </h3>
            <input
              value={newEntryName}
              onChange={(e) => setNewEntryName(e.target.value)}
              placeholder={
                newEntryModal === 'file'
                  ? 'e.g., src/game.js or script.py'
                  : newEntryModal === 'folder'
                  ? 'e.g., src/components'
                  : 'e.g., synthwave-racer'
              }
              autoFocus
              className="w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
            />
            {newEntryModal === 'project' && (
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {[
                  { id: 'web', label: 'HTML/JS/CSS' },
                  { id: 'node', label: 'Node.js' },
                  { id: 'python', label: 'Python' },
                ].map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setNewProjectTemplate(tpl.id)}
                    className={`py-1.5 rounded-lg border font-medium cursor-pointer ${
                      newProjectTemplate === tpl.id ? 'border-[#D97757] text-[#D97757]' : ''
                    }`}
                    style={{ borderColor: newProjectTemplate === tpl.id ? '#D97757' : 'var(--border-subtle)' }}
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewEntryModal(null)}
                className="px-3 py-1.5 rounded-xl border text-xs cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
