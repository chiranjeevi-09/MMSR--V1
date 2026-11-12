'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Journal } from '@/lib/types/journal';
import { UserCheck, MapPin, GraduationCap } from 'lucide-react';

export const EditorialBoard: React.FC<{ journal: Journal }> = ({ journal }) => {
  const members = journal.editorialBoard || [
    {
      id: 'ed-def-1',
      name: journal.editor || 'Dr. S. Ramanujan',
      role: 'Editor-in-Chief',
      institution: 'MMSR Publications Editorial Council',
      country: 'India',
      researchAreas: [journal.discipline, 'Peer Review Standards'],
    },
    {
      id: 'ed-def-2',
      name: 'Prof. Dr. Elena Rostova',
      role: 'Associate Editor',
      institution: 'Department of Advanced Research, Imperial College',
      country: 'United Kingdom',
      researchAreas: ['Biotechnology & Nanomedicine', 'Computational Systems'],
    },
  ];

  return (
    <section className="py-8 font-manrope h-full flex flex-col">
      <div className="flex flex-col gap-2 mb-6">
        <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">
          Academic Leadership
        </span>
        <h3 className="text-2xl font-bold font-playfair text-[#3A2312]">
          Editorial Board & Advisory Council
        </h3>
      </div>

      <div className="flex flex-col gap-4 flex-1">
        {members.map((member, idx) => (
          <motion.div
            key={member.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: idx * 0.08 }}
            whileHover={{ y: -6 }}
            className="p-6 min-h-[240px] rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#8C6B1B] shadow-medium flex items-center gap-4 transition-all"
          >
            {/* Avatar Placeholder */}
            <div className="w-14 h-14 rounded-2xl bg-gradient-gold p-0.5 shadow-gold-glow shrink-0 flex items-center justify-center font-playfair font-bold text-navy-900 text-xl">
              {member.name.charAt(0).toUpperCase() || 'E'}
            </div>

            <div className="flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <h4 className="text-base font-bold font-playfair text-[#3A2312]">{member.name}</h4>
                <span className="text-[13px] font-mono font-bold text-[#B8860B] bg-[#C99A2E]/15 px-2.5 py-0.5 rounded-full border border-[#D4AC54]">
                  {member.role}
                </span>
              </div>

              <span className="text-xs text-[#6E5238] font-medium flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#B8860B] shrink-0" />
                {member.institution}
              </span>

              <span className="text-xs text-[#6E5238] font-medium flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#2E6B34] shrink-0" />
                {member.country}
              </span>

              <div className="flex flex-wrap gap-1.5 mt-2">
                {(Array.isArray(member.researchAreas) ? member.researchAreas : [member.researchAreas]).map((area, idx) => (
                  <span
                    key={idx}
                    className="text-[13px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-[#F8EEDC] border border-[#D4AC54]/60 text-[#5C4033]"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
