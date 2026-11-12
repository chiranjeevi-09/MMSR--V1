'use client';

import React from 'react';
import Image from 'next/image';
import { Conference } from '@/lib/types/conference';
import { GraduationCap, Globe } from 'lucide-react';

interface ConferenceSpeakersProps {
  conference: Conference;
}

export const ConferenceSpeakers: React.FC<ConferenceSpeakersProps> = ({ conference }) => {
  return (
    <section className="space-y-4 font-manrope">
      <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
          <GraduationCap className="w-4 h-4" />
        </span>
        Keynote Speakers
      </h2>

      {!conference.speakers?.length ? (
        <div className="p-6 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-center text-text-muted text-xs">
          Keynote speakers will be announced soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {conference.speakers.map((speaker) => (
            <div
              key={speaker.id}
              className="p-5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-colors flex flex-col gap-3"
            >
              {speaker.photo ? (
                <div className="w-14 h-14 rounded-full overflow-hidden relative border border-[#D4AC54] shadow-gold-glow">
                  <Image src={speaker.photo} alt={speaker.name} fill className="object-cover" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-gold flex items-center justify-center text-navy-900 font-bold font-playfair text-xl shadow-gold-glow">
                  {speaker.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>
              )}
              <div>
                <h3 className="font-playfair font-bold text-ivory-white text-sm">{speaker.name}</h3>
                {speaker.title && <p className="text-xs text-gold-400">{speaker.title}</p>}
              </div>
              <div className="flex flex-col gap-1 text-xs text-text-muted">
                {speaker.institution && <p>{speaker.institution}</p>}
                {speaker.country && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-gold-400 shrink-0" />
                    <span>{speaker.country}</span>
                  </div>
                )}
              </div>
              {speaker.topic && (
                <div className="pt-2 border-t border-white/8">
                  <span className="text-[13px] text-text-muted uppercase tracking-wider">Topic</span>
                  <p className="text-xs text-ivory-white mt-0.5 font-medium">{speaker.topic}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
