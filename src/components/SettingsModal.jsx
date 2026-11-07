import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Sliders,
  Feather,
  Palette,
  Gauge,
  Cpu,
  Database,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Download,
  Upload,
  Play,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { apiRequest, consumeSSE } from '../lib/api.js';

const POPULAR_OLLAMA_MODELS = [
  { tag: 'qwen2.5-coder:7b', desc: 'Fast coding & Artifacts powerhouse (4.7 GB)' },
  { tag: 'llama3.2:3b', desc: 'Ultra-fast everyday local assistant (2.0 GB)' },
  { tag: 'deepseek-r1:7b', desc: 'Strong local Extended Thinking model (4.7 GB)' },
  { tag: 'gemma3:4b', desc: 'Multimodal vision + clean prose (3.3 GB)' },
];

export default function SettingsModal({
  initialTab = 'profile',
  settings,
  systemStatus,
  modelsData,
  onClose,
  onSaveSettings,
  onRefreshSystem,
}) {
  const [tab, setTab] = useState(initialTab);
  const [savedBanner, setSavedBanner] = useState(false);

  // Local editable form state synced from settings
  const [profile, setProfile] = useState(settings?.profile || {});
  const [appearance, setAppearance] = useState(settings?.appearance || {});
  const [sysPrompt, setSysPrompt] = useState(settings?.systemPrompt || {});
  const [generation, setGeneration] = useState(settings?.generation || {});
  const [styles, setStyles] = useState(settings?.styles || []);

  // Custom style creator
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleDesc, setNewStyleDesc] = useState('');
  const [newStyleInst, setNewStyleInst] = useState('');

  // 9Router connect state
  const [nineBaseUrl, setNineBaseUrl] = useState(settings?.nineRouter?.baseUrl || 'http://127.0.0.1:20128');
  const [nineApiKeyInput, setNineApiKeyInput] = useState('');
  const [ninePasswordInput, setNinePasswordInput] = useState('');
  const [nineConnectMsg, setNineConnectMsg] = useState(null);
  const [nineBusy, setNineBusy] = useState(false);

  // Ollama pull state
  const [pullModelTag, setPullModelTag] = useState('');
  const [pullProgress, setPullProgress] = useState(null);
  const [pulling, setPulling] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const flashSaved = () => {
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 1800);
  };

  const persistPatch = async (patch) => {
    await onSaveSettings(patch);
    flashSaved();
  };

  const presets = settings?.presets || [];

  const insertPromptVar = (token) => {
    setSysPrompt((prev) => ({
      ...prev,
      customSystemPrompt: `${prev.customSystemPrompt || ''}${prev.customSystemPrompt?.endsWith(' ') ? '' : ' '}${token}`,
    }));
  };

  const handleConnectNineRouter = async (e) => {
    e?.preventDefault();
    setNineBusy(true);
    setNineConnectMsg(null);
    try {
      const res = await apiRequest('/api/system/9router-connect', {
        method: 'POST',
        body: {
          baseUrl: nineBaseUrl,
          apiKey: nineApiKeyInput.trim(),
          password: ninePasswordInput,
        },
      });
      setNineConnectMsg({
        ok: true,
        text: `Connected! Active API key (${res.maskedKey}) verified with ${res.modelsCount} 9Router models.`,
      });
      setNineApiKeyInput('');
      setNinePasswordInput('');
      await onRefreshSystem?.();
    } catch (err) {
      setNineConnectMsg({ ok: false, text: err.message });
    } finally {
      setNineBusy(false);
    }
  };

  const handlePullOllama = async (tagToPull) => {
    const target = (tagToPull || pullModelTag).trim();
    if (!target || pulling) return;
    setPulling(true);
    setPullProgress({ status: `Requesting ${target}...`, percent: 0 });
    try {
      await consumeSSE('/api/ollama/pull', {
        body: { model: target },
        onEvent: (ev) => {
          if (ev.error) {
            setPullProgress({ status: `Error: ${ev.error}`, error: true });
          } else {
            setPullProgress(ev);
          }
        },
      });
      setPullModelTag('');
      await onRefreshSystem?.();
    } catch (err) {
      setPullProgress({ status: `Failed: ${err.message}`, error: true });
    } finally {
      setPulling(false);
    }
  };

  const handleDeleteOllama = async (modelName) => {
    try {
      await apiRequest('/api/ollama/models', {
        method: 'DELETE',
        body: { model: modelName },
      });
      await onRefreshSystem?.();
    } catch (err) {
      alert(err.message);
    }
  };

  const navTabs = [
    { id: 'profile', label: 'Profile', Icon: User },
    { id: 'system-prompt', label: 'System Prompt', Icon: Sliders },
    { id: 'styles', label: 'Writing Styles', Icon: Feather },
    { id: 'appearance', label: 'Appearance', Icon: Palette },
    { id: '9router', label: '9Router Gateway', Icon: Gauge },
    { id: 'ollama', label: 'Local Ollama', Icon: Cpu },
    { id: 'parameters', label: 'Model Parameters', Icon: Sparkles },
    { id: 'data', label: 'Data & Backup', Icon: Database },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl h-[86vh] rounded-3xl border flex flex-col md:flex-row overflow-hidden animate-claude-in"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        {/* Left Claude Settings Navigation */}
        <div
          className="w-full md:w-60 border-b md:border-b-0 md:border-r p-4 flex flex-col justify-between shrink-0"
          style={{
            backgroundColor: 'var(--bg-sidebar)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div>
            <div className="px-2 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                Settings
              </h2>
              <button type="button" onClick={onClose} className="md:hidden p-1 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <nav className="flex md:flex-col gap-1 overflow-x-auto">
              {navTabs.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--bg-sidebar-active)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    <Icon size={15} className={active ? 'text-[#D97757]' : ''} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {savedBanner && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              <Check size={14} />
              <span>Settings saved</span>
            </div>
          )}
        </div>

        {/* Right Main Settings Body */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="hidden md:flex items-center justify-end px-6 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-8 pt-2 space-y-6">
            {/* TAB 1: PROFILE (Identical to Claude.ai Profile Settings) */}
            {tab === 'profile' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Profile & Personal Preferences
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Customize how Claude greets you and what personal context it remembers across chats.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5">Full name</label>
                    <input
                      value={profile.fullName || ''}
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5">What should Claude call you?</label>
                    <input
                      value={profile.nickname || ''}
                      onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">What best describes your work?</label>
                  <input
                    value={profile.workRole || ''}
                    onChange={(e) => setProfile({ ...profile, workRole: e.target.value })}
                    placeholder="Software Engineering, Design, Research, Student..."
                    className="w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    What personal preferences should Claude consider in responses?
                  </label>
                  <textarea
                    rows={5}
                    value={profile.personalPreferences || ''}
                    onChange={(e) => setProfile({ ...profile, personalPreferences: e.target.value })}
                    placeholder="e.g., Prefer TypeScript & modern React, skip beginner boilerplate explanations, use metric units, always include keyboard accessibility..."
                    className="w-full p-3.5 rounded-xl border text-sm leading-relaxed focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => persistPatch({ profile })}
                  className="px-5 py-2.5 rounded-xl bg-[#D97757] text-white text-xs font-medium hover:opacity-90 cursor-pointer"
                >
                  Save Profile Preferences
                </button>
              </div>
            )}

            {/* TAB 2: CUSTOMIZABLE SYSTEM PROMPT */}
            {tab === 'system-prompt' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Customizable System Prompt
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Full control over the foundational system instructions sent to every 9Router and Local Ollama model.
                  </p>
                </div>

                {/* Preset Templates */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                    Prompt Presets
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {presets.map((p) => {
                      const selected = sysPrompt.activePresetId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setSysPrompt({
                              ...sysPrompt,
                              activePresetId: p.id,
                              customSystemPrompt: p.prompt,
                            })
                          }
                          className="p-3 rounded-2xl border text-left transition cursor-pointer"
                          style={{
                            backgroundColor: 'var(--bg-surface)',
                            borderColor: selected ? 'var(--accent-claude)' : 'var(--border-subtle)',
                          }}
                        >
                          <div className="text-xs font-semibold flex items-center justify-between">
                            <span>{p.name}</span>
                            {selected && <Check size={13} className="text-[#D97757]" />}
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {p.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Master Prompt Editor */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="text-xs font-medium">Master System Prompt</label>
                    <div className="flex items-center gap-1 text-[11px]">
                      <span style={{ color: 'var(--text-muted)' }}>Insert variable:</span>
                      {['{{date}}', '{{user_name}}', '{{model}}', '{{os}}'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertPromptVar(v)}
                          className="px-2 py-0.5 rounded-md border font-mono hover:border-[#D97757] cursor-pointer"
                          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={10}
                    value={sysPrompt.customSystemPrompt || ''}
                    onChange={(e) =>
                      setSysPrompt({
                        ...sysPrompt,
                        activePresetId: 'custom',
                        customSystemPrompt: e.target.value,
                      })
                    }
                    className="w-full p-4 rounded-2xl border font-mono text-xs leading-relaxed focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  />
                </div>

                <div className="space-y-2.5 p-4 rounded-2xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-xs font-medium">Automatically append Claude Artifacts XML protocol</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Teaches any 9Router or Ollama model how to create live interactive HTML, React, SVG & Mermaid Artifacts.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={sysPrompt.enableArtifactsProtocol !== false}
                      onChange={(e) =>
                        setSysPrompt({ ...sysPrompt, enableArtifactsProtocol: e.target.checked })
                      }
                      className="accent-[#D97757] w-4 h-4 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <div className="text-xs font-medium">Inject Personal Profile Preferences</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Includes your work role and personal preferences from the Profile tab.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={sysPrompt.includePersonalPreferences !== false}
                      onChange={(e) =>
                        setSysPrompt({ ...sysPrompt, includePersonalPreferences: e.target.checked })
                      }
                      className="accent-[#D97757] w-4 h-4 cursor-pointer"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => persistPatch({ systemPrompt: sysPrompt })}
                  className="px-5 py-2.5 rounded-xl bg-[#D97757] text-white text-xs font-medium hover:opacity-90 cursor-pointer"
                >
                  Save System Prompt
                </button>
              </div>
            )}

            {/* TAB 3: WRITING STYLES */}
            {tab === 'styles' && (
              <div className="space-y-5 max-w-2xl">
                <div>
                  <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Writing Styles
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Tailor how Claude structures and phrases responses—just like Claude.ai Styles.
                  </p>
                </div>

                <div className="space-y-2">
                  {styles.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{st.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                            {st.builtIn ? 'Built-in' : 'Custom'}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {st.description}
                        </p>
                        {st.instructions && (
                          <p className="text-[11px] font-mono mt-1.5 opacity-75">{st.instructions}</p>
                        )}
                      </div>
                      {!st.builtIn && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = styles.filter((x) => x.id !== st.id);
                            setStyles(updated);
                            persistPatch({ styles: updated });
                          }}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <h4 className="text-sm font-semibold">Create Custom Style</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                      placeholder="Style Name (e.g., Socratic Tutor)"
                      className="px-3 py-2 rounded-xl border text-xs focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                    />
                    <input
                      value={newStyleDesc}
                      onChange={(e) => setNewStyleDesc(e.target.value)}
                      placeholder="Short subtitle"
                      className="px-3 py-2 rounded-xl border text-xs focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                    />
                  </div>
                  <textarea
                    rows={3}
                    value={newStyleInst}
                    onChange={(e) => setNewStyleInst(e.target.value)}
                    placeholder="Describe tone, formatting, voice, or paste a writing example for Claude to emulate..."
                    className="w-full p-3 rounded-xl border text-xs focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newStyleName.trim() || !newStyleInst.trim()) return;
                      const created = {
                        id: `style_${Date.now()}`,
                        name: newStyleName.trim(),
                        description: newStyleDesc.trim() || 'Custom user style',
                        instructions: newStyleInst.trim(),
                        builtIn: false,
                      };
                      const next = [...styles, created];
                      setStyles(next);
                      persistPatch({ styles: next, activeStyleId: created.id });
                      setNewStyleName('');
                      setNewStyleDesc('');
                      setNewStyleInst('');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Save Custom Style</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: APPEARANCE */}
            {tab === 'appearance' && (
              <div className="space-y-6 max-w-xl">
                <div>
                  <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Appearance
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Match Claude.ai’s warm parchment light mode, obsidian dark mode, and literary serif typography.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-2">Color Mode</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'light', title: 'Light', bg: '#FAF9F5', card: '#FFFFFF', text: '#141413' },
                      { id: 'dark', title: 'Dark', bg: '#21201E', card: '#2B2A27', text: '#F2F0E8' },
                      { id: 'system', title: 'Auto (System)', bg: 'linear-gradient(135deg, #FAF9F5 50%, #21201E 50%)', card: '#D97757', text: '#141413' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const next = { ...appearance, theme: opt.id };
                          setAppearance(next);
                          persistPatch({ appearance: next });
                        }}
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                          appearance.theme === opt.id ? 'ring-2 ring-[#D97757]' : ''
                        }`}
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                      >
                        <div
                          className="h-14 rounded-xl mb-2 border"
                          style={{ background: opt.bg, borderColor: 'rgba(128,128,128,0.2)' }}
                        />
                        <div className="text-xs font-semibold">{opt.title}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-2">Chat Font</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'serif', label: 'Default (Claude Serif)', sampleClass: 'font-serif' },
                      { id: 'sans', label: 'Match System (Sans)', sampleClass: 'font-sans' },
                      { id: 'dyslexic', label: 'Dyslexic Friendly', sampleClass: '' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          const next = { ...appearance, chatFont: f.id };
                          setAppearance(next);
                          persistPatch({ appearance: next });
                        }}
                        className={`p-3.5 rounded-2xl border text-left cursor-pointer ${
                          appearance.chatFont === f.id ? 'border-[#D97757]' : ''
                        }`}
                        style={{ backgroundColor: 'var(--bg-surface)', borderColor: appearance.chatFont === f.id ? '#D97757' : 'var(--border-subtle)' }}
                      >
                        <div className={`text-lg mb-1 ${f.sampleClass}`}>Aa</div>
                        <div className="text-xs font-medium">{f.label}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-2xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  {[
                    { key: 'sendWithEnter', title: 'Press Enter to send message', desc: 'When disabled, use Ctrl+Enter to send.' },
                    { key: 'autoOpenArtifacts', title: 'Automatically open Artifacts side panel', desc: 'Slides open live preview as soon as Claude generates an Artifact.' },
                    { key: 'showTokenMetrics', title: 'Show model speed & token metrics on hover', desc: 'Displays tok/s and active backend below assistant replies.' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center justify-between cursor-pointer py-1">
                      <div>
                        <div className="text-xs font-medium">{item.title}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={appearance[item.key] !== false}
                        onChange={(e) => {
                          const next = { ...appearance, [item.key]: e.target.checked };
                          setAppearance(next);
                          persistPatch({ appearance: next });
                        }}
                        className="accent-[#D97757] w-4 h-4 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: 9ROUTER GATEWAY & DASHBOARD */}
            {tab === '9router' && (
              <div className="space-y-5 max-w-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                      9Router Gateway & Dashboard
                    </h3>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Multi-tier fallback router, RTK token saver, and unified `/v1` gateway across 40+ AI providers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => apiRequest('/api/system/open-9router-dashboard', { method: 'POST' })}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium hover:opacity-90 shrink-0 cursor-pointer"
                  >
                    <span>Open Dashboard</span>
                    <ExternalLink size={13} />
                  </button>
                </div>

                {/* Live Status Card */}
                <div
                  className="p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          systemStatus?.nineRouter?.running ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span>
                        {systemStatus?.nineRouter?.running
                          ? `9Router Running (${systemStatus.nineRouter.version || 'active'})`
                          : '9Router Stopped'}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Endpoint: <code>{nineBaseUrl}/v1</code> • {systemStatus?.nineRouter?.modelsCount || 0} models discovered •{' '}
                      {settings?.nineRouter?.hasApiKey
                        ? `Key: ${settings.nineRouter.maskedApiKey}`
                        : 'No API Key saved yet'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest('/api/system/start-9router', { method: 'POST', body: { openDashboard: false } });
                        await onRefreshSystem?.();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-black/5 cursor-pointer"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <Play size={12} />
                      <span>{systemStatus?.nineRouter?.running ? 'Verify / Restart' : 'Start 9Router'}</span>
                    </button>
                  </div>
                </div>

                {/* Connect 9Router Authentication */}
                <form
                  onSubmit={handleConnectNineRouter}
                  className="p-5 rounded-2xl border space-y-4"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <KeyRound size={16} className="text-[#D97757]" />
                    <span>Connect 9Router API Key</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Either paste an API key (`sk-...`) from your 9Router Dashboard <strong>OR</strong> enter your 9Router Dashboard password below and OpenClaude will automatically create/fetch an API key for you!
                  </p>

                  <div>
                    <label className="block text-xs font-medium mb-1">9Router Server URL</label>
                    <input
                      value={nineBaseUrl}
                      onChange={(e) => setNineBaseUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Option A: Paste API Key (`sk-...`)</label>
                      <input
                        type="password"
                        value={nineApiKeyInput}
                        onChange={(e) => setNineApiKeyInput(e.target.value)}
                        placeholder={settings?.nineRouter?.maskedApiKey || 'sk-...'}
                        className="w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Option B: Dashboard Password (Auto-Key)</label>
                      <input
                        type="password"
                        value={ninePasswordInput}
                        onChange={(e) => setNinePasswordInput(e.target.value)}
                        placeholder="9Router dashboard password"
                        className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                      />
                    </div>
                  </div>

                  {nineConnectMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs ${
                        nineConnectMsg.ok
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/15 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {nineConnectMsg.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={nineBusy}
                    className="px-4 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    {nineBusy ? 'Connecting...' : 'Save & Connect 9Router'}
                  </button>
                </form>
              </div>
            )}

            {/* TAB 6: LOCAL OLLAMA MANAGER */}
            {tab === 'ollama' && (
              <div className="space-y-5 max-w-2xl">
                <div>
                  <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Local Ollama Models
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    100% private offline inference on your GPU/CPU with zero API keys required.
                  </p>
                </div>

                {/* Ollama Status Card */}
                <div
                  className="p-4 rounded-2xl border flex items-center justify-between gap-4"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          systemStatus?.ollama?.running ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span>
                        {systemStatus?.ollama?.running
                          ? `Ollama Active (v${systemStatus.ollama.version || 'local'})`
                          : systemStatus?.ollama?.installed
                          ? 'Ollama Installed (Stopped)'
                          : 'Ollama Not Installed'}
                      </span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Server: <code>http://127.0.0.1:11434</code> • {modelsData?.ollama?.models?.length || 0} local models installed
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest('/api/system/start-ollama', { method: 'POST' });
                      await onRefreshSystem?.();
                    }}
                    className="px-3 py-1.5 rounded-xl border text-xs font-medium hover:bg-black/5 cursor-pointer"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    {systemStatus?.ollama?.running ? 'Refresh Engine' : 'Start Ollama'}
                  </button>
                </div>

                {/* Pull New Model */}
                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                >
                  <div className="text-sm font-semibold">Download / Pull Local Model</div>
                  <div className="flex gap-2">
                    <input
                      value={pullModelTag}
                      onChange={(e) => setPullModelTag(e.target.value)}
                      placeholder="e.g., qwen2.5-coder:7b, llama3.2:3b, deepseek-r1:8b, hf.co/..."
                      className="flex-1 px-3.5 py-2 rounded-xl border text-xs font-mono focus:outline-none"
                      style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                    />
                    <button
                      type="button"
                      disabled={pulling || !pullModelTag.trim()}
                      onClick={() => handlePullOllama(pullModelTag)}
                      className="px-4 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium disabled:opacity-40 cursor-pointer"
                    >
                      {pulling ? 'Pulling...' : 'Pull Model'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_OLLAMA_MODELS.map((m) => (
                      <button
                        key={m.tag}
                        type="button"
                        disabled={pulling}
                        onClick={() => handlePullOllama(m.tag)}
                        title={m.desc}
                        className="text-[11px] px-2.5 py-1 rounded-lg border hover:border-[#D97757] cursor-pointer font-mono"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                      >
                        + {m.tag}
                      </button>
                    ))}
                  </div>

                  {pullProgress && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between text-xs">
                        <span>{pullProgress.status}</span>
                        {pullProgress.percent != null && <span>{pullProgress.percent}%</span>}
                      </div>
                      {pullProgress.percent != null && (
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-3)' }}>
                          <div className="h-full bg-[#D97757] transition-all" style={{ width: `${pullProgress.percent}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Installed Models Table */}
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Installed on Disk
                  </div>
                  {(modelsData?.ollama?.models || []).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl border"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate flex items-center gap-2">
                          <span>{m.id}</span>
                          {m.loadedInVram && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-medium">
                              Loaded in VRAM ({m.vramGb} GB)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {m.parameterSize} • {m.quantization} • {m.sizeGb} GB • {Math.round((m.contextWindow || 32768) / 1024)}K max ctx
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteOllama(m.id)}
                        title="Delete local model"
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: GENERATION PARAMETERS */}
            {tab === 'parameters' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Model Generation Parameters
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Fine-tune sampling temperature, max output tokens, and Ollama context window (`num_ctx`).
                  </p>
                </div>

                <div className="space-y-4 p-5 rounded-2xl border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span>Temperature</span>
                      <span className="font-mono">{generation.temperature ?? 0.7}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.05"
                      value={generation.temperature ?? 0.7}
                      onChange={(e) => setGeneration({ ...generation, temperature: Number(e.target.value) })}
                      className="w-full accent-[#D97757]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span>Top P</span>
                      <span className="font-mono">{generation.topP ?? 0.9}</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={generation.topP ?? 0.9}
                      onChange={(e) => setGeneration({ ...generation, topP: Number(e.target.value) })}
                      className="w-full accent-[#D97757]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-medium mb-1">Max Output Tokens</label>
                      <input
                        type="number"
                        value={generation.maxTokens ?? 8192}
                        onChange={(e) => setGeneration({ ...generation, maxTokens: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border text-xs font-mono"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Ollama Context (`num_ctx`)</label>
                      <input
                        type="number"
                        value={generation.numCtx ?? 32768}
                        onChange={(e) => setGeneration({ ...generation, numCtx: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border text-xs font-mono"
                        style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => persistPatch({ generation })}
                  className="px-5 py-2.5 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
                >
                  Save Parameters
                </button>
              </div>
            )}

            {/* TAB 8: DATA & BACKUP */}
            {tab === 'data' && (
              <div className="space-y-5 max-w-xl">
                <div>
                  <h3 className="text-2xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                    Data & Local Storage
                  </h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    All conversations, projects, styles, and artifacts stay 100% on your computer inside <code>OpenClaude/data/</code>.
                  </p>
                </div>

                <div className="p-5 rounded-2xl border space-y-4" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Export Full Backup</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Download all chats, projects, custom styles, and settings as JSON.
                      </div>
                    </div>
                    <a
                      href="/api/export"
                      download="openclaude-backup.json"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#141413] dark:bg-[#F2F0E8] text-white dark:text-[#141413] text-xs font-medium"
                    >
                      <Download size={13} />
                      <span>Export JSON</span>
                    </a>
                  </div>

                  <div className="border-t pt-4 flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                      <div className="text-sm font-semibold">Import Backup</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Restore conversations and projects from a previous OpenClaude JSON file.
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium cursor-pointer hover:bg-black/5" style={{ borderColor: 'var(--border-subtle)' }}>
                      <Upload size={13} />
                      <span>Import JSON</span>
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const parsed = JSON.parse(await f.text());
                            await apiRequest('/api/import', { method: 'POST', body: parsed });
                            window.location.reload();
                          } catch (err) {
                            alert('Import failed: ' + err.message);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
