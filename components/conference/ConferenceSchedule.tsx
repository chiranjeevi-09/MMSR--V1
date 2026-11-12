'use client';

import React from 'react';
import { Conference } from '@/lib/types/conference';
import { Clock, Mic, BookOpen, Coffee, Users, Award, Sunrise } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ConferenceScheduleProps {
  conference: Conference;
}

const typeIcon: Record<string, React.ReactNode> = {
  Keynote: <Mic className="w-3.5 h-3.5" />,
  'Paper Presentation': <BookOpen className="w-3.5 h-3.5" />,
  Workshop: <Award className="w-3.5 h-3.5" />,
  Break: <Coffee className="w-3.5 h-3.5" />,
  Panel: <Users className="w-3.5 h-3.5" />,
  Opening: <Sunrise className="w-3.5 h-3.5" />,
  Closing: <Sunrise className="w-3.5 h-3.5" />,
};

const typeStyle: Record<string, string> = {
  Keynote: 'text-gold-400 border-[#D4AC54] bg-gold-500/10',
  'Paper Presentation': 'text-royal-blue border-blue-500/30 bg-blue-500/10',
  Workshop: 'text-orange-accent border-orange-400/30 bg-orange-400/10',
  Break: 'text-text-muted border-[#D4AC54]/60 bg-white/5',
  Panel: 'text-emerald-accent border-emerald-400/30 bg-emerald-400/10',
  Opening: 'text-ivory-white border-white/20 bg-white/5',
  Closing: 'text-ivory-white border-white/20 bg-white/5',
};

export const ConferenceSchedule: React.FC<ConferenceScheduleProps> = ({ conference }) => {
  return (
    <section className="space-y-4 font-manrope">
      <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
          <Clock className="w-4 h-4" />
        </span>
        Schedule Overview
      </h2>

      {!conference.schedule?.length ? (
        <div className="p-6 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-center text-text-muted text-xs">
          Detailed schedule will be published closer to the conference date.
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {conference.schedule.map((day) => (
            <div key={day.day} className="rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 overflow-hidden">
              <div className="px-5 py-3 bg-gold-500/10 border-b border-[#D4AC54] flex items-center justify-between">
                <span className="font-bold text-gold-400 font-playfair">{day.day}</span>
                <span className="text-xs text-text-muted">{day.date}</span>
              </div>
              <div className="divide-y divide-white/5">
                {day.items.map((item, idx) => (
                  <div key={idx} className="px-5 py-3.5 flex items-start gap-3">
                    <span className="text-xs font-mono text-text-muted w-20 shrink-0 pt-0.5">{item.time}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ivory-white">{item.title}</p>
                      {item.speaker && (
                        <p className="text-xs text-text-muted mt-0.5">{item.speaker}</p>
                      )}
                    </div>
                    <span className={cn(
                      'flex items-center gap-1 text-[13px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide shrink-0',
                      typeStyle[item.type] || typeStyle['Paper Presentation']
                    )}>
                      {typeIcon[item.type]}
                      {item.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
