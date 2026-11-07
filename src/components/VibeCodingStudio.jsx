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
  FileText,
  Folder,
  AlertTriangle,
  ArrowUp,
  Undo2,
  Wrench,
  X,
  Plus,
  Pencil,
  Check,
  Loader2,
  Brain,
  Shield,
  Zap,
} from 'lucide-react';
import { ClaudeStarburst } from './ClaudeIcons.jsx';
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

const TOOL_META = {
  write_file: { icon: FilePlus, verb: 'Created' },
  edit_file: { icon: Pencil, verb: 'Edited' },
  read_file: { icon: FileText, verb: 'Read' },
  delete_file: { icon: Trash2, verb: 'Deleted' },
  run_command: { icon: Terminal, verb: 'Ran' },
};

const MAX_DIFF_LINES = 160;

function DiffLines({ lines, sign }) {
  const shown = lines.slice(0, MAX_DIFF_LINES);
  const isAdd = sign === '+';
  return (
    <>
      {shown.map((line, i) => (
        <div
          key={`${sign}${i}`}
          className="flex whitespace-pre-wrap break-all"
          style={{
            backgroundColor: isAdd ? 'rgba(68, 179, 122, 0.13)' : 'rgba(229, 90, 81, 0.13)',
          }}
        >
          <span
            className="w-5 shrink-0 text-center select-none"
            style={{ color: isAdd ? 'var(--accent-green)' : 'var(--accent-danger)' }}
          >
            {sign}
          </span>
          <span className="flex-1 pr-2">{line || ' '}</span>
        </div>
      ))}
      {lines.length > MAX_DIFF_LINES && (
        <div className="px-5 py-1 italic" style={{ color: 'var(--text-muted)' }}>
          … {lines.length - MAX_DIFF_LINES} more lines
        </div>
      )}
    </>
  );
}

