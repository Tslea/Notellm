'use client';

import { useEffect, useRef, useState } from 'react';

interface SearchBarProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

export default function SearchBar({ isOpen, onClose, onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery('');
      onSearch('');
    }
  }, [isOpen, onSearch]);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  }

  if (!isOpen) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search notes..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-100 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-300"
        />
      </div>
      <button
        onClick={onClose}
        className="text-sm font-medium text-gray-500 active:text-gray-700 py-2.5 px-1"
      >
        Cancel
      </button>
    </div>
  );
}
