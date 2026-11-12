'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CalendarDays, MapPin, Globe, Monitor, Users,
  ArrowRight, Clock, Tag
} from 'lucide-react';
import { Conference } from '@/lib/types/conference';
import { cn } from '@/lib/utils/cn';

interface ConferenceCardProps {
  conference: Conference;
}

const modeConfig: Record<string, { label: string; className: string }> = {
  Online: { label: 'Online', className: 'text-amber-800 border-amber-300 bg-amber-50' },
  Offline: { label: 'In-Person', className: 'text-emerald-800 border-emerald-300 bg-emerald-50' },
  Hybrid: { label: 'Hybrid', className: 'text-[#C99A2E] border-[#D4AC54] bg-[#FFF2D9]' },
};

const statusConfig: Record<string, { className: string }> = {
  Upcoming: { className: 'text-emerald-800 bg-emerald-50 border-emerald-300' },
  Ongoing: { className: 'text-[#C99A2E] bg-[#FFF2D9] border-[#D4AC54]' },
  Past: { className: 'text-[#73614C] bg-[#F8EEDC] border-[#D4AC54]' },
  Cancelled: { className: 'text-red-700 bg-red-50 border-[#DC2626]/25' },
};

export const ConferenceCard: React.FC<ConferenceCardProps> = ({ conference }) => {
  const mode = modeConfig[conference.mode] || modeConfig['Hybrid'];
  const status = statusConfig[conference.status] || statusConfig['Upcoming'];

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="group rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#C99A2E] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full font-manrope overflow-hidden shadow-md"
    >
      {/* Header Band */}
      <div className="px-5 pt-5 pb-4 border-b border-[#D4AC54] bg-[#F8EEDC] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#C99A2E]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn(
              'text-[13px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border',
              status.className
            )}>
              {conference.status}
            </span>
            {!conference.submissionOpen && (
              <span className="text-[13px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border text-red-700 bg-red-50 border-[#DC2626]/25">
                Submissions Closed
              </span>
            )}
          </div>
          <span className={cn(
            'text-[13px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border shrink-0',
            mode.className
          )}>
            {mode.label}
          </span>
        </div>

        <Link href={`/conference/${conference.slug}`}>
          <h3 className="mt-3 text-base font-bold font-playfair text-[#2F241A] group-hover:text-[#C99A2E] transition-colors line-clamp-2">
            {conference.title}
          </h3>
        </Link>
        <p className="text-[13px] text-[#C99A2E] font-mono font-semibold mt-1">{conference.shortTitle}</p>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <p className="text-xs text-[#73614C] leading-relaxed line-clamp-3">
          {conference.description}
        </p>

        <div className="flex flex-col gap-2 text-xs text-[#73614C] pt-1">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
            <span>{conference.date}</span>
          </div>
          <div className="flex items-center gap-2">
            {conference.mode === 'Online' ? (
              <Monitor className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
            )}
            <span className="truncate">{conference.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Tag className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
            <span className="truncate">{conference.domain}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
            <span>
              Submission: {conference.submissionDeadline}
              {!conference.submissionOpen && (
                <span className="text-red-700 font-bold"> (Closed)</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#C99A2E] shrink-0" />
            <span className="truncate">{conference.organizer}</span>
          </div>
        </div>

        {/* Submission status */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-[#D4AC54]/60">
          <span className="text-[#73614C]">Submissions:</span>
          <span className={cn('font-bold', conference.submissionOpen ? 'text-emerald-700' : 'text-red-700')}>
            {conference.submissionOpen ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-5 pb-5">
        <Link
          href={`/conference/${conference.slug}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-[#C99A2E]/40 text-[#C99A2E] bg-[#FFF2D9]/40 text-sm font-semibold hover:bg-[#FFF2D9] hover:border-[#C99A2E] transition-all"
        >
          View Conference Details
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </motion.article>
  );
};
