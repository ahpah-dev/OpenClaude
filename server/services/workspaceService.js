import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE = path.join(__dirname, '..', '..', 'workspace');

// Ensure default starter workspace exists
if (!fs.existsSync(DEFAULT_WORKSPACE)) {
  fs.mkdirSync(DEFAULT_WORKSPACE, { recursive: true });
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '__pycache__',
  '.venv',
  'venv',
  '.cache',
]);

// Keep in-memory undo stack of recent file modifications on disk
const undoHistory = [];
const MAX_UNDO = 60;

function recordUndoSnapshot(absPath, previousExists, previousContent, actionLabel) {
  undoHistory.unshift({
    id: `undo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    absPath,
    previousExists,
    previousContent,
    actionLabel,
    timestamp: new Date().toISOString(),
  });
  if (undoHistory.length > MAX_UNDO) undoHistory.pop();
}

export function getDefaultWorkspaceRoot() {
  return DEFAULT_WORKSPACE;
}

export function resolveSafeWorkspacePath(workspaceRoot, targetRelOrAbs = '') {
  const root = path.resolve(workspaceRoot || DEFAULT_WORKSPACE);
  if (!targetRelOrAbs) return root;
  const resolved = path.isAbsolute(targetRelOrAbs)
    ? path.resolve(targetRelOrAbs)
    : path.resolve(root, targetRelOrAbs);

  // Prevent accidental traversal outside selected workspace unless user explicitly set that root
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.toLowerCase().startsWith(rootWithSep.toLowerCase())) {
    throw new Error(`Path "${targetRelOrAbs}" is outside the active workspace (${root}). Change workspace folder first.`);
  }
  return resolved;
}

export function buildWorkspaceTree(workspaceRoot, { maxDepth = 4, showHidden = false } = {}) {
  const root = path.resolve(workspaceRoot || DEFAULT_WORKSPACE);
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }

  let fileCount = 0;
  const MAX_ENTRIES = 600;

  function walk(currentDir, depth) {
    if (depth > maxDepth || fileCount > MAX_ENTRIES) return [];
    let dirents = [];
    try {
      dirents = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return [];
    }

    dirents.sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const nodes = [];
    for (const d of dirents) {
      if (fileCount > MAX_ENTRIES) break;
      if (!showHidden && d.name.startsWith('.') && d.name !== '.env.example' && d.name !== '.gitignore') {
        if (d.name === '.git' || d.name === '.DS_Store') continue;
      }
      if (d.isDirectory() && IGNORED_DIRS.has(d.name)) continue;

      const abs = path.join(currentDir, d.name);
      const rel = path.relative(root, abs).replace(/\\/g, '/');

      if (d.isDirectory()) {
        nodes.push({
          name: d.name,
          path: rel,
          type: 'directory',
          children: walk(abs, depth + 1),
        });
      } else {
        fileCount++;
        let size = 0;
        let mtime = null;
        try {
          const st = fs.statSync(abs);
          size = st.size;
          mtime = st.mtime.toISOString();
        } catch {
          // ignore
        }
        nodes.push({
          name: d.name,
          path: rel,
          type: 'file',
          ext: path.extname(d.name).slice(1).toLowerCase(),
          size,
          mtime,
        });
      }
    }
    return nodes;
  }

  const tree = walk(root, 1);
  return {
    root,
    name: path.basename(root) || root,
    tree,
    fileCount,
    undoStack: undoHistory.slice(0, 15).map(({ previousContent, ...meta }) => meta),
  };
}

export function flattenTreeSummary(treeNodes = [], prefix = '') {
  const lines = [];
  for (const n of treeNodes) {
    if (n.type === 'directory') {
      lines.push(`${prefix}${n.name}/`);
      lines.push(...flattenTreeSummary(n.children || [], `${prefix}  `));
    } else {
      lines.push(`${prefix}${n.name} (${n.size}B)`);
    }
  }
  return lines;
}

export function readWorkspaceFile(workspaceRoot, filePath) {
  const abs = resolveSafeWorkspacePath(workspaceRoot, filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    throw new Error(`"${filePath}" is a directory, not a file.`);
  }
  if (stat.size > 2 * 1024 * 1024) {
    throw new Error(`File "${filePath}" is larger than 2 MB (${Math.round(stat.size / 1024)} KB).`);
  }
  const content = fs.readFileSync(abs, 'utf8');
  return {
    path: path.relative(path.resolve(workspaceRoot), abs).replace(/\\/g, '/'),
    absPath: abs,
    content,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
  };
}

export function writeWorkspaceFile(workspaceRoot, filePath, content = '') {
  const abs = resolveSafeWorkspacePath(workspaceRoot, filePath);
  const existed = fs.existsSync(abs);
  let prevContent = null;
  if (existed && fs.statSync(abs).isFile()) {
    try {
      prevContent = fs.readFileSync(abs, 'utf8');
    } catch {
      prevContent = null;
    }
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, String(content), 'utf8');

  const rel = path.relative(path.resolve(workspaceRoot), abs).replace(/\\/g, '/');
  recordUndoSnapshot(abs, existed, prevContent, `${existed ? 'Modified' : 'Created'} ${rel}`);

  return {
    success: true,
    created: !existed,
    path: rel,
    absPath: abs,
    lines: String(content).split('\n').length,
    bytes: Buffer.byteLength(String(content), 'utf8'),
  };
}

export function editWorkspaceFile(workspaceRoot, filePath, { search, replace }) {
  const abs = resolveSafeWorkspacePath(workspaceRoot, filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Cannot edit missing file: ${filePath}`);
  }
  const original = fs.readFileSync(abs, 'utf8');
  const normOriginal = original.replace(/\r\n/g, '\n');
  const normSearch = String(search || '').replace(/\r\n/g, '\n');
  const normReplace = String(replace ?? '').replace(/\r\n/g, '\n');

  if (!normSearch || !normOriginal.includes(normSearch)) {
    throw new Error(`Target block not found in ${filePath}. Read the file first or use write_file.`);
  }

  const updated = normOriginal.replace(normSearch, normReplace);
  fs.writeFileSync(abs, updated, 'utf8');

  const rel = path.relative(path.resolve(workspaceRoot), abs).replace(/\\/g, '/');
  recordUndoSnapshot(abs, true, original, `Edited ${rel}`);

  return {
    success: true,
    path: rel,
    absPath: abs,
    lines: updated.split('\n').length,
  };
}

