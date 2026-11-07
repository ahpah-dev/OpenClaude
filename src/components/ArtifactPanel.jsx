import React, { useState, useEffect, useMemo, useRef } from 'react';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import {
  X,
  Copy,
  Check,
  Download,
  RotateCw,
  Maximize2,
  Minimize2,
  ExternalLink,
  Code2,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Pencil,
  AlertTriangle,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ArtifactCubeIcon } from './ClaudeIcons.jsx';
import MarkdownRenderer from './MarkdownRenderer.jsx';
import { getArtifactTypeLabel, getFileExtensionForArtifact } from '../lib/artifactParser.js';

mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
});

/**
 * Builds self-contained iframe HTML for React/JSX Artifacts using Babel + React 18 + Tailwind + Lucide
 */
function buildReactSandboxHtml(jsxCode = '') {
  // Rewrite ES module imports into globals available inside the sandbox
  let transformed = jsxCode
    // import React, { useState, ... } from 'react'
    .replace(
      /import\s+React\s*,\s*\{([^}]+)\}\s*from\s*['"]react['"];?/g,
      'const {$1} = React;'
    )
    .replace(/import\s+\*\s+as\s+React\s+from\s*['"]react['"];?/g, '')
    .replace(/import\s+React\s+from\s*['"]react['"];?/g, '')
    .replace(/import\s*\{([^}]+)\}\s*from\s*['"]react['"];?/g, 'const {$1} = React;')
    // import { ... } from 'lucide-react'
    .replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]lucide-react['"];?/g,
      (_, names) => {
        const items = names
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((spec) => {
            const [orig, alias] = spec.split(/\s+as\s+/).map((x) => x.trim());
            return `const ${alias || orig} = window.__makeLucideIcon("${orig}");`;
          });
        return items.join('\n');
      }
    )
    // import { ... } from 'recharts'
    .replace(
      /import\s*\{([^}]+)\}\s*from\s*['"]recharts['"];?/g,
      'const {$1} = window.Recharts || {};'
    )
    // Strip any other bare CSS/unknown imports gracefully
    .replace(/import\s+['"][^'"]+['"];?/g, '');

  // Capture default export
  if (/export\s+default\s+function\s+([A-Za-z0-9_]+)/.test(transformed)) {
    transformed = transformed.replace(
      /export\s+default\s+function\s+([A-Za-z0-9_]+)/,
      'function $1'
    );
    const fnMatch = jsxCode.match(/export\s+default\s+function\s+([A-Za-z0-9_]+)/);
    if (fnMatch?.[1]) {
      transformed += `\nwindow.__ArtifactDefaultComponent = ${fnMatch[1]};`;
    }
  } else if (/export\s+default\s+/.test(transformed)) {
    transformed = transformed.replace(/export\s+default\s+/, 'window.__ArtifactDefaultComponent = ');
  } else {
    const fallbackFn = transformed.match(/function\s+([A-Z][A-Za-z0-9_]*)\s*\(/);
    if (fallbackFn?.[1]) {
      transformed += `\nwindow.__ArtifactDefaultComponent = ${fallbackFn[1]};`;
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    html, body, #root { margin: 0; padding: 0; min-height: 100vh; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    window.addEventListener('error', (e) => {
      parent.postMessage({ type: 'OPENCLAUDE_ARTIFACT_ERROR', message: e.message || String(e.error) }, '*');
    });
    window.addEventListener('unhandledrejection', (e) => {
      parent.postMessage({ type: 'OPENCLAUDE_ARTIFACT_ERROR', message: String(e.reason) }, '*');
    });

    // Helper creating React components from Lucide UMD icons
    window.__makeLucideIcon = function(iconName) {
      return function LucideProxy({ size = 20, color = 'currentColor', strokeWidth = 2, className = '', style = {}, ...rest }) {
        const ref = React.useRef(null);
        React.useEffect(() => {
          if (!ref.current || !window.lucide || !window.lucide.icons) return;
          const iconDef = window.lucide.icons[iconName] || window.lucide.icons.Sparkles;
          if (!iconDef) return;
          const svgEl = window.lucide.createElement(iconDef);
          svgEl.setAttribute('width', size);
          svgEl.setAttribute('height', size);
          svgEl.setAttribute('stroke', color);
          svgEl.setAttribute('stroke-width', strokeWidth);
          if (className) svgEl.setAttribute('class', className);
          ref.current.innerHTML = '';
          ref.current.appendChild(svgEl);
        }, [size, color, strokeWidth, className]);
        return React.createElement('span', {
          ref,
          style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 0, ...style },
          ...rest
        });
      };
    };
  </script>
  <script type="text/babel" data-presets="react">
    try {
      ${transformed}
      const RootComp = window.__ArtifactDefaultComponent;
      if (RootComp) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(RootComp));
      } else {
        document.getElementById('root').innerHTML = '<div style="padding:24px;color:#87857E">No default React component exported.</div>';
      }
    } catch (err) {
      parent.postMessage({ type: 'OPENCLAUDE_ARTIFACT_ERROR', message: err.message }, '*');
      document.getElementById('root').innerHTML = '<pre style="padding:20px;color:#C94038;white-space:pre-wrap;font-size:13px;">' + err.stack + '</pre>';
    }
  </script>
</body>
</html>`;
}

function buildHtmlSandbox(rawHtml = '') {
  const errorBridge = `<script>
    window.addEventListener('error', function(e) {
      parent.postMessage({ type: 'OPENCLAUDE_ARTIFACT_ERROR', message: e.message || 'Runtime error' }, '*');
    });
    window.addEventListener('unhandledrejection', function(e) {
      parent.postMessage({ type: 'OPENCLAUDE_ARTIFACT_ERROR', message: String(e.reason || 'Promise error') }, '*');
    });
  </script>`;
  if (/<head[\s>]/i.test(rawHtml)) {
    return rawHtml.replace(/<head([^>]*)>/i, `<head$1>${errorBridge}`);
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>${errorBridge}</head><body>${rawHtml}</body></html>`;
}

export default function ArtifactPanel({
  artifact,
  onClose,
  onSelectVersion,
  onFixWithClaude,
}) {
  const canLiveRender = useMemo(() => {
    const t = artifact?.type || '';
    return (
      t === 'text/html' ||
      t === 'application/vnd.ant.react' ||
      t === 'image/svg+xml' ||
      t === 'application/vnd.ant.mermaid' ||
      t === 'text/markdown'
    );
  }, [artifact?.type]);

  const [tab, setTab] = useState(canLiveRender ? 'preview' : 'code');
  const [viewport, setViewport] = useState('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [editedContent, setEditedContent] = useState(artifact?.content || '');
  const [runtimeError, setRuntimeError] = useState(null);
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [mermaidErr, setMermaidErr] = useState('');
  const [zoom, setZoom] = useState(1);
  const iframeRef = useRef(null);

  useEffect(() => {
    setEditedContent(artifact?.content || '');
    setRuntimeError(null);
    setZoom(1);
    setIsEditingCode(false);
    const shouldPreview =
      artifact?.type === 'text/html' ||
      artifact?.type === 'application/vnd.ant.react' ||
      artifact?.type === 'image/svg+xml' ||
      artifact?.type === 'application/vnd.ant.mermaid' ||
      artifact?.type === 'text/markdown';
    if (!artifact?.isStreaming) {
      setTab(shouldPreview ? 'preview' : 'code');
    } else {
      // While streaming code, show code live until complete, then flip to preview!
      setTab('code');
    }
  }, [artifact?.id, artifact?.version, artifact?.isStreaming]);

  useEffect(() => {
    setEditedContent(artifact?.content || '');
  }, [artifact?.content]);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === 'OPENCLAUDE_ARTIFACT_ERROR') {
        setRuntimeError(e.data.message);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Render Mermaid diagrams when type is mermaid
  useEffect(() => {
    if (artifact?.type !== 'application/vnd.ant.mermaid' || artifact?.isStreaming) return;
    let cancelled = false;
    (async () => {
      try {
        setMermaidErr('');
        const id = `mmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const { svg } = await mermaid.render(id, editedContent.trim());
        if (!cancelled) setMermaidSvg(svg);
      } catch (err) {
        if (!cancelled) setMermaidErr(err.message || 'Invalid Mermaid syntax');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifact?.type, artifact?.isStreaming, editedContent, reloadNonce]);

  const highlightedCode = useMemo(() => {
    const code = editedContent || '';
    const lang = artifact?.language || 'html';
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [editedContent, artifact?.language]);

  const srcDoc = useMemo(() => {
    if (!artifact || artifact.isStreaming) return '';
    if (artifact.type === 'text/html') return buildHtmlSandbox(editedContent);
    if (artifact.type === 'application/vnd.ant.react') return buildReactSandboxHtml(editedContent);
    return '';
  }, [artifact?.type, artifact?.isStreaming, editedContent, reloadNonce]);

  if (!artifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const ext = getFileExtensionForArtifact(artifact);
    const filename = `${artifact.identifier || 'artifact'}.${ext}`;
    const blob = new Blob([editedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenInNewTab = () => {
    const htmlContent =
      artifact.type === 'application/vnd.ant.react'
        ? buildReactSandboxHtml(editedContent)
        : artifact.type === 'image/svg+xml'
        ? `<!DOCTYPE html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#FAF9F5;">${editedContent}</body></html>`
        : editedContent;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
  };

  const viewportWidth =
    viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '768px' : '100%';

  return (
    <aside
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 w-full'
          : 'w-full lg:w-[50%] xl:w-[52%] h-full border-l'
      } flex flex-col transition-all duration-200`}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Top Claude Artifacts Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b gap-2 shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface-2)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--accent-claude-soft)',
              color: 'var(--accent-claude)',
            }}
          >
            <ArtifactCubeIcon size={17} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold truncate">{artifact.title}</h3>
              {artifact.isStreaming && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#D97757]/15 text-[#D97757] font-medium animate-pulse">
                  Streaming...
                </span>
              )}
            </div>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {getArtifactTypeLabel(artifact.type, artifact.language)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Preview | Code Segmented Switch */}
          {canLiveRender && (
            <div
              className="flex items-center p-0.5 rounded-lg border text-xs"
              style={{
                backgroundColor: 'var(--bg-canvas)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  tab === 'preview' ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
                }`}
                style={
                  tab === 'preview'
                    ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                <Eye size={13} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('code')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  tab === 'code' ? 'shadow-xs' : 'opacity-70 hover:opacity-100'
                }`}
                style={
                  tab === 'code'
                    ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                <Code2 size={13} />
                <span>Code</span>
              </button>
            </div>
          )}

          {/* Responsive Viewport Controls */}
          {tab === 'preview' && (artifact.type === 'text/html' || artifact.type === 'application/vnd.ant.react') && (
            <div className="hidden sm:flex items-center gap-0.5 px-1">
              {[
                { id: 'desktop', Icon: Monitor, label: 'Desktop' },
                { id: 'tablet', Icon: Tablet, label: 'Tablet' },
                { id: 'mobile', Icon: Smartphone, label: 'Mobile' },
              ].map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewport(id)}
                  title={label}
                  className={`p-1.5 rounded-md transition cursor-pointer ${
                    viewport === id ? 'bg-black/10 dark:bg-white/10' : 'opacity-60 hover:opacity-100'
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}

          {tab === 'preview' && canLiveRender && (
            <button
              type="button"
              onClick={() => {
                setRuntimeError(null);
                setReloadNonce((n) => n + 1);
              }}
              title="Reload artifact sandbox"
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <RotateCw size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            title="Close Artifacts panel"
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Runtime Sandbox Error Banner with 1-Click "Fix with Claude" */}
      {runtimeError && tab === 'preview' && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/25 text-xs">
          <div className="flex items-center gap-2 min-w-0 text-red-600 dark:text-red-400">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="truncate font-mono">{runtimeError}</span>
          </div>
          {onFixWithClaude && (
            <button
              type="button"
              onClick={() =>
                onFixWithClaude(
                  `The artifact "${artifact.title}" threw this runtime error:\n\`\`\`\n${runtimeError}\n\`\`\`\nPlease fix it and output the updated complete artifact.`
                )
              }
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D97757] text-white font-medium shrink-0 hover:opacity-90 cursor-pointer"
            >
              <Wrench size={12} />
              <span>Fix with Claude</span>
            </button>
          )}
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {tab === 'preview' && canLiveRender ? (
          <div
            className="flex-1 min-h-0 w-full flex items-center justify-center overflow-auto"
            style={{ backgroundColor: 'var(--bg-canvas)' }}
          >
            {(artifact.type === 'text/html' || artifact.type === 'application/vnd.ant.react') && (
              <div
                className="h-full transition-all duration-200 bg-white shadow-xs overflow-hidden"
                style={{ width: viewportWidth, maxWidth: '100%' }}
              >
                <iframe
                  key={`${artifact.id}_${reloadNonce}`}
                  ref={iframeRef}
                  title={artifact.title}
                  srcDoc={srcDoc}
                  sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
                  className="w-full h-full border-0"
                />
              </div>
            )}

            {artifact.type === 'image/svg+xml' && (
              <div className="relative w-full h-full flex items-center justify-center p-6 overflow-auto">
                <div
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s' }}
                  dangerouslySetInnerHTML={{ __html: editedContent }}
                />
                <div className="absolute bottom-4 right-4 flex items-center gap-1 p-1 rounded-xl border bg-white/90 dark:bg-[#2B2A27]/90 shadow-sm" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><ZoomOut size={14} /></button>
                  <span className="text-xs px-1.5 tabular-nums">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><ZoomIn size={14} /></button>
                </div>
              </div>
            )}

            {artifact.type === 'application/vnd.ant.mermaid' && (
              <div className="relative w-full h-full flex items-center justify-center p-6 overflow-auto bg-white">
                {mermaidErr ? (
                  <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs font-mono max-w-md">
                    {mermaidErr}
                  </div>
                ) : (
                  <div
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s' }}
                    dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                  />
                )}
                <div className="absolute bottom-4 right-4 flex items-center gap-1 p-1 rounded-xl border bg-white shadow-sm text-[#141413]" style={{ borderColor: '#E5E2D9' }}>
                  <button type="button" onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))} className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><ZoomOut size={14} /></button>
                  <span className="text-xs px-1.5 tabular-nums">{Math.round(zoom * 100)}%</span>
                  <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"><ZoomIn size={14} /></button>
                </div>
              </div>
            )}

            {artifact.type === 'text/markdown' && (
              <div className="w-full h-full overflow-y-auto p-8 max-w-3xl mx-auto">
                <MarkdownRenderer content={editedContent} />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col" style={{ backgroundColor: 'var(--bg-code)' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 text-xs text-[#B4B1A6]">
              <span className="font-mono">{artifact.identifier}.{getFileExtensionForArtifact(artifact)}</span>
              <button
                type="button"
                onClick={() => setIsEditingCode(!isEditingCode)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition cursor-pointer ${
                  isEditingCode ? 'bg-[#D97757] text-white' : 'hover:bg-white/10 text-[#E6E4DC]'
                }`}
              >
                <Pencil size={12} />
                <span>{isEditingCode ? 'Done Editing (Live)' : 'Edit Code'}</span>
              </button>
            </div>
            {isEditingCode ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                spellCheck={false}
                className="flex-1 w-full p-4 bg-transparent text-[#F2F0E8] font-mono text-[13px] leading-relaxed resize-none focus:outline-none"
              />
            ) : (
              <pre className="flex-1 m-0 p-4 overflow-auto text-[13px] leading-relaxed font-mono">
                <code className="hljs" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Bottom Claude Artifact Footer */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-t text-xs shrink-0"
        style={{
          backgroundColor: 'var(--bg-surface-2)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
      >
        <div className="flex items-center gap-2">
          {artifact.versions && artifact.versions.length > 1 ? (
            <select
              value={artifact.version || 1}
              onChange={(e) => {
                const v = Number(e.target.value);
                const chosen = artifact.versions.find((item) => item.version === v);
                if (chosen) onSelectVersion?.(chosen);
              }}
              className="px-2 py-1 rounded-md border text-xs font-medium cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
            >
              {artifact.versions.map((ver) => (
                <option key={ver.id} value={ver.version}>
                  Version {ver.version} of {artifact.versions.length}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2 py-0.5 rounded-md border text-[11px]" style={{ borderColor: 'var(--border-subtle)' }}>
              v{artifact.version || 1}
            </span>
          )}
          <span className="hidden sm:inline text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {editedContent.split('\n').length} lines
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {(artifact.type === 'text/html' || artifact.type === 'application/vnd.ant.react' || artifact.type === 'image/svg+xml') && (
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border hover:opacity-90 transition cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
              title="Open standalone in browser tab"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">Open Tab</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border hover:opacity-90 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border hover:opacity-90 transition cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
          >
            <Download size={13} />
            <span>Download</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
