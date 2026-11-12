import React from 'react';
import { cn } from '@/lib/utils/cn';

export type JournalSortOption = 'newest' | 'title_asc' | 'popular' | 'impact' | 'recent_issue';

export interface JournalSortProps {
  currentSort: JournalSortOption;
  onSortChange: (option: JournalSortOption) => void;
  totalCount: number;
}

export const JournalSort: React.FC<JournalSortProps> = ({ currentSort, onSortChange, totalCount }) => {
  const options: { id: JournalSortOption; label: string }[] = [
    { id: 'newest', label: 'Newest' },
    { id: 'impact', label: 'Impact Factor' },
    { id: 'popular', label: 'Most Articles' },
    { id: 'recent_issue', label: 'Latest Volume' },
    { id: 'title_asc', label: 'A–Z Title' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-manrope bg-[#FFF9F1]/60 p-3 rounded-2xl border border-[#D4AC54]/40">
      <div className="text-xs text-text-muted">
        Showing <span className="font-bold text-gold-400">{totalCount}</span> peer-reviewed journals
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
