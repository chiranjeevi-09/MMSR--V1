import React from 'react';
import { cn } from '@/lib/utils/cn';
import { ConferenceFilterOptions } from '@/lib/types/conference';

export type ConferenceSortOption = ConferenceFilterOptions['sortBy'];

export interface ConferenceSortProps {
  currentSort?: ConferenceSortOption;
  onSortChange: (option: ConferenceSortOption) => void;
  totalCount: number;
}

export const ConferenceSort: React.FC<ConferenceSortProps> = ({
  currentSort = 'date_desc',
  onSortChange,
  totalCount,
}) => {
  const options: { id: ConferenceSortOption; label: string }[] = [
    { id: 'date_desc', label: 'Upcoming First' },
    { id: 'date_asc', label: 'Earliest Date' },
    { id: 'year_desc', label: 'Latest Year' },
    { id: 'title_asc', label: 'A–Z Title' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-manrope bg-[#FFF9F1]/60 p-3 rounded-2xl border border-[#D4AC54]/40">
      <div className="text-xs text-text-muted">
        Showing <span className="font-bold text-gold-400">{totalCount}</span> research conferences
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
