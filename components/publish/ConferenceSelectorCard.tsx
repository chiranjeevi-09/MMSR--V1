'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar, MapPin, CheckCircle2, Bookmark, IndianRupee } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { fetchConferencesList, ConferenceTarget } from '@/lib/services/submissionServices';

interface ConferenceSelectorCardProps {
  selectedConference: ConferenceTarget | null;
  onSelectConference: (conf: ConferenceTarget) => void;
}

export function ConferenceSelectorCard({
  selectedConference,
  onSelectConference,
}: ConferenceSelectorCardProps) {
  const [conferences, setConferences] = useState<ConferenceTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Keep latest select handler without re-running the mount effect
  const onSelectRef = useRef(onSelectConference);
  useEffect(() => {
    onSelectRef.current = onSelectConference;
  });

  useEffect(() => {
    fetchConferencesList()
      .then((data) => {
        setConferences(data);
        // Deep-link pre-selection: /submit-conference-paper?conf=<slug-or-id>
        // (ignored when a conference is already chosen)
        const wanted = new URLSearchParams(window.location.search).get('conf');
        if (wanted && !selectedConference) {
          const match = data.find(
            (c) => String(c.slug) === wanted || String(c.id) === wanted
          );
          if (match) onSelectRef.current(match);
        }
      })
      .catch(() => setConferences([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = conferences.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.acronym?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* ── TARGET CONFERENCE SELECTION ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2C999] pb-4">
          <div>
            <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block mb-1">
              Step 1 — Target Conference Selection
            </span>
            <h3 className="text-xl font-bold font-playfair text-[#5C4033] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#C99A2E]" />
              Select Target Conference <span className="text-ruby-red">*</span>
            </h3>
            <p className="text-xs text-[#6E5238]">
              Select the upcoming MMSR international academic conference or symposium.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#8A6A4A] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="conference-search-input"
              aria-label="Search conference name, acronym, or location"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conference name or acronym..."
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl pl-9 pr-4 py-2 text-xs text-[#5C4033] outline-none"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[310px]">
            {[1, 2].map((n) => (
              <div key={n} className="min-h-[290px] rounded-2xl bg-[#F8EEDC] animate-pulse border border-[#E2C999]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#F8EEDC] border border-dashed border-[#E2C999] text-center text-xs text-[#8A6A4A] min-h-[310px] flex items-center justify-center">
            No matching conferences available at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[310px]">
            {filtered.map((conf) => {
              const isSelected = selectedConference?.id === conf.id;
              return (
                <div
                  key={conf.id}
                  className={`min-h-[290px] p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                    isSelected
                      ? 'bg-[#F8EEDC] border-[#C99A2E] shadow-medium ring-2 ring-[#C99A2E]/50'
                      : 'bg-[#FFF9F1] border-[#E2C999] hover:border-[#C99A2E] hover:shadow-soft'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-3 py-1 rounded-md text-[13px] font-mono font-bold uppercase bg-[#C99A2E]/15 text-[#8C6239] border border-[#C99A2E]/30">
                        {conf.acronym}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[13px] font-extrabold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
                        {conf.registrationStatus}
                      </span>
                    </div>

                    {/* Submission fee chip */}
                    <div className="-mt-1">
                      {Number(conf.submissionFee || 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-bold bg-[#C99A2E] text-white shadow-soft">
                          <IndianRupee className="w-3 h-3" />
                          Submission Fee: ₹{Number(conf.submissionFee).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-bold bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/30">
                          No Fee
                        </span>
                      )}
                    </div>

                    <h4 className="font-playfair font-bold text-base text-[#5C4033] leading-snug">
                      {conf.title}
                    </h4>

                    <div className="space-y-1 text-xs text-[#6E5238]">
                      <p className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#C99A2E]" />
                        <span>{conf.location}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#C99A2E]" />
                        <span>{conf.dates}</span>
                      </p>
                      {conf.paperDeadline ? (
                        <p className="flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-[#C99A2E]" />
                          <span>Paper deadline: {conf.paperDeadline}</span>
                        </p>
                      ) : null}
                      <p className="flex items-center gap-1.5 text-[#8C6239] font-medium">
                        <Bookmark className="w-3.5 h-3.5 text-[#C99A2E]" />
                        <span>{conf.proceedingsBadge}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={isSelected ? 'gold' : 'secondary'}
                    size="sm"
                    fullWidth
                    onClick={() => onSelectConference(conf)}
                    leftIcon={isSelected ? <CheckCircle2 className="w-4 h-4" /> : undefined}
                  >
                    {isSelected ? 'Conference Selected' : 'Submit Paper to Conference'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
