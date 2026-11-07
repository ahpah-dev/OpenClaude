import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'openclaude-db.json');

export const DEFAULT_CLAUDE_SYSTEM_PROMPT = `You are Claude, a thoughtful, articulate, and highly capable AI assistant running inside OpenClaude (powered by 9Router and Local Ollama).
Current date: {{date}}
User's name: {{user_name}}
Active model: {{model}}

Core behavioral principles:
- Respond with warmth, intellectual honesty, precision, and clarity.
- Match the depth and tone appropriate to the user's question—concise for quick factual queries, thorough and structured for complex engineering, writing, math, or analysis tasks.
- Format responses cleanly using GitHub Flavored Markdown, tables where helpful, and KaTeX math ($...$ inline, $$...$$ display) for mathematical expressions.
- Write complete, production-ready, well-structured code without lazy placeholders when asked to build software.`;

export const SYSTEM_PROMPT_PRESETS = [
  {
    id: 'claude-default',
    name: 'Claude Default (Authentic)',
    description: 'Balanced, warm, articulate assistant identical to Claude.ai behavior.',
    prompt: DEFAULT_CLAUDE_SYSTEM_PROMPT,
  },
  {
    id: 'senior-architect',
    name: 'Claude Code / Principal Architect',
    description: 'Laser-focused on clean architecture, complete runnable code, edge cases, and performance.',
    prompt: `You are Claude, acting as a Principal Software Architect and Staff Full-Stack Engineer inside OpenClaude ({{model}}).
Current date: {{date}} | User: {{user_name}}

Engineering standards:
- Always write complete, runnable, modular, and defensive code—never leave TODO stubs or incomplete snippets.
- Favor modern idioms, strong UI/UX craft, accessibility, and clear separation of concerns.
- Briefly explain key architectural trade-offs before or after presenting the solution.`,
  },
  {
    id: 'creative-3d-coder',
    name: 'Creative UI, Canvas & 3D Coder',
    description: 'Optimized for interactive HTML5 Canvas, Three.js WebGL scenes, shaders, games, and visual Artifacts.',
    prompt: `You are Claude, a Creative Technologist & Interactive Graphics Engineer inside OpenClaude ({{model}}).
Current date: {{date}} | User: {{user_name}}

Creative coding directives:
- Whenever asked to build a visualization, 3D scene, game, simulation, or UI widget, create a rich, self-contained interactive HTML or React Artifact with polished controls, lighting, smooth 60fps animation, and responsive layout.
- Include interactive HUD sliders, camera orbit/mouse controls, and refined visual polish.`,
  },
  {
    id: 'research-analyst',
    name: 'Deep Research & First-Principles Analyst',
    description: 'Rigorous analytical reasoning, structured synthesis, mathematical precision, and nuanced trade-offs.',
    prompt: `You are Claude, a Senior Research Scientist and Strategic Analyst inside OpenClaude ({{model}}).
Current date: {{date}} | User: {{user_name}}

Analytical approach:
- Decompose complex questions from first principles.
- Distinguish established facts from hypotheses and quantify uncertainty where appropriate.
- Present structured comparisons, mathematical derivations in KaTeX, and clear executive takeaways.`,
  },
  {
    id: 'raw-minimal',
    name: 'Minimal / Unfiltered Custom',
    description: 'Minimal system framing for raw local model experimentation.',
    prompt: `You are a helpful AI assistant talking to {{user_name}} on {{date}}.`,
  },
];

export const DEFAULT_STYLES = [
  {
    id: 'normal',
    name: 'Normal',
    badge: 'Default',
    builtIn: true,
    description: 'Default responses from Claude',
    instructions: '',
  },
  {
    id: 'concise',
    name: 'Concise',
    badge: 'Built-in',
    builtIn: true,
    description: 'Shorter responses & more messages',
    instructions: 'Keep your responses concise, direct, and to the point. Avoid unnecessary preamble, filler, or repetition while preserving accuracy.',
  },
  {
    id: 'explanatory',
    name: 'Explanatory',
    badge: 'Built-in',
    builtIn: true,
    description: 'Educational responses for learning new concepts',
    instructions: 'Adopt an clear, patient, explanatory teaching style. Use intuitive analogies, step-by-step breakdowns, and concrete examples so concepts click effortlessly.',
  },
  {
    id: 'formal',
    name: 'Formal',
    badge: 'Built-in',
    builtIn: true,
    description: 'Clear and well-structured prose',
    instructions: 'Write in polished, formal, executive-ready prose with crisp structure, precise terminology, and objective tone.',
  },
];

