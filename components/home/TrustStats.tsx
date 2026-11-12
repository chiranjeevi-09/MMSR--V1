'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookMarked, FileText, Users, GraduationCap, Globe, Award } from 'lucide-react';
import { StatCounterCard } from '@/components/ui/StatCounterCard';
import { getImpactMetrics } from '@/lib/services/siteSettings';
import {
  fetchPublicBooks,
  fetchPublicJournals,
  fetchPublicSubmissions,
  fetchAdminTestimonials,
} from '@/lib/services/cms';

export const TrustStats: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    booksCount: 500,
    journalsCount: 50,
    publishedArticles: 2500,
    partnerUnis: 150,
    countriesCount: 50,
    certificatesCount: 10000,
  });

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    const stored = getImpactMetrics();
    try {
      const [books, journals, submissions, testimonials] = await Promise.all([
        fetchPublicBooks().catch(() => []),
        fetchPublicJournals().catch(() => []),
        fetchPublicSubmissions().catch(() => []),
        fetchAdminTestimonials().catch(() => []),
      ]);

      const booksTotal = books.length > 0 ? books.length : stored.booksCount;
      const journalsTotal = journals.length > 0 ? journals.length : stored.journalsCount;

      const publishedCount = submissions.length > 0
        ? submissions.filter((s) => s.status === 'published' || s.status === 'accepted').length || submissions.length
        : stored.publishedArticles;

      // Calculate unique countries
      const countriesSet = new Set<string>();
      testimonials.forEach((t) => t.country && countriesSet.add(t.country.trim()));
      submissions.forEach((s) => s.author_name && countriesSet.add('India'));
      const uniqueCountries = countriesSet.size > 5 ? countriesSet.size : stored.countriesCount;

      setMetrics({
        booksCount: Math.max(stored.booksCount, booksTotal),
        journalsCount: Math.max(stored.journalsCount, journalsTotal),
        publishedArticles: Math.max(stored.publishedArticles, publishedCount),
        partnerUnis: stored.partnerUnisCount,
        countriesCount: uniqueCountries,
        certificatesCount: stored.certificatesCount,
      });
    } catch {
      setMetrics({
        booksCount: stored.booksCount,
        journalsCount: stored.journalsCount,
        publishedArticles: stored.publishedArticles,
        partnerUnis: stored.partnerUnisCount,
        countriesCount: stored.countriesCount,
        certificatesCount: stored.certificatesCount,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const stats = [
    {
      value: loading ? '...' : `${metrics.booksCount}+`,
      label: 'Books Published',
      sublabel: 'Edited volumes with ISBN & DOI',
      icon: <BookMarked className="w-5 h-5 text-gold-400" />,
      trend: 'ISBN Indexed',
    },
    {
      value: loading ? '...' : `${metrics.journalsCount}+`,
      label: 'Active Journals',
      sublabel: 'Peer-reviewed indexed journals',
      icon: <FileText className="w-5 h-5 text-gold-400" />,
      trend: 'Quarterly Releases',
    },
    {
      value: loading ? '...' : `${metrics.publishedArticles.toLocaleString('en-IN')}+`,
      label: 'Published Articles',
      sublabel: 'Peer-reviewed author manuscripts',
      icon: <Users className="w-5 h-5 text-gold-400" />,
      trend: 'Global Scholars',
    },
    {
      value: loading ? '...' : `${metrics.partnerUnis}+`,
      label: 'Partner Universities',
      sublabel: 'Academic institutional collaborators',
      icon: <GraduationCap className="w-5 h-5 text-gold-400" />,
      trend: 'Global Alliances',
    },
    {
      value: loading ? '...' : `${metrics.countriesCount}+`,
      label: 'Countries Reached',
      sublabel: 'International readership & distribution',
      icon: <Globe className="w-5 h-5 text-gold-400" />,
      trend: 'Worldwide Reach',
    },
    {
      value: loading ? '...' : `${metrics.certificatesCount.toLocaleString('en-IN')}+`,
      label: 'Certificates Issued',
      sublabel: 'Verified digital author credentials',
      icon: <Award className="w-5 h-5 text-gold-400" />,
      trend: '100% Verified',
    },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <span className="text-xs font-semibold uppercase tracking-widest text-gold-400 bg-gold-500/10 px-3 py-1 rounded-full border border-[#D4AC54]">
          Impact & Metrics
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold font-playfair text-[#3A2312] mt-3">
          Trusted by Academic Leaders Worldwide
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
          >
            <StatCounterCard {...stat} />
          </motion.div>
        ))}
      </div>
    </section>
  );
};
