'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, BadgeCheck, Lock, Headphones, BookOpen, FileCheck2 } from 'lucide-react';
import { EnterButton } from '@/components/landing/EnterButton';

const GUARANTEES = [
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'Rigorous Peer-Reviewed Process' },
  { icon: <FileCheck2 className="w-4 h-4" />, label: 'DOI & ISBN Registration' },
  { icon: <BadgeCheck className="w-4 h-4" />, label: 'Indexed Journal Visibility' },
  { icon: <Lock className="w-4 h-4" />, label: 'Secure Payments & Licensing' },
  { icon: <Headphones className="w-4 h-4" />, label: 'Dedicated Author Support' },
];

export const FinalCTASection: React.FC = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative z-10 font-manrope">
      <motion.div
        initial={{ opacity: 0, y: 36 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.85 }}
        className="relative max-w-6xl mx-auto rounded-[2.5rem] p-[1.5px] bg-gradient-to-br from-[#D4AC54] via-[#C99A2E]/50 to-[#8C6239]/70 shadow-2xl"
      >
        {/* Inner champagne stage — matches the full-bleed hero */}
        <div className="relative rounded-[calc(2.5rem-1.5px)] bg-gradient-to-b from-[#F5EBD6] via-[#EBD9B7] to-[#DFC59B] overflow-hidden px-6 sm:px-14 pt-16 sm:pt-20 pb-10 text-center">
          {/* Ornamental gold corner brackets */}
          <div className="absolute top-5 left-5 w-14 h-14 border-t-2 border-l-2 border-[#8C6239]/50 rounded-tl-2xl pointer-events-none" />
          <div className="absolute top-5 right-5 w-14 h-14 border-t-2 border-r-2 border-[#8C6239]/50 rounded-tr-2xl pointer-events-none" />
          <div className="absolute bottom-5 left-5 w-14 h-14 border-b-2 border-l-2 border-[#8C6239]/50 rounded-bl-2xl pointer-events-none" />
          <div className="absolute bottom-5 right-5 w-14 h-14 border-b-2 border-r-2 border-[#8C6239]/50 rounded-br-2xl pointer-events-none" />

          {/* Ambient glows + floating emblem */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[34rem] h-56 bg-[#C99A2E]/20 blur-3xl rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-8 w-40 h-40 bg-[#8C6239]/25 blur-3xl rounded-full pointer-events-none" />
          <BookOpen className="absolute top-16 right-10 w-24 h-24 text-[#8C6239]/10 hidden lg:block animate-float pointer-events-none" />
          <Sparkles className="absolute bottom-24 left-10 w-16 h-16 text-[#8C6239]/10 hidden lg:block animate-float pointer-events-none" />

          {/* Eyebrow badge */}
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.28em] text-[#7A5A2E] bg-[#C99A2E]/15 border border-[#8C6239]/50 rounded-full px-5 py-2 shadow-gold-glow"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#7A5A2E]" />
            Gateway to Knowledge
          </motion.span>

          {/* Headline */}
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="relative mt-7 text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair text-[#3E2A1A] leading-tight"
          >
            Ready to Explore{' '}
            <span className="bg-gradient-to-r from-[#8C6239] via-[#A97917] to-[#C99A2E] bg-clip-text text-transparent">
              MMSR Publications?
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="relative text-sm sm:text-base text-[#4A3626] max-w-2xl mx-auto mt-5 leading-relaxed"
          >
            Join a growing community of scholars, authors and researchers. Browse peer-reviewed journals,
            publish your own work, and access the full academic library — all in one trusted gateway.
          </motion.p>

          {/* CTA button */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="relative flex items-center justify-center mt-9"
          >
            <div className="absolute w-56 h-56 rounded-full border border-[#8C6239]/25 shadow-gold-glow animate-gold-glow pointer-events-none" />
            <EnterButton variant="primary" label="Explore Our Research World" size="xl" />
          </motion.div>

          {/* Guarantee strip */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className="relative mt-14 pt-7 border-t border-[#8C6239]/25"
          >
            <p className="text-[13px] font-bold uppercase tracking-[0.3em] text-[#8C6239] mb-5">
              What you can count on
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              {GUARANTEES.map((g) => (
                <div key={g.label} className="flex items-center gap-2 text-[#4A3626]">
                  <span className="text-[#7A5A2E]">{g.icon}</span>
                  <span className="text-xs font-semibold">{g.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};
