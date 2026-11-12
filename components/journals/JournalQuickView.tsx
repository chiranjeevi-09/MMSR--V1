'use client';

import React from 'react';
import Link from 'next/link';
import { Journal } from '@/lib/types/journal';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ArrowRight, ShieldCheck, Globe, FileText } from 'lucide-react';

export interface JournalQuickViewProps {
  journal: Journal | null;
  isOpen?: boolean;
  onClose: () => void;
}

export const JournalQuickView: React.FC<JournalQuickViewProps> = ({ journal, isOpen, onClose }) => {
  if (!journal) return null;

  const indexedList = Array.isArray(journal.indexedIn)
    ? journal.indexedIn
    : typeof journal.indexedIn === 'string'
    ? (journal.indexedIn as string).split(',').map((s) => s.trim()).filter(Boolean)
    : ['Google Scholar', 'Crossref', 'DOAJ', 'ResearchGate'];

  return (
    <Modal
      isOpen={isOpen !== undefined ? isOpen : Boolean(journal)}
      onClose={onClose}
      title={journal.title}
      subtitle={`ISSN: ${journal.issn} | E-ISSN: ${journal.eissn} | DOI Prefix: ${journal.doiPrefix}`}
      size="lg"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" size="md" onClick={onClose}>
            Close
          </Button>
          <Link href={`/journals/${journal.slug}`} onClick={onClose}>
            <Button variant="gold" size="md" rightIcon={<ArrowRight className="w-4 h-4 text-navy-900" />}>
              View Full Journal Details
            </Button>
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-6 font-manrope">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="Published">{journal.discipline}</Badge>
          {journal.openAccess && <Badge variant="Open Access">Open Access</Badge>}
          <span className="text-xs text-gold-400 font-semibold font-mono bg-gold-500/10 px-2.5 py-1 rounded-full border border-[#D4AC54]">
            Impact Factor: {journal.impactMetric || '3.50'}
          </span>
        </div>

        <p className="text-sm text-[#3A2312] leading-relaxed font-medium">{journal.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] text-xs">
          <div>
            <span className="text-[#6E5238] block text-[13px] uppercase font-bold">Editor-in-Chief</span>
            <span className="font-bold text-[#3A2312]">{journal.editor}</span>
          </div>
          <div>
            <span className="text-[#6E5238] block text-[13px] uppercase font-bold">Frequency</span>
            <span className="font-bold text-[#3A2312]">{journal.frequency}</span>
          </div>
          <div>
            <span className="text-[#6E5238] block text-[13px] uppercase font-bold">Current Volume</span>
            <span className="font-bold text-[#3A2312]">Vol. {journal.volume}, Issue {journal.issue}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#6E5238]">Indexed In</span>
          <div className="flex flex-wrap gap-2">
            {indexedList.map((idxItem, idx) => (
              <span
                key={idx}
                className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-[#FFF9F1] border border-[#D4AC54] text-[#3A2312]"
              >
                {idxItem}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};
