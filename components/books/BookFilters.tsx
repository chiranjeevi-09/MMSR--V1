import React, { useState } from 'react';
import { Filter, X, RotateCcw, ChevronDown } from 'lucide-react';
import { BookCategory, BookFilterOptions } from '@/lib/types/book';
import { CategorySidebar } from './CategorySidebar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

export interface BookFiltersProps {
  categories: BookCategory[];
  filters: BookFilterOptions;
  onFilterChange: (newFilters: Partial<BookFilterOptions>) => void;
  onResetFilters: () => void;
}

export const BookFilters: React.FC<BookFiltersProps> = ({
  categories,
  filters,
  onFilterChange,
  onResetFilters,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [openSections, setOpenSections] = useState({
    categories: true,
    price: true,
    availability: true,
    year: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const activeCategory = filters.category || 'all';

  const filterContent = (
    <div className="flex flex-col gap-6 font-manrope">
      {/* Header & Reset */}
      <div className="flex items-center justify-between pb-4 border-b border-[#D4AC54]/60">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gold-400" />
          <h2 className="text-sm font-bold font-playfair text-ivory-white">Filter Catalogue</h2>
        </div>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Category Section */}
      <CategorySidebar
        categories={categories}
        selectedCategory={activeCategory}
        onSelectCategory={(slug) => onFilterChange({ category: slug })}
      />

      {/* Availability Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('availability')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Availability</span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 transition-transform',
              !openSections.availability && '-rotate-90'
            )}
          />
        </button>

        {openSections.availability && (
          <div className="flex flex-col gap-2 mt-1">
            {['In Stock', 'Pre-Order'].map((status) => {
              const isChecked = filters.availability?.toLowerCase() === status.toLowerCase();
              return (
                <label
                  key={status}
                  className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      onFilterChange({
                        availability: isChecked ? undefined : status,
                      })
                    }
                    className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
                  />
                  <span>{status}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Publication Year Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('year')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Publication Year</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.year && '-rotate-90')}
          />
        </button>

        {openSections.year && (
          <div className="flex flex-col gap-2 mt-1">
            {[2026, 2025].map((yr) => {
              const isChecked = Number(filters.year) === yr;
              return (
                <label
                  key={yr}
                  className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      onFilterChange({
                        year: isChecked ? undefined : yr,
                      })
                    }
                    className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
                  />
                  <span>{yr} Edition</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 shadow-medium h-fit sticky top-28 shrink-0">
        {filterContent}
      </aside>

      {/* Mobile Drawer Filter Trigger Button */}
      <div className="lg:hidden w-full mb-4">
        <Button
          variant="outline"
          size="md"
          fullWidth
          onClick={() => setIsOpenMobile(true)}
          leftIcon={<Filter className="w-4 h-4 text-gold-400" />}
        >
          Filter Catalogue
        </Button>
      </div>

      {/* Mobile Bottom Sheet Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-[#F8EEDC]/80 backdrop-blur-md"
            onClick={() => setIsOpenMobile(false)}
          />
          <div className="relative z-10 w-full bg-[#F8EEDC] border-t border-[#D4AC54] rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto shadow-glass animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold font-playfair text-ivory-white">Filters</span>
              <button
                type="button"
                onClick={() => setIsOpenMobile(false)}
                className="p-1 text-text-muted hover:text-ivory-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {filterContent}
            <div className="mt-6 pt-4 border-t border-[#D4AC54]/60">
              <Button variant="gold" size="lg" fullWidth onClick={() => setIsOpenMobile(false)}>
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
