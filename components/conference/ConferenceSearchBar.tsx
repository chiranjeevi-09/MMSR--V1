'use client';

import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ConferenceSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  className?: string;
}

export const ConferenceSearchBar: React.FC<ConferenceSearchBarProps> = ({
  value,
  onChange,
  inputRef,
  className,
}) => {
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = inputRef || internalRef;

  return (
    <div className={cn('relative w-full font-manrope', className)}>
      <label htmlFor="conference-search" className="sr-only">
        Search conferences
      </label>
      <div className="relative flex items-center">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        <input
          id="conference-search"
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by title, location, domain, or organizer..."
          className="w-full pl-11 pr-10 py-3.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-ivory-white placeholder:text-text-muted text-sm focus:outline-none focus:border-gold-500/60 focus:ring-1 focus:ring-gold-500/30 transition-all"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-ivory-white transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
