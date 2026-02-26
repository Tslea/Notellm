'use client';

import { useRef, useState } from 'react';
import { Note, Category } from '@/lib/types';
import { getCategoryColor } from '@/lib/category-colors';
import { relativeTime } from '@/lib/time';

interface NoteCardProps {
  note: Note;
  categoryIndex: number;
  onTap: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}

export default function NoteCard({
  note,
  categoryIndex,
  onTap,
  onDelete,
  onTogglePin,
}: NoteCardProps) {
  const [swipeX, setSwipeX] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const category = note.categories as Category | null;
  const color = category ? getCategoryColor(categoryIndex) : null;

  const preview = note.content.length > 120
    ? note.content.slice(0, 120) + '…'
    : note.content;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = false;

    longPressTimer.current = setTimeout(() => {
      onTogglePin();
    }, 600);
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Only swipe if horizontal movement > vertical
    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      swiping.current = true;
      setSwipeX(Math.max(dx, -100));
    }
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (swipeX < -60) {
      setSwipeX(-100);
      setShowDelete(true);
    } else {
      setSwipeX(0);
      setShowDelete(false);
    }
  }

  function handleClick() {
    if (!swiping.current && !showDelete) {
      onTap();
    }
    swiping.current = false;
  }

  function handleDeleteClick() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
  }

  function handleCancelSwipe() {
    setSwipeX(0);
    setShowDelete(false);
    setConfirmDelete(false);
  }

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button behind card */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={handleDeleteClick}
          className={`h-full px-6 text-sm font-medium text-white ${
            confirmDelete ? 'bg-red-600' : 'bg-red-500'
          }`}
        >
          {confirmDelete ? 'Confirm' : 'Delete'}
        </button>
        {showDelete && (
          <button
            onClick={handleCancelSwipe}
            className="h-full px-4 text-sm font-medium text-gray-600 bg-gray-200"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Card content */}
      <div
        className="relative bg-white border border-gray-100 rounded-xl p-4 transition-transform duration-150 active:bg-gray-50"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            {/* Top row: category + pin + time */}
            <div className="flex items-center gap-2 mb-1.5">
              {category && color && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}
                >
                  {category.name}
                </span>
              )}
              {note.pinned && (
                <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-3h4v3a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              )}
              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                {relativeTime(note.updated_at)}
              </span>
            </div>

            {/* Preview text */}
            <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
              {preview}
            </p>
          </div>

          {/* AI status indicator */}
          <div className="flex-shrink-0 mt-1">
            {note.ai_status === 'processing' || note.ai_status === 'pending' ? (
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : note.ai_status === 'done' ? (
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : note.ai_status === 'error' ? (
              <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
