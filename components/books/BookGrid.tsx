'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, PackageOpen } from 'lucide-react';
import { Book } from '@/lib/types/book';
import { BookCard } from './BookCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils/cn';

export interface BookGridProps {
  books: Book[];
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onQuickView?: (book: Book) => void;
  onResetFilters?: () => void;
}

export const BookGrid: React.FC<BookGridProps> = ({
  books,
  page,
  totalPages,
  onPageChange,
  onQuickView,
  onResetFilters,
}) => {
  if (books.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen className="w-12 h-12 text-gold-400/70" />}
        title="No Academic Books Found"
        description="No volumes match your selected category or search query. Try broadening your filter options or clearing search terms."
        primaryActionLabel="Clear All Filters"
        onPrimaryAction={onResetFilters}
      />
    );
  }

  return (
    <div className="flex flex-col gap-10 w-full font-manrope">
      {/* 4-Column Responsive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onQuickView={onQuickView} />
        ))}
      </div>

      {/* SECTION 6 — PAGINATION */}
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
                      : 'bg-[#FFF9F1] border border-[#D4AC54]/60 text-text-muted hover:text-ivory-white hover:border-white/20'
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
