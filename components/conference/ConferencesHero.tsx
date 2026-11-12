'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { GraduationCap, Globe, CalendarDays, Send, Sparkles } from 'lucide-react';
import { ConferenceBreadcrumb } from './ConferenceBreadcrumb';
import { Button } from '@/components/ui/Button';
import { getImpactMetrics, DEFAULT_METRICS } from '@/lib/services/siteSettings';

interface ConferencesHeroProps {
  onFocusSearch?: () => void;
}

export const ConferencesHero: React.FC<ConferencesHeroProps> = ({ onFocusSearch }) => {
  const [metrics, setMetrics] = useState(DEFAULT_METRICS);

  useEffect(() => {
    setMetrics(getImpactMetrics());
  }, []);

  const stats = [
    { label: 'Conferences Hosted', value: metrics.confHostedText || '25+' },
    { label: 'Research Domains', value: metrics.confDomainsText || '10+' },
    { label: 'Papers Published', value: metrics.confPapersText || '2,000+' },
    { label: 'Countries Represented', value: metrics.confCountriesText || '40+' },
  ];
  return (
    <section className="relative pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <div className="absolute top-0 left-1/4 w-[500px] h-[400px] rounded-full bg-gold-500/8 blur-[120px] pointer-events-none" />

      <div className="flex flex-col gap-6 relative z-10">
        <ConferenceBreadcrumb />

        <div className="p-8 sm:p-12 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] backdrop-blur-2xl shadow-glass flex flex-col lg:flex-row items-center justify-between gap-10 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-72 h-72 bg-gold-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Left: Headline */}
          <div className="flex flex-col gap-5 max-w-2xl text-left">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-gold-500/10 text-gold-400 border border-[#D4AC54] w-fit">
              <Sparkles className="w-3.5 h-3.5" />
              International Academic Conferences
            </span>

            <h1 className="text-3xl sm:text-5xl font-bold font-playfair text-ivory-white leading-tight">
              Explore{' '}
              <span className="gradient-gold-text">Research Conferences</span>
              <br />& Call for Papers
            </h1>

            <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-xl">
              Discover peer-reviewed academic conferences across Engineering, Life Sciences, Management, Physics, and emerging interdisciplinary research domains. Submit your papers and join the global research community.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="gold"
                size="md"
                onClick={onFocusSearch}
                leftIcon={<CalendarDays className="w-4 h-4 text-navy-900" />}
              >
                Browse Conferences
              </Button>
              <Link href="/submit-conference-paper">
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<Send className="w-4 h-4 text-gold-400" />}
                >
                  Submit Paper
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Stats Box */}
          <div className="w-full lg:w-80 p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex flex-col gap-4 shadow-medium shrink-0">
            <div className="flex items-center gap-3 pb-3 border-b border-[#D4AC54]/60">
              <div className="w-10 h-10 rounded-xl bg-gradient-gold p-0.5 shadow-gold-glow flex items-center justify-center text-navy-900">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold font-playfair text-ivory-white">MMSR Conferences</span>
                <span className="text-[13px] text-gold-400">Academic Research Network</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col gap-0.5">
                  <span className="text-xl font-bold font-playfair text-gold-400">{stat.value}</span>
                  <span className="text-[13px] text-text-muted uppercase tracking-wider">{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#D4AC54]/60 flex flex-col gap-1.5 text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-gold-400" />
                <span>Proceedings with Crossref DOI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-gold-400" />
                <span>Double-Blind Peer Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
