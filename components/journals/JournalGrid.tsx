'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, FileX } from 'lucide-react';
import { Journal } from '@/lib/types/journal';
import { JournalCard } from './JournalCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils/cn';

export interface JournalGridProps {
  journals: Journal[];
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onQuickView?: (journal: Journal) => void;
  onResetFilters?: () => void;
}

export const JournalGrid: React.FC<JournalGridProps> = ({
  journals,
  page,
  totalPages,
  onPageChange,
  onQuickView,
  onResetFilters,
}) => {
  if (journals.length === 0) {
    return (
      <EmptyState
        icon={<FileX className="w-12 h-12 text-gold-400/70" />}
        title="No Journals Found"
        description="No academic journals match your filter criteria or search query. Try resetting your search terms or expanding discipline selections."
        primaryActionLabel="Clear All Filters"
        onPrimaryAction={onResetFilters}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10 w-full font-manrope">
      {/* Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {journals.map((journal) => (
          <JournalCard key={journal.id} journal={journal} onQuickView={onQuickView} />
        ))}
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6 border-t border-[#D4AC54]/60">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-2.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-text-muted hover:text-ivory-white hover:border-gold-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalPages }).map((_, idx) => {
              const p = idx + 1;
              const isActive = p === page;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={cn(
                    'w-9 h-9 rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer select-none',
                    isActive
                      ? 'bg-gradient-gold text-navy-900 shadow-gold-glow font-bold'
                      : 'bg-[#FFF9F1] border border-[#D4AC54]/60 text-text-muted hover:text-ivory-white hover:bg-white/5'
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-2.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-text-muted hover:text-ivory-white hover:border-gold-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            aria-label="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
