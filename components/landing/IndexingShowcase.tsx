'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  FileCheck,
  ShieldCheck,
  Award,
  Globe2,
  CheckCircle2,
  BookOpen,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { LandingPanel } from './LandingPanel';

export const IndexingShowcase: React.FC = () => {
  const indexingFeatures = [
    {
      title: 'Crossref DOI Assignment',
      desc: 'Every published journal article and book chapter receives a persistent Crossref DOI prefix (10.5281/mmsr) for global citation tracking.',
      badge: 'CROSSREF REGISTERED',
      icon: <Globe2 className="w-6 h-6 text-[#7A5A2E]" />,
    },
    {
      title: 'Double-Blind Peer Review',
      desc: 'Independent evaluation by international editorial board members adhering to COPE (Committee on Publication Ethics) guidelines.',
      badge: 'COPE COMPLIANT',
      icon: <ShieldCheck className="w-6 h-6 text-[#7A5A2E]" />,
    },
    {
      title: 'ISBN & ISSN Verification',
      desc: 'All hardcover edited books carry registered ISBN numbers and journals carry official ISSN barcodes for institutional libraries.',
      badge: 'ISBN / ISSN BARCODE',
      icon: <FileCheck className="w-6 h-6 text-[#7A5A2E]" />,
    },
    {
      title: 'CC-BY 4.0 Open Access',
      desc: 'Immediate, unrestricted worldwide access to full-text PDFs under Creative Commons Attribution 4.0 International Licensing.',
      badge: 'OPEN ACCESS',
      icon: <Award className="w-6 h-6 text-[#7A5A2E]" />,
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto relative z-10 font-manrope">
      <LandingPanel innerClassName="px-6 py-12 sm:px-10 sm:py-16">
        <div className="text-center max-w-3xl mx-auto mb-16 flex flex-col items-center gap-3 relative z-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#7A5A2E] bg-[#C99A2E]/15 px-3.5 py-1 rounded-full border border-[#8C6239]/40">
            <Sparkles className="w-3.5 h-3.5" />
            Global Citation & Indexing
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair text-[#3E2A1A]">
            Rigorous Standards for Worldwide Recognition
          </h2>
          <p className="text-sm sm:text-base text-[#4A3626]">
            Our publications are archived and indexed across top academic databases, ensuring high citation density and global research visibility.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        {indexingFeatures.map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.15 }}
            className="p-6 rounded-2xl bg-white/45 border border-[#8C6239]/20 hover:border-[#8C6239]/50 hover:bg-white/70 shadow-glass flex flex-col justify-between gap-6 group hover:-translate-y-1 hover:shadow-gold-glow transition-all duration-300"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 rounded-xl bg-[#C99A2E]/15 border border-[#8C6239]/30 group-hover:bg-[#C99A2E]/25 transition-colors">
                  {item.icon}
                </div>
                <span className="text-[13px] font-mono font-bold text-[#7A5A2E] bg-[#C99A2E]/15 px-2 py-0.5 rounded border border-[#8C6239]/40">
                  {item.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold font-playfair text-[#3E2A1A] group-hover:text-[#8C6239] transition-colors">
                {item.title}
              </h3>
              <p className="text-xs text-[#4A3626] leading-relaxed">
                {item.desc}
              </p>
            </div>

            <div className="pt-4 border-t border-[#8C6239]/25 flex items-center justify-between text-xs text-[#7A5A2E] font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> Standard Compliant
              </span>
            </div>
          </motion.div>
        ))}
        </div>
      </LandingPanel>
    </section>
  );
};
