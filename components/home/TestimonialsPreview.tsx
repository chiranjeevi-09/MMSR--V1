'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Quote, GraduationCap, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AdminTestimonial, fetchAdminTestimonials } from '@/lib/services/cms';

export const TestimonialsPreview: React.FC = () => {
  const [testimonials, setTestimonials] = useState<AdminTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminTestimonials();
      // Only show testimonials that are active (admin-controlled)
      const activeOnly = data.filter((t) => t.is_active ?? t.active ?? true);
      setTestimonials(activeOnly);
    } catch {
      setTestimonials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const list = testimonials;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % list.length);
  }, [list.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + list.length) % list.length);
  }, [list.length]);

  useEffect(() => {
    if (list.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [list.length, nextSlide]);

  if (!loading && list.length === 0) {
    return null;
  }

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <SectionHeader
        badge="Author Testimonials"
        title="What Authors & Editors Say"
        subtitle="Read feedback from leading professors, researchers, and book chapter contributors worldwide."
        align="center"
      />

      {loading && (
        <div className="max-w-3xl mx-auto h-80 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] animate-pulse p-8 shadow-xl" />
      )}

      {!loading && list.length > 0 && (
        <div className="relative max-w-4xl mx-auto pt-6 pb-12">
          {/* Main Interactive Luxury 3D Card Container */}
          <div className="relative min-h-[340px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              {list.map((item, idx) => {
                if (idx !== currentIndex) return null;

                const authorName = item.name || item.author_name || 'Academic Scholar';
                const roleStr = item.designation || item.role || 'Senior Researcher';
                const locationStr = [item.university || item.institution, item.country].filter(Boolean).join(', ') || 'Global Partner';
                const starCount = item.rating ?? 5;
                const quoteText = item.content || item.quote || item.testimonial_text || item.text || 'Exemplary academic publishing experience.';
                const avatarUrl = item.photo || item.avatar || item.image;

                return (
                  <motion.div
                    key={item.id || idx}
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -15 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    className="w-full p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-[#FFF9F1] via-[#FAF3E0] to-[#F5E6CC] border-2 border-[#D4AC54] shadow-[0_15px_40px_rgba(212,172,84,0.25)] flex flex-col justify-between gap-8 relative overflow-hidden"
                  >
                    {/* Background Decorative Graphic Accent */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-[#D4AC54]/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col gap-6 relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 bg-[#C99A2E]/10 px-3 py-1 rounded-full border border-[#D4AC54]/40">
                          {Array.from({ length: starCount }).map((_, i) => (
                            <Star key={i} className="w-4 h-4 fill-[#B8860B] text-[#B8860B]" />
                          ))}
                        </div>
                        <Quote className="w-10 h-10 text-[#C99A2E]/30" />
                      </div>

                      <p className="text-base sm:text-xl font-medium font-playfair text-[#3A2312] leading-relaxed italic">
                        &ldquo;{quoteText}&rdquo;
                      </p>
                    </div>

                    <div className="pt-6 border-t border-[#D4AC54]/60 flex items-center justify-between gap-4 relative z-10 flex-wrap">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-gold p-0.5 shadow-md shrink-0 overflow-hidden relative">
                          {avatarUrl ? (
                            <Image
                              src={avatarUrl}
                              alt={authorName}
                              width={56}
                              height={56}
                              className="object-cover rounded-xl w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#FFF9F1] rounded-xl flex items-center justify-center text-[#B8860B] font-bold font-playfair text-xl">
                              {(authorName[0] || 'A').toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col">
                          <h4 className="text-lg font-bold font-playfair text-[#3A2312]">
                            {authorName}
                          </h4>
                          <span className="text-xs text-[#B8860B] font-bold">{roleStr}</span>
                          <span className="text-xs text-[#6E5238] flex items-center gap-1.5 mt-0.5 font-medium">
                            <GraduationCap className="w-3.5 h-3.5 text-[#B8860B] shrink-0" />
                            {locationStr}
                          </span>
                        </div>
                      </div>

                      {/* Numbering */}
                      <div className="text-xs font-mono font-bold text-[#B8860B] bg-[#C99A2E]/10 px-3 py-1.5 rounded-xl border border-[#D4AC54]">
                        0{currentIndex + 1} / 0{list.length}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-8">
            {/* Dots */}
            <div className="flex items-center gap-2">
              {list.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentIndex(i)}
                  className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                    i === currentIndex
                      ? 'w-8 bg-gradient-to-r from-[#D4AC54] to-[#B8860B] shadow-md'
                      : 'w-2.5 bg-[#D4AC54]/40 hover:bg-[#D4AC54]'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>

            {/* Next / Prev Navigation Buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={prevSlide}
                className="w-11 h-11 rounded-2xl bg-[#FFF9F1] border-2 border-[#D4AC54] text-[#3A2312] flex items-center justify-center hover:bg-[#D4AC54] hover:text-[#FFF9F1] hover:scale-105 shadow-md transition-all cursor-pointer"
                aria-label="Previous Testimonial"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={nextSlide}
                className="w-11 h-11 rounded-2xl bg-[#FFF9F1] border-2 border-[#D4AC54] text-[#3A2312] flex items-center justify-center hover:bg-[#D4AC54] hover:text-[#FFF9F1] hover:scale-105 shadow-md transition-all cursor-pointer"
                aria-label="Next Testimonial"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
