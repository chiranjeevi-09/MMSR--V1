'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Cpu,
  Wrench,
  Dna,
  Leaf,
  Atom,
  Binary,
  TrendingUp,
  Globe2,
  Sprout,
  FlaskConical,
  Zap,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';

export const ResearchDomains: React.FC = () => {
  const domains = [
    { icon: <Cpu className="w-6 h-6 text-gold-400" />, title: 'Computer Science & AI', count: '120+ Books' },
    { icon: <Wrench className="w-6 h-6 text-gold-400" />, title: 'Engineering & Technology', count: '95+ Books' },
    { icon: <Dna className="w-6 h-6 text-gold-400" />, title: 'Biotechnology & Medicine', count: '80+ Books' },
    { icon: <Leaf className="w-6 h-6 text-gold-400" />, title: 'Environmental Science', count: '65+ Books' },
    { icon: <Atom className="w-6 h-6 text-gold-400" />, title: 'Physics & Nanotechnology', count: '75+ Books' },
    { icon: <Binary className="w-6 h-6 text-gold-400" />, title: 'Mathematics & Data Science', count: '50+ Books' },
    { icon: <TrendingUp className="w-6 h-6 text-gold-400" />, title: 'Business & Management', count: '60+ Books' },
    { icon: <Globe2 className="w-6 h-6 text-gold-400" />, title: 'Humanities & Social Studies', count: '45+ Books' },
    { icon: <Sprout className="w-6 h-6 text-gold-400" />, title: 'Agricultural & Food Science', count: '40+ Books' },
    { icon: <FlaskConical className="w-6 h-6 text-gold-400" />, title: 'Chemical Sciences', count: '55+ Books' },
    { icon: <Zap className="w-6 h-6 text-gold-400" />, title: 'Energy & Power Systems', count: '70+ Books' },
    { icon: <GraduationCap className="w-6 h-6 text-gold-400" />, title: 'Educational Research', count: '35+ Books' },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <SectionHeader
        badge="Multidisciplinary Scope"
        title="Explore Research Domains"
        subtitle="MMSR Publications accepts interdisciplinary submissions across STEM, Medical, Social Sciences, and Management disciplines."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {domains.map((domain, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.04 }}
          >
            <Link
              href={`/books?domain=${encodeURIComponent(domain.title)}`}
              className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 hover:border-gold-500 hover:shadow-gold-glow transition-all duration-300 flex flex-col items-start gap-3 group cursor-pointer"
            >
              <div className="p-3 rounded-xl bg-gold-500/10 border border-[#D4AC54] group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-navy-900 transition-all">
                {domain.icon}
              </div>
              <div className="flex flex-col">
                <h4 className="text-sm font-bold font-playfair text-[#3A2312] group-hover:text-gold-400 transition-colors">
                  {domain.title}
                </h4>
                <span className="text-[13px] text-text-muted mt-0.5">{domain.count}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
