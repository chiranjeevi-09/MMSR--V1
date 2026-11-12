'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookMarked, ShieldCheck, Globe, Search, Sparkles } from 'lucide-react';
import { BookBreadcrumb } from './BookBreadcrumb';
import { Button } from '@/components/ui/Button';
import { fetchSiteMetrics, SiteMetrics } from '@/lib/services/cms';
import { getImpactMetrics, ImpactMetricsConfig } from '@/lib/services/siteSettings';

export const BooksHero: React.FC<{ onFocusSearch?: () => void }> = ({ onFocusSearch }) => {
  const [metrics, setMetrics] = useState<SiteMetrics | null>(null);
  const [impactMetrics, setImpactMetrics] = useState<ImpactMetricsConfig>(getImpactMetrics());

  useEffect(() => {
    fetchSiteMetrics().then(setMetrics).catch(() => {});
    setImpactMetrics(getImpactMetrics());
  }, []);

  return (
    <section className="relative pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      {/* Background Mesh Glow */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] rounded-full bg-gold-500/10 blur-[130px] pointer-events-none" />

      <div className="flex flex-col gap-6 relative z-10">
        <BookBreadcrumb items={[]} />

        <div className="p-8 sm:p-12 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] backdrop-blur-2xl shadow-glass flex flex-col lg:flex-row items-center justify-between gap-10 overflow-hidden relative">
          {/* Inner Decorative Background Accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Left Hero Headline & Info */}
          <div className="flex flex-col gap-4 max-w-2xl text-left">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-gold-500/10 text-gold-400 border border-[#D4AC54] w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              ISBN & DOI Registered Volumes
            </span>

            <h1 className="text-3xl sm:text-5xl font-bold font-playfair text-[#3A2312] leading-tight">
              Explore Academic Books & <span className="gradient-gold-text">Edited Chapters</span>
            </h1>

            <p className="text-sm sm:text-base text-text-muted leading-relaxed">
              Discover high-impact peer-reviewed edited volumes across Engineering, Computer Science, Biotechnology, Nanotechnology, and Social Sciences.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="gold"
                size="md"
                onClick={onFocusSearch}
                leftIcon={<Search className="w-4 h-4 text-navy-900" />}
              >
                Quick Search Catalogue
              </Button>
              <Link href="/publish-chapter">
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<Sparkles className="w-4 h-4 text-gold-400" />}
                >
                  Publish Book Chapter
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Statistics Box */}
          <div className="w-full lg:w-80 p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex flex-col gap-4 shadow-medium shrink-0">
            <div className="flex items-center gap-3 pb-3 border-b border-[#D4AC54]/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-gold p-0.5 shadow-gold-glow flex items-center justify-center text-navy-900 font-bold">
                <BookMarked className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold font-playfair text-[#3A2312]">MMSR Books</span>
                <span className="text-[13px] text-gold-400">Global Academic Catalogue</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 text-xs text-text-muted">
              <div className="flex items-center justify-between">
                <span>{metrics?.books_label || 'Total Edited Books'}</span>
                <span className="font-bold text-gold-400 font-mono">
                  {impactMetrics.editedBooksText || metrics?.books_count || '500+'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Peer Review Standard</span>
                <span className="font-semibold text-emerald-600">
                  {impactMetrics.peerReviewStandard || 'Double-Blind'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Digital Object ID</span>
                <span className="font-semibold text-royal-blue">
                  {impactMetrics.digitalObjectId || 'Crossref Registered'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
