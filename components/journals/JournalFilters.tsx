import React, { useState } from 'react';
import { Filter, X, RotateCcw, ChevronDown } from 'lucide-react';
import { JournalDiscipline, JournalFilterOptions } from '@/lib/types/journal';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

export interface JournalFiltersProps {
  disciplines: JournalDiscipline[];
  filters: JournalFilterOptions;
  onFilterChange: (newFilters: Partial<JournalFilterOptions>) => void;
  onResetFilters: () => void;
}

export const JournalFilters: React.FC<JournalFiltersProps> = ({
  disciplines,
  filters,
  onFilterChange,
  onResetFilters,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [openSections, setOpenSections] = useState({
    discipline: true,
    access: true,
    frequency: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const activeDiscipline = filters.discipline || 'all';

  const filterContent = (
    <div className="flex flex-col gap-6 font-manrope">
      {/* Header & Reset */}
      <div className="flex items-center justify-between pb-4 border-b border-[#D4AC54]/60">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gold-400" />
          <h3 className="text-sm font-bold font-playfair text-ivory-white">Filter Journals</h3>
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

      {/* Discipline Section */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => toggleSection('discipline')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Disciplines</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.discipline && '-rotate-90')}
          />
        </button>

        {openSections.discipline && (
          <div className="flex flex-col gap-1 mt-1">
            {disciplines.map((d) => {
              const isActive = activeDiscipline.toLowerCase() === d.slug.toLowerCase() || (activeDiscipline === 'all' && d.slug === 'all');
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onFilterChange({ discipline: d.slug })}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left',
                    isActive
                      ? 'bg-gold-500/15 text-gold-400 font-semibold border border-[#D4AC54]'
                      : 'text-text-muted hover:text-ivory-white hover:bg-white/5'
                  )}
                >
                  <span>{d.name}</span>
                  <span className="text-[13px] font-mono opacity-80 px-1.5 py-0.5 rounded bg-white/5">
                    {d.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Open Access Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('access')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Access Type</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.access && '-rotate-90')}
          />
        </button>

        {openSections.access && (
          <div className="flex flex-col gap-2 mt-1">
            <label className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={Boolean(filters.openAccess)}
                onChange={(e) =>
                  onFilterChange({ openAccess: e.target.checked ? true : undefined })
                }
                className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
              />
              <span>Open Access Only</span>
            </label>
          </div>
        )}
      </div>

      {/* Frequency Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('frequency')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Frequency</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.frequency && '-rotate-90')}
          />
        </button>

        {openSections.frequency && (
          <div className="flex flex-col gap-2 mt-1">
            {['Monthly', 'Bi-Monthly', 'Quarterly'].map((freq) => {
              const isChecked = filters.frequency?.toLowerCase() === freq.toLowerCase();
              return (
                <label
                  key={freq}
                  className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      onFilterChange({
                        frequency: isChecked ? undefined : freq,
                      })
                    }
                    className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
                  />
                  <span>{freq}</span>
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

      {/* Mobile Drawer Trigger Button */}
      <div className="lg:hidden w-full mb-4">
        <Button
          variant="outline"
          size="md"
          fullWidth
          onClick={() => setIsOpenMobile(true)}
          leftIcon={<Filter className="w-4 h-4 text-gold-400" />}
        >
          Filter Journals
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
