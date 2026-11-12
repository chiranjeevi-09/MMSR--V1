'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { ConferenceFAQ } from '@/lib/types/conference';
import { cn } from '@/lib/utils/cn';

interface ConferenceFAQsProps {
  faqs: ConferenceFAQ[];
}

export const ConferenceFAQs: React.FC<ConferenceFAQsProps> = ({ faqs }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!faqs?.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
          <HelpCircle className="w-4 h-4" />
        </span>
        Frequently Asked Questions
      </h2>

      <div className="flex flex-col gap-2">
        {faqs.map((faq) => {
          const isOpen = openId === faq.id;
          return (
            <div key={faq.id} className="rounded-xl border border-[#D4AC54]/60 bg-[#FFF9F1] overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors"
              >
                <span className={cn('text-sm font-semibold', isOpen ? 'text-gold-400' : 'text-ivory-white')}>
                  {faq.question}
                </span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gold-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                )}
              </button>
              {isOpen && (
                <div className="px-5 pb-4 text-sm text-text-muted leading-relaxed border-t border-[#D4AC54]/40">
                  <p className="pt-3">{faq.answer}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
