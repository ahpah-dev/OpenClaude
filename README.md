# ✦ OpenClaude

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](LICENSE)
[![9Router: MIT](https://img.shields.io/badge/9Router-MIT%20License-D97757.svg)](NOTICE)
[![Website](https://img.shields.io/badge/Website-ahpah--dev.github.io%2FOpenClaude-141413.svg)](https://ahpah-dev.github.io/OpenClaude/)

**OpenClaude** is a complete local desktop & web application replicating the **Claude.ai** interface, typography, Artifacts engine, Projects workspace, Writing Styles, Extended Thinking, Conversation Branching, Customizable System Prompts, and a built-in **Vibe Coding Studio** for editing and running files directly on your PC—powered seamlessly by **[9Router](https://github.com/decolua/9router)** (`localhost:20128`) and **Local [Ollama](https://ollama.com/)** (`localhost:11434`).

🌐 **Landing Page:** **[https://ahpah-dev.github.io/OpenClaude/](https://ahpah-dev.github.io/OpenClaude/)**

---

## ⚡ Quick Start

### Option A — Native Windows Desktop App (`OpenClaude.exe`)
```powershell
git clone https://github.com/ahpah-dev/OpenClaude.git
cd OpenClaude
powershell -ExecutionPolicy Bypass -File .\Create-Desktop-Shortcut.ps1
.\OpenClaude.exe
```
*(Launches a native chromeless OpenClaude window with custom Anthropic-styled Desktop icon, system tray controller, and automatic background startup of OpenClaude `:3099`, 9Router `:20128`, and Ollama `:11434`. You can also run `OpenClaude.bat`.)*

### Option B — Cross-Platform CLI (Windows / macOS / Linux)
```bash
git clone https://github.com/ahpah-dev/OpenClaude.git
cd OpenClaude
npm install
npm run build
npm start
```
Then open **http://localhost:3099** (and **http://localhost:20128/dashboard** for 9Router).

---

## ✨ Features

1. **Automated Setup & Daemon Orchestration**
   - Automatically verifies, downloads/installs (`npm install -g 9router@latest`), and starts the **9Router** gateway & live dashboard (`http://localhost:20128/dashboard`) in background tray mode.
   - Automatically detects and starts **Local Ollama** (`ollama serve` on `http://127.0.0.1:11434`), shows live GPU VRAM residency, and includes a 1-click **Model Puller** with real-time download progress bars.
   - Embeds the live **9Router Dashboard** directly inside OpenClaude (plus 1-click external browser popout and automatic API key provisioning via your dashboard password or pasted `sk-...` key).

2. **Authentic Claude.ai Interface**
   - Warm parchment light mode (`#FAF9F5`) & warm obsidian dark mode (`#21201E`), plus system auto-switching.
   - Literary serif prose (`Source Serif 4`), humanist sans UI (`Plus Jakarta Sans`), and `JetBrains Mono` code blocks (configurable in **Settings → Appearance**).
   - Time-of-day personalized greetings, collapsible rail sidebar, Starred & Recent threads, and full `/chats` history archive.
   - Large pasted text (`>1,500` characters) automatically converts into compact `PASTED` attachment cards just like Claude.ai, alongside image vision & code/document drag-and-drop.

3. **Full Claude Artifacts Engine (Split-Screen Live Sandbox)**
   - Supports `<antArtifact>` streaming XML **and** automatic fallback promotion of HTML, React/JSX, SVG, and Mermaid code blocks from smaller local models.
   - Live sandboxed **HTML5 / Canvas / Three.js WebGL**, **React 18 + Tailwind CSS + Lucide Icons**, **SVG** (zoomable), **Mermaid Diagrams**, and **Markdown Documents**.
   - Includes **Preview | Code** toggle, live code editing, responsive viewport testing (Desktop / Tablet / Mobile), multi-turn **Version History (`v1`, `v2`...)**, runtime error detection with 1-click **"Fix with Claude"**, file downloads, and standalone tab launch.

4. **Vibe Coding Studio (Local PC File Editor & Runner)**
   - Point OpenClaude at any directory on your PC (native Windows folder picker or direct path) or scaffold new Web, Node.js, or Python projects in 1 click.
   - Multi-tab code editor (`Ctrl+S` save, `Ctrl+Enter` 1-click file runner), live multi-file HTML/localhost preview tab, and a docked streaming PowerShell terminal with process kill & 1-click **"Fix Error with Claude"**.
   - Autonomous **Vibe Agent** (`<ocAction>` protocol) that reads, writes, diff-edits, and runs commands directly on your machine with an `Auto-apply` toggle and a 60-step **Undo** history.
   - **Save to PC** button inside every Claude Artifact to export generated apps straight into your local Vibe Studio workspace.

5. **Customizable System Prompt, Writing Styles & Claude Projects**
   - **Master System Prompt Editor** in **Settings → System Prompt** with presets, dynamic variables (`{{date}}`, `{{user_name}}`, `{{model}}`, `{{os}}`), plus **Per-Chat System Prompt Overrides** right in the conversation header.
   - **Writing Styles**: *Normal*, *Concise*, *Explanatory*, *Formal*, plus unlimited custom user styles.
   - **Claude Projects**: Dedicated workspaces with custom **Project Instructions** and **Project Knowledge Base** documents automatically injected into every chat in that project.
   - **Message Branching (`< 1 / 2 >`)** when editing any user message or regenerating any Claude response, plus collapsible **Extended Thinking** (`Thought for X.Xs`).

---

## 📄 License & Copyright Notice

### OpenClaude — The Unlicense (Public Domain)
All original source code in **OpenClaude** is released into the public domain under **[The Unlicense](LICENSE)**. See [LICENSE](LICENSE) for full details.

### 9Router — MIT License Copyright Notice
OpenClaude integrates with and automates setup for **[9Router](https://github.com/decolua/9router)**, which is distributed under the MIT License. In accordance with 9Router's MIT License, the following copyright and permission notice is retained (see also [NOTICE](NOTICE) and [LICENSE](LICENSE)):

> **MIT License**
>
> **Copyright (c) 2026 9Router Contributors**
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
