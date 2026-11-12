'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Download, Mail, ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const CTASection: React.FC = () => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <div className="relative p-10 sm:p-16 rounded-3xl bg-gradient-to-br from-[#3A2312] via-[#5C4033] to-[#3A2312] border-2 border-[#D4AC54] text-[#FFF9F1] overflow-hidden shadow-2xl flex flex-col items-center text-center gap-6">
        {/* Background Decorative Graphic Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#D4AC54_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-[#FFF9F1]/10 border border-[#D4AC54]/40 text-[#D4AC54] flex items-center justify-center shadow-lg z-10 backdrop-blur-sm">
          <BookOpen className="w-8 h-8" />
        </div>

        <div className="flex flex-col gap-3 max-w-3xl relative z-10">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#D4AC54] bg-[#D4AC54]/15 px-4 py-1.5 rounded-full w-fit mx-auto border border-[#D4AC54]/40">
            Start Your Publishing Journey
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold font-playfair tracking-tight leading-tight text-[#FFF9F1]">
            Publish Your Research With MMSR Publications
          </h2>
          <p className="text-sm sm:text-base font-medium text-[#EEDBC0] leading-relaxed">
            Join thousands of global scholars. Submit your book chapters, journal papers, or edited volume proposals today.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 relative z-10 mt-4">
          <Link href="/submit-manuscript">
            <button
              type="button"
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#D4AC54] to-[#C99A2E] text-[#2A180B] border-2 border-[#FFE8A3] shadow-lg hover:scale-105 hover:from-[#E8C26B] hover:to-[#D4AC54] hover:shadow-[0_0_20px_rgba(212,172,84,0.5)] transition-all duration-300 flex items-center gap-2 group cursor-pointer"
            >
              <span>Submit Manuscript / Chapter</span>
              <ArrowRight className="w-4 h-4 text-[#2A180B] group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
          <Link href="/services">
            <button
              type="button"
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-[#2A180B]/80 text-[#FFF9F1] border-2 border-[#D4AC54] shadow-md hover:bg-[#D4AC54] hover:text-[#2A180B] hover:border-[#FFE8A3] hover:scale-105 hover:shadow-[0_0_15px_rgba(212,172,84,0.3)] transition-all duration-300 flex items-center gap-2 group cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#D4AC54] group-hover:text-[#2A180B] transition-colors" />
              <span>Author Services & Guidelines</span>
            </button>
          </Link>
          <Link href="/contact">
            <button
              type="button"
              className="px-6 py-3.5 rounded-xl font-bold text-sm bg-[#2A180B]/80 text-[#FFF9F1] border-2 border-[#D4AC54] shadow-md hover:bg-[#D4AC54] hover:text-[#2A180B] hover:border-[#FFE8A3] hover:scale-105 hover:shadow-[0_0_15px_rgba(212,172,84,0.3)] transition-all duration-300 flex items-center gap-2 group cursor-pointer"
            >
              <Mail className="w-4 h-4 text-[#D4AC54] group-hover:text-[#2A180B] transition-colors" />
              <span>Contact Editorial Board</span>
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};
