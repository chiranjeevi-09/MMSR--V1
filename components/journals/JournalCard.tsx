'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Eye, ArrowRight, ShieldCheck, Heart, FileText } from 'lucide-react';
import { Journal } from '@/lib/types/journal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useWishlist } from '@/lib/context/WishlistContext';

export interface JournalCardProps {
  journal: Journal;
  onQuickView?: (journal: Journal) => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({ journal, onQuickView }) => {
  const { toggleItem, isWishlisted } = useWishlist();

  const journalWishlistId = `journal-${journal.id || journal.slug}`;
  const saved = isWishlisted(journalWishlistId);

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    toggleItem({
      id: journalWishlistId,
      type: 'journal',
      targetId: journal.id || journal.slug,
      title: journal.title,
      subtitle: `ISSN: ${journal.issn} | Vol. ${journal.volume}, Issue ${journal.issue}`,
      cover: journal.cover,
      price: 49.00,
      slug: journal.slug,
      category: journal.discipline,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#C99A2E] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-full group font-manrope relative shadow-md overflow-hidden"
    >
      {/* Cover Image Header Section */}
      <Link href={`/journals/${journal.slug}`} className="h-44 bg-[#F8EEDC] relative flex items-center justify-center overflow-hidden border-b border-[#D4AC54] block">
        {journal.cover || (journal as any).cover_image ? (
          <Image
            src={journal.coverWebp || journal.cover || (journal as any).cover_image || ''}
            alt={`Cover of ${journal.title}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-[#9E7A3B]">
            <FileText className="w-10 h-10 mb-1 text-[#C99A2E]" />
            <span className="text-[13px] font-semibold uppercase tracking-wider">Indexed Journal</span>
          </div>
        )}
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#C99A2E]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Wishlist Button Overlay */}
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`p-2 rounded-full border transition-colors shadow-sm cursor-pointer ${
              saved
                ? 'bg-[#FFF2D9] border-[#C99A2E] text-[#C99A2E]'
                : 'bg-[#FFF9F1] border-[#D4AC54] hover:border-[#C99A2E] text-[#73614C] hover:text-[#C99A2E]'
            }`}
            aria-label={saved ? 'Remove from Wishlist' : 'Save Journal to Wishlist'}
          >
            <Heart className={`w-4 h-4 ${saved ? 'fill-[#C99A2E] text-[#C99A2E]' : ''}`} />
          </button>
        </div>
      </Link>

      {/* Card Content Below Image */}
      <div className="p-6 flex flex-col justify-between flex-1 gap-4">
        <div className="flex flex-col gap-3">
          {/* ISSN & Open Access Badges Below Image */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[13px] font-mono text-[#C99A2E] font-semibold bg-[#FFF2D9] border border-[#D4AC54] px-2.5 py-1 rounded-full">
              ISSN: {journal.issn}
            </span>
            {journal.openAccess && <Badge variant="Open Access">Open Access</Badge>}
          </div>

          <Link href={`/journals/${journal.slug}`}>
            <h3 className="text-xl font-bold font-playfair text-[#2F241A] group-hover:text-[#C99A2E] transition-colors line-clamp-2 leading-snug">
              {journal.title}
            </h3>
          </Link>

          <span className="text-xs text-[#73614C]">
            Discipline: <span className="text-[#2F241A] font-medium">{journal.discipline}</span>
          </span>

          <p className="text-xs text-[#73614C] leading-relaxed line-clamp-2">
            {journal.description}
          </p>

          {/* Metrics Grid Box */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#F8EEDC]/60 border border-[#D4AC54] text-xs my-1">
            <div>
              <span className="text-[13px] text-[#73614C] uppercase">Impact Factor</span>
              <p className="font-bold font-playfair text-[#C99A2E] text-base">
                {journal.impactMetric || '3.50'}
              </p>
            </div>
            <div>
              <span className="text-[13px] text-[#73614C] uppercase">Frequency</span>
              <p className="font-semibold text-[#2F241A] text-xs">{journal.frequency}</p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#73614C] pt-1">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Vol. {journal.volume}, Issue {journal.issue}</span>
            </span>
            <span className="font-mono text-[13px] text-[#C99A2E] font-medium">{journal.year}</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#D4AC54]/70 gap-2">
          {onQuickView && (
            <button
              type="button"
              onClick={() => onQuickView(journal)}
              className="p-2 rounded-lg bg-[#F8EEDC] hover:bg-[#FFF2D9] text-[#73614C] hover:text-[#C99A2E] transition-colors"
              aria-label="Quick View Journal"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          <Link href={`/journals/${journal.slug}`}>
            <Button variant="gold" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5 text-[#3E2A20]" />}>
              View Journal
            </Button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
};
