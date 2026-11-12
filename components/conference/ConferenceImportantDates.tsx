'use client';

import React from 'react';
import { CalendarDays, CheckCircle2, Circle } from 'lucide-react';
import { Conference } from '@/lib/types/conference';
import { cn } from '@/lib/utils/cn';

interface ConferenceImportantDatesProps {
  conference: Conference;
}

export const ConferenceImportantDates: React.FC<ConferenceImportantDatesProps> = ({ conference }) => {
  if (!conference.importantDates?.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
          <CalendarDays className="w-4 h-4" />
        </span>
        Important Dates
      </h2>

      <div className="relative pl-6 border-l-2 border-[#D4AC54]">
        <div className="flex flex-col gap-0">
          {conference.importantDates.map((item, index) => (
            <div key={index} className="relative pb-6 last:pb-0">
              {/* Timeline dot */}
              <span className={cn(
                'absolute -left-[1.6rem] top-0 flex items-center justify-center w-5 h-5 rounded-full border-2',
                item.isPast
                  ? 'bg-[#F8EEDC] border-text-muted text-text-muted'
                  : item.isHighlighted
                    ? 'bg-gold-500 border-gold-500 text-navy-900'
                    : 'bg-[#F8EEDC] border-gold-500/40 text-gold-400'
              )}>
                {item.isPast ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <Circle className="w-2.5 h-2.5" />
                )}
              </span>

              <div className={cn(
                'p-4 rounded-xl border',
                item.isHighlighted
                  ? 'bg-gold-500/10 border-[#D4AC54]'
                  : item.isPast
                    ? 'bg-white/3 border-[#D4AC54]/40 opacity-60'
                    : 'bg-[#FFF9F1] border-[#D4AC54]/60'
              )}>
                <p className={cn(
                  'text-sm font-semibold',
                  item.isHighlighted ? 'text-gold-400' : item.isPast ? 'text-text-muted' : 'text-ivory-white'
                )}>
                  {item.label}
                </p>
                <p className={cn(
                  'text-xs mt-0.5',
                  item.isHighlighted ? 'text-gold-300' : 'text-text-muted'
                )}>
                  {item.date}
                  {item.isPast && <span className="ml-2 text-[13px] uppercase tracking-wider opacity-70">(Passed)</span>}
                  {item.isHighlighted && <span className="ml-2 text-[13px] uppercase tracking-wider font-bold text-gold-400">— Highlighted</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
