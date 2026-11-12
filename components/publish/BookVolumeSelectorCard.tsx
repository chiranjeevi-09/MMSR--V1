'use client';

import React, { useState, useEffect } from 'react';
import { Search, BookMarked, CheckCircle2, ChevronRight, Calendar, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fetchBookVolumes, BookVolumeTarget } from '@/lib/services/submissionServices';

interface BookVolumeSelectorCardProps {
  selectedVolume: BookVolumeTarget | null;
  onSelectVolume: (vol: BookVolumeTarget) => void;
}

export function BookVolumeSelectorCard({ selectedVolume, onSelectVolume }: BookVolumeSelectorCardProps) {
  const [volumes, setVolumes] = useState<BookVolumeTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBookVolumes()
      .then((data) => setVolumes(data))
      .catch(() => setVolumes([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredVolumes = volumes.filter(
    (v) =>
      v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.editorName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── CARD A: SELECT BOOK VOLUME ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2C999] pb-4">
          <div>
            <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block mb-1">
              Card A — Publication Target
            </span>
            <h3 className="text-xl font-bold font-playfair text-[#5C4033] flex items-center gap-2">
              <BookMarked className="w-5 h-5 text-[#C99A2E]" />
              Select Target Book Volume <span className="text-ruby-red">*</span>
            </h3>
            <p className="text-xs text-[#6E5238]">
              Book chapters MUST belong to an existing edited volume published by MMSR Publications.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#8A6A4A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search volume or topic..."
              className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl pl-9 pr-4 py-2 text-xs text-[#5C4033] outline-none"
            />
          </div>
        </div>

        {/* Volume Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-40 rounded-2xl bg-[#F8EEDC] animate-pulse border border-[#E2C999]" />
            ))}
          </div>
        ) : filteredVolumes.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#F8EEDC] border border-dashed border-[#E2C999] text-center text-xs text-[#8A6A4A]">
            No matching edited book volumes found. Please check back later or adjust your search filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVolumes.map((vol) => {
              const isSelected = selectedVolume?.id === vol.id;
              return (
                <div
                  key={vol.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'bg-[#F8EEDC] border-[#C99A2E] shadow-medium ring-2 ring-[#C99A2E]/50'
                      : 'bg-[#FFF9F1] border-[#E2C999] hover:border-[#C99A2E] hover:shadow-soft'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[13px] font-bold uppercase bg-[#C99A2E]/15 text-[#8C6239] border border-[#C99A2E]/30">
                        {vol.category || 'Academic Volume'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[13px] font-extrabold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
                        {vol.statusBadge || 'Open'}
                      </span>
                    </div>

                    <h4 className="font-playfair font-bold text-base text-[#5C4033] leading-snug line-clamp-2">
                      {vol.title}
                    </h4>

                    <div className="space-y-1 text-xs text-[#6E5238]">
                      <p className="flex items-center gap-1">
                        <BookMarked className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
                        <span className="font-semibold">{vol.volumeNumber}</span> • ISBN: {vol.isbn}
                      </p>
                      <p className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
                        <span>Editor: {vol.editorName}</span>
                      </p>
                      <p className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
                        <span>Deadline: {vol.submissionDeadline}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={isSelected ? 'gold' : 'secondary'}
                    size="sm"
                    fullWidth
                    onClick={() => onSelectVolume(vol)}
                    leftIcon={isSelected ? <CheckCircle2 className="w-4 h-4" /> : undefined}
                  >
                    {isSelected ? 'Volume Selected' : 'Select This Volume'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CARD C: BOOK METADATA (READ-ONLY SUMMARY) ── */}
      {selectedVolume && (
        <div className="p-6 rounded-3xl bg-[#F8EEDC] border border-[#C99A2E] shadow-soft space-y-3">
          <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block">
            Card C — Selected Volume Summary (Read-Only)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#8A6A4A] block">Selected Book Title</span>
              <span className="font-bold text-[#5C4033]">{selectedVolume.title}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block">Volume & ISBN</span>
              <span className="font-semibold text-[#5C4033]">
                {selectedVolume.volumeNumber} (ISBN: {selectedVolume.isbn})
              </span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block">Editor in Chief</span>
              <span className="font-semibold text-[#5C4033]">{selectedVolume.editorName}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block">Subject Category</span>
              <span className="font-semibold text-[#5C4033]">{selectedVolume.category}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
