import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { ClaudeStarburst } from './ClaudeIcons.jsx';

const WORK_ROLES = [
  'Software Engineering',
  'Design & Creative',
  'Research & Data',
  'Product & Strategy',
  'Writing & Content',
  'Student & Learning',
  'Just Exploring',
];

export default function WelcomeModal({ initialName = '', initialRole = '', onComplete }) {
  const [name, setName] = useState(initialName);
  const [workRole, setWorkRole] = useState(initialRole || 'Software Engineering');
  const [saving, setSaving] = useState(false);

  const initials = (name.trim() || 'U').slice(0, 2).toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onComplete({
        fullName: trimmed,
        nickname: trimmed,
        workRole,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-3xl border p-7 sm:p-8 space-y-6 animate-claude-in"
        style={{
          backgroundColor: 'var(--bg-canvas)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-popover)',
        }}
      >
        <div className="flex flex-col items-center text-center space-y-3">
          <ClaudeStarburst size={38} />
          <h2
            className="text-2xl sm:text-3xl font-normal tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
          >
            Before we get started, what should Claude call you?
          </h2>
          <p className="text-xs leading-relaxed max-w-xs" style={{ color: 'var(--text-secondary)' }}>
            Stored locally on your machine—used for personalized greetings and your customizable system prompt.
          </p>
        </div>

        {/* Username Input with Live Avatar Badge */}
        <div className="space-y-2">
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Your name or username
          </label>
          <div
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border focus-within:border-[#D97757] transition"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-strong)',
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0 select-none"
              style={{ backgroundColor: '#2B2A27' }}
            >
              {initials}
            </div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name..."
              autoFocus
              maxLength={40}
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Optional Work Focus Pills */}
        <div className="space-y-2">
          <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            What best describes your focus? (Optional)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {WORK_ROLES.map((role) => {
              const selected = workRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setWorkRole(role)}
                  className="px-3 py-1.5 rounded-full border text-xs font-medium transition cursor-pointer"
                  style={{
                    backgroundColor: selected ? 'var(--accent-claude-soft)' : 'var(--bg-surface)',
                    borderColor: selected ? 'var(--accent-claude)' : 'var(--border-subtle)',
                    color: selected ? 'var(--accent-claude)' : 'var(--text-secondary)',
                  }}
                >
                  {role}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="w-full py-3 rounded-2xl text-white text-sm font-medium flex items-center justify-center gap-2 transition hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-default"
          style={{ backgroundColor: 'var(--accent-claude)' }}
        >
          <span>{saving ? 'Saving...' : 'Continue to OpenClaude'}</span>
          <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}
