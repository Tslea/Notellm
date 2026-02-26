'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-browser';
import { Note, Category } from '@/lib/types';
import { getCategoryColor } from '@/lib/category-colors';
import Toast from '@/components/Toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function NoteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;
  const isNew = noteId === 'new';

  const [note, setNote] = useState<Note | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedContentRef = useRef('');
  const noteIdRef = useRef<string | null>(null);
  // Track whether content was edited in this session (needs AI reprocess on close)
  const contentDirtyRef = useRef(false);

  // Auto-grow textarea
  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }

  // Fetch note data
  const fetchNote = useCallback(async (id: string) => {
    const res = await fetch(`/api/notes?search=`);
    if (!res.ok) return;
    const notes: Note[] = await res.json();
    const found = notes.find((n) => n.id === id);
    if (found) {
      setNote(found);
      // Only update content if user hasn't typed something new
      if (savedContentRef.current === '' || savedContentRef.current === found.content) {
        setContent(found.content);
        savedContentRef.current = found.content;
      }
      // Get category index
      if (found.category_id) {
        const catRes = await fetch('/api/categories');
        if (catRes.ok) {
          const cats: Category[] = await catRes.json();
          const idx = cats.findIndex((c) => c.id === found.category_id);
          if (idx >= 0) setCategoryIndex(idx);
        }
      }
    }
  }, []);

  // Load existing note or focus for new
  useEffect(() => {
    if (isNew) {
      textareaRef.current?.focus();
    } else {
      fetchNote(noteId);
    }
  }, [isNew, noteId, fetchNote]);

  // Real-time subscription
  useEffect(() => {
    if (isNew && !noteIdRef.current) return;
    const id = isNew ? noteIdRef.current : noteId;
    if (!id) return;

    const channel = supabase
      .channel(`note-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notes', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as Note;
          setNote((prev) => prev ? { ...prev, ...updated } : null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isNew, noteId]);

  // Trigger AI reprocess when the user leaves the page (tab hidden, browser back, etc.)
  useEffect(() => {
    function triggerAIIfNeeded() {
      if (!contentDirtyRef.current) return;
      const id = noteIdRef.current || (noteId !== 'new' ? noteId : null);
      if (!id) return;
      contentDirtyRef.current = false;
      navigator.sendBeacon(`/api/notes/${id}/reprocess`);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        triggerAIIfNeeded();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [noteId]);

  // Save function (content only — no AI trigger)
  async function saveNote(text: string): Promise<boolean> {
    if (text.trim().length === 0) return false;
    setSaving(true);

    try {
      if (isNew && !noteIdRef.current) {
        // Create new note
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          noteIdRef.current = data.id;
          setNote(data);
          savedContentRef.current = text;
          contentDirtyRef.current = true;
          // Replace URL without navigation
          window.history.replaceState(null, '', `/note/${data.id}`);
          setSaving(false);
          return true;
        } else {
          setToast('Failed to save. Tap to retry.');
        }
      } else {
        // Update existing
        const id = noteIdRef.current || noteId;
        if (text === savedContentRef.current) {
          setSaving(false);
          return true;
        }
        const res = await fetch(`/api/notes/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: text }),
        });
        if (res.ok) {
          const data = await res.json();
          setNote(data);
          savedContentRef.current = text;
          contentDirtyRef.current = true;
          setSaving(false);
          return true;
        } else {
          setToast('Failed to save. Tap to retry.');
        }
      }
    } catch {
      setToast('Failed to save. Tap to retry.');
    }
    setSaving(false);
    return false;
  }

  // Debounced auto-save on content change
  function handleContentChange(value: string) {
    setContent(value);
    autoResize();

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveNote(value);
    }, 2000);
  }

  // Save on blur (textarea loses focus)
  function handleBlur() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (content.trim().length > 0 && content !== savedContentRef.current) {
      saveNote(content);
    }
  }

  // Close the note: save pending content, trigger AI, then navigate home
  async function handleBack() {
    // Cancel pending debounce
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    // Save if there are unsaved changes
    if (content.trim().length > 0 && content !== savedContentRef.current) {
      await saveNote(content);
    }

    // Trigger AI reprocess if content was edited
    const id = noteIdRef.current || (noteId !== 'new' ? noteId : null);
    if (id && contentDirtyRef.current) {
      contentDirtyRef.current = false;
      // Fire-and-forget from client — server awaits the AI call internally
      fetch(`/api/notes/${id}/reprocess`, { method: 'POST' }).catch(() => {});
    }

    router.push('/');
  }

  async function handleTogglePin() {
    if (!note) return;
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !note.pinned }),
    });
    if (res.ok) {
      const data = await res.json();
      setNote(data);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    const id = noteIdRef.current || noteId;
    if (!id || id === 'new') {
      router.back();
      return;
    }
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      contentDirtyRef.current = false; // no need to reprocess a deleted note
      router.push('/');
    } else {
      setToast('Failed to delete note.');
    }
  }

  async function handleReprocess() {
    const id = noteIdRef.current || noteId;
    if (!id) return;
    const res = await fetch(`/api/notes/${id}/reprocess`, { method: 'POST' });
    if (res.ok) {
      setNote((prev) => prev ? { ...prev, ai_status: 'processing' } : null);
    }
  }

  const category = note?.categories as Category | null;
  const color = category ? getCategoryColor(categoryIndex) : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3 pt-safe-top">
          <button
            onClick={handleBack}
            className="flex items-center gap-1 text-gray-600 active:text-gray-900 -ml-1 py-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>

          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-gray-400">Saving...</span>
            )}
            {category && color && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                {category.name}
              </span>
            )}
            {note && (
              <button
                onClick={handleTogglePin}
                className={`p-2 rounded-xl transition-colors ${
                  note.pinned ? 'text-amber-500' : 'text-gray-400 active:text-gray-600'
                }`}
                aria-label={note.pinned ? 'Unpin' : 'Pin'}
              >
                <svg className="w-5 h-5" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
            )}
            <button
              onClick={handleDelete}
              className={`p-2 rounded-xl transition-colors ${
                confirmDelete ? 'text-red-600 bg-red-50' : 'text-gray-400 active:text-gray-600'
              }`}
              aria-label="Delete"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-safe-bottom">
        {/* Original note section */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Original
          </label>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="Write your note..."
            className="w-full resize-none outline-none text-gray-800 text-base leading-relaxed placeholder:text-gray-300 min-h-[120px]"
            rows={4}
            autoFocus={isNew}
          />
        </div>

        {/* Divider */}
        {note && (
          <>
            <div className="border-t border-gray-100 my-6" />

            {/* AI Rewrite section */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                AI Rewrite
              </label>

              {note.ai_status === 'pending' && !note.ai_rewrite && (
                <p className="text-sm text-gray-400 py-4">
                  Will process when you close the note.
                </p>
              )}

              {note.ai_status === 'processing' && (
                <div className="flex items-center gap-2 text-gray-400 py-4">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Processing...</span>
                </div>
              )}

              {note.ai_status === 'done' && note.ai_rewrite && (
                <div className="prose prose-sm prose-gray max-w-none text-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {note.ai_rewrite}
                  </ReactMarkdown>
                </div>
              )}

              {/* Show old rewrite while pending (content was edited) */}
              {note.ai_status === 'pending' && note.ai_rewrite && (
                <div className="opacity-50">
                  <p className="text-xs text-gray-400 mb-2 italic">Previous version — will update when you close the note</p>
                  <div className="prose prose-sm prose-gray max-w-none text-gray-700">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {note.ai_rewrite}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {note.ai_status === 'error' && (
                <button
                  onClick={handleReprocess}
                  className="flex items-center gap-2 text-amber-600 text-sm py-2 active:text-amber-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Failed — tap to retry
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
