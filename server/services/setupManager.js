import { spawn, exec, execFile } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const setupLogs = [];
const MAX_LOGS = 300;

export function pushSetupLog(message, level = 'info') {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    message: String(message).trim(),
  };
  if (!entry.message) return;
  setupLogs.push(entry);
  if (setupLogs.length > MAX_LOGS) setupLogs.shift();
  console.log(`[OpenClaude Setup] [${level.toUpperCase()}] ${entry.message}`);
}

export function getSetupLogs() {
  return [...setupLogs];
}

export function checkTcpPort(port, host = '127.0.0.1', timeoutMs = 1200) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
  });
}

export async function waitPortReady(port, { timeoutMs = 20000, intervalMs = 300 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await checkTcpPort(port)) return true;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

export async function getCommandVersion(cmd) {
  try {
    const { stdout } = await execAsync(`${cmd} --version`, {
      timeout: 6000,
      windowsHide: true,
    });
    return stdout.trim().split(/\r?\n/)[0] || 'installed';
  } catch {
    return null;
  }
}

export async function resolveNineRouterCliJs() {
  try {
    const { stdout } = await execAsync('npm root -g', { timeout: 5000, windowsHide: true });
    const globalRoot = stdout.trim();
    const cliPath = path.join(globalRoot, '9router', 'cli.js');
    if (fs.existsSync(cliPath)) return cliPath;
  } catch {
    // fallback
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    const fallback = path.join(process.env.APPDATA, 'npm', 'node_modules', '9router', 'cli.js');
    if (fs.existsSync(fallback)) return fallback;
  }
  return null;
}

export async function checkSystemStatus(settings) {
  const ninePort = settings?.nineRouter?.port || 20128;
  const nineUrl = (settings?.nineRouter?.baseUrl || `http://127.0.0.1:${ninePort}`).replace(/\/+$/, '');
  const ollamaUrl = (settings?.ollama?.baseUrl || 'http://127.0.0.1:11434').replace(/\/+$/, '');

  const [nineCliPath, nineVersion, ollamaVersionRaw, ninePortOpen] = await Promise.all([
    resolveNineRouterCliJs(),
    getCommandVersion('9router'),
    getCommandVersion('ollama'),
    checkTcpPort(ninePort),
  ]);

  let nineModelsCount = 0;
  let nineReachable = false;
  if (ninePortOpen) {
    try {
      const headers = { Accept: 'application/json' };
      if (settings?.nineRouter?.apiKey) {
        headers.Authorization = `Bearer ${settings.nineRouter.apiKey}`;
      }
      const res = await fetch(`${nineUrl}/v1/models`, {
        headers,
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        nineReachable = true;
        const json = await res.json();
        nineModelsCount = Array.isArray(json?.data) ? json.data.length : 0;
      } else if (res.status === 401) {
        nineReachable = true;
      }
    } catch {
      nineReachable = ninePortOpen;
    }
  }

  let ollamaReachable = false;
  let ollamaModelsCount = 0;
  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      ollamaReachable = true;
      const json = await res.json();
      ollamaModelsCount = Array.isArray(json?.models) ? json.models.length : 0;
    }
  } catch {
    ollamaReachable = false;
  }

  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: os.arch(),
    nineRouter: {
      installed: !!(nineCliPath || nineVersion),
      version: nineVersion,
      cliPath: nineCliPath,
      running: nineReachable,
      port: ninePort,
      baseUrl: nineUrl,
      dashboardUrl: `http://localhost:${ninePort}/dashboard`,
      modelsCount: nineModelsCount,
      hasApiKey: !!settings?.nineRouter?.apiKey,
    },
    ollama: {
      installed: !!ollamaVersionRaw,
      version: ollamaVersionRaw ? ollamaVersionRaw.replace(/^ollama version is\s+/i, '') : null,
      running: ollamaReachable,
      baseUrl: ollamaUrl,
      modelsCount: ollamaModelsCount,
    },
    logs: getSetupLogs().slice(-50),
  };
}

export function installNineRouter({ onProgress } = {}) {
  return new Promise((resolve) => {
    pushSetupLog('Installing / updating 9Router globally via npm (npm install -g 9router@latest)...');
    onProgress?.({ stage: '9router-install', message: 'Running npm install -g 9router@latest...' });

    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(npmCmd, ['install', '-g', '9router@latest', '--no-fund', '--no-audit'], {
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        pushSetupLog(`[npm] ${text}`);
        onProgress?.({ stage: '9router-install', message: text });
      }
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString().trim();
      if (text) {
        pushSetupLog(`[npm] ${text}`, 'warn');
        onProgress?.({ stage: '9router-install', message: text });
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        pushSetupLog('9Router installed successfully!', 'success');
        onProgress?.({ stage: '9router-install', done: true, success: true, message: '9Router installed!' });
        resolve({ success: true });
      } else {
        pushSetupLog(`9Router install exited with code ${code}`, 'error');
        onProgress?.({ stage: '9router-install', done: true, success: false, message: `Exit code ${code}` });
        resolve({ success: false, error: `npm exited with code ${code}` });
      }
    });

    child.on('error', (err) => {
      pushSetupLog(`Failed to spawn npm: ${err.message}`, 'error');
      resolve({ success: false, error: err.message });
    });
  });
}

