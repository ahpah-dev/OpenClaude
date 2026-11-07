import React, { useState } from 'react';
import { Search, Star, Trash2, Plus, MessageSquare } from 'lucide-react';

export default function ChatsArchiveView({
  conversations = [],
  onOpenConversation,
  onNewChat,
  onToggleStar,
  onBulkDelete,
}) {
  const [query, setQuery] = useState('');
  const [onlyStarred, setOnlyStarred] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const filtered = conversations.filter((c) => {
    if (onlyStarred && !c.starred) return false;
    if (query.trim() && !(c.title || '').toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto px-6 py-9">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
              Your chat history
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {conversations.length} conversations stored locally on your computer
            </p>
          </div>
          <button
            type="button"
            onClick={onNewChat}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#D97757] text-white text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            <Plus size={16} />
            <span>New chat</span>
          </button>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div
            className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your chats..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyStarred(!onlyStarred)}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
              onlyStarred ? 'border-[#D97757] text-[#D97757]' : ''
            }`}
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: onlyStarred ? '#D97757' : 'var(--border-subtle)' }}
          >
            <Star size={14} className={onlyStarred ? 'fill-[#D97757]' : ''} />
            <span>Starred</span>
          </button>

          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => {
                onBulkDelete(Array.from(selectedIds));
                setSelectedIds(new Set());
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-medium cursor-pointer"
            >
              <Trash2 size={14} />
              <span>Delete ({selectedIds.size})</span>
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div
            className="rounded-2xl border p-10 text-center text-sm"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            No matching chats found.
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3.5 rounded-2xl border hover:border-[#D97757]/50 transition"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  className="accent-[#D97757] w-4 h-4 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => onOpenConversation(c.id)}
                  className="flex-1 min-w-0 text-left cursor-pointer"
                >
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#D97757] shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </div>
                  <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span>Last message {new Date(c.updatedAt).toLocaleString()}</span>
                    {c.model && <span>• {c.model}</span>}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleStar(c.id, !c.starred)}
                  className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                >
                  <Star size={15} className={c.starred ? 'fill-[#D97757] text-[#D97757]' : 'opacity-40'} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
