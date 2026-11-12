'use client';

import React, { useState } from 'react';
import { Filter, X, RotateCcw, ChevronDown } from 'lucide-react';
import { ConferenceFilterOptions, ConferenceMode, ConferenceStatus } from '@/lib/types/conference';
import { CONFERENCE_DOMAINS, CONFERENCE_YEARS } from '@/lib/services/conferences';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface ConferenceFiltersProps {
  filters: ConferenceFilterOptions;
  onFilterChange: (filters: Partial<ConferenceFilterOptions>) => void;
  onReset: () => void;
  domains?: string[];
}

const STATUS_OPTIONS: { label: string; value: ConferenceStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Upcoming Conferences', value: 'Upcoming' },
  { label: 'Ongoing Conferences', value: 'Ongoing' },
  { label: 'Completed Conferences', value: 'Completed' },
];

const MODE_OPTIONS: { label: string; value: ConferenceMode | 'all' }[] = [
  { label: 'All Modes', value: 'all' },
  { label: 'Online / Virtual', value: 'Online' },
  { label: 'Offline / In-Person', value: 'Offline' },
  { label: 'Hybrid Event', value: 'Hybrid' },
];

export const ConferenceFilters: React.FC<ConferenceFiltersProps> = ({
  filters,
  onFilterChange,
  onReset,
  domains = CONFERENCE_DOMAINS,
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [openSections, setOpenSections] = useState({
    status: true,
    mode: true,
    domain: true,
    year: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const filterContent = (
    <div className="flex flex-col gap-6 font-manrope">
      {/* Header & Reset */}
      <div className="flex items-center justify-between pb-4 border-b border-[#D4AC54]/60">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gold-400" />
          <h2 className="text-sm font-bold font-playfair text-ivory-white">Filter Conferences</h2>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Conference Status Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('status')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Conference Status</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.status && '-rotate-90')}
          />
        </button>

        {openSections.status && (
          <div className="flex flex-col gap-2 mt-1">
            {STATUS_OPTIONS.map((opt) => {
              const isChecked = filters.status === opt.value || (!filters.status && opt.value === 'all');
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      onFilterChange({
                        status: isChecked && opt.value !== 'all' ? 'all' : opt.value,
                      })
                    }
                    className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Conference Mode Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('mode')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Conference Mode</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.mode && '-rotate-90')}
          />
        </button>

        {openSections.mode && (
          <div className="flex flex-col gap-2 mt-1">
            {MODE_OPTIONS.map((opt) => {
              const isChecked = filters.mode === opt.value || (!filters.mode && opt.value === 'all');
              return (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      onFilterChange({
                        mode: isChecked && opt.value !== 'all' ? 'all' : opt.value,
                      })
                    }
                    className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Research Domain Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('domain')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Research Domains</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.domain && '-rotate-90')}
          />
        </button>

        {openSections.domain && (
          <div className="flex flex-col gap-2 mt-1 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
            {domains.map((dom) => {
              const isChecked =
                (filters.domain || 'All Domains').toLowerCase() === dom.toLowerCase() ||
                (!filters.domain && dom === 'All Domains');
              return (
                <label
                  key={dom}
                  className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() =>
                      onFilterChange({
                        domain: dom === 'All Domains' || isChecked ? undefined : dom,
                      })
                    }
                    className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
                  />
                  <span>{dom}</span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Year Section */}
      <div className="flex flex-col gap-2 pt-4 border-t border-[#D4AC54]/60">
        <button
          type="button"
          onClick={() => toggleSection('year')}
          className="flex items-center justify-between text-xs font-bold font-playfair uppercase text-gold-400"
        >
          <span>Conference Year</span>
          <ChevronDown
            className={cn('w-3.5 h-3.5 transition-transform', !openSections.year && '-rotate-90')}
          />
        </button>

        {openSections.year && (
          <div className="flex flex-col gap-2 mt-1">
            <label className="flex items-center gap-2.5 text-xs text-text-muted hover:text-ivory-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!filters.year || filters.year === 'all'}
                onChange={() => onFilterChange({ year: 'all' })}
                className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
              />
              <span>All Years</span>
            </label>
            {CONFERENCE_YEARS.map((yr) => {
              const isChecked = filters.year === yr || Number(filters.year) === yr;
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
                        year: isChecked ? 'all' : yr,
                      })
                    }
                    className="w-4 h-4 rounded border-[#D4AC54] bg-[#FFF9F1] accent-[#C99A2E] text-[#C99A2E] focus:ring-[#C99A2E]/50 cursor-pointer"
                  />
                  <span>{yr}</span>
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
          Filter Conferences
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

