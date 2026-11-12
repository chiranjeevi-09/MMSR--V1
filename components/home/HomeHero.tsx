'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  BookOpen,
  FileText,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Award,
  Globe,
  BookMarked,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminSlide, fetchAdminSlider } from '@/lib/services/cms';

export const HomeHero: React.FC = () => {
  const [slides, setSlides] = useState<AdminSlide[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  // Load live active slides from API
  const loadSlides = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSlider();
      const activeSlides = data
        .filter((s) => s.is_active ?? s.active ?? true)
        .sort((a, b) => (a.display_order ?? a.order ?? a.id) - (b.display_order ?? b.order ?? b.id));

      setSlides(activeSlides);
    } catch {
      setSlides([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSlides();
  }, [loadSlides]);

  // Mouse move parallax effect — driven by motion values so pointer movement
  // never triggers a React re-render of the hero (previous setState-per-event
  // pattern re-rendered the whole section on every mousemove, hurting INP).
  const mouseRawX = useMotionValue(0);
  const mouseRawY = useMotionValue(0);
  const parallaxX = useSpring(mouseRawX, { stiffness: 180, damping: 24 });
  const parallaxY = useSpring(mouseRawY, { stiffness: 180, damping: 24 });
  const parallaxX15 = useTransform(parallaxX, (v) => v * 1.5);
  const parallaxY15 = useTransform(parallaxY, (v) => v * 1.5);
  const parallaxXNeg15 = useTransform(parallaxX, (v) => -v * 1.5);
  const parallaxYNeg15 = useTransform(parallaxY, (v) => -v * 1.5);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseRawX.set((e.clientX - window.innerWidth / 2) / 40);
      mouseRawY.set((e.clientY - window.innerHeight / 2) / 40);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseRawX, mouseRawY]);

  // Auto-carousel timer (every 6 seconds if multiple slides)
  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [slides.length]);

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const activeSlide = slides[currentIndex];

  return (
    <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope overflow-hidden">
      {/* Background Mesh Glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full bg-gold-500/10 blur-[140px] pointer-events-none" />

      {/* SKELETON LOADER */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center animate-pulse py-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="w-48 h-8 rounded-full bg-navy-950 border border-[#D4AC54]/60" />
            <div className="w-full h-16 rounded-2xl bg-navy-950 border border-[#D4AC54]/60" />
            <div className="w-3/4 h-12 rounded-xl bg-navy-950 border border-[#D4AC54]/60" />
            <div className="flex gap-4 pt-4">
              <div className="w-36 h-12 rounded-xl bg-navy-950 border border-[#D4AC54]/60" />
              <div className="w-36 h-12 rounded-xl bg-navy-950 border border-[#D4AC54]/60" />
            </div>
          </div>
          <div className="lg:col-span-5 h-[350px] rounded-3xl bg-navy-950 border border-[#D4AC54]/60" />
        </div>
      )}

      {/* HERO SLIDER CONTENT */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left Column Text & Actions */}
          <div className="lg:col-span-7 flex flex-col gap-6 text-left relative min-h-[380px] justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSlide?.id || 'default-slide'}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <div>
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-gold-500/10 text-gold-400 border border-[#D4AC54] shadow-gold-glow">
                    <Sparkles className="w-3.5 h-3.5" />
                    Premier Global Academic Publisher
                  </span>
                </div>

                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold font-playfair text-[#3A2312] tracking-tight leading-[1.1]">
                  {activeSlide?.title || (
                    <>
                      Publish. Discover. <span className="gradient-gold-text">Inspire.</span>
                    </>
                  )}
                </h1>

                <p className="text-base sm:text-lg text-text-muted leading-relaxed max-w-2xl">
                  {activeSlide?.subtitle ||
                    'Missile Man Scientific & Research Publications connects authors, scientists, and academic institutions with high-impact peer-reviewed journals, ISBN-registered edited books, and global Open Access indexing.'}
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link href={activeSlide?.cta_link || activeSlide?.cta_url || '/books'}>
                    <Button variant="gold" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      {activeSlide?.cta_text || 'Browse Books'}
                    </Button>
                  </Link>

                  <Link href="/submit-manuscript">
                    <Button variant="primary" size="lg" leftIcon={<Sparkles className="w-4 h-4 text-gold-400" />}>
                      Submit Manuscript
                    </Button>
                  </Link>

                  <Link href="/journals">
                    <Button variant="outline" size="lg">
                      View Journals
                    </Button>
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Pagination Controls (Dots & Previous/Next Buttons) */}
            {slides.length > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-[#D4AC54]/60">
                {/* Dots */}
                <div className="flex items-center gap-2">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-2 rounded-full transition-all ${
                        currentIndex === idx ? 'w-8 bg-gold-500 shadow-gold-glow' : 'w-2 bg-white/20 hover:bg-white/40'
                      }`}
                    />
                  ))}
                </div>

                {/* Arrows */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="p-2 rounded-xl bg-navy-950 border border-[#D4AC54]/60 text-text-muted hover:text-ivory-white hover:border-gold-500/50 transition-all"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="p-2 rounded-xl bg-navy-950 border border-[#D4AC54]/60 text-text-muted hover:text-ivory-white hover:border-gold-500/50 transition-all"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Trust Highlights */}
            {slides.length <= 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="flex flex-wrap items-center gap-6 pt-4 border-t border-[#D4AC54]/60 text-xs text-text-muted"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>COPE Compliant Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-gold-400" />
                  <span>Crossref DOI Assigned</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-royal-blue" />
                  <span>Verified Digital Certificates</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* Right Column Illustration / Slide Artwork */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <motion.div
              style={{ x: parallaxX, y: parallaxY }}
              className="relative w-full max-w-md aspect-square rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] shadow-glass overflow-hidden group"
            >
              {/* Background Slide Image if available */}
              {(activeSlide?.image || activeSlide?.cover_image) && !brokenImages.has(activeSlide?.image || activeSlide?.cover_image || '') ? (
                <Image
                  src={activeSlide.image || activeSlide.cover_image || ''}
                  alt={activeSlide.title || 'Slide'}
                  fill
                  className="object-cover rounded-3xl"
                  onError={() => {
                    const imgUrl = activeSlide.image || activeSlide.cover_image || '';
                    if (imgUrl) {
                      setBrokenImages((prev) => new Set([...prev, imgUrl]));
                    }
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col justify-center items-center p-8 text-center relative">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gold-500/10 rounded-full blur-2xl pointer-events-none" />
                  <BookOpen className="w-16 h-16 text-gold-400 mb-4" />
                  <h3 className="text-xl font-bold font-playfair text-[#3A2312]">
                    Missile Man Scientific & Research
                  </h3>
                </div>
              )}
            </motion.div>

            {/* Floating Parallax Card Top Right */}
            <motion.div
              style={{ x: parallaxXNeg15, y: parallaxYNeg15 }}
              className="absolute -top-6 -right-4 p-4 rounded-2xl bg-[#F8EEDC]/90 backdrop-blur-xl border border-gold-500/40 shadow-glass flex items-center gap-3 hidden sm:flex z-30"
            >
              <BookMarked className="w-6 h-6 text-gold-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#3A2312]">ISBN Registered</span>
                <span className="text-[13px] text-text-muted">Global Book Registry</span>
              </div>
            </motion.div>

            {/* Floating Parallax Card Bottom Left */}
            <motion.div
              style={{ x: parallaxX15, y: parallaxY15 }}
              className="absolute -bottom-6 -left-4 p-4 rounded-2xl bg-[#F8EEDC]/90 backdrop-blur-xl border border-emerald-500/40 shadow-glass flex items-center gap-3 hidden sm:flex z-30"
            >
              <FileText className="w-6 h-6 text-emerald-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#3A2312]">Peer Reviewed</span>
                <span className="text-[13px] text-emerald-400">Double-Blind Standards</span>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </section>
  );
};
