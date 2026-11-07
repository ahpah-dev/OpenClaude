// Real-time streaming <antArtifact> parser + smart fallback code-block extractor + showcase gallery

function parseAttributes(attrString = '') {
  const attrs = {};
  const regex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match;
  while ((match = regex.exec(attrString)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? '';
  }
  return attrs;
}

function slugify(str = 'artifact') {
  return (
    String(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'artifact'
  );
}

/**
 * Parses assistant content (both finished & mid-stream) into interleaved segments:
 *   [{ kind: 'markdown', text }, { kind: 'artifact', artifact }]
 * Also auto-promotes substantial standalone HTML / JSX / SVG / Mermaid code blocks
 * if a smaller local model outputs fenced blocks without <antArtifact> XML tags!
 */
export function parseMessageSegments(content = '', messageId = 'msg', isStreaming = false) {
  if (!content) return { segments: [], extractedArtifacts: [] };

  const hasXmlArtifact = content.includes('<antArtifact');
  const segments = [];
  const extractedArtifacts = [];

  if (hasXmlArtifact) {
    let cursor = 0;
    let idx = 0;

    while (cursor < content.length) {
      const openIdx = content.indexOf('<antArtifact', cursor);
      if (openIdx === -1) {
        const tail = content.slice(cursor);
        if (tail.trim()) segments.push({ kind: 'markdown', text: tail });
        break;
      }

      if (openIdx > cursor) {
        const before = content.slice(cursor, openIdx);
        if (before.trim()) segments.push({ kind: 'markdown', text: before });
      }

      const tagCloseIdx = content.indexOf('>', openIdx);
      if (tagCloseIdx === -1) {
        // Still streaming opening <antArtifact ...
        segments.push({
          kind: 'artifact',
          artifact: {
            id: `${messageId}_art_${idx}`,
            identifier: `streaming-${idx}`,
            title: 'Generating Artifact...',
            type: 'text/html',
            language: 'html',
            content: '',
            isStreaming: true,
          },
        });
        break;
      }

      const attrStr = content.slice(openIdx + 12, tagCloseIdx);
      const attrs = parseAttributes(attrStr);
      const endTag = '</antArtifact>';
      const closeIdx = content.indexOf(endTag, tagCloseIdx + 1);

      let innerCode;
      let stillGenerating = false;
      if (closeIdx === -1) {
        innerCode = content.slice(tagCloseIdx + 1).replace(/^\r?\n/, '');
        stillGenerating = isStreaming;
        cursor = content.length;
      } else {
        innerCode = content.slice(tagCloseIdx + 1, closeIdx).replace(/^\r?\n/, '').replace(/\r?\n$/, '');
        cursor = closeIdx + endTag.length;
      }

      // Strip accidental outer ``` fence if a local model wrapped code inside <antArtifact>
      innerCode = innerCode
        .replace(/^```[a-zA-Z0-9_-]*\r?\n/, '')
        .replace(/\r?\n```\s*$/, '');

      const artifact = {
        id: `${messageId}_art_${idx}`,
        identifier: attrs.identifier || slugify(attrs.title || `artifact-${idx + 1}`),
        title: attrs.title || 'Untitled Artifact',
        type: attrs.type || inferArtifactTypeFromLang(attrs.language, innerCode),
        language: attrs.language || inferLanguageFromType(attrs.type),
        content: innerCode,
        isStreaming: stillGenerating,
        messageId,
      };

      extractedArtifacts.push(artifact);
      segments.push({ kind: 'artifact', artifact });
      idx++;
    }

    return { segments, extractedArtifacts };
  }

  // Fallback for local models that emit rich HTML / React / SVG / Mermaid fenced blocks directly
  const fenceRegex = /```(html|htm|svg|mermaid|jsx|tsx)\r?\n([\s\S]*?)(?:```|$)/gi;
  let lastIndex = 0;
  let match;
  let autoIdx = 0;

  while ((match = fenceRegex.exec(content)) !== null) {
    const lang = match[1].toLowerCase();
    const body = match[2] || '';
    const isClosed = match[0].endsWith('```');

    // Only auto-promote substantial visual/renderable blocks (>140 chars or <!DOCTYPE/<html/<svg/mermaid)
    const shouldPromote =
      lang === 'mermaid' ||
      lang === 'svg' ||
      /<!doctype|<html|<canvas|<svg|export\s+default\s+function/i.test(body) ||
      body.split('\n').length >= 14;

    if (!shouldPromote) continue;

    if (match.index > lastIndex) {
      const prose = content.slice(lastIndex, match.index);
      if (prose.trim()) segments.push({ kind: 'markdown', text: prose });
    }

    const titleMatch =
      body.match(/<title>([^<]+)<\/title>/i) ||
      body.match(/function\s+([A-Z][A-Za-z0-9_]*)/);
    const derivedTitle = titleMatch?.[1]?.trim() || `${lang.toUpperCase()} Interactive Artifact`;
    const type = inferArtifactTypeFromLang(lang, body);

    const artifact = {
      id: `${messageId}_auto_${autoIdx}`,
      identifier: `${slugify(derivedTitle)}-${autoIdx + 1}`,
      title: derivedTitle,
      type,
      language: lang,
      content: body.replace(/\r?\n$/, ''),
      isStreaming: isStreaming && !isClosed,
      messageId,
    };

    extractedArtifacts.push(artifact);
    segments.push({ kind: 'artifact', artifact });
    lastIndex = match.index + match[0].length;
    autoIdx++;
  }

  if (extractedArtifacts.length === 0) {
    return {
      segments: [{ kind: 'markdown', text: content }],
      extractedArtifacts: [],
    };
  }

  if (lastIndex < content.length) {
    const rem = content.slice(lastIndex);
    if (rem.trim()) segments.push({ kind: 'markdown', text: rem });
  }

  return { segments, extractedArtifacts };
}

export function inferArtifactTypeFromLang(lang = '', code = '') {
  const l = String(lang || '').toLowerCase();
  if (l === 'html' || l === 'htm') return 'text/html';
  if (l === 'jsx' || l === 'tsx' || l === 'react') return 'application/vnd.ant.react';
  if (l === 'svg' || /^\s*<svg[\s>]/i.test(code)) return 'image/svg+xml';
  if (l === 'mermaid') return 'application/vnd.ant.mermaid';
  if (l === 'md' || l === 'markdown') return 'text/markdown';
  if (/^\s*<!doctype html|^\s*<html/i.test(code)) return 'text/html';
  return 'application/vnd.ant.code';
}

export function inferLanguageFromType(type = '') {
  if (type === 'text/html') return 'html';
  if (type === 'application/vnd.ant.react') return 'jsx';
  if (type === 'image/svg+xml') return 'svg';
  if (type === 'application/vnd.ant.mermaid') return 'mermaid';
  if (type === 'text/markdown') return 'markdown';
  return 'javascript';
}

export function getArtifactTypeLabel(type = '', language = '') {
  if (type === 'text/html') return 'Interactive HTML App';
  if (type === 'application/vnd.ant.react') return 'Interactive React Component';
  if (type === 'image/svg+xml') return 'Vector Graphic (SVG)';
  if (type === 'application/vnd.ant.mermaid') return 'Mermaid Diagram';
  if (type === 'text/markdown') return 'Document';
  return language ? `${language.toUpperCase()} Code` : 'Code Artifact';
}

export function getFileExtensionForArtifact(artifact) {
  const t = artifact?.type || '';
  if (t === 'text/html') return 'html';
  if (t === 'application/vnd.ant.react') return 'jsx';
  if (t === 'image/svg+xml') return 'svg';
  if (t === 'application/vnd.ant.mermaid') return 'mmd';
  if (t === 'text/markdown') return 'md';
  const langMap = {
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    rust: 'rs',
    go: 'go',
    cpp: 'cpp',
    c: 'c',
    json: 'json',
    css: 'css',
  };
  return langMap[artifact?.language?.toLowerCase()] || 'txt';
}

/**
 * Reconciles all artifacts across the active thread to assign v1, v2, v3... per identifier
 */
export function collectVersionedArtifacts(thread = []) {
  const byIdentifier = new Map();
  const flat = [];

  for (const msg of thread) {
    if (msg.role !== 'assistant' || !msg.content) continue;
    const { extractedArtifacts } = parseMessageSegments(msg.content, msg.id, false);
    for (const art of extractedArtifacts) {
      const list = byIdentifier.get(art.identifier) || [];
      const version = list.length + 1;
      const enriched = {
        ...art,
        version,
        createdAt: msg.createdAt,
      };
      list.push(enriched);
      byIdentifier.set(art.identifier, list);
      flat.push(enriched);
    }
  }

  // Attach totalVersions & versions array to each entry
  return flat.map((item) => {
    const versions = byIdentifier.get(item.identifier) || [item];
    return {
      ...item,
      totalVersions: versions.length,
      versions,
    };
  });
}

export const SHOWCASE_ARTIFACTS = [
  {
    id: 'showcase_solar_3d',
    identifier: 'interactive-orbital-mechanics',
    title: 'Interactive Orbital Gravity Sandbox',
    type: 'text/html',
    language: 'html',
    version: 1,
    totalVersions: 1,
    showcaseCategory: 'Simulation',
    description: 'Click and drag to launch glowing celestial bodies with real-time N-body gravitational trails.',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #111110; color: #FAF9F5; font-family: system-ui, sans-serif; overflow: hidden; height: 100vh; }
  canvas { display: block; width: 100vw; height: 100vh; cursor: crosshair; }
  .hud {
    position: fixed; top: 16px; left: 16px;
    background: rgba(28, 27, 25, 0.85); backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.12); border-radius: 14px;
    padding: 14px 18px; width: 270px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }
  .hud h2 { font-size: 14px; font-weight: 600; color: #D97757; margin-bottom: 4px; }
  .hud p { font-size: 12px; color: #A8A59C; line-height: 1.4; margin-bottom: 10px; }
  .row { display: flex; gap: 8px; margin-top: 8px; }
  button {
    flex: 1; padding: 7px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.14);
    background: #282724; color: #FAF9F5; font-size: 12px; cursor: pointer; transition: 0.15s;
  }
  button:hover { background: #D97757; border-color: #D97757; }
</style>
</head>
<body>
<canvas id="sim"></canvas>
<div class="hud">
  <h2>✦ Orbital Gravity Sandbox</h2>
  <p>Drag anywhere on canvas to slingshot a new planet into orbit around the binary star core.</p>
  <div id="stats" style="font-size:12px;color:#E5E2D9;">Bodies: 5</div>
  <div class="row">
    <button id="preset">Binary Preset</button>
    <button id="clear">Clear Orbits</button>
  </div>
</div>
<script>
const canvas = document.getElementById('sim');
const ctx = canvas.getContext('2d');
let W, H;
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

const PALETTE = ['#D97757', '#F2B880', '#7CA9F5', '#88D4AB', '#E88B9C', '#C59BF0'];
let bodies = [];
let drag = null;

function seedSystem() {
  bodies = [
    { x: W/2, y: H/2, vx: 0, vy: 0, m: 1900, r: 16, color: '#F59E56', fixed: false, trail: [] },
    { x: W/2 + 150, y: H/2, vx: 0, vy: 3.5, m: 18, r: 6, color: '#7CA9F5', trail: [] },
    { x: W/2 - 220, y: H/2, vx: 0, vy: -2.9, m: 26, r: 7.5, color: '#88D4AB', trail: [] },
    { x: W/2, y: H/2 - 290, vx: 2.55, vy: 0, m: 14, r: 5.5, color: '#E88B9C', trail: [] }
  ];
}
seedSystem();

canvas.addEventListener('pointerdown', e => {
  drag = { sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY };
});
addEventListener('pointermove', e => { if (drag) { drag.cx = e.clientX; drag.cy = e.clientY; } });
addEventListener('pointerup', () => {
  if (!drag) return;
  const vx = (drag.sx - drag.cx) * 0.035;
  const vy = (drag.sy - drag.cy) * 0.035;
  bodies.push({
    x: drag.sx, y: drag.sy, vx, vy,
    m: 12 + Math.random() * 22,
    r: 5 + Math.random() * 4,
    color: PALETTE[bodies.length % PALETTE.length],
    trail: []
  });
  drag = null;
});

document.getElementById('preset').onclick = seedSystem;
document.getElementById('clear').onclick = () => { bodies = bodies.slice(0, 1); bodies[0].x = W/2; bodies[0].y = H/2; bodies[0].vx = 0; bodies[0].vy = 0; };

function step() {
  ctx.fillStyle = 'rgba(17, 17, 16, 0.28)';
  ctx.fillRect(0, 0, W, H);
  const G = 1.0;

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const distSq = Math.max(180, dx*dx + dy*dy);
      const dist = Math.sqrt(distSq);
      const f = (G * a.m * b.m) / distSq;
      const fx = f * dx / dist, fy = f * dy / dist;
      a.vx += fx / a.m; a.vy += fy / a.m;
      b.vx -= fx / b.m; b.vy -= fy / b.m;
    }
  }

  for (const b of bodies) {
    b.x += b.vx; b.y += b.vy;
    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 90) b.trail.shift();

    if (b.trail.length > 2) {
      ctx.beginPath();
      ctx.moveTo(b.trail[0].x, b.trail[0].y);
      for (const p of b.trail) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = b.color + '66';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = b.color;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (drag) {
    ctx.beginPath();
    ctx.moveTo(drag.sx, drag.sy);
    ctx.lineTo(drag.cx, drag.cy);
    ctx.strokeStyle = '#D97757';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  document.getElementById('stats').textContent = 'Active Bodies: ' + bodies.length;
  requestAnimationFrame(step);
}
step();
</script>
</body>
</html>`,
  },
  {
    id: 'showcase_pomodoro_react',
    identifier: 'claude-focus-studio',
    title: 'Claude Warm Minimalist Focus Timer',
    type: 'application/vnd.ant.react',
    language: 'jsx',
    version: 1,
    totalVersions: 1,
    showcaseCategory: 'Productivity',
    description: 'Warm parchment Pomodoro studio built as a live React + Tailwind Artifact.',
    content: `import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Coffee, Brain, CheckCircle2, Plus } from 'lucide-react';

export default function FocusStudio() {
  const MODES = {
    focus: { label: 'Deep Focus', minutes: 25, accent: '#D97757' },
    short: { label: 'Short Break', minutes: 5, accent: '#278655' },
    long: { label: 'Long Rest', minutes: 15, accent: '#2D6CDF' },
  };

  const [mode, setMode] = useState('focus');
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Configure 9Router multi-tier model fallback', done: true },
    { id: 2, text: 'Prototype interactive Artifacts in OpenClaude', done: false },
  ]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setRunning(false);
    setSecondsLeft(MODES[mode].minutes * 60);
  }, [mode]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const addTask = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: draft.trim(), done: false }]);
    setDraft('');
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#141413] p-8 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-md bg-white border border-[#E5E2D9] rounded-3xl p-7 shadow-sm">
        <div className="flex gap-2 p-1 bg-[#F0EEE6] rounded-2xl mb-7">
          {Object.entries(MODES).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={\`flex-1 py-2 rounded-xl text-xs font-medium transition \${
                mode === key ? 'bg-white text-[#141413] shadow-xs' : 'text-[#6B6962] hover:text-[#141413]'
              }\`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        <div className="text-center my-6">
          <div className="text-7xl font-serif tracking-tight text-[#141413] tabular-nums">
            {mins}:{secs}
          </div>
          <p className="text-xs text-[#87857E] mt-2 uppercase tracking-widest">{MODES[mode].label}</p>
        </div>

        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setRunning(!running)}
            className="px-7 py-3 rounded-2xl text-white font-medium flex items-center gap-2 transition hover:opacity-90"
            style={{ backgroundColor: MODES[mode].accent }}
          >
            {running ? <Pause size={17} /> : <Play size={17} />}
            {running ? 'Pause' : 'Start Session'}
          </button>
          <button
            onClick={() => { setRunning(false); setSecondsLeft(MODES[mode].minutes * 60); }}
            className="p-3 rounded-2xl border border-[#E5E2D9] text-[#5C5A53] hover:bg-[#F5F3EC]"
          >
            <RotateCcw size={17} />
          </button>
        </div>

        <div className="border-t border-[#E5E2D9] pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#87857E] mb-3">Session Intentions</h3>
          <div className="space-y-2 mb-3">
            {tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setTasks(tasks.map((x) => x.id === t.id ? { ...x, done: !x.done } : x))}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#FAF9F5] hover:bg-[#F0EEE6] cursor-pointer text-sm"
              >
                <CheckCircle2 size={16} className={t.done ? 'text-[#278655]' : 'text-[#C8C3B4]'} />
                <span className={t.done ? 'line-through text-[#87857E]' : ''}>{t.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={addTask} className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add focus task..."
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-[#E5E2D9] bg-[#FAF9F5] focus:outline-none"
            />
            <button type="submit" className="p-2 rounded-xl bg-[#141413] text-white">
              <Plus size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}`,
  },
  {
    id: 'showcase_architecture_mermaid',
    identifier: 'openclaude-routing-architecture',
    title: 'OpenClaude + 9Router + Ollama Architecture',
    type: 'application/vnd.ant.mermaid',
    language: 'mermaid',
    version: 1,
    totalVersions: 1,
    showcaseCategory: 'Diagram',
    description: 'Live Mermaid diagram illustrating how OpenClaude orchestrates 9Router and Local Ollama.',
    content: `flowchart LR
    UI["OpenClaude UI (Claude.ai Interface)"] --> API["OpenClaude Server (:3099)"]
    UI --> ART["Live Artifacts Sandbox (HTML / React / SVG / Mermaid)"]
    API --> PROMPT["System Prompt + Styles + Project Knowledge"]
    PROMPT --> R9["9Router Gateway (:20128/v1)"]
    PROMPT --> OL["Local Ollama Engine (:11434)"]
    R9 --> T1["Tier 1: Subscriptions (Claude / Cursor / Copilot)"]
    R9 --> T2["Tier 2: Low-Cost APIs (GLM / DeepSeek / MiniMax)"]
    R9 --> T3["Tier 3: Free Providers (Kiro / OpenCode)"]
    OL --> M1["Local GGUF Models (Qwen3.5 / YokoCoder / Llama)"]`,
  },
];
