'use client';

import React from 'react';
import { Conference } from '@/lib/types/conference';
import { Users, Globe } from 'lucide-react';

interface ConferenceCommitteeProps {
  conference: Conference;
}

export const ConferenceCommittee: React.FC<ConferenceCommitteeProps> = ({ conference }) => {
  return (
    <section className="space-y-4 font-manrope">
      <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
          <Users className="w-4 h-4" />
        </span>
        Organizing Committee
      </h2>

      {!conference.committee?.length ? (
        <div className="p-6 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-center text-text-muted text-xs">
          Committee information will be published soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {conference.committee.map((member) => (
            <div
              key={member.id}
              className="p-4 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-colors flex flex-col gap-2"
            >
              <div className="w-10 h-10 rounded-full bg-[#F8EEDC] border border-[#D4AC54] flex items-center justify-center font-bold font-playfair text-gold-400 text-sm">
                {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h3 className="text-sm font-bold text-ivory-white font-playfair">{member.name}</h3>
                <p className="text-xs text-gold-400 font-semibold">{member.role}</p>
              </div>
              <div className="text-xs text-text-muted">
                {member.institution && <p>{member.institution}</p>}
                {member.country && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Globe className="w-3 h-3 text-gold-400" />
                    <span>{member.country}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
