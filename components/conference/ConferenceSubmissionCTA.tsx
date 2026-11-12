'use client';

import React from 'react';
import Link from 'next/link';
import { Send, FileText, CheckCircle2, Globe, ShieldCheck, Zap } from 'lucide-react';
import { Conference } from '@/lib/types/conference';

interface ConferenceSubmissionCTAProps {
  conference: Conference;
}

export const ConferenceSubmissionCTA: React.FC<ConferenceSubmissionCTAProps> = ({ conference }) => {
  if (conference.status === 'Past' || conference.status === 'Cancelled') {
    return (
      <section className="relative rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="font-playfair text-2xl font-bold text-ivory-white">Conference Concluded</h2>
          <p className="text-text-muted text-sm mt-1">
            {conference.shortTitle} has concluded. Published proceedings are available in the MMSR Books catalogue.
          </p>
        </div>
        <Link
          href="/books"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-gold text-navy-900 font-bold text-sm shrink-0"
        >
          <FileText className="w-4 h-4" />
          Browse Proceedings
        </Link>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1527] via-[#F8F5EE] to-[#0D1527] border border-[#C9962A]/30 p-8 md:p-12 shadow-2xl">
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#C9962A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-8 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9962A]/10 border border-[#C9962A]/30 text-[#C9962A] text-xs font-semibold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            Call for Papers — {conference.shortTitle}
          </div>

          <h2 className="font-serif text-3xl md:text-4xl text-slate-100 font-bold leading-tight">
            Submit Your Research to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9962A] via-amber-200 to-[#C9962A]">
              {conference.shortTitle}
            </span>
          </h2>

          <p className="text-slate-300 text-base leading-relaxed">
            Contribute your research to the international academic community. Submitted papers undergo rigorous double-blind peer review. Accepted papers are published in the official MMSR Conference Proceedings with DOI registration.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="flex items-center gap-2.5 text-slate-300 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#C9962A] shrink-0" />
              <span>Double-Blind Review</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300 text-sm">
              <ShieldCheck className="w-4 h-4 text-[#C9962A] shrink-0" />
              <span>Crossref DOI</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300 text-sm">
              <Globe className="w-4 h-4 text-[#C9962A] shrink-0" />
              <span>Global Proceedings</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4">
          {conference.submissionOpen ? (
            <Link
              href={`/submit-conference-paper?conf=${conference.slug}`}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-[#C9962A] to-amber-500 text-slate-950 font-bold text-base shadow-lg hover:shadow-[#C9962A]/40 hover:scale-[1.02] transition-all duration-300 text-center"
            >
              <Send className="w-5 h-5" />
              Submit Paper
            </Link>
          ) : (
            <div className="flex flex-col items-center justify-center gap-1 px-6 py-4 rounded-xl bg-slate-900/80 border border-[#DC2626]/40 text-center">
              <span className="flex items-center gap-2 text-red-400 font-bold text-base">
                <Send className="w-5 h-5" />
                Submissions Closed
              </span>
              <span className="text-slate-400 text-xs">The submission deadline has passed.</span>
            </div>
          )}
          <Link
            href="/services"
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-200 hover:text-[#C9962A] hover:border-[#C9962A]/40 font-semibold text-base transition-all duration-300 text-center"
          >
            <FileText className="w-5 h-5" />
            Publishing Services
          </Link>
        </div>
      </div>
    </section>
  );
};
