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
  FilePen,
  FileSearch,
  FileX,
  Brain,
  Loader2,
} from 'lucide-react';
import { ClaudeStarburst, NineRouterBadgeIcon, OllamaIcon } from './ClaudeIcons.jsx';
import MarkdownRenderer from './MarkdownRenderer.jsx';
import { apiRequest, consumeSSE } from '../lib/api.js';
import { parseVibeResponse } from '../lib/vibeParser.js';

const ACTION_META = {
  write_file: { label: 'Write', Icon: FilePlus },
  edit_file: { label: 'Edit', Icon: FilePen },
  read_file: { label: 'Read', Icon: FileSearch },
  delete_file: { label: 'Delete', Icon: FileX },
  run_command: { label: 'Bash', Icon: Terminal },
};

function ActionCard({ act, status, onApply, onOpen }) {
  const meta = ACTION_META[act.type] || { label: act.type, Icon: Wrench };
  const { Icon } = meta;
  const subject = act.type === 'run_command' ? act.body.trim().split('\n')[0] : act.path;
  const state = status?.status;
  const lines = (act.body || '').split('\n');
  const hasDetails = act.type === 'write_file' || act.type === 'edit_file' || (act.type === 'run_command' && lines.length > 1);

  return (
    <details
      className="group/tool rounded-xl border overflow-hidden"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <summary
        className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform group-open/tool:rotate-90 ${hasDetails ? '' : 'opacity-0'}`}
          style={{ color: 'var(--text-muted)' }}
        />
        <Icon size={13} className="shrink-0 text-[#D97757]" />
        <span className="text-[12px] font-semibold shrink-0">{meta.label}</span>
        <span
          onClick={(e) => {
            if (act.path && act.type !== 'run_command' && act.type !== 'delete_file') {
              e.preventDefault();
              onOpen();
            }
          }}
          className={`text-[12px] font-mono truncate min-w-0 flex-1 ${
            act.path && act.type !== 'run_command' && act.type !== 'delete_file' ? 'hover:underline hover:text-[#D97757]' : ''
          }`}
          style={{ color: 'var(--text-secondary)' }}
          title={act.path ? `Open ${act.path} in editor` : subject}
        >
          {subject}
        </span>
        {state === 'done' ? (
          <span className="text-[11px] text-emerald-600 flex items-center gap-1 shrink-0">
            <CheckCircle2 size={12} /> {status.detail}
          </span>
        ) : state === 'error' ? (
          <span className="text-[11px] text-red-500 flex items-center gap-1 shrink-0" title={status.detail}>
            <AlertTriangle size={12} /> Failed
          </span>
        ) : state === 'running' ? (
          <Loader2 size={13} className="animate-spin shrink-0 text-[#D97757]" />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onApply();
            }}
            className="px-2 py-0.5 rounded-md bg-[#D97757] text-white text-[11px] font-medium cursor-pointer shrink-0"
          >
            Apply
          </button>
        )}
      </summary>
      {hasDetails && (
        <div className="border-t text-[11.5px] font-mono max-h-56 overflow-auto" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}>
          {act.type === 'edit_file' ? (
            <>
              {(act.search || '').split('\n').map((l, i) => (
                <div key={`s${i}`} className="px-3 whitespace-pre-wrap break-all bg-red-500/10 text-red-600 dark:text-red-400">- {l}</div>
              ))}
              {(act.replace || '').split('\n').map((l, i) => (
                <div key={`r${i}`} className="px-3 whitespace-pre-wrap break-all bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">+ {l}</div>
              ))}
            </>
          ) : (
            <pre className="px-3 py-2 whitespace-pre-wrap break-all" style={{ color: 'var(--text-secondary)' }}>
              {lines.slice(0, 60).join('\n')}
              {lines.length > 60 ? `\n… ${lines.length - 60} more lines` : ''}
            </pre>
          )}
        </div>
      )}
      {act.path && act.type !== 'run_command' && act.type !== 'delete_file' && (
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left px-3 py-1.5 border-t text-[11px] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
        >
          {state === 'done' && act.type !== 'read_file' ? 'View changes in editor' : 'Open in editor'}
        </button>
      )}
    </details>
  );
}

function ThinkingBlock({ text, streaming }) {
  if (!text) return null;
  return (
    <details className="group/think text-[12px]" style={{ color: 'var(--text-muted)' }}>
      <summary className="flex items-center gap-1.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <Brain size={13} className={streaming ? 'animate-pulse' : ''} />
        <span>{streaming ? 'Thinking…' : 'Thought process'}</span>
        <ChevronRight size={11} className="transition-transform group-open/think:rotate-90" />
      </summary>
      <div className="mt-1.5 pl-3 border-l whitespace-pre-wrap leading-relaxed max-h-48 overflow-auto" style={{ borderColor: 'var(--border-strong)' }}>
        {text}
      </div>
    </details>
  );
}

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
  const [fileChanges, setFileChanges] = useState({}); // path -> { type, search, replace, lines }
  const [dismissedChange, setDismissedChange] = useState('');
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
        setFileChanges((prev) => ({ ...prev, [res.path]: { type: 'write', created: !!res.created, lines: res.lines } }));
        setDismissedChange('');
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
        setFileChanges((prev) => ({ ...prev, [res.path]: { type: 'edit', search: action.search, replace: action.replace } }));
        setDismissedChange('');
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
        className="w-56 h-full border-l order-3 flex flex-col shrink-0 select-none"
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
      <div className="flex-1 min-w-0 h-full flex flex-col order-2">
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
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ backgroundColor: '#181715' }}>
              {fileChanges[activeTab.path] && dismissedChange !== activeTab.path && (
                <div className="shrink-0 border-b border-white/10 bg-[#1B1A18] text-[12px] font-mono max-h-44 overflow-auto">
                  <div className="flex items-center justify-between px-3 py-1.5 text-[11px] text-[#A8A59C] font-sans sticky top-0 bg-[#1B1A18]">
                    <span className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-[#D97757]" />
                      {fileChanges[activeTab.path].type === 'write'
                        ? `Claude ${fileChanges[activeTab.path].created ? 'created' : 'rewrote'} this file (${fileChanges[activeTab.path].lines} lines)`
                        : "Claude's last edit"}
                    </span>
                    <button type="button" onClick={() => setDismissedChange(activeTab.path)} className="hover:text-white cursor-pointer">
                      <X size={12} />
                    </button>
                  </div>
                  {fileChanges[activeTab.path].type === 'edit' && (
                    <>
                      {(fileChanges[activeTab.path].search || '').split('\n').map((l, i) => (
                        <div key={`s${i}`} className="px-3 whitespace-pre-wrap break-all bg-red-500/15 text-red-300">- {l}</div>
                      ))}
                      {(fileChanges[activeTab.path].replace || '').split('\n').map((l, i) => (
                        <div key={`r${i}`} className="px-3 whitespace-pre-wrap break-all bg-emerald-500/15 text-emerald-300">+ {l}</div>
                      ))}
                    </>
                  )}
                </div>
              )}
              <div className="flex-1 min-h-0 flex overflow-hidden">
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

      {/* 1. CHAT PANE (Claude Code style): conversation on the left, workspace on the right */}
      <div
        className="order-1 w-[420px] xl:w-[480px] h-full flex flex-col shrink-0 border-r"
        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
      >
        <div className="px-4 h-11 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ClaudeStarburst size={17} animated={vibeStreaming} />
            <span className="text-[13px] font-medium truncate">{workspace.name || 'workspace'}</span>
          </div>
          <div className="flex items-center gap-1">
            {vibeMessages.length > 0 && (
              <button
                type="button"
                onClick={() => setVibeMessages([])}
                title="Start a new session"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <Plus size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Agent Conversation Feed */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
          {vibeMessages.length === 0 ? (
            <div className="h-full flex flex-col justify-center space-y-5 pb-10">
              <div className="space-y-2">
                <ClaudeStarburst size={30} />
                <h3 className="text-[22px] font-normal leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  What should we build in <span className="text-[#D97757]">{workspace.name}</span>?
                </h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Claude reads, edits and runs files directly on your PC and updates the preview as it goes.
                </p>
              </div>
              <div className="space-y-1">
                {[
                  'Create a complete playable Neon Synthwave Brick Breaker game in index.html, style.css, and game.js.',
                  'Build a clean Python CLI task tracker in task_cli.py and run it to test.',
                  'Create a Three.js interactive 3D terrain generator in index.html with sliders for elevation and wireframe.',
                ].map((starter, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendVibePrompt(starter)}
                    className="w-full text-left px-3 py-2 rounded-xl text-[12.5px] leading-snug hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                    style={{ color: 'var(--text-secondary)' }}
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
                    className="text-[11.5px] flex items-center gap-1.5 -my-2"
                    style={{ color: 'var(--text-muted)' }}
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
                    className="ml-8 rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ backgroundColor: 'var(--bg-user-bubble)' }}
                  >
                    {m.content}
                  </div>
                );
              }

              const { parts } = parseVibeResponse(m.content, vibeStreaming);
              const isLast = m.id === vibeMessages[vibeMessages.length - 1]?.id;
              return (
                <div key={m.id} className="space-y-2.5 text-[13px]">
                  <ThinkingBlock text={m.thinking} streaming={vibeStreaming && isLast && !m.content} />
                  {parts.map((p, i) => {
                    if (p.kind === 'action') {
                      const act = p.action;
                      return (
                        <ActionCard
                          key={i}
                          act={act}
                          status={actionStatuses[`${m.id}_${act.index}`]}
                          onApply={() => applySingleOcAction(m.id, act)}
                          onOpen={() => openFileInTab(act.path)}
                        />
                      );
                    }
                    return p.text?.trim() ? (
                      <div key={i} className="text-[13px] leading-relaxed">
                        <MarkdownRenderer content={p.text} />
                      </div>
                    ) : null;
                  })}
                  {vibeStreaming && isLast && !m.content && !m.thinking && (
                    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                      <ClaudeStarburst size={14} animated />
                      <span>Working…</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Vibe Agent Input Box */}
        <div className="px-3 pb-3 pt-1 shrink-0">
          <div
            className="rounded-2xl border p-3 shadow-sm focus-within:border-[#D97757]/60 transition"
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
              placeholder="Reply to Claude…"
              className="w-full bg-transparent text-[13px] leading-relaxed resize-none focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 pt-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setAutoApply(!autoApply)}
                  title={autoApply ? 'Claude applies file edits and commands automatically' : 'You approve each action manually'}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium cursor-pointer shrink-0 transition"
                  style={{
                    color: autoApply ? '#D97757' : 'var(--text-secondary)',
                    backgroundColor: autoApply ? 'var(--accent-claude-soft)' : 'transparent',
                  }}
                >
                  <Sparkles size={12} />
                  <span>{autoApply ? 'Auto-accept edits' : 'Ask before edits'}</span>
                </button>
                <select
                  value={`${selectedBackend}::${selectedModel}`}
                  onChange={(e) => {
                    const [b, ...rest] = e.target.value.split('::');
                    onSelectModel?.(b, rest.join('::'));
                  }}
                  className="text-[11px] px-1.5 py-1 rounded-lg bg-transparent max-w-[160px] truncate cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none"
                  style={{ color: 'var(--text-secondary)' }}
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
              </div>

              {vibeStreaming ? (
                <button
                  type="button"
                  onClick={() => vibeAbortRef.current?.abort()}
                  title="Stop"
                  className="w-8 h-8 rounded-lg bg-[#141413] dark:bg-[#F2F0E8] text-white dark:text-[#141413] flex items-center justify-center cursor-pointer shrink-0"
                >
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!vibePrompt.trim()}
                  onClick={() => sendVibePrompt()}
                  title="Send"
                  className="w-8 h-8 rounded-lg bg-[#D97757] text-white flex items-center justify-center disabled:opacity-35 cursor-pointer shrink-0"
                >
                  <ArrowUp size={16} />
                </button>
              )}
            </div>
          </div>
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
