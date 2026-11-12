import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface DropdownOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface DropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  searchable?: boolean;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  searchable = false,
  disabled = false,
  error,
  helperText,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
    }
  };

  const handleSelect = (optionValue: string) => {
    if (onChange) onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full font-manrope flex flex-col gap-1.5', className)}
    >
      {label && (
        <label htmlFor={generatedId} className="text-xs font-medium text-[#2F241A]">
          {label}
        </label>
      )}

      <button
        id={generatedId}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          'w-full flex items-center justify-between bg-[#FFFDF8] text-[#2F241A] text-sm rounded-xl border border-[#D4AC54] px-3.5 py-2.5 transition-all duration-200 outline-none cursor-pointer hover:border-[#C99A2E]',
          'focus:border-[#C99A2E] focus:ring-1 focus:ring-[#C99A2E]/50',
          isOpen && 'border-[#C99A2E] ring-1 ring-[#C99A2E]/50',
          error ? 'border-red-500' : 'border-[#D4AC54]',
          disabled && 'opacity-50 cursor-not-allowed bg-[#F8EEDC]/50'
        )}
      >
        <span className={cn('truncate', !selectedOption && 'text-[#73614C]')}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-[#73614C] transition-transform duration-200 shrink-0 ml-2',
            isOpen && 'transform rotate-180 text-[#C99A2E]'
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-[#FFF9F1] backdrop-blur-xl border border-[#D4AC54] rounded-xl shadow-xl overflow-hidden max-h-60 flex flex-col animate-scale-in"
        >
          {searchable && (
            <div className="p-2 border-b border-[#D4AC54] sticky top-0 bg-[#FFF9F1] z-10">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#73614C]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Filter options..."
                  className="w-full bg-[#FFFDF8] text-xs text-[#2F241A] placeholder-[#73614C] pl-8 pr-3 py-1.5 rounded-md border border-[#D4AC54] outline-none focus:border-[#C99A2E]"
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3.5 py-3 text-xs text-[#73614C] text-center">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'w-full text-left px-3.5 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-[#FFF2D9] text-[#C99A2E] font-semibold'
                        : isHighlighted
                        ? 'bg-[#FFF8EE] text-[#2F241A]'
                        : 'text-[#2F241A] hover:bg-[#FFF8EE]',
                      opt.disabled && 'opacity-40 cursor-not-allowed'
                    )}
                  >
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      {opt.description && (
                        <span className="text-[13px] text-[#73614C]">
                          {opt.description}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#C99A2E] shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error ? (
        <p className="text-xs text-red-500 mt-0.5">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-[#73614C] mt-0.5">{helperText}</p>
      ) : null}
    </div>
  );

};
