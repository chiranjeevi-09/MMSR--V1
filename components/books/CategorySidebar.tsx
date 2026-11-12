import React from 'react';
import { BookCategory } from '@/lib/types/book';
import { cn } from '@/lib/utils/cn';

export interface CategorySidebarProps {
  categories: BookCategory[];
  selectedCategory: string;
  onSelectCategory: (categorySlug: string) => void;
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex flex-col gap-2 font-manrope">
      <h4 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 mb-1">
        Categories
      </h4>
      <div className="flex flex-col gap-1">
        {categories.map((cat) => {
          const isActive = selectedCategory.toLowerCase() === cat.slug.toLowerCase() || (selectedCategory === 'all' && cat.slug === 'all');
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left',
                isActive
                  ? 'bg-gold-500/15 text-gold-400 font-semibold border border-[#D4AC54]'
                  : 'text-text-muted hover:text-ivory-white hover:bg-white/5'
              )}
            >
              <span>{cat.name}</span>
              <span className="text-[13px] font-mono opacity-80 px-1.5 py-0.5 rounded bg-white/5">
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
