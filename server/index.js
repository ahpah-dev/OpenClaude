import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { store } from './store.js';
import {
  checkSystemStatus,
  ensureAutoSetupOnBoot,
  installNineRouter,
  startNineRouter,
  installOllama,
  startOllama,
  openExternalUrl,
  pushSetupLog,
} from './services/setupManager.js';
import {
  listNineRouterModels,
  provisionNineRouterKey,
  streamNineRouterChat,
} from './services/nineRouterService.js';
import {
  listOllamaModels,
  pullOllamaModel,
  deleteOllamaModel,
  streamOllamaChat,
} from './services/ollamaService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, '..', 'dist');
const PORT = Number(process.env.OPENCLAUDE_PORT || 3099);

const ARTIFACTS_SYSTEM_SPEC = `
<artifacts_info>
You can create and update self-contained "Artifacts" that render in a dedicated side-by-side preview panel next to the chat—identical to Claude.ai Artifacts.
Use an Artifact whenever creating substantial, visual, interactive, or standalone content:
- Interactive web apps, games, simulations, calculators, 3D scenes (Three.js / WebGL / Canvas): type="text/html"
- Interactive React components / dashboards (Tailwind CSS, Lucide icons, Recharts preloaded—export default a component): type="application/vnd.ant.react"
- Vector illustrations, icons, diagrams, charts: type="image/svg+xml"
- Flowcharts, sequence diagrams, architecture diagrams: type="application/vnd.ant.mermaid"
- Long-form structured documents, reports, specs, essays: type="text/markdown"
- Standalone scripts or multi-function code modules (>20 lines): type="application/vnd.ant.code" with language="python|javascript|typescript|rust|cpp|..."

Wrap every artifact strictly in <antArtifact> tags like this:
<antArtifact identifier="kebab-case-unique-id" type="text/html" title="Descriptive Artifact Title">
<!DOCTYPE html>
<html>
...complete runnable code without placeholders...
</html>
</antArtifact>

Rules for Artifacts:
1. Always write 100% complete, self-contained, immediately runnable code inside <antArtifact>—never truncate with "// rest of code".
2. For type="text/html", include all HTML, CSS, and JS in one document (CDN scripts from unpkg/jsdelivr/cdnjs such as Three.js, Chart.js, Tailwind CDN, GSAP, D3 are allowed).
3. For type="application/vnd.ant.react", you may import React hooks from 'react', icons from 'lucide-react', or charts from 'recharts', and use Tailwind CSS utility classes; always include \`export default function App() { ... }\`.
4. When modifying an existing artifact, reuse the SAME \`identifier\` and output the full updated artifact.
5. Keep your conversational explanation outside <antArtifact> concise rather than repeating the code in markdown.
</artifacts_info>`;

