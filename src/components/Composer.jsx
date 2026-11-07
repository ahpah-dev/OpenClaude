import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Plus,
  ArrowUp,
  Square,
  ChevronDown,
  Clock,
  Feather,
  SlidersHorizontal,
  X,
  FileText,
  Image as ImageIcon,
  Search,
  RefreshCw,
  Check,
  ExternalLink,
  KeyRound,
  Cpu,
  Eye,
  Brain,
  Sparkles,
} from 'lucide-react';
import { NineRouterBadgeIcon, OllamaIcon } from './ClaudeIcons.jsx';

export default function Composer({
  placeholder = 'How can I help you today?',
  isStreaming = false,
  onSend,
  onStop,
  modelsData,
  onRefreshModels,
  selectedBackend,
  selectedModel,
  onSelectModel,
  extendedThinking,
  onToggleThinking,
  artifactsEnabled,
  onToggleArtifacts,
  styles = [],
  activeStyleId = 'normal',
  onSelectStyle,
  onOpenStyleManager,
  onOpenNineRouterConnect,
  onOpenNineRouterDashboard,
  sendWithEnter = true,
  projectBadge = null,
  initialDraft = '',
  onDraftConsumed,
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // 'model' | 'style' | 'tools' | null
  const [modelSearch, setModelSearch] = useState('');
  const [modelTab, setModelTab] = useState('all'); // 'all' | 'ollama' | '9router'
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (initialDraft) {
      setText(initialDraft);
      onDraftConsumed?.();
      setTimeout(() => textareaRef.current?.focus(), 30);
    }
  }, [initialDraft]);

  // Auto-resize textarea cleanly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, [text]);

  // Close popovers on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const activeStyle = styles.find((s) => s.id === activeStyleId) || styles[0] || { id: 'normal', name: 'Normal' };

  const ollamaModels = modelsData?.ollama?.models || [];
  const nineModels = modelsData?.nineRouter?.models || [];
  const nineHasKey = !!modelsData?.nineRouter?.hasApiKey;

  const currentModelDisplay = useMemo(() => {
    if (!selectedModel) return 'Select model';
    if (selectedBackend === 'ollama') {
      const m = ollamaModels.find((x) => x.id === selectedModel);
      return m ? m.name : selectedModel.replace(/^hf\.co\/[^/]+\//i, '');
    }
    return selectedModel;
  }, [selectedModel, selectedBackend, ollamaModels]);

  const filteredOllama = useMemo(() => {
    if (modelTab === '9router') return [];
    const q = modelSearch.trim().toLowerCase();
    if (!q) return ollamaModels;
    return ollamaModels.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  }, [ollamaModels, modelSearch, modelTab]);

  const filteredNine = useMemo(() => {
    if (modelTab === 'ollama') return [];
    const q = modelSearch.trim().toLowerCase();
    if (!q) return nineModels.slice(0, 80);
    return nineModels.filter((m) => m.id.toLowerCase().includes(q)).slice(0, 100);
  }, [nineModels, modelSearch, modelTab]);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        setAttachments((prev) => [
          ...prev,
          {
            id: `att_${crypto.randomUUID()}`,
            kind: 'image',
            name: file.name,
            mimeType: file.type,
            size: file.size,
            dataUrl,
          },
        ]);
      } else {
        const content = await file.text().catch(() => '');
        setAttachments((prev) => [
          ...prev,
          {
            id: `att_${crypto.randomUUID()}`,
            kind: 'file',
            name: file.name,
            mimeType: file.type || 'text/plain',
            size: file.size,
            lines: content.split('\n').length,
            content: content.slice(0, 120000),
          },
        ]);
      }
    }
  };

  // Authentic Claude.ai paste behavior: convert large pasted text (>1500 chars) into a PASTED snippet card!
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items) {
      const imageItems = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) imageItems.push(f);
        }
      }
      if (imageItems.length > 0) {
        e.preventDefault();
        handleFiles(imageItems);
        return;
      }
    }

    const pastedText = e.clipboardData?.getData('text/plain') || '';
    if (pastedText.length > 1500) {
      e.preventDefault();
      setAttachments((prev) => [
        ...prev,
        {
          id: `paste_${crypto.randomUUID()}`,
          kind: 'pasted',
          name: 'PASTED',
          lines: pastedText.split('\n').length,
          size: pastedText.length,
          content: pastedText,
        },
      ]);
    }
  };

  const triggerSend = () => {
    if (isStreaming) return;
    if (!text.trim() && attachments.length === 0) return;
    onSend?.({
      content: text.trim(),
      attachments,
    });
    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (sendWithEnter && !e.shiftKey) {
        e.preventDefault();
        triggerSend();
      } else if (!sendWithEnter && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        triggerSend();
      }
    }
  };

  return (
    <div ref={containerRef} className="w-full relative">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer?.files?.length) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={`rounded-[22px] border transition-all duration-150 ${
          isDragging ? 'ring-2 ring-[#D97757]' : ''
        }`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: isDragging ? 'var(--accent-claude)' : 'var(--border-strong)',
          boxShadow: 'var(--shadow-composer)',
        }}
      >
        {/* Attached Images / Documents / Pasted Cards Row */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-4 pt-3.5 pb-1">
            {attachments.map((att) => (
              <div
                key={att.id}
                onClick={() => att.kind !== 'image' && setPreviewAttachment(att)}
                className="group relative flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs max-w-[220px] cursor-pointer transition hover:border-[#D97757]/50"
                style={{
                  backgroundColor: 'var(--bg-surface-2)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                {att.kind === 'image' ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-9 h-9 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-[10px] font-bold"
                    style={{
                      backgroundColor: 'var(--accent-claude-soft)',
                      color: 'var(--accent-claude)',
                    }}
                  >
                    {att.kind === 'pasted' ? 'TXT' : <FileText size={15} />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{att.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {att.lines ? `${att.lines} lines` : `${Math.max(1, Math.round((att.size || 0) / 1024))} KB`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAttachments((prev) => prev.filter((x) => x.id !== att.id));
                  }}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Active Project Pill if inside a Project */}
        {projectBadge && (
          <div className="px-4 pt-3 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--accent-claude-soft)',
                color: 'var(--accent-claude)',
              }}
            >
              <span>Project: {projectBadge.name}</span>
              {projectBadge.knowledgeCount > 0 && (
                <span className="opacity-75">• {projectBadge.knowledgeCount} docs</span>
              )}
            </span>
          </div>
        )}

        {/* Main Textarea */}
        <div className="px-4 pt-3.5 pb-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            className="w-full bg-transparent resize-none border-0 focus:outline-none text-[15.5px] leading-relaxed placeholder:opacity-60"
            style={{
              color: 'var(--text-primary)',
              minHeight: '32px',
              maxHeight: '260px',
            }}
          />
        </div>

        {/* Bottom Claude Controls Bar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
          {/* Left Action Icons */}
          <div className="flex items-center gap-1 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.js,.jsx,.ts,.tsx,.py,.json,.csv,.html,.css,.sql,.yaml,.yml,.xml,.rs,.go,.cpp,.c,.java"
              onChange={(e) => {
                if (e.target.files?.length) handleFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach images, code, or text files"
              className="w-8 h-8 rounded-xl flex items-center justify-center border transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Plus size={17} />
            </button>

            {/* Extended Thinking Toggle */}
            <button
              type="button"
              onClick={onToggleThinking}
              title="Extended Thinking (step-by-step reasoning before answering)"
              className={`h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium border transition cursor-pointer ${
                extendedThinking ? 'shadow-2xs' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={
                extendedThinking
                  ? {
                      backgroundColor: 'var(--accent-blue-soft)',
                      borderColor: 'var(--accent-blue)',
                      color: 'var(--accent-blue)',
                    }
                  : {
                      borderColor: 'transparent',
                      color: 'var(--text-secondary)',
                    }
              }
            >
              <Clock size={14} />
              <span className="hidden sm:inline">Extended thinking</span>
            </button>

            {/* Writing Style Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'style' ? null : 'style')}
                title="Choose Claude response style"
                className="h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                style={{
                  color: activeStyleId !== 'normal' ? 'var(--accent-claude)' : 'var(--text-secondary)',
                  backgroundColor: activeStyleId !== 'normal' ? 'var(--accent-claude-soft)' : 'transparent',
                }}
              >
                <Feather size={14} />
                <span className="hidden md:inline">
                  {activeStyleId === 'normal' ? 'Style' : activeStyle.name}
                </span>
              </button>

              {openMenu === 'style' && (
                <div
                  className="absolute bottom-11 left-0 w-68 rounded-2xl border p-1.5 z-40 animate-claude-in"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    boxShadow: 'var(--shadow-popover)',
                  }}
                >
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Choose Style
                  </div>
                  {styles.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => {
                        onSelectStyle?.(st.id);
                        setOpenMenu(null);
                      }}
                      className="w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-medium">{st.name}</div>
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {st.description}
                        </div>
                      </div>
                      {st.id === activeStyleId && <Check size={14} className="text-[#D97757] mt-0.5 shrink-0" />}
                    </button>
                  ))}
                  <div className="border-t my-1" style={{ borderColor: 'var(--border-subtle)' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onOpenStyleManager?.();
                    }}
                    className="w-full px-2.5 py-2 rounded-xl text-xs font-medium text-left hover:bg-black/5 dark:hover:bg-white/5 text-[#D97757] cursor-pointer"
                  >
                    + Create & edit custom styles
                  </button>
                </div>
              )}
            </div>

            {/* Capabilities / Artifacts Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'tools' ? null : 'tools')}
                title="Capabilities & Claude Artifacts"
                className="h-8 px-2 rounded-xl flex items-center gap-1 text-xs transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
              >
                <SlidersHorizontal size={14} />
              </button>

              {openMenu === 'tools' && (
                <div
                  className="absolute bottom-11 left-0 w-72 rounded-2xl border p-3 z-40 animate-claude-in"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    boxShadow: 'var(--shadow-popover)',
                  }}
                >
                  <div className="text-xs font-semibold mb-2">Claude Capabilities</div>
                  <label className="flex items-center justify-between py-2 cursor-pointer">
                    <div>
                      <div className="text-xs font-medium flex items-center gap-1.5">
                        <Sparkles size={13} className="text-[#D97757]" />
                        <span>Claude Artifacts</span>
                      </div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        Render live apps, React UI, diagrams & docs side-by-side
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={artifactsEnabled}
                      onChange={onToggleArtifacts}
                      className="accent-[#D97757] w-4 h-4 cursor-pointer"
                    />
                  </label>
                  <div className="border-t my-1.5" style={{ borderColor: 'var(--border-subtle)' }} />
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      onOpenNineRouterDashboard?.();
                    }}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <span>Open 9Router Dashboard</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Unified Model Selector (9Router + Local Ollama) + Send/Stop */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenMenu(openMenu === 'model' ? null : 'model')}
                className="h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer max-w-[230px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                {selectedBackend === '9router' ? (
                  <NineRouterBadgeIcon size={14} className="text-[#D97757] shrink-0" />
                ) : (
                  <OllamaIcon size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="truncate" style={{ color: 'var(--text-primary)' }}>
                  {currentModelDisplay}
                </span>
                <ChevronDown size={13} className="shrink-0 opacity-70" />
              </button>

              {openMenu === 'model' && (
                <div
                  className="absolute bottom-11 right-0 w-[340px] sm:w-[390px] rounded-2xl border z-50 overflow-hidden flex flex-col max-h-[440px] animate-claude-in"
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    borderColor: 'var(--border-subtle)',
                    boxShadow: 'var(--shadow-popover)',
                  }}
                >
                  {/* Search & Filter Header */}
                  <div className="p-2.5 border-b space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <Search size={13} style={{ color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        value={modelSearch}
                        onChange={(e) => setModelSearch(e.target.value)}
                        placeholder="Search Local Ollama & 9Router models..."
                        autoFocus
                        className="flex-1 bg-transparent text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={onRefreshModels}
                        title="Refresh models"
                        className="p-1 rounded hover:bg-black/5 cursor-pointer"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      {[
                        { id: 'all', label: 'All Models' },
                        { id: 'ollama', label: `Ollama (${ollamaModels.length})` },
                        { id: '9router', label: `9Router (${nineModels.length})` },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setModelTab(t.id)}
                          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                            modelTab === t.id ? 'bg-[#D97757] text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scrollable Model List */}
                  <div className="overflow-y-auto p-1.5 space-y-3 flex-1">
                    {/* Local Ollama Section */}
                    {modelTab !== '9router' && (
                      <div>
                        <div className="px-2.5 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          <span className="flex items-center gap-1.5">
                            <OllamaIcon size={13} className="text-emerald-600" />
                            Local Ollama Models
                          </span>
                          <span className="text-[10px] font-normal">Zero API key</span>
                        </div>
                        {filteredOllama.length === 0 ? (
                          <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            No matching local Ollama models. Pull new models in Settings → Local Ollama!
                          </div>
                        ) : (
                          filteredOllama.map((m) => {
                            const active = selectedBackend === 'ollama' && selectedModel === m.id;
                            return (
                              <button
                                key={`ollama_${m.id}`}
                                type="button"
                                onClick={() => {
                                  onSelectModel?.('ollama', m.id);
                                  setOpenMenu(null);
                                }}
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium truncate">{m.name}</span>
                                    {m.loadedInVram && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium">
                                        VRAM
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {m.parameterSize && <span>{m.parameterSize}</span>}
                                    {m.sizeGb && <span>{m.sizeGb} GB</span>}
                                    {m.capabilities?.vision && <span className="flex items-center gap-0.5"><Eye size={10} /> Vision</span>}
                                    {m.capabilities?.reasoning && <span className="flex items-center gap-0.5"><Brain size={10} /> Thinking</span>}
                                  </div>
                                </div>
                                {active && <Check size={14} className="text-[#D97757] shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* 9Router Section */}
                    {modelTab !== 'ollama' && (
                      <div>
                        <div className="px-2.5 py-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          <span className="flex items-center gap-1.5">
                            <NineRouterBadgeIcon size={13} className="text-[#D97757]" />
                            9Router Gateway (:20128)
                          </span>
                          {!nineHasKey && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenu(null);
                                onOpenNineRouterConnect?.();
                              }}
                              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-[#D97757]/15 text-[#D97757] hover:bg-[#D97757]/25 cursor-pointer normal-case"
                            >
                              <KeyRound size={10} />
                              Connect API Key
                            </button>
                          )}
                        </div>
                        {filteredNine.length === 0 ? (
                          <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {modelsData?.nineRouter?.online
                              ? 'No matching 9Router routes. Configure providers in the 9Router Dashboard!'
                              : '9Router starting on localhost:20128...'}
                          </div>
                        ) : (
                          filteredNine.map((m) => {
                            const active = selectedBackend === '9router' && selectedModel === m.id;
                            return (
                              <button
                                key={`9r_${m.id}`}
                                type="button"
                                onClick={() => {
                                  onSelectModel?.('9router', m.id);
                                  setOpenMenu(null);
                                }}
                                className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium truncate">{m.id}</span>
                                    {m.isCombo && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#D97757]/15 text-[#D97757] font-medium">
                                        Combo
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] flex items-center gap-2 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                    <span>{m.provider}</span>
                                    {m.contextWindow && <span>{Math.round(m.contextWindow / 1000)}K ctx</span>}
                                    {m.capabilities?.vision && <span>Vision</span>}
                                    {m.capabilities?.reasoning && <span>Reasoning</span>}
                                  </div>
                                </div>
                                {active && <Check size={14} className="text-[#D97757] shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Send or Stop Button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generating"
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#141413] dark:bg-[#F2F0E8] text-white dark:text-[#141413] transition hover:opacity-85 cursor-pointer"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={triggerSend}
                disabled={!text.trim() && attachments.length === 0}
                title="Send message"
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white transition disabled:opacity-35 cursor-pointer disabled:cursor-default"
                style={{
                  backgroundColor: 'var(--accent-claude)',
                }}
              >
                <ArrowUp size={17} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal to inspect pasted/attached text */}
      {previewAttachment && (
        <div
          onClick={() => setPreviewAttachment(null)}
          className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] rounded-2xl border flex flex-col overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="font-semibold text-sm">{previewAttachment.name} ({previewAttachment.lines || 1} lines)</span>
              <button type="button" onClick={() => setPreviewAttachment(null)} className="p-1 rounded-lg hover:bg-black/5 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <pre className="p-4 overflow-auto text-xs font-mono leading-relaxed flex-1 m-0" style={{ backgroundColor: 'var(--bg-canvas)' }}>
              {previewAttachment.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
