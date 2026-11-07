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
  User,
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

function buildTimeOfDayGreetingPool(rawName = '') {
  const name = rawName.trim();
  const withName = (namedTemplate, namelessTemplate) =>
    name ? namedTemplate.replace('{name}', name) : namelessTemplate;

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sun, 1 = Mon, 5 = Fri, 6 = Sat
  const isWeekend = day === 0 || day === 6;

  // 05:00 – 08:59: Early Morning / Dawn
  if (hour >= 5 && hour < 9) {
    return [
      'Coffee and Claude time?',
      withName('Coffee and Claude time, {name}?', 'First cup of coffee and a fresh idea?'),
      withName('Good morning, {name}', 'Good morning'),
      withName('Up early today, {name}?', 'Up early today?'),
      withName('Fresh pot of coffee and a blank canvas, {name}?', 'Fresh pot of coffee and a blank canvas?'),
      withName('Early morning clarity, {name}?', 'Early morning clarity?'),
      withName('Ready to build something great today, {name}?', 'Ready to build something great today?'),
    ];
  }

  // 09:00 – 11:59: Morning Flow
  if (hour >= 9 && hour < 12) {
    const pool = [
      'Coffee and Claude time?',
      withName('Coffee and Claude time, {name}?', 'Morning coffee and Claude?'),
      withName('Good morning, {name}', 'Good morning'),
      withName("What's on the agenda this morning, {name}?", "What's on the agenda this morning?"),
      withName('Morning brainstorm, {name}?', 'Morning brainstorm?'),
      withName("Let's dive into something interesting, {name}", "Let's dive into something interesting"),
      withName("How's your morning unfolding, {name}?", "How's your morning unfolding?"),
    ];
    if (day === 1) {
      pool.push(withName('Happy Monday, {name} — easing in or diving deep?', 'Happy Monday — easing in or diving deep?'));
    }
    if (isWeekend) {
      pool.push(withName('Slow weekend morning with coffee and Claude, {name}?', 'Slow weekend morning with coffee and Claude?'));
    }
    return pool;
  }

  // 12:00 – 13:59: Midday / Lunchtime
  if (hour >= 12 && hour < 14) {
    return [
      withName('Midday check-in, {name}?', 'Midday check-in?'),
      withName('Lunchtime rabbit hole, {name}?', 'Lunchtime rabbit hole?'),
      withName('Good afternoon, {name}', 'Good afternoon'),
      withName('Refueling with coffee and Claude, {name}?', 'Refueling with coffee and Claude?'),
      withName('What are we tackling next, {name}?', 'What are we tackling next?'),
      withName('Halfway through the day, {name} — what’s next?', 'Halfway through the day — what’s next?'),
    ];
  }

  // 14:00 – 17:59: Afternoon Focus
  if (hour >= 14 && hour < 18) {
    const pool = [
      withName('Good afternoon, {name}', 'Good afternoon'),
      'Afternoon coffee and Claude time?',
      withName('Afternoon coffee and Claude, {name}?', 'Second cup of coffee and Claude?'),
      withName('In the flow this afternoon, {name}?', 'In the flow this afternoon?'),
      withName('What are we shipping today, {name}?', 'What are we shipping today?'),
      withName('Need a second pair of eyes, {name}?', 'Need a second pair of eyes?'),
      withName('Afternoon deep dive, {name}?', 'Afternoon deep dive?'),
      withName('Back at it, {name}?', 'Back at it?'),
    ];
    if (day === 5) {
      pool.push(withName('Wrapping up the week strong, {name}?', 'Wrapping up the week strong?'));
    }
    if (isWeekend) {
      pool.push(withName('Weekend passion project time, {name}?', 'Weekend passion project time?'));
    }
    return pool;
  }

  // 18:00 – 21:59: Evening Wind-down & Tinkering
  if (hour >= 18 && hour < 22) {
    return [
      withName('Good evening, {name}', 'Good evening'),
      withName('Evening tinkering session, {name}?', 'Evening tinkering session?'),
      withName("What's on your mind tonight, {name}?", "What's on your mind tonight?"),
      withName('Side-project hours, {name}?', 'Side-project hours?'),
      withName('Unwinding with a new idea, {name}?', 'Unwinding with a new idea?'),
      'Tea and Claude time?',
      withName('Evening brainstorm, {name}?', 'Evening brainstorm?'),
    ];
  }

  // 22:00 – 04:59: Late Night / Night Owl
  return [
    withName('Burning the midnight oil, {name}?', 'Burning the midnight oil?'),
    withName('Late night thoughts, {name}?', 'Late night thoughts?'),
    withName('Night owl hours, {name}?', 'Night owl hours?'),
    withName('Quiet hours, big ideas, {name}?', 'Quiet hours, big ideas?'),
    withName('Midnight debugging or late-night inspiration, {name}?', 'Midnight debugging or late-night inspiration?'),
    'Decaf and Claude time?',
    withName('Still in the zone, {name}?', 'Still in the zone?'),
  ];
}

export default function HomeGreeting({
  userName = '',
  greetingSeed = 0,
  composerProps,
  systemStatus,
  onOpenNineRouterConnect,
  onOpenNineRouterDashboard,
  onOpenSystemPromptEditor,
  onEditUsername,
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [seedDraft, setSeedDraft] = useState('');
  const [localSpin, setLocalSpin] = useState(() => Math.floor(Math.random() * 100));

  const greetingText = useMemo(() => {
    const pool = buildTimeOfDayGreetingPool(userName);
    const idx = Math.abs(greetingSeed + localSpin) % pool.length;
    return pool[idx];
  }, [userName, greetingSeed, localSpin]);

  const activeCategoryObj = STARTER_CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <div className="flex-1 h-full overflow-y-auto flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-[740px] mx-auto flex flex-col items-center">
        {/* Authentic Claude Starburst + Time-Aware Literary Serif Greeting */}
        <div className="flex items-center justify-center gap-3.5 mb-8 text-center animate-claude-in">
          <button
            type="button"
            onClick={() => setLocalSpin((n) => n + 1)}
            title="Click for another greeting"
            className="cursor-pointer transition-transform hover:scale-110 active:scale-95 shrink-0"
          >
            <ClaudeStarburst size={36} />
          </button>
          <h1
            className="text-3xl sm:text-[38px] font-normal tracking-tight leading-tight"
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

          <button
            type="button"
            onClick={onEditUsername}
            title="Change display name"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-medium transition hover:border-[#D97757]/50 cursor-pointer"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <User size={13} />
            <span>{userName ? userName : 'Set name'}</span>
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
