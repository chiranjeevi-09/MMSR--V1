'use client';

import React from 'react';
import { Conference } from '@/lib/types/conference';
import { ConferenceCard } from './ConferenceCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { CalendarDays } from 'lucide-react';

interface ConferenceGridProps {
  conferences: Conference[];
  loading?: boolean;
  totalPages?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  onReset?: () => void;
}

const SkeletonCard = () => (
  <div className="rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 h-72 animate-pulse" />
);

export const ConferenceGrid: React.FC<ConferenceGridProps> = ({
  conferences,
  loading,
  totalPages = 1,
  currentPage = 1,
  onPageChange,
  onReset,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (conferences.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="w-12 h-12 text-gold-400" />}
        title="No Conferences Found"
        description="Try adjusting your search or filters to discover research conferences."
        primaryActionLabel="Clear Filters"
        onPrimaryAction={onReset}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {conferences.map((conf) => (
          <ConferenceCard key={conf.id} conference={conf} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg bg-[#FFF9F1] border border-[#D4AC54]/60 text-sm text-text-muted hover:text-ivory-white hover:border-gold-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Previous
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => onPageChange(i + 1)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                currentPage === i + 1
                  ? 'bg-gradient-gold text-navy-900 shadow-gold-glow'
                  : 'bg-[#FFF9F1] border border-[#D4AC54]/60 text-text-muted hover:text-ivory-white hover:border-gold-500/40'
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg bg-[#FFF9F1] border border-[#D4AC54]/60 text-sm text-text-muted hover:text-ivory-white hover:border-gold-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};