function buildEffectiveSystemPrompt({ settings, conversation, project, modelName, styleOverrideId, artifactsEnabled }) {
  const baseTemplate =
    (conversation?.systemPromptOverride && conversation.systemPromptOverride.trim()) ||
    settings?.systemPrompt?.customSystemPrompt ||
    'You are Claude, a helpful AI assistant.';

  const nowStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const userName = settings?.profile?.nickname || settings?.profile?.fullName || 'User';

  let prompt = baseTemplate
    .replaceAll('{{date}}', nowStr)
    .replaceAll('{{user_name}}', userName)
    .replaceAll('{{model}}', modelName || 'AI Model')
    .replaceAll('{{os}}', `${os.platform()} (${os.arch()})`);

  if (settings?.systemPrompt?.includePersonalPreferences !== false && settings?.profile?.personalPreferences?.trim()) {
    prompt += `\n\n<user_preferences>\nUser work context: ${settings.profile.workRole || 'General'}\n${settings.profile.personalPreferences.trim()}\n</user_preferences>`;
  }

  const effectiveStyleId = styleOverrideId || conversation?.styleId || settings?.activeStyleId || 'normal';
  const styleObj = (settings?.styles || []).find((s) => s.id === effectiveStyleId);
  if (styleObj && styleObj.instructions?.trim()) {
    prompt += `\n\n<response_style name="${styleObj.name}">\n${styleObj.instructions.trim()}\n</response_style>`;
  }

  if (project) {
    let projSection = `\n\n<claude_project name="${project.name}">`;
    if (project.description) projSection += `\nDescription: ${project.description}`;
    if (project.instructions?.trim()) {
      projSection += `\n<project_instructions>\n${project.instructions.trim()}\n</project_instructions>`;
    }
    if (Array.isArray(project.knowledge) && project.knowledge.length > 0) {
      projSection += `\n<project_knowledge>`;
      for (const doc of project.knowledge) {
        projSection += `\n<document title="${doc.title}">\n${doc.content}\n</document>`;
      }
      projSection += `\n</project_knowledge>`;
    }
    projSection += `\n</claude_project>`;
    prompt += projSection;
  }

  const shouldIncludeArtifacts =
    artifactsEnabled !== false &&
    settings?.generation?.artifactsEnabled !== false &&
    settings?.systemPrompt?.enableArtifactsProtocol !== false;

  if (shouldIncludeArtifacts) {
    prompt += `\n\n${ARTIFACTS_SYSTEM_SPEC}`;
  }

  return prompt;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health & System Setup Endpoints
app.get('/api/health', async (_req, res) => {
  res.json({ ok: true, name: 'OpenClaude', port: PORT });
});

app.get('/api/system/status', async (_req, res) => {
  try {
    const status = await checkSystemStatus(store.getSettings());
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/system/start-9router', async (req, res) => {
  try {
    const settings = store.getSettings();
    const port = req.body?.port || settings.nineRouter.port || 20128;
    const result = await startNineRouter(port);
    if (req.body?.openDashboard && result.dashboardUrl) {
      openExternalUrl(result.dashboardUrl);
    }
    const status = await checkSystemStatus(store.getSettings());
    res.json({ ...result, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/system/open-9router-dashboard', async (_req, res) => {
  const settings = store.getSettings();
  const port = settings.nineRouter?.port || 20128;
  await startNineRouter(port);
  const dashboardUrl = `http://localhost:${port}/dashboard`;
  openExternalUrl(dashboardUrl);
  res.json({ success: true, dashboardUrl });
});

app.post('/api/system/install-9router', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const result = await installNineRouter({
    onProgress: (ev) => send(ev),
  });
  if (result.success) {
    const settings = store.getSettings();
    const startRes = await startNineRouter(settings.nineRouter?.port || 20128);
    send({ stage: '9router-start', ...startRes });
  }
  const status = await checkSystemStatus(store.getSettings());
  send({ stage: 'complete', result, status });
  res.end();
});

app.post('/api/system/9router-connect', async (req, res) => {
  try {
    const settings = store.getSettings();
    const baseUrl = req.body?.baseUrl || settings.nineRouter?.baseUrl || 'http://127.0.0.1:20128';
    let apiKey = (req.body?.apiKey || '').trim();

    if (!apiKey) {
      const provisioned = await provisionNineRouterKey({
        baseUrl,
        password: req.body?.password || '',
      });
      apiKey = provisioned.apiKey;
    }

    // Save API key & base URL
    store.updateSettings({
      nineRouter: {
        ...settings.nineRouter,
        baseUrl,
        apiKey,
      },
    });

    const modelsInfo = await listNineRouterModels({ baseUrl, apiKey });
    res.json({
      success: true,
      hasApiKey: !!apiKey,
      maskedKey: apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '',
      modelsCount: modelsInfo.models.length,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/system/start-ollama', async (_req, res) => {
  try {
    const result = await startOllama();
    const status = await checkSystemStatus(store.getSettings());
    res.json({ ...result, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/system/install-ollama', async (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const result = await installOllama({
    onProgress: (ev) => send(ev),
  });
  const status = await checkSystemStatus(store.getSettings());
  send({ stage: 'complete', result, status });
  res.end();
});

// Unified Models Discovery (9Router + Local Ollama)
app.get('/api/models', async (_req, res) => {
  const settings = store.getSettings();
  const [nineSettled, ollamaSettled] = await Promise.allSettled([
    listNineRouterModels({
      baseUrl: settings.nineRouter?.baseUrl,
      apiKey: settings.nineRouter?.apiKey,
    }),
    listOllamaModels({
      baseUrl: settings.ollama?.baseUrl,
    }),
  ]);

  const nineData =
    nineSettled.status === 'fulfilled'
      ? nineSettled.value
      : { models: [], error: nineSettled.reason?.message || 'Unreachable' };

  const ollamaData =
    ollamaSettled.status === 'fulfilled'
      ? ollamaSettled.value
      : { models: [], error: ollamaSettled.reason?.message || 'Unreachable' };

  // Pick smart recommended model if none selected yet
  let recommended = null;
  if (settings.nineRouter?.apiKey && nineData.models.length > 0) {
    recommended = { backend: '9router', model: nineData.models[0].id };
  } else if (ollamaData.models.length > 0) {
    recommended = { backend: 'ollama', model: ollamaData.models[0].id };
  } else if (nineData.models.length > 0) {
    recommended = { backend: '9router', model: nineData.models[0].id };
  }

  res.json({
    nineRouter: {
      online: nineSettled.status === 'fulfilled',
      hasApiKey: !!settings.nineRouter?.apiKey,
      dashboardUrl: `http://localhost:${settings.nineRouter?.port || 20128}/dashboard`,
      ...nineData,
    },
    ollama: {
      online: ollamaSettled.status === 'fulfilled',
      ...ollamaData,
    },
    recommended,
  });
});

// Ollama Model Pull & Delete
app.post('/api/ollama/pull', async (req, res) => {
  const { model } = req.body || {};
  if (!model) return res.status(400).json({ error: 'Model name required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  try {
    const settings = store.getSettings();
    await pullOllamaModel({
      baseUrl: settings.ollama?.baseUrl,
      model,
      signal: controller.signal,
      onProgress: (p) => send(p),
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      send({ error: err.message });
    }
  } finally {
    res.end();
  }
});

app.delete('/api/ollama/models', async (req, res) => {
  try {
    const { model } = req.body || {};
    if (!model) return res.status(400).json({ error: 'Model name required' });
    const settings = store.getSettings();
    await deleteOllamaModel({ baseUrl: settings.ollama?.baseUrl, model });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings API
app.get('/api/settings', (_req, res) => {
  const s = store.getSettings();
  res.json({
    ...s,
    nineRouter: {
      ...s.nineRouter,
      hasApiKey: !!s.nineRouter?.apiKey,
      maskedApiKey: s.nineRouter?.apiKey
        ? `${s.nineRouter.apiKey.slice(0, 6)}...${s.nineRouter.apiKey.slice(-4)}`
        : '',
    },
  });
});

app.put('/api/settings', (req, res) => {
  const patch = { ...req.body };
  // Preserve existing apiKey unless explicitly updated
  if (patch.nineRouter && patch.nineRouter.apiKey === undefined) {
    patch.nineRouter.apiKey = store.getSettings().nineRouter?.apiKey || '';
  }
  const updated = store.updateSettings(patch);
  res.json({
    ...updated,
    nineRouter: {
      ...updated.nineRouter,
      hasApiKey: !!updated.nineRouter?.apiKey,
      maskedApiKey: updated.nineRouter?.apiKey
        ? `${updated.nineRouter.apiKey.slice(0, 6)}...${updated.nineRouter.apiKey.slice(-4)}`
        : '',
    },
  });
});

// Projects API
app.get('/api/projects', (_req, res) => {
  res.json({ projects: store.listProjects() });
});

app.get('/api/projects/:id', (req, res) => {
  const p = store.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(p);
});

app.post('/api/projects', (req, res) => {
  const p = store.createProject(req.body || {});
  res.status(201).json(p);
});

app.put('/api/projects/:id', (req, res) => {
  const p = store.updateProject(req.params.id, req.body || {});
  if (!p) return res.status(404).json({ error: 'Project not found' });
  res.json(p);
});

app.delete('/api/projects/:id', (req, res) => {
  const ok = store.deleteProject(req.params.id);
  res.json({ success: ok });
});

app.post('/api/projects/:id/knowledge', (req, res) => {
  const doc = store.addProjectKnowledge(req.params.id, req.body || {});
  if (!doc) return res.status(404).json({ error: 'Project not found' });
  res.status(201).json(doc);
});

app.delete('/api/projects/:id/knowledge/:docId', (req, res) => {
  const ok = store.removeProjectKnowledge(req.params.id, req.params.docId);
  res.json({ success: ok });
});

// Conversations API
app.get('/api/conversations', (_req, res) => {
  res.json({ conversations: store.listConversations() });
});

app.get('/api/conversations/:id', (req, res) => {
  const c = store.getConversation(req.params.id);
  if (!c) return res.status(404).json({ error: 'Conversation not found' });
  res.json(c);
});

app.post('/api/conversations', (req, res) => {
  const c = store.saveConversation(req.body || {});
  res.status(201).json(c);
});

app.put('/api/conversations/:id', (req, res) => {
  const c = store.saveConversation({ ...(req.body || {}), id: req.params.id });
  res.json(c);
});

app.delete('/api/conversations/:id', (req, res) => {
  const ok = store.deleteConversation(req.params.id);
  res.json({ success: ok });
});

app.post('/api/conversations/bulk-delete', (req, res) => {
  const count = store.bulkDeleteConversations(req.body?.ids || []);
  res.json({ deleted: count });
});

app.get('/api/artifacts', (_req, res) => {
  res.json({ artifacts: store.listAllArtifacts() });
});

app.get('/api/export', (_req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="openclaude-backup.json"');
  res.json(store.exportAll());
});

app.post('/api/import', (req, res) => {
  try {
    store.importData(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Optional Web URL context fetcher when user pastes a link with Web Context enabled
app.post('/api/web-fetch', async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Valid http/https URL required' });
    }
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 OpenClaude/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    const html = await resp.text();
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24000);
    res.json({ url, content: stripped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unified SSE Chat Streaming Endpoint
app.post('/api/chat/stream', async (req, res) => {
  const {
    backend = 'ollama',
    model,
    messages = [],
    conversationId,
    projectId,
    systemPromptOverride,
    styleId,
    extendedThinking,
    artifactsEnabled,
    temperature,
    maxTokens,
  } = req.body || {};

  if (!model) {
    return res.status(400).json({ error: 'Please select a model first.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  const sendEvent = (payload) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  try {
    const settings = store.getSettings();
    const conversation = conversationId ? store.getConversation(conversationId) : null;
    const effectiveProjectId = projectId || conversation?.projectId || null;
    const project = effectiveProjectId ? store.getProject(effectiveProjectId) : null;

    const systemPrompt = buildEffectiveSystemPrompt({
      settings,
      conversation: systemPromptOverride !== undefined ? { ...conversation, systemPromptOverride } : conversation,
      project,
      modelName: model,
      styleOverrideId: styleId,
      artifactsEnabled,
    });

    const genOpts = {
      ...settings.generation,
      extendedThinking: extendedThinking ?? settings.generation?.extendedThinking ?? false,
      temperature: temperature ?? settings.generation?.temperature ?? 0.7,
      maxTokens: maxTokens ?? settings.generation?.maxTokens ?? 8192,
    };

    sendEvent({ type: 'start', backend, model });

    if (backend === '9router') {
      await streamNineRouterChat({
        baseUrl: settings.nineRouter?.baseUrl,
        apiKey: settings.nineRouter?.apiKey,
        model,
        systemPrompt,
        messages,
        options: genOpts,
        signal: controller.signal,
        onChunk: sendEvent,
      });
    } else {
      await streamOllamaChat({
        baseUrl: settings.ollama?.baseUrl,
        model,
        systemPrompt,
        messages,
        options: genOpts,
        signal: controller.signal,
        onChunk: sendEvent,
      });
    }

    sendEvent({ type: 'done' });
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      sendEvent({ type: 'aborted' });
    } else {
      sendEvent({ type: 'error', error: err.message || 'Generation failed' });
    }
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

// Serve built SPA frontend in production mode
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.listen(PORT, '127.0.0.1', () => {
  pushSetupLog(`OpenClaude server listening on http://localhost:${PORT}`, 'success');
  // Kick off automated background check & startup for 9Router + Ollama!
  ensureAutoSetupOnBoot(store.getSettings()).catch((err) => {
    pushSetupLog(`Background setup warning: ${err.message}`, 'warn');
  });
});
