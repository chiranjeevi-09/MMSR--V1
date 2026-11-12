import React from 'react';
import { cn } from '@/lib/utils/cn';

export type BookSortOption = 'newest' | 'popular' | 'price_low' | 'price_high' | 'title_asc' | 'rating';

export interface BookSortProps {
  currentSort: BookSortOption;
  onSortChange: (option: BookSortOption) => void;
  totalCount: number;
}

export const BookSort: React.FC<BookSortProps> = ({ currentSort, onSortChange, totalCount }) => {
  const options: { id: BookSortOption; label: string }[] = [
    { id: 'newest', label: 'Newest' },
    { id: 'popular', label: 'Popular' },
    { id: 'price_low', label: 'Price: Low to High' },
    { id: 'price_high', label: 'Price: High to Low' },
    { id: 'title_asc', label: 'A–Z Title' },
    { id: 'rating', label: 'Highest Rated' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-manrope bg-[#FFF9F1]/60 p-3 rounded-2xl border border-[#D4AC54]/40">
      <div className="text-xs text-text-muted">
        Showing <span className="font-bold text-gold-400">{totalCount}</span> academic volumes
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-text-muted mr-1 hidden sm:inline">Sort By:</span>
        {options.map((opt) => {
          const isActive = currentSort === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSortChange(opt.id)}
              aria-pressed={isActive}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none',
                isActive
                  ? 'bg-gradient-gold text-navy-900 font-bold shadow-gold-glow'
                  : 'text-text-muted hover:text-ivory-white hover:bg-white/5'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
