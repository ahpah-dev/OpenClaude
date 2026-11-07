import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  MessageSquare,
  FolderKanban,
  Box,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Settings,
  Sun,
  Moon,
  Monitor,
  Activity,
  ExternalLink,
  Check,
  X,
  Gauge,
} from 'lucide-react';
import { ClaudeStarburst, NineRouterBadgeIcon, OllamaIcon } from './ClaudeIcons.jsx';

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  activeView, // 'chat' | 'chats' | 'projects' | 'artifacts' | '9router-dashboard'
  onNavigate,
  onNewChat,
  conversations = [],
  projects = [],
  activeConversationId,
  activeProjectId,
  onSelectConversation,
  onSelectProject,
  onToggleStarConversation,
  onRenameConversation,
  onDeleteConversation,
  systemStatus,
  userProfile,
  theme,
  onChangeTheme,
  onOpenSettings,
  onOpenSetupWizard,
  onPopoutNineRouter,
}) {
  const [menuConvId, setMenuConvId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setMenuConvId(null);
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const starredConversations = conversations.filter((c) => c.starred);
  const starredProjects = projects.filter((p) => p.starred);
  const recentConversations = conversations.filter((c) => !c.starred).slice(0, 35);

  const initials = (userProfile?.nickname || userProfile?.fullName || 'D')
    .trim()
    .slice(0, 2)
    .toUpperCase();

  const nineUp = !!systemStatus?.nineRouter?.running;
  const ollamaUp = !!systemStatus?.ollama?.running;

  // Collapsed slim rail (authentic Claude.ai rail)
  if (collapsed) {
    return (
      <aside
        className="w-14 h-full border-r flex flex-col items-center py-3 justify-between shrink-0 select-none z-30"
        style={{
          backgroundColor: 'var(--bg-sidebar)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <PanelLeftOpen size={18} />
          </button>

          <button
            type="button"
            onClick={onNewChat}
            title="New chat (Ctrl+K)"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-xs hover:opacity-90 transition cursor-pointer"
            style={{ backgroundColor: 'var(--accent-claude)' }}
          >
            <Plus size={18} strokeWidth={2.4} />
          </button>

          <div className="h-px w-6 my-1" style={{ backgroundColor: 'var(--border-subtle)' }} />

          <button
            type="button"
            onClick={() => onNavigate('chats')}
            title="Chats"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              activeView === 'chats' ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <MessageSquare size={17} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('projects')}
            title="Projects"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              activeView === 'projects' ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <FolderKanban size={17} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('artifacts')}
            title="Artifacts"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              activeView === 'artifacts' ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Box size={17} />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('9router-dashboard')}
            title="9Router Dashboard"
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer relative ${
              activeView === '9router-dashboard' ? 'bg-black/10 dark:bg-white/10' : 'hover:bg-black/5 dark:hover:bg-white/5'
            }`}
            style={{ color: 'var(--text-secondary)' }}
          >
            <Gauge size={17} />
            <span
              className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                nineUp ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenSettings('profile')}
            title="Settings"
            className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Settings size={17} />
          </button>
          <button
            type="button"
            onClick={() => onOpenSettings('profile')}
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: '#2B2A27' }}
          >
            {initials}
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      ref={sidebarRef}
      className="w-[272px] h-full border-r flex flex-col shrink-0 select-none z-30"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <ClaudeStarburst size={22} />
          <span
            className="text-[20px] font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-primary)' }}
          >
            Claude
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-md border"
            style={{
              borderColor: 'var(--border-strong)',
              color: 'var(--text-secondary)',
            }}
          >
            Open
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
          style={{ color: 'var(--text-secondary)' }}
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      {/* Primary New Chat Action */}
      <div className="px-2.5 py-1.5">
        <button
          type="button"
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition hover:bg-black/[0.05] dark:hover:bg-white/[0.06] cursor-pointer"
          style={{ color: 'var(--accent-claude)' }}
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: 'var(--accent-claude)' }}
          >
            <Plus size={15} strokeWidth={2.5} />
          </span>
          <span>New chat</span>
        </button>
      </div>

      {/* Claude Primary Navigation */}
      <nav className="px-2.5 space-y-0.5 pb-2">
        {[
          { id: 'chats', label: 'Chats', Icon: MessageSquare },
          { id: 'projects', label: 'Projects', Icon: FolderKanban },
          { id: 'artifacts', label: 'Artifacts', Icon: Box },
        ].map(({ id, label, Icon }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[13.5px] font-medium transition cursor-pointer"
              style={{
                backgroundColor: active ? 'var(--bg-sidebar-active)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          );
        })}

        {/* Built-in 9Router Dashboard Item */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onNavigate('9router-dashboard')}
            className="flex-1 flex items-center justify-between px-3 py-1.5 rounded-xl text-[13.5px] font-medium transition cursor-pointer"
            style={{
              backgroundColor: activeView === '9router-dashboard' ? 'var(--bg-sidebar-active)' : 'transparent',
              color: activeView === '9router-dashboard' ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <span className="flex items-center gap-2.5">
              <Gauge size={16} className="text-[#D97757]" />
              <span>9Router Dashboard</span>
            </span>
            <span
              className={`w-2 h-2 rounded-full ${nineUp ? 'bg-emerald-500' : 'bg-amber-500'}`}
              title={nineUp ? '9Router Online (:20128)' : 'Starting 9Router'}
            />
          </button>
          <button
            type="button"
            onClick={onPopoutNineRouter}
            title="Open 9Router Dashboard in external browser tab"
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            <ExternalLink size={13} />
          </button>
        </div>
      </nav>

      {/* Scrollable Starred & Recents History */}
      <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-4">
        {(starredProjects.length > 0 || starredConversations.length > 0) && (
          <div>
            <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Starred
            </div>
            <div className="space-y-0.5">
              {starredProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProject(p.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-[13px] truncate hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                  style={{
                    backgroundColor: activeProjectId === p.id && activeView === 'projects' ? 'var(--bg-sidebar-active)' : 'transparent',
                  }}
                >
                  <FolderKanban size={14} className="text-[#D97757] shrink-0" />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
              {starredConversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conv={c}
                  active={activeView === 'chat' && activeConversationId === c.id}
                  menuOpen={menuConvId === c.id}
                  isRenaming={renamingId === c.id}
                  renameDraft={renameDraft}
                  onRenameDraft={setRenameDraft}
                  onStartRename={() => {
                    setRenamingId(c.id);
                    setRenameDraft(c.title);
                    setMenuConvId(null);
                  }}
                  onCommitRename={() => {
                    if (renameDraft.trim()) onRenameConversation(c.id, renameDraft.trim());
                    setRenamingId(null);
                  }}
                  onCancelRename={() => setRenamingId(null)}
                  onSelect={() => onSelectConversation(c.id)}
                  onToggleMenu={() => setMenuConvId(menuConvId === c.id ? null : c.id)}
                  onToggleStar={() => {
                    onToggleStarConversation(c.id, !c.starred);
                    setMenuConvId(null);
                  }}
                  onDelete={() => {
                    onDeleteConversation(c.id);
                    setMenuConvId(null);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Recents
          </div>
          {recentConversations.length === 0 ? (
            <div className="px-2.5 py-3 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Your conversations with 9Router & Ollama models will appear here.
            </div>
          ) : (
            <div className="space-y-0.5">
              {recentConversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conv={c}
                  active={activeView === 'chat' && activeConversationId === c.id}
                  menuOpen={menuConvId === c.id}
                  isRenaming={renamingId === c.id}
                  renameDraft={renameDraft}
                  onRenameDraft={setRenameDraft}
                  onStartRename={() => {
                    setRenamingId(c.id);
                    setRenameDraft(c.title);
                    setMenuConvId(null);
                  }}
                  onCommitRename={() => {
                    if (renameDraft.trim()) onRenameConversation(c.id, renameDraft.trim());
                    setRenamingId(null);
                  }}
                  onCancelRename={() => setRenamingId(null)}
                  onSelect={() => onSelectConversation(c.id)}
                  onToggleMenu={() => setMenuConvId(menuConvId === c.id ? null : c.id)}
                  onToggleStar={() => {
                    onToggleStarConversation(c.id, !c.starred);
                    setMenuConvId(null);
                  }}
                  onDelete={() => {
                    onDeleteConversation(c.id);
                    setMenuConvId(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Engine Health Bar */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={onOpenSetupWizard}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] border hover:opacity-90 transition cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <span className="flex items-center gap-1.5">
            <NineRouterBadgeIcon size={12} className="text-[#D97757]" />
            <span>9Router</span>
            <span className={`w-1.5 h-1.5 rounded-full ${nineUp ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
          <span className="opacity-30">|</span>
          <span className="flex items-center gap-1.5">
            <OllamaIcon size={12} className="text-emerald-600" />
            <span>Ollama</span>
            <span className={`w-1.5 h-1.5 rounded-full ${ollamaUp ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </span>
        </button>
      </div>

      {/* Bottom Claude User Profile Pill + Menu */}
      <div className="p-2.5 border-t relative" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer text-left"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
            style={{ backgroundColor: '#2B2A27' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate">
              {userProfile?.fullName || 'User'}
            </div>
            <div className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              9Router & Ollama Local
            </div>
          </div>
          <MoreHorizontal size={15} style={{ color: 'var(--text-muted)' }} />
        </button>

        {profileMenuOpen && (
          <div
            className="absolute bottom-16 left-2.5 right-2.5 rounded-2xl border p-1.5 z-50 animate-claude-in"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-popover)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                onOpenSettings('profile');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <Settings size={14} />
              <span>Settings & System Prompt</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                onOpenSettings('system-prompt');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer text-[#D97757]"
            >
              <Pencil size={14} />
              <span>Customize System Prompt</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                onOpenSetupWizard();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
            >
              <Activity size={14} />
              <span>9Router & Ollama Auto-Setup</span>
            </button>

            <div className="border-t my-1" style={{ borderColor: 'var(--border-subtle)' }} />

            <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Appearance
            </div>
            <div className="grid grid-cols-3 gap-1 p-1">
              {[
                { id: 'light', label: 'Light', Icon: Sun },
                { id: 'dark', label: 'Dark', Icon: Moon },
                { id: 'system', label: 'Auto', Icon: Monitor },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChangeTheme(id)}
                  className={`flex flex-col items-center gap-1 py-1.5 rounded-lg text-[11px] transition cursor-pointer ${
                    theme === id ? 'bg-[#D97757]/15 text-[#D97757] font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function ConversationRow({
  conv,
  active,
  menuOpen,
  isRenaming,
  renameDraft,
  onRenameDraft,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onSelect,
  onToggleMenu,
  onToggleStar,
  onDelete,
}) {
  if (isRenaming) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-xl" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <input
          value={renameDraft}
          onChange={(e) => onRenameDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommitRename();
            if (e.key === 'Escape') onCancelRename();
          }}
          autoFocus
          className="flex-1 min-w-0 bg-transparent text-xs focus:outline-none"
        />
        <button type="button" onClick={onCommitRename} className="p-0.5 text-emerald-600 cursor-pointer"><Check size={13} /></button>
        <button type="button" onClick={onCancelRename} className="p-0.5 opacity-60 cursor-pointer"><X size={13} /></button>
      </div>
    );
  }

  return (
    <div
      className="group relative flex items-center rounded-xl transition"
      style={{
        backgroundColor: active ? 'var(--bg-sidebar-active)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 min-w-0 text-left px-2.5 py-1.5 text-[13px] truncate hover:opacity-100 cursor-pointer"
        style={{
          color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: active ? 500 : 400,
        }}
      >
        {conv.title || 'New chat'}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMenu();
        }}
        className={`p-1 mr-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer ${
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ color: 'var(--text-muted)' }}
      >
        <MoreHorizontal size={14} />
      </button>

      {menuOpen && (
        <div
          className="absolute right-1 top-8 w-40 rounded-xl border p-1 z-40 animate-claude-in"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
            boxShadow: 'var(--shadow-popover)',
          }}
        >
          <button
            type="button"
            onClick={onToggleStar}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Star size={13} className={conv.starred ? 'fill-[#D97757] text-[#D97757]' : ''} />
            <span>{conv.starred ? 'Unstar' : 'Star'}</span>
          </button>
          <button
            type="button"
            onClick={onStartRename}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
          >
            <Pencil size={13} />
            <span>Rename</span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-red-600 hover:bg-red-500/10 cursor-pointer"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
