'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, ShieldCheck, Globe, Award, Search, Sparkles } from 'lucide-react';
import { JournalBreadcrumb } from './JournalBreadcrumb';
import { Button } from '@/components/ui/Button';
import { fetchSiteMetrics, SiteMetrics } from '@/lib/services/cms';
import { getImpactMetrics, ImpactMetricsConfig } from '@/lib/services/siteSettings';

export const JournalsHero: React.FC<{ onFocusSearch?: () => void }> = ({ onFocusSearch }) => {
  const [metrics, setMetrics] = useState<SiteMetrics | null>(null);
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetricsConfig>(getImpactMetrics());

  useEffect(() => {
    fetchSiteMetrics().then(setMetrics).catch(() => {});
    setImpactMetrics(getImpactMetrics());
  }, []);

  return (
    <section className="relative pt-8 pb-14 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      {/* Mesh Glow Background */}
      <div className="absolute top-0 right-1/3 w-[500px] h-[500px] rounded-full bg-gold-500/10 blur-[140px] pointer-events-none" />

      <div className="flex flex-col gap-6 relative z-10">
        <JournalBreadcrumb />

        <div className="p-8 sm:p-12 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] backdrop-blur-2xl shadow-glass flex flex-col lg:flex-row items-center justify-between gap-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-80 h-80 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Left Hero Content */}
          <div className="flex flex-col gap-4 max-w-2xl text-left">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-gold-500/10 text-gold-400 border border-[#D4AC54] w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              Double-Blind Peer Reviewed Journals
            </span>

            <h1 className="text-3xl sm:text-5xl font-bold font-playfair text-[#3A2312] leading-tight">
              International Scientific <span className="gradient-gold-text">Journals</span>
            </h1>

            <p className="text-sm sm:text-base text-text-muted leading-relaxed">
              Publishing high-impact refereed research across STEM, Biotechnology, Nanotechnology, Environmental Science, and Interdisciplinary Studies with Crossref DOI allocation.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="gold"
                size="md"
                onClick={onFocusSearch}
                leftIcon={<Search className="w-4 h-4 text-navy-900" />}
              >
                Search Journal Titles & ISSN
              </Button>
              <Link href="/submit-manuscript">
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<Sparkles className="w-4 h-4 text-gold-400" />}
                >
                  Submit Manuscript
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Journal Statistics Box */}
          <div className="w-full lg:w-80 p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex flex-col gap-4 shadow-medium shrink-0">
            <div className="flex items-center gap-3 pb-3 border-b border-[#D4AC54]/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-gold p-0.5 shadow-gold-glow flex items-center justify-center text-navy-900 font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold font-playfair text-[#3A2312]">MMSR Journals</span>
                <span className="text-[13px] text-gold-400">Indexed Research Network</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-text-muted">
              <div className="p-2.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/40">
                <span className="text-[13px] text-text-muted uppercase">Active Journals</span>
                <p className="text-lg font-bold font-playfair text-gold-400">
                  {impactMetrics.activeJournalsText || metrics?.journals_count || '50+'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/40">
                <span className="text-[13px] text-text-muted uppercase">Disciplines</span>
                <p className="text-lg font-bold font-playfair text-gold-400">
                  {impactMetrics.disciplinesText || '12+'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/40">
                <span className="text-[13px] text-text-muted uppercase">Issues Published</span>
                <p className="text-lg font-bold font-playfair text-gold-400">
                  {impactMetrics.issuesPublishedText || metrics?.articles_count || '500+'}
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/40">
                <span className="text-[13px] text-text-muted uppercase">Countries</span>
                <p className="text-lg font-bold font-playfair text-gold-400">
                  {impactMetrics.countriesText || metrics?.countries_count || '50+'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
