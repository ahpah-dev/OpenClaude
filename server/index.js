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
import {
  getDefaultWorkspaceRoot,
  resolveSafeWorkspacePath,
  buildWorkspaceTree,
  flattenTreeSummary,
  readWorkspaceFile,
  writeWorkspaceFile,
  editWorkspaceFile,
  deleteWorkspaceEntry,
  createWorkspaceDirectory,
  renameWorkspaceEntry,
  undoLastWorkspaceEdit,
  scaffoldNewProject,
  pickFolderNativeDialog,
  openInSystemExplorer,
  getRunCommandForFile,
  streamWorkspaceCommand,
} from './services/workspaceService.js';

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

function buildVibeCodingPromptBlock(workspaceRoot) {
  let treeLines = '(empty directory)';
  try {
    const { tree } = buildWorkspaceTree(workspaceRoot, { maxDepth: 3 });
    const flat = flattenTreeSummary(tree).slice(0, 120);
    if (flat.length > 0) treeLines = flat.join('\n');
  } catch {
    // ignore
  }

  return `
<vibe_coding_workspace>
You are operating inside OpenClaude Vibe Coding Studio with direct local PC file & shell tools rooted at:
Workspace Directory: ${workspaceRoot}

Current Files on Disk:
${treeLines}

Whenever creating, editing, reading, deleting, or running files on the user's PC, emit structured <ocAction> tags (NOT markdown code fences for file writes):

1. Create or overwrite a file on disk (always write complete, runnable code with zero placeholders):
<ocAction type="write_file" path="index.html">
<!DOCTYPE html>
...complete file content...
</ocAction>

2. Apply a targeted edit to an existing file:
<ocAction type="edit_file" path="src/app.js">
<search>
exact lines to find
</search>
<replace>
new lines
</replace>
</ocAction>

3. Read an existing file before editing if you haven't seen its contents yet:
<ocAction type="read_file" path="package.json"></ocAction>

4. Execute a shell command inside the workspace directory (tests, scripts, builds, installs):
<ocAction type="run_command">node index.js</ocAction>

5. Delete an obsolete file:
<ocAction type="delete_file" path="old.txt"></ocAction>

Rules:
- Always use clean relative paths inside the workspace (e.g., "index.html", "style.css", "src/main.py").
- You can emit multiple <ocAction> blocks in a single turn to scaffold complete multi-file apps!
- Keep surrounding explanation concise and direct.
</vibe_coding_workspace>`;
}

function getEffectiveWorkspaceRoot() {
  const saved = store.getSettings()?.vibeWorkspace?.rootPath;
  if (saved && fs.existsSync(saved)) return path.resolve(saved);
  return getDefaultWorkspaceRoot();
}

