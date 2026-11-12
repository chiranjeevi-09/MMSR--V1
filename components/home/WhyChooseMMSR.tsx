'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, BookMarked, Globe, Zap, Eye, Award } from 'lucide-react';
import { FeatureCard } from '@/components/ui/Card';

export const WhyChooseMMSR: React.FC = () => {
  const reasons = [
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Double-Blind Peer Review',
      description: 'Rigorous COPE-compliant evaluation by international subject matter experts ensuring unbiased academic quality.',
      tag: 'Rigorous',
    },
    {
      icon: <BookMarked className="w-6 h-6" />,
      title: 'Official ISBN Allocation',
      description: 'Every published edited volume and book chapter is assigned an official ISBN registered with international databases.',
      tag: 'ISBN 978',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Crossref DOI Registration',
      description: 'Permanent digital object identifiers (DOIs) assigned to papers and chapters for instant citations.',
      tag: 'Crossref',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Fast Publication Workflow',
      description: 'Efficient editorial handling with preliminary review results within 14-21 days of submission.',
      tag: 'Fast Track',
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Global Visibility & Indexing',
      description: 'Open Access distribution with indexing across Google Scholar, ResearchGate, and partner repositories.',
      tag: 'Open Access',
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: 'Verified Digital Certificates',
      description: 'Cryptographically signed publication certificates issued instantly upon book or paper release.',
      tag: 'Verified',
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <span className="text-xs font-semibold uppercase tracking-widest text-gold-400 bg-gold-500/10 px-3 py-1 rounded-full border border-[#D4AC54]">
          Why Publish With Us
        </span>
        <h2 className="text-3xl sm:text-4xl font-bold font-playfair text-[#3A2312] mt-3">
          The MMSR Advantage for Authors & Editors
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
        {reasons.map((reason, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            className="h-full flex"
          >
            <FeatureCard {...reason} className="h-full w-full" />
          </motion.div>
        ))}
      </div>
    </section>
  );
};
