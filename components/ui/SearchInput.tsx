import React, { forwardRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input, InputProps } from './Input';

export interface SearchInputProps extends Omit<InputProps, 'type' | 'leftIcon' | 'rightIcon'> {
  onClear?: () => void;
  showShortcut?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, showShortcut = true, placeholder = 'Search journals, books, articles...', ...props }, ref) => {
    const [localValue, setLocalValue] = useState(value || '');
    const currentValue = value !== undefined ? value : localValue;

    const handleClear = () => {
      setLocalValue('');
      if (onClear) onClear();
    };

    return (
      <Input
        ref={ref}
        type="search"
        value={currentValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          if (onChange) onChange(e);
        }}
        placeholder={placeholder}
        leftIcon={<Search className="w-4 h-4 text-[#C99A2E]" />}
        rightIcon={
          currentValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:text-[#2F241A] text-[#73614C] transition-colors rounded"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : showShortcut ? (
            <span className="hidden sm:inline-block text-[13px] font-mono font-medium px-1.5 py-0.5 rounded bg-[#F8EEDC] text-[#73614C] border border-[#D4AC54]">
              ⌘K
            </span>
          ) : null
        }
        {...props}
      />
    );
  }
);

SearchInput.displayName = 'SearchInput';
