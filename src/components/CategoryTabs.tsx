'use client';

import { Category } from '@/lib/types';
import { getCategoryColor } from '@/lib/category-colors';

interface CategoryTabsProps {
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

export default function CategoryTabs({ categories, activeId, onSelect }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
      <button
        onClick={() => onSelect(null)}
        className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
          activeId === null
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-600 active:bg-gray-200'
        }`}
      >
        All
      </button>
      {categories.map((cat, i) => {
        const color = getCategoryColor(i);
        const isActive = activeId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.id)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? `${color.bg} ${color.text} ring-1 ${color.border}`
                : 'bg-gray-100 text-gray-600 active:bg-gray-200'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