export function deleteWorkspaceEntry(workspaceRoot, targetPath) {
  const abs = resolveSafeWorkspacePath(workspaceRoot, targetPath);
  if (abs === path.resolve(workspaceRoot)) {
    throw new Error('Cannot delete the workspace root folder itself.');
  }
  if (!fs.existsSync(abs)) return { success: true };

  const stat = fs.statSync(abs);
  const rel = path.relative(path.resolve(workspaceRoot), abs).replace(/\\/g, '/');
  if (stat.isFile() && stat.size < 1024 * 1024) {
    recordUndoSnapshot(abs, true, fs.readFileSync(abs, 'utf8'), `Deleted ${rel}`);
  }
  fs.rmSync(abs, { recursive: true, force: true });
  return { success: true, path: rel };
}

export function createWorkspaceDirectory(workspaceRoot, dirPath) {
  const abs = resolveSafeWorkspacePath(workspaceRoot, dirPath);
  fs.mkdirSync(abs, { recursive: true });
  return {
    success: true,
    path: path.relative(path.resolve(workspaceRoot), abs).replace(/\\/g, '/'),
  };
}

export function renameWorkspaceEntry(workspaceRoot, oldPath, newPath) {
  const absOld = resolveSafeWorkspacePath(workspaceRoot, oldPath);
  const absNew = resolveSafeWorkspacePath(workspaceRoot, newPath);
  fs.mkdirSync(path.dirname(absNew), { recursive: true });
  fs.renameSync(absOld, absNew);
  return {
    success: true,
    path: path.relative(path.resolve(workspaceRoot), absNew).replace(/\\/g, '/'),
  };
}

