import React, { useState, useRef, useEffect } from 'react';
import {
  Star,
  Download,
  Sliders,
  Box,
  ArrowDown,
  FolderKanban,
  Check,
  X,
} from 'lucide-react';
import MessageItem from './MessageItem.jsx';
import Composer from './Composer.jsx';

export default function ChatView({
  conversation,
  thread = [],
  projects = [],
  isStreaming = false,
  userInitials = 'D',
  activeArtifact,
  allThreadArtifacts = [],
  versionedArtifactsMap,
  onSelectArtifact,
  onToggleStar,
  onRenameTitle,
  onAssignProject,
  onSaveChatSystemPrompt,
  onEditUserMessage,
  onRegenerateAssistant,
  onSwitchBranch,
  onFeedback,
  showTokenMetrics = true,
  composerProps,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(conversation?.title || '');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptOverrideDraft, setPromptOverrideDraft] = useState(conversation?.systemPromptOverride || '');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const scrollRef = useRef(null);

  useEffect(() => {
    setTitleDraft(conversation?.title || 'New chat');
    setPromptOverrideDraft(conversation?.systemPromptOverride || '');
  }, [conversation?.id, conversation?.title, conversation?.systemPromptOverride]);

  // Auto-scroll smoothly when near bottom
  useEffect(() => {
    if (isNearBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thread, isStreaming, isNearBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsNearBottom(dist < 140);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const exportMarkdown = () => {
    const lines = [`# ${conversation?.title || 'Conversation'}\n`];
    for (const m of thread) {
      lines.push(`## ${m.role === 'user' ? 'User' : `Claude (${m.model || ''})`}\n`);
      if (m.thinking) {
        lines.push(`<details><summary>Thought Process</summary>\n\n${m.thinking}\n\n</details>\n`);
      }
      lines.push(`${m.content || ''}\n`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(conversation?.title || 'chat').replace(/[^a-z0-9-_]+/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const assignedProject = projects.find((p) => p.id === conversation?.projectId) || null;
  const hasOverridePrompt = !!(conversation?.systemPromptOverride && conversation.systemPromptOverride.trim());

  return (
    <div className="flex-1 h-full min-w-0 flex flex-col relative">
      {/* Top Claude Conversation Header */}
      <header
        className="h-13 px-4 border-b flex items-center justify-between gap-3 shrink-0"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-1">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (titleDraft.trim()) onRenameTitle(titleDraft.trim());
                    setEditingTitle(false);
                  }
                  if (e.key === 'Escape') setEditingTitle(false);
                }}
                autoFocus
                className="px-2 py-1 rounded-lg border text-sm font-medium focus:outline-none"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}
              />
              <button
                type="button"
                onClick={() => {
                  if (titleDraft.trim()) onRenameTitle(titleDraft.trim());
                  setEditingTitle(false);
                }}
                className="p-1 text-emerald-600 cursor-pointer"
              >
                <Check size={15} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              title="Click to rename chat"
              className="text-sm font-medium truncate hover:opacity-80 cursor-pointer max-w-[260px] sm:max-w-[420px]"
            >
              {conversation?.title || 'New chat'}
            </button>
          )}

          <button
            type="button"
            onClick={() => onToggleStar(!conversation?.starred)}
            title={conversation?.starred ? 'Unstar' : 'Star chat'}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
          >
            <Star
              size={15}
              className={conversation?.starred ? 'fill-[#D97757] text-[#D97757]' : 'opacity-45'}
            />
          </button>

          {projects.length > 0 && (
            <select
              value={conversation?.projectId || ''}
              onChange={(e) => onAssignProject(e.target.value || null)}
              className="hidden md:inline-block text-xs px-2 py-1 rounded-lg border cursor-pointer"
              style={{
                backgroundColor: assignedProject ? 'var(--accent-claude-soft)' : 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: assignedProject ? 'var(--accent-claude)' : 'var(--text-secondary)',
              }}
            >
              <option value="">No Project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  📁 {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Per-Chat System Prompt Override */}
          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            title="Customize System Prompt for this chat"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer"
            style={{
              backgroundColor: hasOverridePrompt ? 'var(--accent-claude-soft)' : 'var(--bg-surface)',
              borderColor: hasOverridePrompt ? 'var(--accent-claude)' : 'var(--border-subtle)',
              color: hasOverridePrompt ? 'var(--accent-claude)' : 'var(--text-secondary)',
            }}
          >
            <Sliders size={13} />
            <span className="hidden sm:inline">{hasOverridePrompt ? 'Custom Prompt Active' : 'Chat Prompt'}</span>
          </button>

          {/* Artifacts Drawer Quick Toggle */}
          {allThreadArtifacts.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (activeArtifact) onSelectArtifact(null);
                else onSelectArtifact(allThreadArtifacts[allThreadArtifacts.length - 1]);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer"
              style={{
                backgroundColor: activeArtifact ? 'var(--accent-claude)' : 'var(--bg-surface)',
                borderColor: activeArtifact ? 'var(--accent-claude)' : 'var(--border-subtle)',
                color: activeArtifact ? '#FFFFFF' : 'var(--text-primary)',
              }}
            >
              <Box size={13} />
              <span>Artifacts ({allThreadArtifacts.length})</span>
            </button>
          )}

          {/* Export Markdown */}
          <div className="relative">
            <button
              type="button"
              onClick={exportMarkdown}
              title="Export chat as Markdown"
              className="p-1.5 rounded-xl border hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Download size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Scrollable Messages Stream */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 pb-6"
      >
        <div className="max-w-[740px] mx-auto">
          {thread.map((msg, idx) => {
            const isLast = idx === thread.length - 1 && msg.role === 'assistant';
            return (
              <MessageItem
                key={msg.id}
                message={msg}
                isLastAssistant={isLast}
                isStreaming={isStreaming && isLast}
                userInitials={userInitials}
                activeArtifactId={activeArtifact?.id}
                versionedArtifactsMap={versionedArtifactsMap}
                onSelectArtifact={(art) => onSelectArtifact(art)}
                onEditUserMessage={onEditUserMessage}
                onRegenerateAssistant={onRegenerateAssistant}
                onSwitchBranch={onSwitchBranch}
                onFeedback={onFeedback}
                showTokenMetrics={showTokenMetrics}
              />
            );
          })}
        </div>
      </div>

      {/* Floating Scroll to Bottom Button */}
      {!isNearBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-32 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border flex items-center justify-center shadow-md cursor-pointer z-20"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-strong)',
          }}
        >
          <ArrowDown size={15} />
        </button>
      )}

      {/* Bottom Anchored Claude Reply Composer */}
      <div className="px-4 sm:px-6 pb-3 pt-1 shrink-0">
        <div className="max-w-[740px] mx-auto">
          <Composer
            {...composerProps}
            placeholder="Reply to Claude..."
            projectBadge={
              assignedProject
                ? { name: assignedProject.name, knowledgeCount: assignedProject.knowledge?.length || 0 }
                : null
            }
          />
          <div className="text-center text-[11px] mt-2 select-none" style={{ color: 'var(--text-muted)' }}>
            OpenClaude runs locally with 9Router & Ollama. Always verify important code and facts.
          </div>
        </div>
      </div>

      {/* Per-Chat System Prompt Override Modal */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div
            className="w-full max-w-xl rounded-2xl border p-6 space-y-4 animate-claude-in"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-serif)' }}>
                  Conversation System Prompt Override
                </h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Leave blank to inherit your Global System Prompt from Settings, or enter a custom prompt just for this chat.
                </p>
              </div>
              <button type="button" onClick={() => setShowPromptModal(false)} className="cursor-pointer">
                <X size={17} />
              </button>
            </div>

            <textarea
              rows={8}
              value={promptOverrideDraft}
              onChange={(e) => setPromptOverrideDraft(e.target.value)}
              placeholder="Using global customizable system prompt... Type here to override for this chat (supports {{date}}, {{user_name}}, {{model}})."
              className="w-full p-3.5 rounded-xl border text-xs font-mono leading-relaxed focus:outline-none"
              style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
            />

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPromptOverrideDraft('')}
                className="text-xs text-red-600 hover:underline cursor-pointer"
              >
                Reset to Global Default
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="px-3.5 py-2 rounded-xl border text-xs cursor-pointer"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveChatSystemPrompt(promptOverrideDraft);
                    setShowPromptModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
                >
                  Apply to Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
