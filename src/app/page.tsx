'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { Note, Category } from '@/lib/types';
import NoteCard from '@/components/NoteCard';
import CategoryTabs from '@/components/CategoryTabs';
import SearchBar from '@/components/SearchBar';
import Toast from '@/components/Toast';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const categoryMapRef = useRef<Map<string, number>>(new Map());

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeCategory) params.set('category_id', activeCategory);
    if (searchQuery) params.set('search', searchQuery);

    const res = await fetch(`/api/notes?${params}`, { cache: 'no-store' });
    if (res.ok) {
      const data: Note[] = await res.json();
      setNotes(data);

      // Extract categories from notes as a reliable fallback
      const catMap = new Map<string, Category>();
      data.forEach((n) => {
        const cat = n.categories as Category | null;
        if (cat) catMap.set(cat.id, cat);
      });
      if (catMap.size > 0) {
        const cats = Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        setCategories((prev) => prev.length >= cats.length ? prev : cats);
        const map = new Map<string, number>();
        cats.forEach((c, i) => map.set(c.id, i));
        categoryMapRef.current = map;
      }
    } else {
      setToast("Can't connect to database. Retrying...");
    }
    setLoading(false);
  }, [activeCategory, searchQuery]);

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/categories', { cache: 'no-store' });
    if (res.ok) {
      const data: Category[] = await res.json();
      setCategories(data);
      const map = new Map<string, number>();
      data.forEach((c, i) => map.set(c.id, i));
      categoryMapRef.current = map;
    }
  }, []);

  // Initial load — fetch both in parallel
  useEffect(() => {
    Promise.all([fetchCategories(), fetchNotes()]);
  }, [fetchNotes, fetchCategories]);

  // Real-time subscription for note and category changes
  useEffect(() => {
    const channel = supabase
      .channel('home-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        () => {
          fetchNotes();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        () => {
          fetchCategories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotes, fetchCategories]);

  async function handleDelete(noteId: string) {
    const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } else {
      setToast('Failed to delete note.');
    }
  }

  async function handleTogglePin(noteId: string, currentPinned: boolean) {
    // Optimistic update
    setNotes((prev) =>
      prev.map((n) => n.id === noteId ? { ...n, pinned: !currentPinned } : n)
    );
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !currentPinned }),
    });
    if (!res.ok) {
      // Revert on failure
      setNotes((prev) =>
        prev.map((n) => n.id === noteId ? { ...n, pinned: currentPinned } : n)
      );
    }
  }

  function handleNewNote() {
    router.push('/note/new');
  }

  // Prefetch note detail pages when notes are loaded
  useEffect(() => {
    notes.slice(0, 10).forEach((note) => {
      router.prefetch(`/note/${note.id}`);
    });
  }, [notes, router]);

  function getCategoryIndex(categoryId: string | null): number {
    if (!categoryId) return 0;
    return categoryMapRef.current.get(categoryId) ?? 0;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="px-4 pt-safe-top">
          {searchOpen ? (
            <div className="py-2">
              <SearchBar
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                onSearch={setSearchQuery}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between py-3">
              <h1 className="text-xl font-bold text-gray-900">Notellm</h1>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2.5 rounded-xl active:bg-gray-100 transition-colors"
                  aria-label="Search"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
                <button
                  onClick={handleNewNote}
                  className="p-2.5 rounded-xl bg-gray-900 text-white active:bg-gray-700 transition-colors"
                  aria-label="New note"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Category tabs — always visible so filter UI is discoverable */}
        {!searchOpen && (
          <div className="px-4 pb-2">
            <CategoryTabs
              categories={categories}
              activeId={activeCategory}
              onSelect={setActiveCategory}
            />
          </div>
        )}
      </header>

      {/* Notes list */}
      <main className="px-4 py-4 pb-safe-bottom">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  <div className="h-3 w-12 bg-gray-100 rounded ml-auto" />
                </div>
                <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-full bg-gray-100 rounded mb-1" />
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <p className="text-gray-400 text-sm">
              {searchQuery ? 'No notes found' : 'No notes yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleNewNote}
                className="mt-4 text-sm font-medium text-gray-600 active:text-gray-900"
              >
                Create your first note
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                categoryIndex={getCategoryIndex(note.category_id)}
                onTap={() => router.push(`/note/${note.id}`)}
                onDelete={() => handleDelete(note.id)}
                onTogglePin={() => handleTogglePin(note.id, note.pinned)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating new note button (mobile) */}
      {!searchOpen && (
        <button
          onClick={handleNewNote}
          className="fixed bottom-6 right-4 w-14 h-14 rounded-2xl bg-gray-900 text-white shadow-lg shadow-gray-900/25 flex items-center justify-center active:scale-95 transition-transform z-30"
          style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-label="New note"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
