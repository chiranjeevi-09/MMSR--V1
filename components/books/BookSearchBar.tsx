import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface BookSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

export const BookSearchBar = forwardRef<HTMLInputElement, BookSearchBarProps>(
  ({ value, onChange, onClear, placeholder = 'Search by book title, ISBN (e.g. 978-93), author, or keyword...', className }, ref) => {
    return (
      <div className={cn('relative w-full font-manrope', className)}>
        <Search className="w-5 h-5 text-gold-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <label htmlFor="book-search-input" className="sr-only">Search books</label>
        <input
          id="book-search-input"
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full bg-[#FFF9F1] border border-[#D4AC54] focus:border-gold-500 focus:ring-1 focus:ring-gold-500/50 rounded-2xl pl-12 pr-12 py-3.5 text-sm text-ivory-white placeholder-text-muted outline-none transition-all shadow-glass"
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-ivory-white transition-colors rounded"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

BookSearchBar.displayName = 'BookSearchBar';
