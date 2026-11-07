import React, { useState, useMemo } from 'react';
import {
  Code2,
  PenLine,
  GraduationCap,
  BarChart3,
  Sparkles,
  KeyRound,
  ExternalLink,
  Sliders,
} from 'lucide-react';
import { ClaudeStarburst } from './ClaudeIcons.jsx';
import Composer from './Composer.jsx';

const STARTER_CATEGORIES = [
  {
    id: 'artifact',
    label: 'Create Artifact',
    Icon: Sparkles,
    prompts: [
      'Build an interactive 3D Cyberpunk Solar System explorer in HTML/Three.js with camera orbit controls and planet inspector HUD as an Artifact.',
      'Create a sleek interactive React Kanban & Pomodoro productivity dashboard styled like warm minimalist stationery.',
      'Design an interactive Web Audio synthesizer keyboard with waveform visualizer oscilloscope in a single HTML Artifact.',
      'Generate a complete Mermaid system architecture diagram for an event-driven microservices platform.',
    ],
  },
  {
    id: 'code',
    label: 'Code',
    Icon: Code2,
    prompts: [
      'Write a clean, concurrent worker pool in TypeScript with retry backoff, cancellation support, and unit test examples.',
      'Design a fast SQLite schema and query layer for a local-first knowledge graph with full-text search.',
      'Build an interactive sorting & pathfinding visualizer (A*, Dijkstra) in HTML5 Canvas.',
    ],
  },
  {
    id: 'write',
    label: 'Write',
    Icon: PenLine,
    prompts: [
      'Draft a crisp, persuasive engineering RFC proposing a local AI gateway rollout across a developer team.',
      'Help me write a clear, memorable launch announcement for an open-source developer tool.',
      'Rewrite rough meeting notes into an executive summary with owners, risks, and timeline.',
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    Icon: GraduationCap,
    prompts: [
      'Explain how RoPE (Rotary Position Embeddings) and KV-cache quantization work intuitively with math and examples.',
      'Walk me through modern GPU memory bandwidth bottlenecks during LLM token generation.',
      'Teach me WebGL fragment shaders from scratch with an interactive live example.',
    ],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    Icon: BarChart3,
    prompts: [
      'Compare local quantized GGUF models vs cloud API routing across latency, privacy, cost, and context scaling.',
      'Create an interactive React financial runway & SaaS unit economics calculator Artifact.',
      'Help me stress-test a software architecture for single points of failure and cascading retries.',
    ],
  },
];

export default function HomeGreeting({
  userName = 'Friend',
  composerProps,
  systemStatus,
  onOpenNineRouterConnect,
  onOpenNineRouterDashboard,
  onOpenSystemPromptEditor,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [seedDraft, setSeedDraft] = useState('');

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) return `Late night thoughts, ${userName}?`;
    if (hour < 12) return `Good morning, ${userName}`;
    if (hour < 18) return `Good afternoon, ${userName}`;
    return `Good evening, ${userName}`;
  }, [userName]);

  const activeCategoryObj = STARTER_CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <div className="flex-1 h-full overflow-y-auto flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[740px] mx-auto flex flex-col items-center">
        {/* Authentic Claude Starburst + Literary Serif Greeting */}
        <div className="flex items-center justify-center gap-3.5 mb-8 text-center animate-claude-in">
          <ClaudeStarburst size={36} />
          <h1
            className="text-3xl sm:text-[40px] font-normal tracking-tight leading-tight"
            style={{
              fontFamily: 'var(--font-serif)',
              color: 'var(--text-primary)',
            }}
          >
            {greetingText}
          </h1>
        </div>

        {/* Main Claude Composer */}
        <div className="w-full">
          <Composer
            {...composerProps}
            initialDraft={seedDraft}
            onDraftConsumed={() => setSeedDraft('')}
          />
        </div>

        {/* Claude Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {STARTER_CATEGORIES.map(({ id, label, Icon }) => {
            const active = selectedCategory === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedCategory(active ? null : id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--bg-surface)' : 'transparent',
                  borderColor: active ? 'var(--accent-claude)' : 'var(--border-subtle)',
                  color: active ? 'var(--accent-claude)' : 'var(--text-secondary)',
                }}
              >
                <Icon size={13.5} />
                <span>{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenSystemPromptEditor}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition hover:border-[#D97757]/50 cursor-pointer"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <Sliders size={13} />
            <span>System Prompt</span>
          </button>
        </div>

        {/* Expandable Starter Prompts Card */}
        {activeCategoryObj && (
          <div
            className="w-full mt-4 rounded-2xl border p-2 space-y-1 animate-claude-in"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {activeCategoryObj.prompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setSeedDraft(p);
                  setSelectedCategory(null);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-[13.5px] hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition cursor-pointer"
                style={{ color: 'var(--text-primary)' }}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Helpful Subtle 9Router Quick-Connect Pill if 9Router is Online without API Key */}
        {systemStatus?.nineRouter?.running && !systemStatus?.nineRouter?.hasApiKey && (
          <div
            className="mt-7 flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 rounded-2xl border text-xs animate-claude-in"
            style={{
              backgroundColor: 'var(--bg-surface-2)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <span>
              <strong>Local Ollama</strong> ({systemStatus?.ollama?.modelsCount || 0} models) is ready immediately •{' '}
              <strong>9Router</strong> ({systemStatus?.nineRouter?.modelsCount || 0} routes) is running on :20128
            </span>
            <button
              type="button"
              onClick={onOpenNineRouterConnect}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D97757] text-white font-medium hover:opacity-90 cursor-pointer"
            >
              <KeyRound size={12} />
              <span>Connect 9Router Key</span>
            </button>
            <button
              type="button"
              onClick={onOpenNineRouterDashboard}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border hover:bg-black/5 cursor-pointer"
              style={{ borderColor: 'var(--border-strong)' }}
            >
              <span>Dashboard</span>
              <ExternalLink size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
