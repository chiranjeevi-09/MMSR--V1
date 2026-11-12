'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Sparkles, BookOpen, Check, Newspaper } from 'lucide-react';
import { Journal } from '@/lib/types/journal';
import { Badge } from '@/components/ui/Badge';
import { PublicId } from '@/components/ui/PublicId';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/context/CartContext';

export const JournalDetailsHero: React.FC<{ journal: Journal; onScrollToIssues?: () => void }> = ({
  journal,
  onScrollToIssues,
}) => {
  const { addItem } = useCart();
  const [addedSub, setAddedSub] = useState(false);
  const coverSrc = journal.coverWebp || journal.cover || (journal as any).cover_image_webp || (journal as any).cover_image || '';

  const handleAddSubscriptionToCart = () => {
    const subPrice = journal.subscriptionPriceAnnual || 2999.00;
    addItem({
      id: `sub-${journal.id || journal.slug}`,
      itemType: 'journal_subscription',
      targetId: parseInt(journal.id, 10) || 1,
      title: `${journal.title} — Annual Institutional Subscription`,
      cover: journal.cover,
      price: subPrice,
      journalSlug: journal.slug,
      duration: '1 Year (Annual)',
      format: 'digital',
      formatLabel: 'Annual Digital Subscription',
    });
    setAddedSub(true);
    setTimeout(() => setAddedSub(false), 2500);
  };

  return (
    <section className="relative pt-6 pb-12 font-manrope">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column — Journal Cover Graphic Container */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="w-full aspect-[3/4] rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] overflow-hidden shadow-glass relative group"
          >
            {/* Journal Cover Image — kept clean, no text overlays */}
            {coverSrc ? (
              <Image
                src={coverSrc}
                alt={`${journal.title} cover`}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Newspaper className="w-16 h-16 text-[#D4AC54]/60" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column — Details & CTAs */}
        <div className="lg:col-span-8 flex flex-col gap-6 text-left">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="Published">{journal.discipline}</Badge>
              <span className="text-xs font-mono text-[#8C6B1B] bg-[#C99A2E]/15 px-2.5 py-1 rounded-full border border-[#D4AC54] font-semibold">
                Impact Factor: {journal.impactMetric || '3.50'}
              </span>
              <span className="text-xs font-mono font-bold text-[#8C6B1B] bg-[#C99A2E]/15 border border-[#D4AC54] px-2.5 py-1 rounded-full">
                ISSN: {journal.issn}
              </span>
              {journal.openAccess && <Badge variant="Open Access">Open Access</Badge>}
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#6E5238]">
                Vol. {journal.volume}, Issue {journal.issue} · {journal.year}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair text-[#3A2312] leading-tight">
              {journal.title}
            </h1>

            <p className="text-sm sm:text-base text-[#5C4033] leading-relaxed font-manrope font-medium">
              {journal.description}
            </p>
          </div>

          {/* Quick Specifications Metadata Box */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-medium text-xs">
            <div>
              <span className="text-[#8A6A4A] block text-[13px] uppercase font-bold">Print ISSN</span>
              <span className="font-mono font-bold text-[#3A2312]">{journal.issn}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block text-[13px] uppercase font-bold">Online E-ISSN</span>
              <span className="font-mono font-bold text-[#3A2312]">{journal.eissn}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block text-[13px] uppercase font-bold">DOI Prefix</span>
              <span className="font-mono font-bold text-[#B8860B]">{journal.doiPrefix}</span>
            </div>
            <div>
              <span className="text-[#8A6A4A] block text-[13px] uppercase font-bold">Frequency</span>
              <span className="font-bold text-[#3A2312]">{journal.frequency}</span>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <span className="text-[#8A6A4A] block text-[13px] uppercase font-bold mb-1">MMSR Journal ID</span>
              <PublicId value={journal.publicId} tone="light" size="sm" className="w-fit" />
            </div>
          </div>

          {/* Purchase & Submission — two separate action cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3A2312]">Annual Subscription</span>
                <span className="text-sm font-extrabold text-[#B8860B] font-playfair">
                  ₹{(journal.subscriptionPriceAnnual || 2999).toLocaleString('en-IN')}
                </span>
              </div>
              <p className="text-[13px] text-[#6E5238] font-medium">1 Year full library & institutional access.</p>
              <Button
                variant={addedSub ? 'success' : 'primary'}
                size="sm"
                fullWidth
                onClick={handleAddSubscriptionToCart}
                leftIcon={addedSub ? <Check className="w-3.5 h-3.5 text-white" /> : <Newspaper className="w-3.5 h-3.5 text-gold-400" />}
              >
                {addedSub ? 'Added Subscription' : 'Subscribe 1 Year'}
              </Button>
            </div>

            {/* Second card — submission action for this particular journal */}
            <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] space-y-2 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3A2312]">Submit Your Research</span>
              </div>
              <p className="text-[13px] text-[#6E5238] font-medium">Submit manuscript for this particular journal.</p>
              <Button
                variant="gold"
                size="sm"
                fullWidth
                className="mt-auto"
                onClick={() => (window.location.href = `/submit-manuscript?journal=${journal.slug}`)}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-navy-900" />}
              >
                Submit Manuscript
              </Button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            {onScrollToIssues && (
              <Button
                variant="primary"
                size="xl"
                onClick={onScrollToIssues}
                leftIcon={<BookOpen className="w-5 h-5 text-gold-400" />}
              >
                View Current Issue
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
