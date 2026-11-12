'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Award,
  BookOpen,
  FileCheck2,
  Users,
  Zap,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { LandingPanel } from './LandingPanel';

export const AuthorBenefits: React.FC = () => {
  const benefits = [
    {
      icon: <Clock className="w-6 h-6 text-[#7A5A2E]" />,
      title: 'Rapid Editorial Decision',
      desc: 'First screening decision within 3–5 business days and complete double-blind peer review within 14–21 days.',
    },
    {
      icon: <Award className="w-6 h-6 text-[#7A5A2E]" />,
      title: 'Digital Publication Certificate',
      desc: 'Cryptographically signed certificates of publication issued immediately upon acceptance for lead and co-authors.',
    },
    {
      icon: <Zap className="w-6 h-6 text-[#7A5A2E]" />,
      title: 'Pre-Formatting Support',
      desc: 'Professional typesetting, LaTeX formatting, reference validation, and figure enhancement provided by editorial staff.',
    },
    {
      icon: <Users className="w-6 h-6 text-[#7A5A2E]" />,
      title: 'Global Academic Exposure',
      desc: 'Distribution across university repositories, research network databases, and open-access portals in 40+ countries.',
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto relative z-10 font-manrope">
      <LandingPanel innerClassName="p-8 sm:p-14">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C99A2E]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#8C6239]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#7A5A2E] bg-[#C99A2E]/15 px-3.5 py-1 rounded-full border border-[#8C6239]/40">
              Author Privileges & Support
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair text-[#3E2A1A] leading-tight">
              Why Global Scholars Choose MMSR
            </h2>
            <p className="text-sm sm:text-base text-[#4A3626] leading-relaxed">
              We empower authors with transparent peer review timelines, dedicated editorial guidance, and open-access publishing models tailored for maximum citations and career advancement.
            </p>

            <div className="pt-2">
              <Link
                href="/submit-manuscript"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-gold text-navy-900 font-bold text-sm shadow-gold-glow hover:scale-105 transition-transform"
              >
                <span>Submit Your Research</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {benefits.map((b, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="p-6 rounded-2xl bg-white/45 border border-[#8C6239]/20 space-y-3 hover:border-[#8C6239]/50 hover:bg-white/70 hover:shadow-gold-glow transition-all"
              >
                <div className="p-2.5 w-fit rounded-xl bg-[#C99A2E]/15 border border-[#8C6239]/30">
                  {b.icon}
                </div>
                <h3 className="text-base font-bold font-playfair text-[#3E2A1A]">
                  {b.title}
                </h3>
                <p className="text-xs text-[#4A3626] leading-relaxed">
                  {b.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </LandingPanel>
    </section>
  );
};
