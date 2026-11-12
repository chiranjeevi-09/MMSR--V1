'use client';

import React from 'react';
import { Conference } from '@/lib/types/conference';
import { LayoutGrid } from 'lucide-react';

interface ConferenceTracksProps {
  conference: Conference;
}

export const ConferenceTracks: React.FC<ConferenceTracksProps> = ({ conference }) => {
  return (
    <section className="space-y-4 font-manrope">
      <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
          <LayoutGrid className="w-4 h-4" />
        </span>
        Conference Tracks
      </h2>

      {!conference.tracks?.length ? (
        <div className="p-6 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-center text-text-muted text-xs">
          Conference tracks will be announced soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {conference.tracks.map((track) => (
            <div
              key={track.id}
              className="p-5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-colors flex flex-col gap-3"
            >
              <h3 className="font-playfair text-base font-bold text-ivory-white">{track.title}</h3>
              {track.description && <p className="text-xs text-text-muted leading-relaxed">{track.description}</p>}
              {track.topics?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {track.topics.map((topic) => (
                    <span
                      key={topic}
                      className="text-[13px] font-semibold px-2.5 py-1 rounded-full bg-gold-500/10 text-gold-400 border border-[#D4AC54]"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
