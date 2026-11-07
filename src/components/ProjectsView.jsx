import React, { useState, useRef } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  Star,
  ArrowLeft,
  FileText,
  Upload,
  Trash2,
  Sliders,
  MessageSquare,
  X,
  Check,
} from 'lucide-react';
import Composer from './Composer.jsx';

export default function ProjectsView({
  projects = [],
  conversations = [],
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onAddKnowledge,
  onRemoveKnowledge,
  onStartProjectChat,
  onOpenConversation,
  composerProps,
}) {
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newInstructions, setNewInstructions] = useState('');

  const [editingInstructions, setEditingInstructions] = useState(false);
  const [instructionsDraft, setInstructionsDraft] = useState('');

  const [showTextDocModal, setShowTextDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const fileRef = useRef(null);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // PROJECT WORKSPACE DETAIL VIEW
  if (activeProject) {
    const projectChats = conversations.filter((c) => c.projectId === activeProject.id);
    const totalChars = (activeProject.knowledge || []).reduce(
      (acc, d) => acc + (d.content?.length || d.size || 0),
      0
    );
    const estTokens = Math.round(totalChars / 4);
    const contextPercent = Math.min(100, Math.max(1, Math.round((estTokens / 128000) * 100)));

    const handleUploadFiles = async (files) => {
      for (const f of Array.from(files || [])) {
        const text = await f.text().catch(() => '');
        if (text) {
          await onAddKnowledge(activeProject.id, {
            title: f.name,
            fileName: f.name,
            content: text,
            type: f.type || 'text/plain',
          });
        }
      }
    };

    return (
      <div className="flex-1 h-full overflow-y-auto px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium mb-5 hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={14} />
            <span>All Projects</span>
          </button>

          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <FolderKanban size={24} className="text-[#D97757]" />
                <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-serif)' }}>
                  {activeProject.name}
                </h1>
                <button
                  type="button"
                  onClick={() => onUpdateProject(activeProject.id, { starred: !activeProject.starred })}
                  className="p-1.5 rounded-lg hover:bg-black/5 cursor-pointer"
                >
                  <Star
                    size={16}
                    className={activeProject.starred ? 'fill-[#D97757] text-[#D97757]' : 'opacity-50'}
                  />
                </button>
              </div>
              {activeProject.description && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {activeProject.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onDeleteProject(activeProject.id);
                onSelectProject(null);
              }}
              className="px-3 py-1.5 rounded-xl border text-xs text-red-600 hover:bg-red-500/10 cursor-pointer"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              Delete project
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Cols: Composer + Project Chats */}
            <div className="lg:col-span-7 space-y-6">
              <Composer
                {...composerProps}
                placeholder={`Start a new chat inside "${activeProject.name}"...`}
                projectBadge={{
                  name: activeProject.name,
                  knowledgeCount: activeProject.knowledge?.length || 0,
                }}
                onSend={(payload) => onStartProjectChat(activeProject.id, payload)}
              />

              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  Project Conversations ({projectChats.length})
                </h2>
                {projectChats.length === 0 ? (
                  <div
                    className="rounded-2xl border p-6 text-center text-sm"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    No chats in this project yet. Send a message above to start one with all project instructions and knowledge automatically included!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectChats.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onOpenConversation(c.id)}
                        className="w-full flex items-center justify-between p-3.5 rounded-2xl border text-left hover:border-[#D97757]/50 transition cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <MessageSquare size={16} className="text-[#D97757] shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.title}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Updated {new Date(c.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Claude Project Instructions & Knowledge Base */}
            <div className="lg:col-span-5 space-y-4">
              {/* Project Instructions Card */}
              <div
                className="rounded-2xl border p-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sliders size={15} className="text-[#D97757]" />
                    <span>Project Instructions</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInstructionsDraft(activeProject.instructions || '');
                      setEditingInstructions(!editingInstructions);
                    }}
                    className="text-xs font-medium text-[#D97757] cursor-pointer"
                  >
                    {editingInstructions ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {editingInstructions ? (
                  <div className="space-y-2">
                    <textarea
                      rows={5}
                      value={instructionsDraft}
                      onChange={(e) => setInstructionsDraft(e.target.value)}
                      placeholder="Give Claude tailored instructions, tone, or coding conventions for every chat in this project..."
                      className="w-full p-3 rounded-xl border text-xs leading-relaxed focus:outline-none"
                      style={{
                        backgroundColor: 'var(--bg-canvas)',
                        borderColor: 'var(--border-subtle)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateProject(activeProject.id, { instructions: instructionsDraft });
                        setEditingInstructions(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
                    >
                      Save Instructions
                    </button>
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {activeProject.instructions ||
                      'Optional custom instructions injected into the system prompt for all chats in this project.'}
                  </p>
                )}
              </div>

              {/* Project Knowledge Card */}
              <div
                className="rounded-2xl border p-4"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Project Knowledge</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={fileRef}
                      type="file"
                      multiple
                      accept=".txt,.md,.json,.csv,.js,.jsx,.ts,.tsx,.py,.html,.css,.sql,.yaml,.yml"
                      onChange={(e) => {
                        if (e.target.files?.length) handleUploadFiles(e.target.files);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs hover:bg-black/5 cursor-pointer"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <Upload size={12} />
                      <span>Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowTextDocModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#D97757] text-white text-xs cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add Text</span>
                    </button>
                  </div>
                </div>

                {/* Context Usage Meter */}
                <div className="mb-3">
                  <div className="flex justify-between text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>
                    <span>~{estTokens.toLocaleString()} tokens</span>
                    <span>{contextPercent}% of 128K knowledge capacity</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface-3)' }}>
                    <div className="h-full bg-[#D97757]" style={{ width: `${activeProject.knowledge?.length ? contextPercent : 0}%` }} />
                  </div>
                </div>

                {(!activeProject.knowledge || activeProject.knowledge.length === 0) ? (
                  <div className="py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    Attach reference docs, codebases, specs, or style guides so Claude always has them in context.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {activeProject.knowledge.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs"
                        style={{
                          backgroundColor: 'var(--bg-canvas)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-[#D97757] shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{doc.title}</div>
                            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {Math.max(1, Math.round((doc.size || doc.content?.length || 0) / 1024))} KB
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveKnowledge(activeProject.id, doc.id)}
                          className="p-1 rounded hover:bg-red-500/10 text-red-500 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Add Text Note Modal */}
        {showTextDocModal && (
          <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-2xl border p-5 space-y-3"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Add Text to Project Knowledge</h3>
                <button type="button" onClick={() => setShowTextDocModal(false)} className="cursor-pointer"><X size={16} /></button>
              </div>
              <input
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="Document title (e.g., API Specification)"
                className="w-full px-3 py-2 rounded-xl border text-sm focus:outline-none"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
              />
              <textarea
                rows={8}
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Paste markdown, code, documentation, or research notes..."
                className="w-full p-3 rounded-xl border text-xs font-mono focus:outline-none"
                style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowTextDocModal(false)} className="px-3.5 py-2 rounded-xl border text-xs cursor-pointer" style={{ borderColor: 'var(--border-subtle)' }}>Cancel</button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!docContent.trim()) return;
                    await onAddKnowledge(activeProject.id, {
                      title: docTitle.trim() || 'Knowledge Note',
                      content: docContent,
                    });
                    setDocTitle('');
                    setDocContent('');
                    setShowTextDocModal(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
                >
                  Add Document
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ALL PROJECTS GALLERY VIEW
  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 h-full overflow-y-auto px-6 py-9">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
              Projects
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Group chats with dedicated custom instructions and persistent reference documents.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#141413] dark:bg-[#F2F0E8] text-white dark:text-[#141413] text-sm font-medium hover:opacity-90 cursor-pointer"
          >
            <Plus size={16} />
            <span>New project</span>
          </button>
        </div>

        <div
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border mb-6"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
        >
          <Search size={15} style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="flex-1 bg-transparent text-sm focus:outline-none"
          />
        </div>

        {filtered.length === 0 ? (
          <div
            className="rounded-3xl border p-10 text-center space-y-3"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <FolderKanban size={34} className="mx-auto text-[#D97757]" />
            <h3 className="text-lg font-medium" style={{ fontFamily: 'var(--font-serif)' }}>
              Create your first Claude Project
            </h3>
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Projects let you attach codebases, documentation, and tailored instructions that automatically ground every conversation inside the workspace.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D97757] text-white text-sm font-medium cursor-pointer"
            >
              <Plus size={15} />
              <span>Create project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((proj) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => onSelectProject(proj.id)}
                className="flex flex-col justify-between p-5 rounded-2xl border text-left hover:border-[#D97757]/60 transition cursor-pointer h-40"
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-base truncate">{proj.name}</span>
                    {proj.starred && <Star size={14} className="fill-[#D97757] text-[#D97757]" />}
                  </div>
                  <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                    {proj.description || proj.instructions || 'No description'}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  <span>{proj.knowledge?.length || 0} knowledge files</span>
                  <span>Updated {new Date(proj.updatedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4 animate-claude-in"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-normal" style={{ fontFamily: 'var(--font-serif)' }}>
                Create a Project
              </h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="cursor-pointer"><X size={17} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">What are you working on?</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Game Engine Architecture, Thesis Research..."
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief summary of this workspace..."
                  className="w-full px-3.5 py-2 rounded-xl border text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Project System Instructions (Optional)</label>
                <textarea
                  rows={4}
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="Custom system instructions applied to every chat in this project..."
                  className="w-full p-3 rounded-xl border text-xs leading-relaxed focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-canvas)', borderColor: 'var(--border-subtle)' }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl border text-xs font-medium cursor-pointer"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!newName.trim()) return;
                  const created = await onCreateProject({
                    name: newName.trim(),
                    description: newDesc.trim(),
                    instructions: newInstructions.trim(),
                  });
                  setNewName('');
                  setNewDesc('');
                  setNewInstructions('');
                  setShowCreateModal(false);
                  if (created?.id) onSelectProject(created.id);
                }}
                className="px-4 py-2 rounded-xl bg-[#D97757] text-white text-xs font-medium cursor-pointer"
              >
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
