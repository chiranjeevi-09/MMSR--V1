'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ShieldCheck, Award, Globe, CheckCircle2, ArrowRight } from 'lucide-react';
import { EnterButton } from './EnterButton';
import { SiteLogo } from '@/components/ui/SiteLogo';
import { ScrollIndicator } from './ScrollIndicator';

export const LandingHero: React.FC = () => {
  const router = useRouter();

  // Mouse parallax is driven by framer-motion motion values updated directly
  // inside the event listener, instead of React state. The previous
  // setMousePosition-on-every-mousemove re-rendered this whole hero tree on
  // each pointer move, which the Lighthouse report flagged as long main-thread
  // tasks / forced reflows. Motion values keep React out of the loop (the GPU
  // compositor handles the transform) and useSpring preserves the same smooth
  // trailing feel as before.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const springX = useSpring(mx, { stiffness: 50, damping: 20 });
  const springY = useSpring(my, { stiffness: 50, damping: 20 });
  const orbAX = useTransform(springX, (v) => v * 1.5);
  const orbAY = useTransform(springY, (v) => v * 1.5);
  const orbBX = useTransform(springX, (v) => v * -1.5);
  const orbBY = useTransform(springY, (v) => v * -1.5);
  const logoX = useTransform(springX, (v) => v * 0.5);
  const logoY = useTransform(springY, (v) => v * 0.5);

  // Mouse Parallax Listener
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const handleMouseMove = (e: MouseEvent) => {
      mx.set((e.clientX - window.innerWidth / 2) / 35);
      my.set((e.clientY - window.innerHeight / 2) / 35);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mx, my]);

  return (
    <section className="relative min-h-screen w-full flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-20 overflow-hidden font-manrope z-10 bg-gradient-to-br from-[#F5EBD6] via-[#EBD9B7] to-[#DFC59B]">
      {/* Skip Intro Top-Right Button */}
      <div className="absolute top-6 right-6 z-40">
        <button
          type="button"
          onClick={() => router.push('/home')}
          className="group flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-[#7A5A2E] bg-white/70 border border-[#8C6239]/40 hover:border-[#8C6239] hover:bg-white transition-all duration-300 backdrop-blur-md cursor-pointer shadow-medium"
        >
          <span>Skip Intro</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Hero Stage — full-bleed champagne background, content sits directly on it */}
      <div className="relative w-full max-w-6xl">
        <div className="relative px-6 py-16 sm:px-12 sm:py-20 flex flex-col items-center text-center font-manrope">
          {/* Mouse Parallax Decorative Orbs */}
          <motion.div
            style={{ x: orbAX, y: orbAY }}
            className="absolute top-1/4 left-10 w-72 h-72 rounded-full bg-[#C99A2E]/20 blur-[100px] pointer-events-none"
          />
          <motion.div
            style={{ x: orbBX, y: orbBY }}
            className="absolute bottom-1/4 right-10 w-96 h-96 rounded-full bg-[#8C6239]/35 blur-[120px] pointer-events-none"
          />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[40rem] h-56 bg-[#D4AC54]/15 blur-3xl rounded-full pointer-events-none" />

          {/* Centered Hero Content */}
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-8 relative z-20">
        {/* MMSR Logo Centered Inside Glowing Gold Ring */}
        <motion.div
          style={{ x: logoX, y: logoY }}
          initial={false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 100 }}
          className="relative group cursor-pointer"
        >
          {/* Logo Emblem */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden group-hover:scale-110 transition-transform duration-300">
            <SiteLogo className="w-full h-full" priority sizes="(max-width: 640px) 112px, 128px" />
          </div>
        </motion.div>

        {/* Gold Badge */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-[#C99A2E]/15 text-[#7A5A2E] border border-[#8C6239]/50">
            <Award className="w-4 h-4 text-[#7A5A2E]" />
            INTERNATIONAL SCIENTIFIC PUBLISHER
          </span>
        </motion.div>

        {/* Main Heading */}
        <motion.h1
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold font-playfair tracking-tight text-[#3E2A1A] leading-[1.15]"
        >
          Missile Man Scientific and{' '}
          <span className="gradient-gold-text block sm:inline">Research Publications</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-base sm:text-lg lg:text-xl text-[#4A3626] max-w-2xl leading-relaxed font-manrope"
        >
          A premier global academic publisher dedicated to high-impact peer-reviewed journals, edited books, Crossref DOI registration, and open-access scientific dissemination.
        </motion.p>

        {/* Single CTA Button Centered */}
        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex justify-center items-center w-full sm:w-auto mt-2"
        >
          <EnterButton variant="primary" label="Explore Our Research World" size="xl" />
        </motion.div>

        {/* Small Trust Indicators Below Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-6 text-xs text-[#4A3626] border-t border-[#8C6239]/40 w-full max-w-3xl mt-4"
        >
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>500+ Books Published</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#7A5A2E] shrink-0" />
            <span>Double-Blind Review</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Globe className="w-4 h-4 text-royal-blue shrink-0" />
            <span>Crossref DOI Registry</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Award className="w-4 h-4 text-[#7A5A2E] shrink-0" />
            <span>Open Access Standards</span>
          </div>
        </motion.div>
          </div>
        </div>
      </div>

      {/* Scroll Cue Indicator */}
      <ScrollIndicator />
    </section>
  );
};
