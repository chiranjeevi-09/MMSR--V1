'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarDays, MapPin, Monitor, Globe,
  Clock, Send, BookOpen, Users, Download
} from 'lucide-react';
import { Conference } from '@/lib/types/conference';
import { ConferenceBreadcrumb } from './ConferenceBreadcrumb';
import { cn } from '@/lib/utils/cn';

interface ConferenceDetailsHeroProps {
  conference: Conference;
}

const modeIcon: Record<string, React.ReactNode> = {
  Online: <Monitor className="w-4 h-4" />,
  Offline: <MapPin className="w-4 h-4" />,
  Hybrid: <Globe className="w-4 h-4" />,
};

const statusStyle: Record<string, string> = {
  Upcoming: 'text-emerald-accent bg-emerald-400/10 border-emerald-400/30',
  Completed: 'text-text-muted bg-white/5 border-[#D4AC54]/60',
  Past: 'text-text-muted bg-white/5 border-[#D4AC54]/60',
  Ongoing: 'text-gold-400 bg-gold-500/10 border-[#D4AC54]',
  Cancelled: 'text-ruby-red bg-red-500/10 border-red-500/30',
};

export const ConferenceDetailsHero: React.FC<ConferenceDetailsHeroProps> = ({ conference }) => {
  const formattedDeadline = (() => {
    const raw = conference.submissionDeadline;
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  })();

  return (
    <div className="flex flex-col gap-6 font-manrope">
      <ConferenceBreadcrumb currentConference={conference} />

      <div className="relative rounded-3xl bg-[#FFF9F1] border border-gold-500/25 p-8 sm:p-10 overflow-hidden shadow-glass">
        {/* Banner image or Ambient glows */}
        {conference.banner ? (
          <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
            <Image
              src={conference.banner}
              alt={conference.title}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-900/90 to-transparent" />
          </div>
        ) : (
          <>
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-gold-500/8 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        <div className="relative z-10 flex flex-col lg:flex-row gap-8">
          {/* Cover image if provided */}
          {conference.coverImage && (
            <div className="lg:w-56 shrink-0 relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/15 shadow-xl self-start">
              <Image
                src={conference.coverImage}
                alt={conference.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          {/* Left: Info */}
          <div className="flex-1 flex flex-col gap-5">
            {/* Status & Mode badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wide', statusStyle[conference.status] || statusStyle['Upcoming'])}>
                {conference.status}
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-royal-blue uppercase tracking-wide">
                {modeIcon[conference.mode]}
                {conference.mode}
              </span>
              <span className={cn(
                'text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wide',
                conference.submissionOpen
                  ? 'text-emerald-700 bg-emerald-400/15 border-emerald-400/40'
                  : 'text-red-700 bg-red-500/10 border-red-500/30'
              )}>
                Submissions {conference.submissionOpen ? 'Open' : 'Closed'}
              </span>
              <span className="text-xs font-semibold px-3 py-1 rounded-full border border-[#D4AC54]/60 bg-white/5 text-text-muted uppercase tracking-wide">
                {conference.domain}
              </span>
            </div>

            {/* Title */}
            <div>
              <h1 className="font-playfair text-2xl sm:text-4xl font-bold text-ivory-white leading-tight">
                {conference.title}
              </h1>
              {conference.shortTitle && (
                <p className="text-gold-400 font-mono font-semibold text-sm mt-1">{conference.shortTitle}</p>
              )}
            </div>

            {conference.description && (
              <p className="text-text-muted text-sm sm:text-base leading-relaxed max-w-2xl">
                {conference.description}
              </p>
            )}

            {/* Key details grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm p-4 rounded-xl bg-[#F8EEDC]/80 border border-[#D4AC54]/60">
              {conference.date && (
                <div className="flex items-center gap-2.5 text-text-muted">
                  <CalendarDays className="w-4 h-4 text-gold-400 shrink-0" />
                  <div>
                    <span className="text-[13px] uppercase text-text-muted/60 block">Dates</span>
                    <span className="text-ivory-white font-medium">{conference.date}</span>
                  </div>
                </div>
              )}
              {conference.location && (
                <div className="flex items-center gap-2.5 text-text-muted">
                  <MapPin className="w-4 h-4 text-gold-400 shrink-0" />
                  <div>
                    <span className="text-[13px] uppercase text-text-muted/60 block">Location</span>
                    <span className="text-ivory-white font-medium">{conference.location}</span>
                  </div>
                </div>
              )}
              {conference.submissionDeadline && (
                <div className="flex items-center gap-2.5 text-text-muted">
                  <Clock className="w-4 h-4 text-gold-400 shrink-0" />
                  <div>
                    <span className="text-[13px] uppercase text-text-muted/60 block">Submission Deadline</span>
                    <span className="text-ivory-white font-medium">
                      {formattedDeadline}
                      {!conference.submissionOpen && (
                        <span className="text-red-700 font-bold"> (Closed)</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
              {conference.organizer && (
                <div className="flex items-center gap-2.5 text-text-muted">
                  <Users className="w-4 h-4 text-gold-400 shrink-0" />
                  <div>
                    <span className="text-[13px] uppercase text-text-muted/60 block">Organizer</span>
                    <span className="text-ivory-white font-medium line-clamp-1">{conference.organizer}</span>
                  </div>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 pt-1">
              {conference.submissionOpen ? (
                <Link
                  href={`/submit-conference-paper?conf=${conference.slug}`}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#C9962A] text-[#2F241A] font-bold text-sm border-2 border-[#D4AC54] shadow-lg hover:bg-[#b88a1e] hover:scale-[1.02] transition-all"
                >
                  <Send className="w-4 h-4" />
                  Call For Papers
                </Link>
              ) : (
                <span className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F8EEDC] border border-[#DC2626]/40 text-red-700 font-bold text-sm cursor-not-allowed">
                  <Send className="w-4 h-4" />
                  Submissions Closed
                </span>
              )}
              {conference.brochureFile && (
                <a
                  href={conference.brochureFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F8EEDC] border border-white/20 text-ivory-white font-semibold text-sm hover:border-gold-500/40 transition-all"
                >
                  <Download className="w-4 h-4 text-gold-400" />
                  Download Brochure
                </a>
              )}
              {conference.proceedingsFile ? (
                <a
                  href={conference.proceedingsFile}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F8EEDC] border border-white/20 text-ivory-white font-semibold text-sm hover:border-gold-500/40 transition-all"
                >
                  <BookOpen className="w-4 h-4 text-gold-400" />
                  Download Proceedings
                </a>
              ) : conference.proceedings ? (
                <Link
                  href="/books"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F8EEDC] border border-white/20 text-ivory-white font-semibold text-sm hover:border-gold-500/40 transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  View Proceedings
                </Link>
              ) : null}
            </div>
          </div>

          {/* Right: Quick facts panel */}
          <div className="lg:w-72 shrink-0 flex flex-col gap-3 p-5 rounded-2xl bg-[#F8EEDC]/80 border border-[#D4AC54]/60 self-start">
            <p className="text-xs font-bold text-ivory-white uppercase tracking-wider border-b border-[#D4AC54]/60 pb-2">Conference Details</p>

            {conference.doiPrefix && (
              <div>
                <span className="text-[13px] text-text-muted uppercase">DOI Prefix</span>
                <p className="text-xs font-mono text-gold-400 mt-0.5">{conference.doiPrefix}</p>
              </div>
            )}
            {conference.isbnProceedings && (
              <div>
                <span className="text-[13px] text-text-muted uppercase">Proceedings ISBN</span>
                <p className="text-xs font-mono text-ivory-white mt-0.5">{conference.isbnProceedings}</p>
              </div>
            )}
            {conference.registrationFee && (
              <div>
                <span className="text-[13px] text-text-muted uppercase">Fee</span>
                <div className="mt-1 flex flex-col gap-1 text-xs">
                  {conference.registrationFee.earlyBird && <span className="text-ivory-white">Early Bird: <strong>{conference.registrationFee.earlyBird}</strong></span>}
                  {conference.registrationFee.regular && <span className="text-ivory-white">Regular: <strong>{conference.registrationFee.regular}</strong></span>}
                  {conference.registrationFee.student && <span className="text-ivory-white">Student: <strong>{conference.registrationFee.student}</strong></span>}
                  {conference.registrationFee.professional && <span className="text-ivory-white">Professional: <strong>{conference.registrationFee.professional}</strong></span>}
                </div>
              </div>
            )}
            {conference.venue && (
              <div>
                <span className="text-[13px] text-text-muted uppercase">Venue</span>
                <p className="text-xs text-ivory-white mt-0.5">{conference.venue}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
