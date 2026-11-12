'use client';

import React from 'react';
import { Journal } from '@/lib/types/journal';
import { JournalCard } from './JournalCard';
import { BookOpen } from 'lucide-react';

interface RelatedJournalsProps {
  currentJournal: Journal;
  relatedJournals: Journal[];
  onQuickView?: (journal: Journal) => void;
}

export const RelatedJournals: React.FC<RelatedJournalsProps> = ({
  currentJournal,
  relatedJournals,
  onQuickView,
}) => {
  if (!relatedJournals || relatedJournals.length === 0) return null;

  return (
    <section className="space-y-6 pt-4">
      <div className="flex items-center justify-between border-b border-[#D4AC54]/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C9962A]/10 border border-[#C9962A]/30 flex items-center justify-center text-[#C9962A]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-playfair text-2xl font-bold text-[#3A2312]">
              Related Scientific Journals
            </h2>
            <p className="text-[#6E5238] text-sm font-medium">
              More publications in {currentJournal.discipline} and related fields
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedJournals.map((journal) => (
          <JournalCard
            key={journal.id}
            journal={journal}
            onQuickView={onQuickView}
          />
        ))}
      </div>
    </section>
  );
};