export async function startNineRouter(port = 20128) {
  const alreadyUp = await checkTcpPort(port);
  if (alreadyUp) {
    pushSetupLog(`9Router gateway & dashboard already active on http://localhost:${port}/dashboard`, 'success');
    return { success: true, alreadyRunning: true, dashboardUrl: `http://localhost:${port}/dashboard` };
  }

  let cliPath = await resolveNineRouterCliJs();
  if (!cliPath) {
    pushSetupLog('9Router not found locally — downloading and installing automatically...');
    const installRes = await installNineRouter();
    if (!installRes.success) {
      return { success: false, error: installRes.error || 'Failed to install 9Router' };
    }
    cliPath = await resolveNineRouterCliJs();
  }

  pushSetupLog(`Starting 9Router daemon & dashboard on port ${port}...`);

  if (cliPath) {
    const child = spawn(
      process.execPath,
      ['--dns-result-order=ipv4first', cliPath, '--tray', '--skip-update', '--no-browser', '-p', String(port)],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: { ...process.env, TRAY_MODE: '1' },
      }
    );
    child.unref();
  } else {
    const cmd = process.platform === 'win32' ? '9router.cmd' : '9router';
    const child = spawn(cmd, ['--tray', '--skip-update', '--no-browser', '-p', String(port)], {
      detached: true,
      stdio: 'ignore',
      shell: process.platform === 'win32',
      windowsHide: true,
    });
    child.unref();
  }

  const ready = await waitPortReady(port, { timeoutMs: 22000 });
  if (ready) {
    pushSetupLog(`9Router gateway & dashboard started at http://localhost:${port}/dashboard`, 'success');
    return { success: true, dashboardUrl: `http://localhost:${port}/dashboard` };
  }

  pushSetupLog(`Timed out waiting for 9Router on port ${port}`, 'error');
  return { success: false, error: `Timed out waiting for port ${port}` };
}

export async function startOllama() {
  try {
    const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(1800) });
    if (res.ok) {
      pushSetupLog('Ollama local server already active on http://127.0.0.1:11434', 'success');
      return { success: true, alreadyRunning: true };
    }
  } catch {
    // Need to start
  }

  const ver = await getCommandVersion('ollama');
  if (!ver) {
    pushSetupLog('Ollama CLI is not installed yet. You can install it in 1 click from OpenClaude Settings.', 'warn');
    return { success: false, notInstalled: true, error: 'Ollama is not installed on PATH' };
  }

  pushSetupLog('Starting local Ollama server (ollama serve)...');
  const child = spawn('ollama', ['serve'], {
    detached: true,
    stdio: 'ignore',
    shell: process.platform === 'win32',
    windowsHide: true,
    env: { ...process.env, OLLAMA_ORIGINS: '*' },
  });
  child.unref();

  const ready = await waitPortReady(11434, { timeoutMs: 15000 });
  if (ready) {
    pushSetupLog('Ollama local engine started on http://127.0.0.1:11434', 'success');
    return { success: true };
  }
  return { success: false, error: 'Timed out starting ollama serve' };
}

export function installOllama({ onProgress } = {}) {
  return new Promise((resolve) => {
    pushSetupLog('Downloading and installing Ollama...');
    onProgress?.({ stage: 'ollama-install', message: 'Starting automated Ollama installation...' });

    let cmd;
    let args;
    if (process.platform === 'win32') {
      cmd = 'winget';
      args = ['install', '-e', '--id', 'Ollama.Ollama', '--accept-package-agreements', '--accept-source-agreements'];
    } else if (process.platform === 'darwin') {
      cmd = 'brew';
      args = ['install', '--cask', 'ollama'];
    } else {
      cmd = 'sh';
      args = ['-c', 'curl -fsSL https://ollama.com/install.sh | sh'];
    }

    const child = spawn(cmd, args, {
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    child.stdout?.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) {
        pushSetupLog(`[ollama-install] ${msg}`);
        onProgress?.({ stage: 'ollama-install', message: msg });
      }
    });
    child.stderr?.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) {
        pushSetupLog(`[ollama-install] ${msg}`);
        onProgress?.({ stage: 'ollama-install', message: msg });
      }
    });
    child.on('close', async (code) => {
      if (code === 0) {
        pushSetupLog('Ollama installed! Starting server...', 'success');
        await startOllama();
        onProgress?.({ stage: 'ollama-install', done: true, success: true, message: 'Ollama installed & started!' });
        resolve({ success: true });
      } else {
        pushSetupLog(`Ollama installer exited with code ${code}. Visit https://ollama.com/download if needed.`, 'warn');
        onProgress?.({ stage: 'ollama-install', done: true, success: false, message: `Installer code ${code}` });
        resolve({ success: false, error: `Installer exited with code ${code}` });
      }
    });
    child.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

export function openExternalUrl(url) {
  let cmd;
  if (process.platform === 'win32') {
    cmd = `start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    cmd = `open "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }
  exec(cmd, { windowsHide: true }, () => {});
}

let bootPromise = null;
export async function ensureAutoSetupOnBoot(settings) {
  if (bootPromise) return bootPromise;
  bootPromise = (async () => {
    pushSetupLog('OpenClaude automated environment bootstrap initiated...');
    if (settings?.nineRouter?.autoStart !== false) {
      await startNineRouter(settings?.nineRouter?.port || 20128);
    }
    if (settings?.ollama?.autoStart !== false) {
      await startOllama();
    }
    pushSetupLog('Environment bootstrap check complete.');
  })();
  return bootPromise;
}
