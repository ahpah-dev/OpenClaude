import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  FileText,
} from 'lucide-react';
import { ClaudeStarburst, ArtifactCubeIcon } from './ClaudeIcons.jsx';
import MarkdownRenderer from './MarkdownRenderer.jsx';
import { parseMessageSegments, getArtifactTypeLabel } from '../lib/artifactParser.js';

function BranchNavigator({ index, total, siblingIds, onSwitchBranch }) {
  if (!total || total <= 1) return null;
  return (
    <div className="inline-flex items-center gap-0.5 text-xs select-none" style={{ color: 'var(--text-muted)' }}>
      <button
        type="button"
        disabled={index <= 1}
        onClick={() => onSwitchBranch?.(siblingIds[index - 2])}
        className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
      >
        <ChevronLeft size={13} />
      </button>
      <span className="tabular-nums font-medium px-0.5">
        {index} / {total}
      </span>
      <button
        type="button"
        disabled={index >= total}
        onClick={() => onSwitchBranch?.(siblingIds[index])}
        className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 cursor-pointer"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

export default function MessageItem({
  message,
  isLastAssistant = false,
  isStreaming = false,
  userInitials = 'U',
  activeArtifactId = null,
  versionedArtifactsMap = new Map(),
  onSelectArtifact,
  onEditUserMessage,
  onRegenerateAssistant,
  onSwitchBranch,
  onFeedback,
  showTokenMetrics = true,
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(message.content || '');
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const clean = (message.content || '').replace(/<antArtifact[\s\S]*?<\/antArtifact>/g, ' [Artifact] ');
    const utter = new SpeechSynthesisUtterance(clean);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
  };

  // USER MESSAGE
  if (message.role === 'user') {
    return (
      <div className="group flex flex-col items-end my-5 animate-claude-in">
        {isEditing ? (
          <div
            className="w-full max-w-2xl rounded-2xl border p-3.5 space-y-3"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <textarea
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={Math.min(10, Math.max(2, editDraft.split('\n').length))}
              className="w-full bg-transparent resize-y focus:outline-none text-[15px] leading-relaxed"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setEditDraft(message.content || '');
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border hover:bg-black/5 cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editDraft.trim()) return;
                  setIsEditing(false);
                  onEditUserMessage?.(message, editDraft.trim());
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-white cursor-pointer"
                style={{ backgroundColor: 'var(--accent-claude)' }}
              >
                Save & submit
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* User Attachments */}
            {message.attachments?.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2 mb-2 max-w-[85%]">
                {message.attachments.map((att) =>
                  att.kind === 'image' ? (
                    <img
                      key={att.id}
                      src={att.dataUrl}
                      alt={att.name}
                      className="max-h-48 rounded-2xl border object-cover"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    />
                  ) : (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs"
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    >
                      <FileText size={14} className="text-[#D97757]" />
                      <span className="font-medium">{att.name}</span>
                      {att.lines && (
                        <span style={{ color: 'var(--text-muted)' }}>({att.lines} lines)</span>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Authentic Claude Warm User Pill */}
            {message.content && (
              <div
                className="max-w-[86%] sm:max-w-[78%] rounded-[20px] px-4 py-3 flex items-start gap-3"
                style={{ backgroundColor: 'var(--bg-user-bubble)' }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 mt-0.5 text-white select-none"
                  style={{ backgroundColor: '#2B2A27' }}
                >
                  {userInitials}
                </div>
                <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                  {message.content}
                </div>
              </div>
            )}

            {/* User Hover Action Row */}
            <div className="flex items-center gap-2 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <BranchNavigator
                index={message.branchIndex}
                total={message.branchTotal}
                siblingIds={message.siblingIds}
                onSwitchBranch={(targetId) => onSwitchBranch?.(message.id, targetId)}
              />
              <button
                type="button"
                onClick={handleCopy}
                title="Copy prompt"
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditDraft(message.content || '');
                  setIsEditing(true);
                }}
                title="Edit message"
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <Pencil size={13} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // CLAUDE ASSISTANT MESSAGE
  const { segments } = useMemo(
    () => parseMessageSegments(message.content || '', message.id, isStreaming),
    [message.content, message.id, isStreaming]
  );

  const hasThinking = !!(message.thinking && message.thinking.trim());

  return (
    <div className="group my-6 animate-claude-in">
      <div className="space-y-3.5">
        {/* Extended Thinking Collapsible Block (Identical to Claude 3.7/4) */}
        {hasThinking && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-surface-2)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => setThinkingOpen(!thinkingOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              <div className="flex items-center gap-2">
                <ClaudeStarburst size={15} animated={isStreaming && !message.content} />
                <span>
                  {isStreaming && !message.content
                    ? 'Thinking...'
                    : message.thinkingDurationSec
                    ? `Thought for ${message.thinkingDurationSec}s`
                    : 'Thought process'}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${thinkingOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {(thinkingOpen || (isStreaming && !message.content)) && (
              <div
                className="px-4 pb-3.5 pt-1 text-xs leading-relaxed whitespace-pre-wrap border-t max-h-72 overflow-y-auto"
                style={{
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {message.thinking}
              </div>
            )}
          </div>
        )}

        {/* Loading indicator before first token arrives */}
        {isStreaming && !hasThinking && !message.content && (
          <div className="flex items-center gap-2.5 py-2">
            <ClaudeStarburst size={22} animated />
            <span className="text-sm font-serif italic" style={{ color: 'var(--text-muted)' }}>
              Claude is thinking...
            </span>
          </div>
        )}

        {/* Interleaved Prose + Claude Artifact Trigger Chips */}
        {segments.map((seg, i) => {
          if (seg.kind === 'artifact') {
            const enriched = versionedArtifactsMap.get(seg.artifact.id) || seg.artifact;
            const selected = activeArtifactId === enriched.id;

            return (
              <button
                key={enriched.id || i}
                type="button"
                onClick={() => onSelectArtifact?.(enriched)}
                className={`w-full max-w-md flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition cursor-pointer my-2 ${
                  selected ? 'ring-1 ring-[#D97757]' : 'hover:border-[#D97757]/60'
                }`}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: selected ? 'var(--accent-claude)' : 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: 'var(--accent-claude-soft)',
                    color: 'var(--accent-claude)',
                  }}
                >
                  <ArtifactCubeIcon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{enriched.title}</div>
                  <div className="text-xs flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <span>{getArtifactTypeLabel(enriched.type, enriched.language)}</span>
                    <span>•</span>
                    <span>{enriched.isStreaming ? 'Generating live...' : `Click to open • v${enriched.version || 1}`}</span>
                  </div>
                </div>
              </button>
            );
          }

          return (
            <MarkdownRenderer
              key={i}
              content={seg.text}
              onOpenAsArtifact={onSelectArtifact}
            />
          );
        })}

        {/* Assistant Footer: Claude Starburst + Actions + Branch + Speed */}
        {!isStreaming && (message.content || hasThinking) && (
          <div className="flex items-center justify-between pt-1.5 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="mr-1" title="OpenClaude">
                <ClaudeStarburst size={18} animated={false} />
              </div>

              <BranchNavigator
                index={message.branchIndex}
                total={message.branchTotal}
                siblingIds={message.siblingIds}
                onSwitchBranch={(targetId) => onSwitchBranch?.(message.id, targetId)}
              />

              <button
                type="button"
                onClick={handleCopy}
                title="Copy response"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>

              <button
                type="button"
                onClick={() => onRegenerateAssistant?.(message)}
                title="Retry / Regenerate response"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                <RotateCcw size={14} />
              </button>

              <button
                type="button"
                onClick={handleSpeak}
                title={speaking ? 'Stop reading aloud' : 'Read aloud'}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                style={{ color: speaking ? 'var(--accent-claude)' : 'var(--text-muted)' }}
              >
                {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>

              <button
                type="button"
                onClick={() => onFeedback?.(message.id, message.feedback === 'up' ? null : 'up')}
                title="Good response"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                style={{ color: message.feedback === 'up' ? 'var(--accent-claude)' : 'var(--text-muted)' }}
              >
                <ThumbsUp size={13.5} />
              </button>

              <button
                type="button"
                onClick={() => onFeedback?.(message.id, message.feedback === 'down' ? null : 'down')}
                title="Needs improvement"
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                style={{ color: message.feedback === 'down' ? 'var(--accent-danger)' : 'var(--text-muted)' }}
              >
                <ThumbsDown size={13.5} />
              </button>
            </div>

            {showTokenMetrics && (message.model || message.usage) && (
              <div
                className="text-[11px] flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity font-mono"
                style={{ color: 'var(--text-muted)' }}
              >
                {message.model && (
                  <span>
                    {message.backend === '9router' ? '9R' : 'Ollama'}:{' '}
                    {message.model.replace(/^hf\.co\/[^/]+\//i, '')}
                  </span>
                )}
                {message.usage?.tokPerSec && <span>• {message.usage.tokPerSec} tok/s</span>}
                {message.usage?.completionTokens && <span>• {message.usage.completionTokens} tok</span>}
              </div>
            )}
          </div>
        )}

        {isStreaming && isLastAssistant && message.content && (
          <div className="pt-1">
            <ClaudeStarburst size={19} animated />
          </div>
        )}
      </div>
    </div>
  );
}