// One compact, collapsible tool-call row — the way Claude Code lists Edit / Write / Read / Bash steps.
function ToolRow({ action, status, autoApply, streaming, onApply, onOpenFile }) {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[action.type] || TOOL_META.write_file;
  const Icon = meta.icon;
  const state = status?.status;
  const awaiting = !state && !autoApply && action.complete;
  const writing = !state && !action.complete && streaming;

  const addLines = action.type === 'write_file' ? (action.body || '').split('\n') : [];
  const searchLines = action.type === 'edit_file' && action.search ? action.search.split('\n') : [];
  const replaceLines = action.type === 'edit_file' && action.replace ? action.replace.split('\n') : [];

  let stat = null;
  if (action.type === 'write_file' && action.body) stat = { add: addLines.length };
  else if (action.type === 'edit_file') stat = { add: replaceLines.length, del: searchLines.length };

  const isCommand = action.type === 'run_command';
  const label = isCommand ? (action.body || '').trim().split('\n')[0] : action.path;
  const expandable = isCommand || addLines.length > 0 || searchLines.length > 0 || replaceLines.length > 0;
  const verb = writing ? (action.type === 'run_command' ? 'Running' : 'Writing') : meta.verb;

  return (
    <div
      className="rounded-xl border overflow-hidden text-[13px]"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
    >
      <div
        onClick={() => expandable && setOpen(!open)}
        className={`flex items-center gap-2 px-3 py-2 ${expandable ? 'cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.03]' : ''}`}
      >
        <Icon size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <span className="font-medium shrink-0" style={{ color: 'var(--text-secondary)' }}>
          {verb}
        </span>
        <span
          onClick={(e) => {
            if (!isCommand && action.path && action.type !== 'delete_file') {
              e.stopPropagation();
              onOpenFile(action.path);
            }
          }}
          className={`font-mono text-[12px] truncate min-w-0 ${
            !isCommand && action.type !== 'delete_file' ? 'hover:underline cursor-pointer' : ''
          }`}
          style={{ color: 'var(--text-primary)' }}
        >
          {label || '…'}
        </span>

        <span className="ml-auto flex items-center gap-2.5 shrink-0">
          {stat && (
            <span className="font-mono text-[11px] flex items-center gap-1.5">
              {stat.add > 0 && <span style={{ color: 'var(--accent-green)' }}>+{stat.add}</span>}
              {stat.del > 0 && <span style={{ color: 'var(--accent-danger)' }}>−{stat.del}</span>}
            </span>
          )}
          {state === 'running' || writing ? (
            <Loader2 size={13} className="animate-spin" style={{ color: 'var(--accent-claude)' }} />
          ) : state === 'done' ? (
            <Check size={14} style={{ color: 'var(--accent-green)' }} />
          ) : state === 'error' ? (
            <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--accent-danger)' }}>
              <AlertTriangle size={12} /> {status.detail || 'Failed'}
            </span>
          ) : awaiting ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApply();
              }}
              className="px-2.5 py-0.5 rounded-lg text-[11px] font-medium text-white cursor-pointer hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-claude)' }}
            >
              {isCommand ? 'Run' : 'Allow'}
            </button>
          ) : null}
          {expandable && (
            <ChevronDown
              size={13}
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
              style={{ color: 'var(--text-muted)' }}
            />
          )}
        </span>
      </div>

      {open && expandable && (
        <div
          className="border-t font-mono text-[11.5px] leading-[1.55] max-h-72 overflow-auto"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-code)', color: '#E6E4DC' }}
        >
          {isCommand ? (
            <div className="px-3 py-2 whitespace-pre-wrap break-all">
              <div style={{ color: '#F2B880' }}>$ {(action.body || '').trim()}</div>
              {status?.output && <div className="mt-1.5 opacity-80">{status.output}</div>}
            </div>
          ) : (
            <div className="py-1.5">
              {action.type === 'write_file' && <DiffLines lines={addLines} sign="+" />}
              {action.type === 'edit_file' && (
                <>
                  <DiffLines lines={searchLines} sign="-" />
                  <DiffLines lines={replaceLines} sign="+" />
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThinkingBlock({ text, live }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-[13px]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 cursor-pointer hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        <Brain size={13} />
        <span>{live ? 'Thinking…' : 'Thought process'}</span>
        <ChevronRight size={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div
          className="mt-1.5 ml-1.5 pl-3 border-l-2 whitespace-pre-wrap text-[12.5px] leading-relaxed max-h-60 overflow-y-auto"
          style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)' }}
        >
          {text}
        </div>
      )}
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
  const [activeTabPath, setActiveTabPath] = useState('');
  // Right-hand workspace panel (Claude Code style): files | code | preview | terminal
  const [rightOpen, setRightOpen] = useState(false);
  const [rightTab, setRightTab] = useState('files');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const gutterRef = useRef(null);

  const showPanel = (tab) => {
    setRightTab(tab);
    setRightOpen(true);
  };
  const [previewEntry, setPreviewEntry] = useState('index.html');
  const [customPreviewUrl, setCustomPreviewUrl] = useState('');
  const [previewNonce, setPreviewNonce] = useState(0);

  // New File / New Project modals
  const [newEntryModal, setNewEntryModal] = useState(null); // 'file' | 'folder' | 'project'
  const [newEntryName, setNewEntryName] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState('web');

  // Terminal State
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

  const openFileInTab = async (relPath, reveal = true) => {
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
      if (reveal) showPanel('code');
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
      showPanel('preview');
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
        await openFileInTab(res.path, false);
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
        await openFileInTab(res.path, false);
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
          [key]: {
            status: execRes.exitCode === 0 ? 'done' : 'error',
            detail: `Exit ${execRes.exitCode}`,
            output: execRes.output,
          },
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
    if (activeTab) {
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
        showPanel('preview');
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
        await openFileInTab(t.path, false).catch(() => {});
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


  const pickFolder = async () => {
    const res = await apiRequest('/api/workspace/pick-folder', { method: 'POST' });
    if (!res.cancelled) {
      setWorkspace(res);
      setRootPathInput(res.root);
      setTabs([]);
      setActiveTabPath('');
    }
  };

  const togglePanel = (tab) => {
    if (rightOpen && rightTab === tab) setRightOpen(false);
    else showPanel(tab);
  };

  const deleteEntry = async (p) => {
    await apiRequest('/api/workspace/file', { method: 'DELETE', body: { path: p } });
    setTabs((prev) => prev.filter((t) => t.path !== p));
    loadWorkspaceTree(false);
  };

  const closeTab = (path) => {
    const next = tabs.filter((x) => x.path !== path);
    setTabs(next);
    if (activeTabPath === path) setActiveTabPath(next[next.length - 1]?.path || '');
  };

  const panelTabs = [
    { id: 'files', label: 'Files', icon: Folder },
    { id: 'code', label: 'Code', icon: Code2 },
    { id: 'preview', label: 'Preview', icon: Eye },
    { id: 'terminal', label: 'Terminal', icon: Terminal },
  ];

  const starters = [
    'Create a playable Brick Breaker game in index.html, style.css, and game.js.',
    'Build a Python CLI task tracker in task_cli.py and run it to test.',
    'Make a Three.js 3D terrain generator in index.html with sliders.',
  ];

  const iconBtn = 'p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer';

  return (
    <div className="flex-1 h-full min-w-0 flex overflow-hidden" style={{ backgroundColor: 'var(--bg-canvas)' }}>
      {/* ───────── CONVERSATION (centered, like Claude Code) ───────── */}
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <header
          className="h-12 px-4 border-b flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Code2 size={16} style={{ color: 'var(--accent-claude)' }} />
            <span className="text-sm font-medium">Code</span>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <button
              type="button"
              onClick={pickFolder}
              title={`${workspace.root}\nClick to open another folder`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[13px] min-w-0 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Folder size={13} className="shrink-0" />
              <span className="truncate max-w-[220px]">{workspace.name || 'workspace'}</span>
              <ChevronDown size={12} className="shrink-0" />
            </button>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {workspace.undoStack?.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                title={`Undo: ${workspace.undoStack[0]?.actionLabel}`}
                className="flex items-center gap-1 px-2 py-1 mr-1 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                style={{ color: 'var(--accent-claude)' }}
              >
                <Undo2 size={13} />
                <span>Undo</span>
              </button>
            )}
            {panelTabs.map(({ id, label, icon: Icon }) => {
              const active = rightOpen && rightTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePanel(id)}
                  title={label}
                  className={iconBtn}
                  style={{
                    backgroundColor: active ? 'var(--accent-claude-soft)' : undefined,
                    color: active ? 'var(--accent-claude)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={15} />
                </button>
              );
            })}
          </div>
        </header>

        {/* Transcript */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
            {vibeMessages.length === 0 ? (
              <div className="pt-[10vh] flex flex-col items-center text-center space-y-5">
                <ClaudeStarburst size={36} />
                <h2 className="text-[28px] font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                  What should we build?
                </h2>
                <p className="text-sm max-w-md" style={{ color: 'var(--text-secondary)' }}>
                  Claude reads, edits and runs files in{' '}
                  <code className="text-[12px] px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'var(--bg-surface-3)' }}>
                    {workspace.name}
                  </code>{' '}
                  on your PC.
                </p>
                <div className="w-full max-w-xl space-y-2 pt-2">
                  {starters.map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => sendVibePrompt(starter)}
                      className="w-full text-left px-4 py-3 rounded-xl border text-[13px] transition hover:border-[#D97757]/60 cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              vibeMessages.map((m, mi) => {
                if (m.hiddenLabel) {
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-1.5 text-xs"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Check size={12} style={{ color: 'var(--accent-green)' }} />
                      <span>{m.hiddenLabel}</span>
                    </div>
                  );
                }

                if (m.role === 'user') {
                  return (
                    <div key={m.id} className="flex justify-end">
                      <div
                        className="max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap"
                        style={{ backgroundColor: 'var(--bg-user-bubble)' }}
                      >
                        {m.content}
                      </div>
                    </div>
                  );
                }

                const isLast = mi === vibeMessages.length - 1;
                const live = vibeStreaming && isLast;
                const { parts } = parseVibeResponse(m.content, live);
                return (
                  <div key={m.id} className="space-y-3">
                    {m.thinking && <ThinkingBlock text={m.thinking} live={live && !m.content} />}
                    {parts.map((p, i) =>
                      p.kind === 'action' ? (
                        <ToolRow
                          key={i}
                          action={p.action}
                          status={actionStatuses[`${m.id}_${p.action.index}`]}
                          autoApply={autoApply}
                          streaming={live}
                          onApply={() => applySingleOcAction(m.id, p.action)}
                          onOpenFile={openFileInTab}
                        />
                      ) : (
                        <div key={i} className="text-[15px]">
                          <MarkdownRenderer content={p.text} />
                        </div>
                      )
                    )}
                    {live && parts.length === 0 && !m.thinking && (
                      <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                        <ClaudeStarburst size={16} animated />
                        <span>Working…</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {vibeStreaming && vibeMessages.length > 0 && (
              <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
                <ClaudeStarburst size={16} animated />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 px-5 pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            {lastFailedOutput && (
              <button
                type="button"
                onClick={() =>
                  sendVibePrompt(
                    `Command \`${lastFailedOutput.command}\` failed with exit code ${lastFailedOutput.exitCode}:\n\`\`\`\n${lastFailedOutput.output}\n\`\`\`\nPlease inspect the relevant files, fix the root cause on disk, and verify.`
                  )
                }
                className="mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white cursor-pointer hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-claude)' }}
              >
                <Wrench size={12} />
                <span>`{lastFailedOutput.command}` failed — fix with Claude</span>
              </button>
            )}
            <div
              className="rounded-2xl border p-3"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-strong)',
                boxShadow: 'var(--shadow-composer)',
              }}
            >
              <textarea
                rows={1}
                value={vibePrompt}
                onChange={(e) => {
                  setVibePrompt(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendVibePrompt();
                  }
                }}
                placeholder="Describe what to build or change…"
                className="w-full bg-transparent text-[14px] leading-relaxed resize-none focus:outline-none px-1"
                style={{ minHeight: '28px' }}
              />
              <div className="flex items-center justify-between pt-2 gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModeMenuOpen(!modeMenuOpen)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    style={{ color: autoApply ? 'var(--accent-claude)' : 'var(--text-secondary)' }}
                  >
                    {autoApply ? <Zap size={13} /> : <Shield size={13} />}
                    <span>{autoApply ? 'Auto-accept edits' : 'Ask permissions'}</span>
                    <ChevronDown size={11} />
                  </button>
                  {modeMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setModeMenuOpen(false)} />
                      <div
                        className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border p-1 z-20"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                          boxShadow: 'var(--shadow-popover)',
                        }}
                      >
                        {[
                          { value: false, icon: Shield, title: 'Ask permissions', desc: 'Claude asks before each edit or command' },
                          { value: true, icon: Zap, title: 'Auto-accept edits', desc: 'Claude applies changes and runs commands on its own' },
                        ].map((opt) => (
                          <button
                            key={opt.title}
                            type="button"
                            onClick={() => {
                              setAutoApply(opt.value);
                              setModeMenuOpen(false);
                            }}
                            className="w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                          >
                            <opt.icon size={14} className="mt-0.5 shrink-0" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-medium">{opt.title}</span>
                              <span className="block text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {opt.desc}
                              </span>
                            </span>
                            {autoApply === opt.value && <Check size={13} className="mt-0.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <select
                    value={`${selectedBackend}::${selectedModel}`}
                    onChange={(e) => {
                      const [b, ...rest] = e.target.value.split('::');
                      onSelectModel?.(b, rest.join('::'));
                    }}
                    className="text-xs px-2 py-1 rounded-lg max-w-[200px] truncate cursor-pointer bg-transparent hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <optgroup label="Local Ollama">
                      {(modelsData?.ollama?.models || []).map((m) => (
                        <option key={`ol_${m.id}`} value={`ollama::${m.id}`}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="9Router Gateway">
                      {(modelsData?.nineRouter?.models || []).slice(0, 60).map((m) => (
                        <option key={`9r_${m.id}`} value={`9router::${m.id}`}>
                          {m.id}
                        </option>
                      ))}
                    </optgroup>
                  </select>

                  {vibeStreaming ? (
                    <button
                      type="button"
                      onClick={() => vibeAbortRef.current?.abort()}
                      title="Stop"
                      className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0"
                      style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-canvas)' }}
                    >
                      <Square size={11} fill="currentColor" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!vibePrompt.trim()}
                      onClick={() => sendVibePrompt()}
                      title="Send"
                      className="w-8 h-8 rounded-lg text-white flex items-center justify-center disabled:opacity-35 cursor-pointer shrink-0"
                      style={{ backgroundColor: 'var(--accent-claude)' }}
                    >
                      <ArrowUp size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {vibeMessages.length > 0 && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setVibeMessages([]);
                    setActionStatuses({});
                  }}
                  className="text-[11px] hover:underline cursor-pointer"
                  style={{ color: 'var(--text-muted)' }}
                >
                  New session
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ───────── SIDE PANEL: files / code / preview / terminal ───────── */}
      {rightOpen && (
        <aside
          className="w-[46%] min-w-[340px] max-w-[760px] h-full flex flex-col border-l shrink-0"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <div
            className="h-12 px-2 border-b flex items-center justify-between shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-0.5">
              {panelTabs.map(({ id, label, icon: Icon }) => {
                const active = rightTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRightTab(id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: active ? 'var(--shadow-card)' : undefined,
                    }}
                  >
                    <Icon size={13} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setRightOpen(false)} title="Close panel" className={iconBtn}>
              <X size={15} />
            </button>
          </div>

          {/* Files */}
          {rightTab === 'files' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="px-3 py-2 border-b space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
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
                  >
                    <input
                      value={rootPathInput}
                      onChange={(e) => setRootPathInput(e.target.value)}
                      autoFocus
                      onBlur={() => setEditingRootPath(false)}
                      className="w-full px-2 py-1 rounded-lg border text-[11px] font-mono focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
                    />
                  </form>
                ) : (
                  <div
                    onClick={() => setEditingRootPath(true)}
                    title="Click to type a custom directory path"
                    className="px-2 py-1 rounded-lg border text-[11px] font-mono truncate cursor-pointer hover:border-[#D97757]/60"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {workspace.root || 'Loading...'}
                  </div>
                )}
                <div className="flex items-center gap-0.5">
                  <button type="button" title="New file" className={iconBtn} onClick={() => { setNewEntryName(''); setNewEntryModal('file'); }}>
                    <FilePlus size={14} />
                  </button>
                  <button type="button" title="New folder" className={iconBtn} onClick={() => { setNewEntryName(''); setNewEntryModal('folder'); }}>
                    <FolderPlus size={14} />
                  </button>
                  <button type="button" title="New project" className={iconBtn} onClick={() => { setNewEntryName(''); setNewEntryModal('project'); }}>
                    <Plus size={14} />
                  </button>
                  <button type="button" title="Refresh" className={iconBtn} onClick={() => loadWorkspaceTree(false)}>
                    <RefreshCw size={13} />
                  </button>
                  <button type="button" title="Reveal in Explorer" className={iconBtn} onClick={() => apiRequest('/api/workspace/open-explorer', { method: 'POST' })}>
                    <ExternalLink size={13} />
                  </button>
                  <button type="button" title="Open another folder" className={iconBtn} onClick={pickFolder}>
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {workspace.tree?.length === 0 ? (
                  <div className="p-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    Empty folder. Create a file or ask Claude to build something.
                  </div>
                ) : (
                  workspace.tree.map((node) => (
                    <FileTreeItem
                      key={node.path}
                      node={node}
                      activePath={activeTabPath}
                      onOpenFile={openFileInTab}
                      onDeleteEntry={deleteEntry}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Code */}
          {rightTab === 'code' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div
                className="h-10 px-2 border-b flex items-center justify-between gap-2 shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
                  {tabs.map((t) => {
                    const dirty = t.content !== t.savedContent;
                    const active = activeTabPath === t.path;
                    return (
                      <div
                        key={t.path}
                        onClick={() => setActiveTabPath(t.path)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer shrink-0"
                        style={{
                          backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        <span className="max-w-[130px] truncate">{t.path.split('/').pop()}</span>
                        {dirty && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent-claude)' }} />}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(t.path);
                          }}
                          className="opacity-50 hover:opacity-100 cursor-pointer"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {activeTab && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => saveTab(activeTab.path)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                    >
                      <Save size={12} />
                      <span>Save</span>
                    </button>
                    {(activeTab.runCommand || activeTab.path.endsWith('.html')) && (
                      <button
                        type="button"
                        onClick={handleRunActiveFile}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white cursor-pointer hover:opacity-90"
                        style={{ backgroundColor: 'var(--accent-claude)' }}
                      >
                        <Play size={11} fill="currentColor" />
                        <span>{activeTab.path.endsWith('.html') ? 'Preview' : 'Run'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {activeTab ? (
                <div className="flex-1 min-h-0 flex overflow-hidden" style={{ backgroundColor: 'var(--bg-code)' }}>
                  <div
                    ref={gutterRef}
                    className="py-4 px-3 text-right font-mono text-[12px] leading-[1.6] select-none overflow-hidden shrink-0"
                    style={{ color: '#6E6B62' }}
                  >
                    {activeTab.content.split('\n').map((_, idx) => (
                      <div key={idx}>{idx + 1}</div>
                    ))}
                  </div>
                  <textarea
                    value={activeTab.content}
                    onScroll={(e) => {
                      if (gutterRef.current) gutterRef.current.scrollTop = e.target.scrollTop;
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, content: val } : t)));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        const updated = activeTab.content.substring(0, start) + '  ' + activeTab.content.substring(end);
                        setTabs((prev) => prev.map((t) => (t.path === activeTab.path ? { ...t, content: updated } : t)));
                        requestAnimationFrame(() => {
                          e.target.selectionStart = e.target.selectionEnd = start + 2;
                        });
                      }
                    }}
                    spellCheck={false}
                    wrap="off"
                    className="flex-1 p-4 bg-transparent text-[#F2F0E8] font-mono text-[13px] leading-[1.6] resize-none focus:outline-none overflow-auto"
                  />
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                  Open a file from the Files tab or click one in the transcript.
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {rightTab === 'preview' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div
                className="flex items-center gap-2 px-3 py-2 border-b text-xs shrink-0"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
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
                  className="flex-1 min-w-0 px-2.5 py-1 rounded-lg border font-mono text-xs focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                />
                <button type="button" onClick={() => setPreviewNonce((n) => n + 1)} className={iconBtn} title="Reload">
                  <RotateCcw size={13} />
                </button>
                <a href={effectivePreviewSrc} target="_blank" rel="noopener noreferrer" className={iconBtn} title="Open in browser">
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
          )}

          {/* Terminal */}
          {rightTab === 'terminal' && (
            <div className="flex-1 min-h-0 flex flex-col" style={{ backgroundColor: '#131211' }}>
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 text-[11px] text-[#A8A59C]">
                <span className="font-mono truncate">{workspace.root}</span>
                <div className="flex items-center gap-1.5 shrink-0">
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
                  <button type="button" onClick={() => setTerminalLogs([])} className="px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer">
                    Clear
                  </button>
                </div>
              </div>
              <div ref={termScrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
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
                className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-[#1B1A18]"
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
                  placeholder="Run any command (node, python, npm, git, dir)…"
                  className="flex-1 bg-transparent text-xs font-mono text-[#F2F0E8] focus:outline-none"
                />
              </form>
            </div>
          )}
        </aside>
      )}

      {/* New File / Folder / Project modal */}
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
                ? 'Create New File'
                : newEntryModal === 'folder'
                ? 'Create New Folder'
                : 'Scaffold New Project'}
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
                className="px-3.5 py-1.5 rounded-xl text-white text-xs font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--accent-claude)' }}
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
