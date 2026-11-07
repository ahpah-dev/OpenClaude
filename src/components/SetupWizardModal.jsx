import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Download,
  Play,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { ClaudeStarburst, NineRouterBadgeIcon, OllamaIcon } from './ClaudeIcons.jsx';
import { apiRequest, consumeSSE } from '../lib/api.js';

export default function SetupWizardModal({
  systemStatus,
  onClose,
  onRefresh,
  onOpenConnectKey,
  onViewEmbeddedDashboard,
}) {
  const [busyAction, setBusyAction] = useState(null);
  const [streamLogs, setStreamLogs] = useState([]);

  const appendLog = (msg) => {
    if (!msg) return;
    setStreamLogs((prev) => [...prev.slice(-80), msg]);
  };

  const handleInstallNineRouter = async () => {
    setBusyAction('install-9router');
    appendLog('Starting npm install -g 9router@latest...');
    try {
      await consumeSSE('/api/system/install-9router', {
        onEvent: (ev) => {
          if (ev.message) appendLog(ev.message);
        },
      });
      await onRefresh?.();
    } catch (err) {
      appendLog(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartNineRouter = async (openDashboard = true) => {
    setBusyAction('start-9router');
    appendLog('Starting 9Router server & dashboard on port 20128...');
    try {
      const res = await apiRequest('/api/system/start-9router', {
        method: 'POST',
        body: { openDashboard },
      });
      appendLog(res.success ? `9Router live at ${res.dashboardUrl}` : `Error: ${res.error}`);
      await onRefresh?.();
    } catch (err) {
      appendLog(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleInstallOllama = async () => {
    setBusyAction('install-ollama');
    appendLog('Starting automated Ollama installation...');
    try {
      await consumeSSE('/api/system/install-ollama', {
        onEvent: (ev) => {
          if (ev.message) appendLog(ev.message);
        },
      });
      await onRefresh?.();
    } catch (err) {
      appendLog(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartOllama = async () => {
    setBusyAction('start-ollama');
    appendLog('Starting local Ollama engine (ollama serve)...');
    try {
      await apiRequest('/api/system/start-ollama', { method: 'POST' });
      appendLog('Ollama server online at http://127.0.0.1:11434');
      await onRefresh?.();
    } catch (err) {
      appendLog(`Error: ${err.message}`);
    } finally {
      setBusyAction(null);
    }
  };

  const nine = systemStatus?.nineRouter || {};
  const ollama = systemStatus?.ollama || {};
  const combinedLogs = [
    ...(systemStatus?.logs || []).map((l) => l.message),
    ...streamLogs,
  ].slice(-30);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl border overflow-hidden flex flex-col max-h-[88vh] animate-claude-in"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-3">
            <ClaudeStarburst size={26} animated={!!busyAction} />
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-serif)' }}>
                OpenClaude Auto-Setup & Engine Control
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Automated installation, daemon startup, and health check for 9Router & Local Ollama
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh system diagnostics"
              className="p-1.5 rounded-xl hover:bg-black/5 cursor-pointer"
            >
              <RefreshCw size={15} />
            </button>
            <button type="button" onClick={onClose} className="p-1.5 rounded-xl hover:bg-black/5 cursor-pointer">
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto space-y-4">
          {/* 9Router Card */}
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center">
                  <NineRouterBadgeIcon size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold flex items-center gap-2">
                    <span>9Router Gateway & Dashboard</span>
                    {nine.running ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                        <CheckCircle2 size={13} /> Online (:20128)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                        <AlertCircle size={13} /> {nine.installed ? 'Stopped' : 'Not Installed'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {nine.installed ? `CLI v${nine.version || 'installed'} • ` : ''}
                    {nine.modelsCount || 0} models available •{' '}
                    {nine.hasApiKey ? 'API Key Connected ✓' : 'Connect API Key for chat completions'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!nine.running && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => handleStartNineRouter(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
                >
                  {busyAction === 'start-9router' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  <span>Auto-Start 9Router & Dashboard</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewEmbeddedDashboard?.();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141413] dark:bg-[#F2F0E8] text-white dark:text-[#141413] text-xs font-medium cursor-pointer"
              >
                <span>Open Dashboard Inside App</span>
              </button>

              <button
                type="button"
                onClick={() => apiRequest('/api/system/open-9router-dashboard', { method: 'POST' })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-black/5 cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <span>Launch Browser Dashboard</span>
                <ExternalLink size={12} />
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenConnectKey?.();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium text-[#D97757] border-[#D97757]/40 hover:bg-[#D97757]/10 cursor-pointer"
              >
                <span>{nine.hasApiKey ? 'Update API Key' : 'Connect API Key'}</span>
              </button>

              <button
                type="button"
                disabled={!!busyAction}
                onClick={handleInstallNineRouter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs hover:bg-black/5 cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                {busyAction === 'install-9router' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                <span>{nine.installed ? 'Update 9Router' : 'Download & Install 9Router'}</span>
              </button>
            </div>
          </div>

          {/* Local Ollama Card */}
          <div
            className="p-4 rounded-2xl border space-y-3"
            style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                <OllamaIcon size={18} />
              </div>
              <div>
                <div className="text-sm font-semibold flex items-center gap-2">
                  <span>Local Ollama Engine</span>
                  {ollama.running ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                      <CheckCircle2 size={13} /> Online (:11434)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                      <AlertCircle size={13} /> {ollama.installed ? 'Stopped' : 'Not Installed'}
                    </span>
                  )}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {ollama.installed ? `Ollama v${ollama.version} • ` : ''}
                  {ollama.modelsCount || 0} local GGUF models ready for instant zero-key chat
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {!ollama.installed && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleInstallOllama}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
                >
                  {busyAction === 'install-ollama' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  <span>Download & Install Ollama</span>
                </button>
              )}
              {ollama.installed && !ollama.running && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleStartOllama}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-medium cursor-pointer"
                >
                  <Play size={13} />
                  <span>Start Ollama Server</span>
                </button>
              )}
            </div>
          </div>

          {/* Live Bootstrap Terminal Log */}
          {combinedLogs.length > 0 && (
            <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)', backgroundColor: '#161514' }}>
              <div className="px-3.5 py-2 border-b border-white/10 flex items-center gap-2 text-[11px] text-[#B4B1A6]">
                <Terminal size={13} />
                <span>Automated Bootstrapper Log</span>
              </div>
              <pre className="p-3.5 m-0 text-[11.5px] font-mono text-[#E6E4DC] max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {combinedLogs.join('\n')}
              </pre>
            </div>
          )}
        </div>

        <div
          className="px-6 py-3.5 border-t flex items-center justify-end"
          style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium hover:opacity-90 cursor-pointer"
          >
            Continue to OpenClaude
          </button>
        </div>
      </div>
    </div>
  );
}
