'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  BookMarked,
  FileCheck2,
  Award,
  Globe2,
  ShieldCheck,
  FileText,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { LandingPanel } from './LandingPanel';

interface FloatingObjectProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  delay?: number;
  duration?: number;
  yOffset?: number;
  className?: string;
}

const FloatingCard: React.FC<FloatingObjectProps> = ({
  icon,
  title,
  subtitle,
  badge,
  delay = 0,
  duration = 6,
  yOffset = 15,
  className,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      animate={{
        y: [0, -yOffset, 0],
      }}
      transition={{
        y: {
          duration: duration,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: delay,
        },
        opacity: { duration: 0.8 },
      }}
      className={cn(
        'p-5 sm:p-6 rounded-2xl bg-white/45 backdrop-blur-2xl border border-[#8C6239]/20 shadow-glass flex items-center gap-4 hover:border-[#8C6239]/50 hover:bg-white/70 hover:shadow-gold-glow transition-all duration-300 group cursor-pointer font-manrope',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl border border-[#8C6239]/30 bg-[#C99A2E]/15 p-0.5 shadow-gold-glow shrink-0 group-hover:scale-110 transition-transform duration-300">
        <div className="w-full h-full bg-[#F5EBD6] rounded-[10px] flex items-center justify-center text-[#7A5A2E]">
          {icon}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {/* h3 (was h4): these card titles sit under the section's <h2>, so
              h3 keeps the outline sequential (h2 -> h3) instead of skipping
              a level (the accessibility report's heading-order finding). */}
          <h3 className="text-sm font-bold font-playfair text-[#3E2A1A] group-hover:text-[#8C6239] transition-colors">
            {title}
          </h3>
          {badge && (
            <span className="text-[13px] font-mono font-semibold text-[#7A5A2E] bg-[#C99A2E]/15 px-1.5 py-0.5 rounded border border-[#8C6239]/50">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-[#4A3626] mt-0.5">{subtitle}</p>
      </div>
    </motion.div>
  );
};

export const FloatingBooks: React.FC = () => {
  const items = [
    {
      icon: <BookMarked className="w-6 h-6" />,
      title: 'Hardcover Edited Book',
      subtitle: 'International Academic Volume with ISBN',
      badge: 'ISBN 978-93',
      delay: 0,
      duration: 6,
      yOffset: 16,
    },
    {
      icon: <FileCheck2 className="w-6 h-6" />,
      title: 'Peer-Reviewed Journal',
      subtitle: 'Double-blind Refereed Global Journal',
      badge: 'ISSN Verified',
      delay: 1.2,
      duration: 7,
      yOffset: 14,
    },
    {
      icon: <Award className="w-6 h-6" />,
      title: 'Publication Certificate',
      subtitle: 'Cryptographically Verified Digital Copy',
      badge: 'VERIFIED',
      delay: 2.4,
      duration: 6.5,
      yOffset: 18,
    },
    {
      icon: <Globe2 className="w-6 h-6" />,
      title: 'DOI Digital Badge',
      subtitle: 'Crossref Registered Digital Object Identifier',
      badge: '10.5281/mmsr',
      delay: 0.8,
      duration: 7.5,
      yOffset: 15,
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: 'Open Access License',
      subtitle: 'Creative Commons CC-BY 4.0 Standard',
      badge: 'CC-BY 4.0',
      delay: 1.8,
      duration: 6.2,
      yOffset: 17,
    },
    {
      icon: <FileText className="w-6 h-6" />,
      title: 'Indexed Research Paper',
      subtitle: 'Scopus & Web of Science Compliant Format',
      badge: 'INDEXED',
      delay: 3,
      duration: 8,
      yOffset: 13,
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto relative z-10">
      <LandingPanel innerClassName="px-6 py-12 sm:px-10 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-16 flex flex-col items-center gap-3 relative z-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#7A5A2E] bg-[#C99A2E]/15 px-3 py-1 rounded-full border border-[#8C6239]/40">
            <Sparkles className="w-3.5 h-3.5" />
            Academic Excellence Standards
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair text-[#3E2A1A]">
            Floating Publication Artifacts
          </h2>
          <p className="text-sm sm:text-base text-[#4A3626] font-manrope">
            Every publication under MMSR adheres to strict global indexing, ISBN/ISSN registry, Crossref DOI assignment, and Open Access compliance.
          </p>
        </div>

        {/* Floating Artifacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 relative z-10">
          {items.map((item, idx) => (
            <FloatingCard key={idx} {...item} />
          ))}
        </div>
      </LandingPanel>
    </section>
  );
};