const DEFAULT_DB = {
  settings: {
    profile: {
      fullName: '',
      nickname: '',
      workRole: '',
      personalPreferences: '',
    },
    appearance: {
      theme: 'light',
      chatFont: 'serif',
      sendWithEnter: true,
      autoOpenArtifacts: true,
      showTokenMetrics: true,
    },
    systemPrompt: {
      activePresetId: 'claude-default',
      customSystemPrompt: DEFAULT_CLAUDE_SYSTEM_PROMPT,
      enableArtifactsProtocol: true,
      includePersonalPreferences: true,
    },
    activeStyleId: 'normal',
    styles: DEFAULT_STYLES,
    nineRouter: {
      baseUrl: 'http://127.0.0.1:20128',
      port: 20128,
      apiKey: '',
      autoStart: true,
      autoOpenDashboardOnStart: true,
    },
    ollama: {
      baseUrl: 'http://127.0.0.1:11434',
      autoStart: true,
    },
    generation: {
      selectedBackend: 'auto',
      selectedModel: '',
      extendedThinking: false,
      artifactsEnabled: true,
      webFetchEnabled: true,
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxTokens: 8192,
      numCtx: 32768,
      repeatPenalty: 1.05,
    },
    onboardingCompleted: false,
    vibeWorkspace: {
      rootPath: '',
      autoExecute: true,
    },
  },
  projects: [],
  conversations: [],
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function deepMergeDefaults(defaults, current) {
  if (Array.isArray(defaults)) {
    return Array.isArray(current) ? current : defaults;
  }
  if (defaults && typeof defaults === 'object') {
    const out = { ...defaults };
    if (current && typeof current === 'object') {
      for (const key of Object.keys(current)) {
        if (key in defaults && defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
          out[key] = deepMergeDefaults(defaults[key], current[key]);
        } else {
          out[key] = current[key];
        }
      }
    }
    return out;
  }
  return current !== undefined ? current : defaults;
}

class Store {
  constructor() {
    ensureDir();
    this.data = this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        const merged = deepMergeDefaults(DEFAULT_DB, raw);
        // Ensure built-in styles always exist
        const existingIds = new Set((merged.settings.styles || []).map((s) => s.id));
        for (const st of DEFAULT_STYLES) {
          if (!existingIds.has(st.id)) {
            merged.settings.styles.unshift(st);
          }
        }
        return merged;
      }
    } catch (err) {
      console.error('[Store] Failed to load DB, initializing fresh:', err.message);
    }
    const initial = structuredClone(DEFAULT_DB);
    this.saveData(initial);
    return initial;
  }

  saveData(data = this.data) {
    ensureDir();
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  }

  getSettings() {
    return {
      ...this.data.settings,
      presets: SYSTEM_PROMPT_PRESETS,
    };
  }

  updateSettings(patch) {
    this.data.settings = deepMergeDefaults(this.data.settings, patch);
    // Allow explicit array replacement for styles
    if (patch?.styles && Array.isArray(patch.styles)) {
      this.data.settings.styles = patch.styles;
    }
    this.saveData();
    return this.getSettings();
  }

  // Projects CRUD
  listProjects() {
    return [...this.data.projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getProject(id) {
    return this.data.projects.find((p) => p.id === id) || null;
  }

  createProject({ name, description = '', instructions = '', color = '#D97757' }) {
    const now = new Date().toISOString();
    const project = {
      id: `proj_${crypto.randomUUID().slice(0, 8)}`,
      name: name || 'Untitled Project',
      description,
      instructions,
      color,
      starred: false,
      knowledge: [],
      createdAt: now,
      updatedAt: now,
    };
    this.data.projects.unshift(project);
    this.saveData();
    return project;
  }

  updateProject(id, patch) {
    const idx = this.data.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.projects[idx] = {
      ...this.data.projects[idx],
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    };
    this.saveData();
    return this.data.projects[idx];
  }

  deleteProject(id) {
    const before = this.data.projects.length;
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    // Detach conversations that referenced this project
    for (const c of this.data.conversations) {
      if (c.projectId === id) c.projectId = null;
    }
    this.saveData();
    return this.data.projects.length < before;
  }

  addProjectKnowledge(projectId, { title, content, type = 'text/plain', fileName = '' }) {
    const project = this.getProject(projectId);
    if (!project) return null;
    const item = {
      id: `doc_${crypto.randomUUID().slice(0, 8)}`,
      title: title || fileName || 'Document',
      fileName: fileName || title || 'document.txt',
      content: String(content || ''),
      type,
      size: Buffer.byteLength(String(content || ''), 'utf8'),
      createdAt: new Date().toISOString(),
    };
    project.knowledge.unshift(item);
    project.updatedAt = new Date().toISOString();
    this.saveData();
    return item;
  }

  removeProjectKnowledge(projectId, docId) {
    const project = this.getProject(projectId);
    if (!project) return false;
    project.knowledge = project.knowledge.filter((k) => k.id !== docId);
    project.updatedAt = new Date().toISOString();
    this.saveData();
    return true;
  }

  // Conversations CRUD
  listConversations() {
    return [...this.data.conversations]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .map((c) => ({
        id: c.id,
        title: c.title,
        starred: !!c.starred,
        projectId: c.projectId || null,
        backend: c.backend || 'ollama',
        model: c.model || '',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        messageCount: Object.keys(c.nodes || {}).length,
        artifactCount: (c.artifacts || []).length,
      }));
  }

  getConversation(id) {
    return this.data.conversations.find((c) => c.id === id) || null;
  }

  saveConversation(conv) {
    const now = new Date().toISOString();
    const idx = this.data.conversations.findIndex((c) => c.id === conv.id);
    if (idx === -1) {
      const created = {
        id: conv.id || `chat_${crypto.randomUUID()}`,
        title: conv.title || 'New chat',
        starred: !!conv.starred,
        projectId: conv.projectId || null,
        backend: conv.backend || 'ollama',
        model: conv.model || '',
        systemPromptOverride: conv.systemPromptOverride ?? '',
        styleId: conv.styleId || 'normal',
        nodes: conv.nodes || {},
        rootIds: conv.rootIds || [],
        currentLeafId: conv.currentLeafId || null,
        artifacts: conv.artifacts || [],
        createdAt: conv.createdAt || now,
        updatedAt: now,
      };
      this.data.conversations.unshift(created);
      this.saveData();
      return created;
    } else {
      this.data.conversations[idx] = {
        ...this.data.conversations[idx],
        ...conv,
        updatedAt: conv.touchUpdatedAt === false ? this.data.conversations[idx].updatedAt : now,
      };
      delete this.data.conversations[idx].touchUpdatedAt;
      this.saveData();
      return this.data.conversations[idx];
    }
  }

  deleteConversation(id) {
    const before = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter((c) => c.id !== id);
    this.saveData();
    return this.data.conversations.length < before;
  }

  bulkDeleteConversations(ids = []) {
    const idSet = new Set(ids);
    const before = this.data.conversations.length;
    this.data.conversations = this.data.conversations.filter((c) => !idSet.has(c.id));
    this.saveData();
    return before - this.data.conversations.length;
  }

  listAllArtifacts() {
    const list = [];
    for (const c of this.data.conversations) {
      for (const art of c.artifacts || []) {
        list.push({
          ...art,
          conversationId: c.id,
          conversationTitle: c.title,
        });
      }
    }
    return list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
  }

  exportAll() {
    const copy = structuredClone(this.data);
    // Mask 9router API key if exporting? Actually allow user full backup locally
    return copy;
  }

  importData(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('Invalid backup file');
    if (Array.isArray(payload.conversations)) {
      this.data.conversations = payload.conversations;
    }
    if (Array.isArray(payload.projects)) {
      this.data.projects = payload.projects;
    }
    if (payload.settings) {
      this.data.settings = deepMergeDefaults(this.data.settings, payload.settings);
    }
    this.saveData();
    return true;
  }
}

export const store = new Store();