export function undoLastWorkspaceEdit(undoId = null) {
  const idx = undoId ? undoHistory.findIndex((u) => u.id === undoId) : 0;
  if (idx === -1 || undoHistory.length === 0) {
    throw new Error('No undo history available.');
  }
  const [entry] = undoHistory.splice(idx, 1);
  if (!entry.previousExists) {
    if (fs.existsSync(entry.absPath)) {
      fs.rmSync(entry.absPath, { force: true });
    }
  } else if (entry.previousContent !== null) {
    fs.mkdirSync(path.dirname(entry.absPath), { recursive: true });
    fs.writeFileSync(entry.absPath, entry.previousContent, 'utf8');
  }
  return {
    success: true,
    reverted: entry.actionLabel,
    absPath: entry.absPath,
  };
}

export function scaffoldNewProject(parentDir, projectName, template = 'web') {
  const cleanName = String(projectName || 'my-vibe-app')
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '-');
  const base = parentDir ? path.resolve(parentDir) : DEFAULT_WORKSPACE;
  const targetDir = path.join(base, cleanName);
  fs.mkdirSync(targetDir, { recursive: true });

  if (template === 'web') {
    fs.writeFileSync(
      path.join(targetDir, 'index.html'),
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${cleanName}</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main class="card">
    <span class="badge">OpenClaude Vibe Studio</span>
    <h1>${cleanName}</h1>
    <p>Edit files on your PC or ask Claude to build any app, game, or tool right in this folder.</p>
    <button id="ping">Test Interaction</button>
    <div id="out"></div>
  </main>
  <script src="app.js"></script>
</body>
</html>\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(targetDir, 'style.css'),
      `* { box-sizing: border-box; margin: 0; padding: 0; }
body { min-height: 100vh; display: grid; place-items: center; background: #FAF9F5; color: #141413; font-family: system-ui, sans-serif; }
.card { background: #FFF; border: 1px solid #E5E2D9; border-radius: 20px; padding: 36px; max-width: 480px; box-shadow: 0 8px 30px rgba(20,20,19,0.05); }
.badge { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #D97757; font-weight: 600; }
h1 { font-family: Georgia, serif; font-weight: 500; font-size: 30px; margin: 10px 0; }
p { color: #5C5A53; line-height: 1.6; font-size: 14px; margin-bottom: 20px; }
button { background: #D97757; color: #FFF; border: 0; padding: 10px 18px; border-radius: 10px; font-weight: 500; cursor: pointer; }
#out { margin-top: 14px; font-family: monospace; font-size: 12px; color: #278655; }\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(targetDir, 'app.js'),
      `let clicks = 0;
document.getElementById('ping').addEventListener('click', () => {
  clicks++;
  document.getElementById('out').textContent = \`Active on disk — clicked \${clicks} time(s)!\`;
});\n`,
      'utf8'
    );
  } else if (template === 'python') {
    fs.writeFileSync(
      path.join(targetDir, 'main.py'),
      `import sys\nimport platform\n\ndef main():\n    print(f"Running {__file__} on Python {sys.version.split()[0]} ({platform.system()})")\n\nif __name__ == "__main__":\n    main()\n`,
      'utf8'
    );
  } else if (template === 'node') {
    fs.writeFileSync(
      path.join(targetDir, 'package.json'),
      JSON.stringify(
        {
          name: cleanName.toLowerCase().replace(/\s+/g, '-'),
          version: '0.1.0',
          type: 'module',
          scripts: {
            start: 'node index.js',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    fs.writeFileSync(
      path.join(targetDir, 'index.js'),
      `console.log("Hello from ${cleanName} on Node", process.version);\n`,
      'utf8'
    );
  }

  return targetDir;
}

/**
 * Opens native OS Folder Picker Dialog on Windows (or macOS)
 */
export function pickFolderNativeDialog(initialPath = '') {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Select a PC folder for OpenClaude Vibe Coding"
$f.ShowNewFolderButton = $true
${initialPath && fs.existsSync(initialPath) ? `$f.SelectedPath = ${JSON.stringify(initialPath)}` : ''}
$top = New-Object System.Windows.Forms.Form
$top.TopMost = $true
$res = $f.ShowDialog($top)
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $f.SelectedPath
}
`;
      const child = spawn('powershell.exe', ['-NoProfile', '-STA', '-Command', psScript], {
        windowsHide: true,
      });
      let out = '';
      child.stdout.on('data', (d) => (out += d.toString()));
      child.on('close', () => {
        const picked = out.trim();
        resolve(picked || null);
      });
      child.on('error', () => resolve(null));
    } else if (process.platform === 'darwin') {
      exec(`osascript -e 'POSIX path of (choose folder with prompt "Select Workspace Folder")'`, (_err, stdout) => {
        resolve(stdout ? stdout.trim() : null);
      });
    } else {
      resolve(null);
    }
  });
}

export function openInSystemExplorer(targetPath) {
  const abs = path.resolve(targetPath || DEFAULT_WORKSPACE);
  if (process.platform === 'win32') {
    exec(`explorer.exe "${abs}"`, { windowsHide: true }, () => {});
  } else if (process.platform === 'darwin') {
    exec(`open "${abs}"`, () => {});
  } else {
    exec(`xdg-open "${abs}"`, () => {});
  }
}

export function getRunCommandForFile(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  if (ext === '.py') return `python "${relPath}"`;
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return `node "${relPath}"`;
  if (ext === '.ps1') return `powershell -ExecutionPolicy Bypass -File "${relPath}"`;
  if (ext === '.bat' || ext === '.cmd') return `cmd /c "${relPath}"`;
  if (ext === '.ts') return `npx tsx "${relPath}"`;
  if (ext === '.go') return `go run "${relPath}"`;
  if (ext === '.rs') return `rustc "${relPath}" && ./${path.basename(relPath, '.rs')}`;
  return null;
}

/**
 * Streams shell command execution inside workspaceRoot with clean process-tree abort
 */
export function streamWorkspaceCommand({ workspaceRoot, command, signal, onEvent }) {
  return new Promise((resolve) => {
    const cwd = path.resolve(workspaceRoot || DEFAULT_WORKSPACE);
    const startTime = Date.now();

    const isWin = process.platform === 'win32';
    const shellCmd = isWin ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWin
      ? ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]
      : ['-c', command];

    onEvent?.({
      type: 'start',
      cwd,
      command,
      shell: isWin ? 'PowerShell' : 'sh',
    });

    const child = spawn(shellCmd, shellArgs, {
      cwd,
      windowsHide: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const killTree = () => {
      if (!child.pid) return;
      try {
        if (isWin) {
          spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { windowsHide: true });
        } else {
          process.kill(-child.pid, 'SIGKILL');
        }
      } catch {
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    };

    if (signal) {
      if (signal.aborted) {
        killTree();
      } else {
        signal.addEventListener('abort', killTree, { once: true });
      }
    }

    child.stdout?.on('data', (chunk) => {
      onEvent?.({ type: 'stdout', text: chunk.toString() });
    });

    child.stderr?.on('data', (chunk) => {
      onEvent?.({ type: 'stderr', text: chunk.toString() });
    });

    child.on('close', (code) => {
      const durationMs = Date.now() - startTime;
      onEvent?.({
        type: 'exit',
        exitCode: code ?? 0,
        durationMs,
      });
      resolve({ exitCode: code ?? 0, durationMs });
    });

    child.on('error', (err) => {
      onEvent?.({ type: 'stderr', text: `\nFailed to spawn command: ${err.message}\n` });
      onEvent?.({ type: 'exit', exitCode: 1, durationMs: Date.now() - startTime });
      resolve({ exitCode: 1, durationMs: Date.now() - startTime });
    });
  });
}
