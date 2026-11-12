'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Quote, BadgeCheck, ShieldCheck, Globe2, BookOpenCheck } from 'lucide-react';

const TRUST_POINTS = [
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'Rigorous Peer Review' },
  { icon: <BookOpenCheck className="w-4 h-4" />, label: 'Crossref DOIs & ISBNs' },
  { icon: <Globe2 className="w-4 h-4" />, label: 'Global Indexing & Visibility' },
];

export const QuoteSection: React.FC = () => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative z-10 font-manrope">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative rounded-[2.5rem] p-[1.5px] bg-gradient-to-br from-[#D4AC54] via-[#8C6239]/60 to-[#D4AC54] shadow-2xl"
        >
          {/* Inner champagne panel — matches the full-bleed hero */}
          <div className="relative rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-[#F5EBD6] via-[#EBD9B7] to-[#DFC59B] overflow-hidden px-6 py-14 sm:px-12 sm:py-16 text-center">
            {/* Top gold hairline */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AC54] to-transparent" />

            {/* Oversized serif quote watermark */}
            <Quote className="absolute -top-6 -left-4 w-44 h-44 text-[#8C6239]/10 rotate-180 pointer-events-none" />
            <Quote className="absolute -bottom-10 -right-4 w-44 h-44 text-[#8C6239]/10 pointer-events-none" />

            {/* Soft gold glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-40 bg-[#C99A2E]/15 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-48 h-32 bg-[#8C6239]/25 blur-3xl rounded-full pointer-events-none" />

            {/* Eyebrow */}
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.25em] text-[#4A3626] bg-[#C99A2E]/15 border border-[#8C6239]/40 rounded-full px-4 py-1.5"
            >
              <BadgeCheck className="w-3.5 h-3.5 text-[#7A5A2E]" />
              Our Guiding Principle
            </motion.span>

            {/* The quote itself */}
            <motion.blockquote
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative mt-8 text-2xl sm:text-3xl lg:text-[2.6rem] font-bold font-playfair italic text-[#3E2A1A] leading-snug tracking-tight max-w-3xl mx-auto"
            >
              &ldquo;Knowledge grows when research is{' '}
              <span className="bg-gradient-to-r from-[#8C6239] via-[#A97917] to-[#C99A2E] bg-clip-text text-transparent not-italic">
                shared with the world
              </span>
              .&rdquo;
            </motion.blockquote>

            {/* Attribution seal */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="relative mt-8 flex flex-col items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center shadow-gold-glow border-2 border-[#8C6239]/40">
                <BookOpenCheck className="w-6 h-6 text-[#241708]" />
              </div>
              <div>
                <p className="text-sm font-bold font-playfair text-[#8C6239] tracking-[0.2em] uppercase">
                  MMSR Publications
                </p>
                <p className="text-[13px] text-[#4A3626]/80 mt-1 tracking-wide">
                  Missile Man Scientific &amp; Research Publications
                </p>
              </div>
            </motion.div>

            {/* Trust strip */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.75 }}
              className="relative mt-10 pt-8 border-t border-[#8C6239]/25 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0 sm:divide-x sm:divide-[#8C6239]/30"
            >
              {TRUST_POINTS.map((point) => (
                <div key={point.label} className="flex items-center gap-2.5 sm:px-8 text-[#4A3626]">
                  <span className="text-[#7A5A2E]">{point.icon}</span>
                  <span className="text-xs font-semibold tracking-wide">{point.label}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
