'use client';

import React, { useState, useEffect } from 'react';
import { Search, FileText, CheckCircle2, ShieldCheck, Award } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fetchJournalsList, JournalTarget } from '@/lib/services/submissionServices';

interface JournalSelectorCardProps {
  selectedJournal: JournalTarget | null;
  onSelectJournal: (journal: JournalTarget) => void;
}

export function JournalSelectorCard({ selectedJournal, onSelectJournal }: JournalSelectorCardProps) {
  const [journals, setJournals] = useState<JournalTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchJournalsList()
      .then((data) => setJournals(data))
      .catch(() => setJournals([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = journals.filter(
    (j) =>
      j.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.discipline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.issn?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── CARD A: SELECT JOURNAL ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2C999] pb-4">
          <div>
            <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block mb-1">
              Card A — Select Target Journal
            </span>
            <h3 className="text-xl font-bold font-playfair text-[#5C4033] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#C99A2E]" />
              Select Target Journal <span className="text-ruby-red">*</span>
            </h3>
            <p className="text-xs text-[#6E5238]">
              Select the MMSR peer-reviewed journal most relevant to your research scope.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#8A6A4A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search journal name or ISSN..."
              className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl pl-9 pr-4 py-2 text-xs text-[#5C4033] outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((n) => (
              <div key={n} className="h-40 rounded-2xl bg-[#F8EEDC] animate-pulse border border-[#E2C999]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#F8EEDC] border border-dashed border-[#E2C999] text-center text-xs text-[#8A6A4A]">
            No matching journals found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((j) => {
              const isSelected = selectedJournal?.id === j.id;
              return (
                <div
                  key={j.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'bg-[#F8EEDC] border-[#C99A2E] shadow-medium ring-2 ring-[#C99A2E]/50'
                      : 'bg-[#FFF9F1] border-[#E2C999] hover:border-[#C99A2E] hover:shadow-soft'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[13px] font-bold uppercase bg-[#C99A2E]/15 text-[#8C6239] border border-[#C99A2E]/30">
                        {j.discipline || 'Journal'}
                      </span>
                      {j.isOpenAccess && (
                        <span className="px-2 py-0.5 rounded text-[13px] font-extrabold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
                          Open Access
                        </span>
                      )}
                    </div>

                    <h4 className="font-playfair font-bold text-base text-[#5C4033] leading-snug line-clamp-2">
                      {j.title}
                    </h4>

                    <div className="space-y-1 text-xs text-[#6E5238]">
                      <p className="font-mono">ISSN: {j.issn}</p>
                      <p className="flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-[#C99A2E]" />
                        <span>Impact Factor: {j.impactFactor}</span>
                      </p>
                      <p className="text-[13px] text-[#8A6A4A]">{j.currentVolume}</p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={isSelected ? 'gold' : 'secondary'}
                    size="sm"
                    fullWidth
                    onClick={() => onSelectJournal(j)}
                    leftIcon={isSelected ? <CheckCircle2 className="w-4 h-4" /> : undefined}
                  >
                    {isSelected ? 'Journal Selected' : 'Submit to this Journal'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── CARD C: JOURNAL METADATA SUMMARY ── */}
      {selectedJournal && (
        <div className="p-6 rounded-3xl bg-[#F8EEDC] border border-[#C99A2E] shadow-soft space-y-3">
          <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block">
            Selected Journal Target
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#8A6A4A] block">Journal Title</span>
              <span className="font-bold text-[#5C4033]">{selectedJournal.title}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block">ISSN</span>
              <span className="font-mono font-semibold text-[#5C4033]">{selectedJournal.issn}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block">Impact Factor</span>
              <span className="font-semibold text-[#5C4033]">{selectedJournal.impactFactor}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block">Publication Model</span>
              <span className="font-semibold text-[#5C4033]">
                {selectedJournal.isOpenAccess ? 'Gold Open Access' : 'Standard Editorial'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