function buildEffectiveSystemPrompt({
  settings,
  conversation,
  project,
  modelName,
  styleOverrideId,
  artifactsEnabled,
  vibeMode = false,
  workspaceRoot = null,
}) {
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

  if (vibeMode) {
    prompt += `\n\n${buildVibeCodingPromptBlock(workspaceRoot || getEffectiveWorkspaceRoot())}`;
  } else {
    const shouldIncludeArtifacts =
      artifactsEnabled !== false &&
      settings?.generation?.artifactsEnabled !== false &&
      settings?.systemPrompt?.enableArtifactsProtocol !== false;

    if (shouldIncludeArtifacts) {
      prompt += `\n\n${ARTIFACTS_SYSTEM_SPEC}`;
    }
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

app.post('/api/system/install-9router', async (_req, res) => {
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

// ============================================================================
// LOCAL PC VIBE CODING WORKSPACE & TERMINAL ENDPOINTS
// ============================================================================

app.get('/api/workspace/tree', (_req, res) => {
  try {
    const root = getEffectiveWorkspaceRoot();
    res.json(buildWorkspaceTree(root));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspace/set-root', (req, res) => {
  try {
    const rawPath = (req.body?.rootPath || '').trim();
    if (!rawPath) return res.status(400).json({ error: 'Folder path is required.' });
    const resolved = path.resolve(rawPath);
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Selected path is not a directory.' });
    }
    const settings = store.getSettings();
    store.updateSettings({
      vibeWorkspace: {
        ...(settings.vibeWorkspace || {}),
        rootPath: resolved,
      },
    });
    res.json(buildWorkspaceTree(resolved));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workspace/pick-folder', async (_req, res) => {
  try {
    const current = getEffectiveWorkspaceRoot();
    const picked = await pickFolderNativeDialog(current);
    if (!picked) {
      return res.json({ cancelled: true });
    }
    const settings = store.getSettings();
    store.updateSettings({
      vibeWorkspace: {
        ...(settings.vibeWorkspace || {}),
        rootPath: picked,
      },
    });
    res.json({ cancelled: false, ...buildWorkspaceTree(picked) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/workspace/new-project', (req, res) => {
  try {
    const { name, template = 'web', parentDir } = req.body || {};
    const createdDir = scaffoldNewProject(parentDir || getDefaultWorkspaceRoot(), name, template);
    const settings = store.getSettings();
    store.updateSettings({
      vibeWorkspace: {
        ...(settings.vibeWorkspace || {}),
        rootPath: createdDir,
      },
    });
    res.json(buildWorkspaceTree(createdDir));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/workspace/file', (req, res) => {
  try {
    const filePath = String(req.query.path || '');
    if (!filePath) return res.status(400).json({ error: 'path query parameter required' });
    const data = readWorkspaceFile(getEffectiveWorkspaceRoot(), filePath);
    res.json({
      ...data,
      runCommand: getRunCommandForFile(data.path),
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/workspace/file', (req, res) => {
  try {
    const { path: filePath, content = '' } = req.body || {};
    if (!filePath) return res.status(400).json({ error: 'File path is required' });
    const result = writeWorkspaceFile(getEffectiveWorkspaceRoot(), filePath, content);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workspace/edit', (req, res) => {
  try {
    const { path: filePath, search, replace } = req.body || {};
    if (!filePath) return res.status(400).json({ error: 'File path is required' });
    const result = editWorkspaceFile(getEffectiveWorkspaceRoot(), filePath, { search, replace });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/workspace/file', (req, res) => {
  try {
    const targetPath = req.body?.path || req.query?.path;
    if (!targetPath) return res.status(400).json({ error: 'Target path required' });
    res.json(deleteWorkspaceEntry(getEffectiveWorkspaceRoot(), targetPath));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workspace/mkdir', (req, res) => {
  try {
    const { path: dirPath } = req.body || {};
    if (!dirPath) return res.status(400).json({ error: 'Directory path required' });
    res.json(createWorkspaceDirectory(getEffectiveWorkspaceRoot(), dirPath));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workspace/rename', (req, res) => {
  try {
    const { oldPath, newPath } = req.body || {};
    res.json(renameWorkspaceEntry(getEffectiveWorkspaceRoot(), oldPath, newPath));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workspace/undo', (req, res) => {
  try {
    res.json(undoLastWorkspaceEdit(req.body?.undoId || null));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/workspace/open-explorer', (req, res) => {
  const root = getEffectiveWorkspaceRoot();
  const sub = req.body?.path ? resolveSafeWorkspacePath(root, req.body.path) : root;
  openInSystemExplorer(sub);
  res.json({ success: true });
});

app.post('/api/workspace/exec', async (req, res) => {
  const { command, cwd } = req.body || {};
  if (!command || !String(command).trim()) {
    return res.status(400).json({ error: 'Command required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  const send = (obj) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(obj)}\n\n`);
    }
  };

  try {
    const root = cwd ? resolveSafeWorkspacePath(getEffectiveWorkspaceRoot(), cwd) : getEffectiveWorkspaceRoot();
    await streamWorkspaceCommand({
      workspaceRoot: root,
      command: String(command),
      signal: controller.signal,
      onEvent: send,
    });
  } catch (err) {
    send({ type: 'stderr', text: `${err.message}\n` });
    send({ type: 'exit', exitCode: 1, durationMs: 0 });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

// Serve live workspace static files for multi-file HTML/JS/CSS/3D previews!
app.get('/api/workspace/preview/{*relPath}', (req, res) => {
  try {
    const rawParam = Array.isArray(req.params.relPath)
      ? req.params.relPath.join('/')
      : req.params.relPath || 'index.html';
    const abs = resolveSafeWorkspacePath(getEffectiveWorkspaceRoot(), rawParam);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
      const idx = path.join(abs, 'index.html');
      if (fs.existsSync(idx)) return res.sendFile(idx);
      return res.status(404).send('File not found in workspace');
    }
    res.sendFile(abs);
  } catch (err) {
    res.status(403).send(err.message);
  }
});

// ============================================================================
// UNIFIED MODELS, SETTINGS, PROJECTS & CONVERSATIONS
// ============================================================================

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

// Unified SSE Chat Streaming Endpoint (supports both Standard Artifacts Mode & Vibe Coding PC Mode)
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
    vibeMode = false,
    workspaceRoot = null,
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
      vibeMode: !!vibeMode,
      workspaceRoot: workspaceRoot || getEffectiveWorkspaceRoot(),
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
  ensureAutoSetupOnBoot(store.getSettings()).catch((err) => {
    pushSetupLog(`Background setup warning: ${err.message}`, 'warn');
  });
});
