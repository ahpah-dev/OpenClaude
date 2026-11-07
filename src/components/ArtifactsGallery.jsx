import React, { useState } from 'react';
import { Sparkles, Eye, MessageSquare } from 'lucide-react';
import { ArtifactCubeIcon } from './ClaudeIcons.jsx';
import { SHOWCASE_ARTIFACTS, getArtifactTypeLabel } from '../lib/artifactParser.js';

export default function ArtifactsGallery({
  userArtifacts = [],
  onPreviewArtifact,
  onOpenConversation,
}) {
  const [tab, setTab] = useState(userArtifacts.length > 0 ? 'yours' : 'inspiration');

  const items = tab === 'yours' ? userArtifacts : SHOWCASE_ARTIFACTS;

  return (
    <div className="flex-1 h-full overflow-y-auto px-6 py-9">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-3xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
              Artifacts
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Interactive apps, live React components, 3D scenes, SVGs, and Mermaid diagrams created with Claude.
            </p>
          </div>

          <div
            className="inline-flex p-1 rounded-xl border self-start"
            style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border-subtle)' }}
          >
            <button
              type="button"
              onClick={() => setTab('inspiration')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                tab === 'inspiration' ? 'bg-white dark:bg-[#2B2A27] shadow-xs' : 'opacity-70'
              }`}
            >
              Inspiration ({SHOWCASE_ARTIFACTS.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('yours')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                tab === 'yours' ? 'bg-white dark:bg-[#2B2A27] shadow-xs' : 'opacity-70'
              }`}
            >
              Your Artifacts ({userArtifacts.length})
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div
            className="rounded-3xl border p-12 text-center space-y-3"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <Sparkles size={32} className="mx-auto text-[#D97757]" />
            <h3 className="text-lg font-medium" style={{ fontFamily: 'var(--font-serif)' }}>
              No custom artifacts yet
            </h3>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Ask Claude in any chat to build an HTML game, React component, Three.js 3D scene, or Mermaid diagram—or explore the Inspiration tab!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((art) => (
              <div
                key={`${art.id}_${art.conversationId || 'showcase'}`}
                className="flex flex-col justify-between p-5 rounded-2xl border hover:border-[#D97757]/60 transition"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--accent-claude-soft)',
                        color: 'var(--accent-claude)',
                      }}
                    >
                      <ArtifactCubeIcon size={18} />
                    </div>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full border"
                      style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}
                    >
                      {art.showcaseCategory || `v${art.version || 1}`}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base line-clamp-1">{art.title}</h3>
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {art.description || getArtifactTypeLabel(art.type, art.language)}
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-5 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => onPreviewArtifact(art)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium hover:opacity-90 cursor-pointer"
                  >
                    <Eye size={13} />
                    <span>Launch Artifact</span>
                  </button>
                  {art.conversationId && (
                    <button
                      type="button"
                      onClick={() => onOpenConversation(art.conversationId)}
                      title="Go to chat"
                      className="p-2 rounded-xl border hover:bg-black/5 cursor-pointer"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <MessageSquare size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
