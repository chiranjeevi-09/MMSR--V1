'use client';

import React from 'react';
import Link from 'next/link';
import { Send, FileText, CheckCircle2, ShieldCheck, Zap, Globe } from 'lucide-react';
import { Journal } from '@/lib/types/journal';

interface SubmissionCTAProps {
  journal?: Journal;
}

export const SubmissionCTA: React.FC<SubmissionCTAProps> = ({ journal }) => {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0D1527] via-[#F8F5EE] to-[#0D1527] border border-[#C9962A]/30 p-8 md:p-12 shadow-2xl">
      {/* Background ambient lighting */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#C9962A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Information & Pitch */}
        <div className="lg:col-span-8 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9962A]/10 border border-[#C9962A]/30 text-[#C9962A] text-xs font-semibold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>Call for Papers</span>
          </div>

          <h2 className="font-serif text-3xl md:text-4xl text-slate-100 font-bold leading-tight">
            Ready to Publish Your Research in{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9962A] via-amber-200 to-[#C9962A]">
              {journal ? journal.shortTitle || journal.title : 'MMSR Journals'}
            </span>?
          </h2>

          <p className="text-slate-300 text-base md:text-lg leading-relaxed">
            Join thousands of scientists, academic leaders, and researchers worldwide. Submit your manuscript today for rigorous peer review, rapid publication workflow, and global readership.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="flex items-center gap-2.5 text-slate-300 text-sm">
              <CheckCircle2 className="w-4 h-4 text-[#C9962A] flex-shrink-0" />
              <span>Rigorous Peer Review</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300 text-sm">
              <ShieldCheck className="w-4 h-4 text-[#C9962A] flex-shrink-0" />
              <span>DOI & CrossRef Indexed</span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-300 text-sm">
              <Globe className="w-4 h-4 text-[#C9962A] flex-shrink-0" />
              <span>Global Academic Reach</span>
            </div>
          </div>
        </div>

        {/* Right Column: CTA Buttons */}
        <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-4 justify-center">
          <Link
            href={`/submit-manuscript?journal=${journal?.slug || ''}`}
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-[#C9962A] to-amber-500 text-slate-950 font-bold text-base shadow-lg shadow-[#C9962A]/20 hover:shadow-[#C9962A]/40 hover:scale-[1.02] transition-all duration-300 text-center"
          >
            <Send className="w-5 h-5" />
            <span>Submit Manuscript</span>
          </Link>

          <Link
            href="/services"
            className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-200 hover:text-[#C9962A] hover:border-[#C9962A]/40 font-semibold text-base transition-all duration-300 text-center backdrop-blur-md"
          >
            <FileText className="w-5 h-5" />
            <span>Publishing Services</span>
          </Link>
        </div>
      </div>
    </section>
  );
};
