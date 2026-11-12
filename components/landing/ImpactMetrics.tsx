'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Newspaper, Users, Award } from 'lucide-react';
import { getImpactMetrics, DEFAULT_METRICS, ImpactMetricsConfig } from '@/lib/services/siteSettings';
import { fetchPublicBooks, fetchPublicJournals, fetchPublicSubmissions } from '@/lib/services/cms';
import { LandingPanel } from './LandingPanel';

export const ImpactMetrics: React.FC = () => {
  const [data, setData] = useState<ImpactMetricsConfig>(DEFAULT_METRICS);

  useEffect(() => {
    async function loadDynamicMetrics() {
      const stored = getImpactMetrics();
      try {
        const [books, journals, submissions] = await Promise.all([
          fetchPublicBooks().catch(() => []),
          fetchPublicJournals().catch(() => []),
          fetchPublicSubmissions().catch(() => []),
        ]);

        const booksCount = books.length > 0 ? books.length : stored.booksCount;
        const journalsCount = journals.length > 0 ? journals.length : stored.journalsCount;
        const authorCount = submissions.length > 0 ? submissions.length * 5 : stored.authorsCount;

        setData({
          ...stored,
          booksCount: Math.max(stored.booksCount, booksCount),
          journalsCount: Math.max(stored.journalsCount, journalsCount),
          authorsCount: Math.max(stored.authorsCount, authorCount),
        });
      } catch {
        setData(stored);
      }
    }
    loadDynamicMetrics();
  }, []);

  const metrics = [
    {
      icon: <BookOpen className="w-8 h-8 text-[#7A5A2E]" />,
      number: `${data.booksCount.toLocaleString()}+`,
      label: 'Academic Edited Books',
      sub: 'ISBN Registered Volumes',
    },
    {
      icon: <Newspaper className="w-8 h-8 text-[#7A5A2E]" />,
      number: `${data.journalsCount.toLocaleString()}+`,
      label: 'Peer-Reviewed Journals',
      sub: 'ISSN & DOI Indexed',
    },
    {
      icon: <Users className="w-8 h-8 text-[#7A5A2E]" />,
      number: `${data.authorsCount.toLocaleString()}+`,
      label: 'International Authors',
      sub: 'Across 45+ Countries',
    },
    {
      icon: <Award className="w-8 h-8 text-[#7A5A2E]" />,
      number: data.satisfactionRate,
      label: 'Publication Satisfaction',
      sub: 'Author Approval Rating',
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto relative z-10 font-manrope">
      <LandingPanel innerClassName="px-6 py-12 sm:px-10 sm:py-14">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
          {metrics.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="p-8 rounded-2xl bg-white/45 border border-[#8C6239]/20 shadow-glass flex flex-col items-center text-center gap-3 group hover:border-[#8C6239]/50 hover:bg-white/70 hover:shadow-gold-glow transition-all duration-300"
            >
              <div className="p-3 rounded-2xl bg-[#C99A2E]/15 border border-[#8C6239]/30 group-hover:scale-110 transition-transform">
                {m.icon}
              </div>
              {/* h2 (was h3): this section has no title heading, so its stat
                  cards sit directly under the page <h1>. Using h2 keeps the
                  outline sequential (h1 -> h2) instead of skipping a level. */}
              <h2 className="text-3xl sm:text-4xl font-extrabold font-playfair bg-gradient-to-r from-[#8C6239] via-[#A97917] to-[#C99A2E] bg-clip-text text-transparent">
                {m.number}
              </h2>
              <p className="text-sm font-bold text-[#3E2A1A]">{m.label}</p>
              <span className="text-xs text-[#4A3626]/80">{m.sub}</span>
            </motion.div>
          ))}
        </div>
      </LandingPanel>
    </section>
  );
};

