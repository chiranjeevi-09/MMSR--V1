'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Star,
  ShoppingCart,
  Zap,
  FileText,
  Share2,
  Heart,
  Check,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';
import { Book } from '@/lib/types/book';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';

export interface BookDetailsHeroProps {
  book: Book;
  onPreviewSample?: () => void;
}

export const BookDetailsHero: React.FC<BookDetailsHeroProps> = ({ book, onPreviewSample }) => {
  const router = useRouter();
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();

  const [isAddedToCart, setIsAddedToCart] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const bookWishlistId = `book-${book.id}`;
  const saved = isWishlisted(bookWishlistId);

  const handleAddToCart = () => {
    addItem({
      id: bookWishlistId,
      itemType: 'book',
      targetId: typeof book.id === 'string' ? parseInt(book.id, 10) || 1 : book.id,
      title: book.title,
      isbn: book.isbn,
      cover: book.coverImage,
      price: book.price,
      salePrice: book.salePrice,
    });
    setIsAddedToCart(true);
    setTimeout(() => setIsAddedToCart(false), 2500);
  };

  const handleBuyNow = () => {
    // Mode Buy Now: Save transient buy now cart item in sessionStorage
    const buyNowItem = {
      id: bookWishlistId,
      itemType: 'book',
      targetId: typeof book.id === 'string' ? parseInt(book.id, 10) || 1 : book.id,
      title: book.title,
      isbn: book.isbn,
      cover: book.coverImage,
      price: book.salePrice ?? book.price,
      quantity: 1,
    };
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('mmsr_buy_now_item', JSON.stringify(buyNowItem));
    }
    router.push('/checkout?mode=buy-now');
  };

  const handleToggleWishlist = () => {
    toggleItem({
      id: bookWishlistId,
      type: 'book',
      targetId: book.id,
      title: book.title,
      subtitle: book.editors ? `Editors: ${book.editors}` : undefined,
      cover: book.coverImage,
      price: book.salePrice ?? book.price,
      category: book.category,
      isbn: book.isbn,
    });
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const displayPrice = book.salePrice ? `₹${book.salePrice.toLocaleString('en-IN')}` : `₹${book.price.toLocaleString('en-IN')}`;
  const originalPrice = book.salePrice ? `₹${book.price.toLocaleString('en-IN')}` : null;

  return (
    <section className="relative pt-6 pb-12 font-manrope">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column — Book Cover & Gallery Graphic */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="w-full aspect-[3/4] rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] p-6 flex flex-col justify-between overflow-hidden shadow-glass relative group"
          >
            {book.coverImage ? (
              <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-md">
                <Image
                  src={book.coverImage}
                  alt={book.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 768px) 100vw, 400px"
                />
              </div>
            ) : (
              <>
                <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between z-10">
                  <Badge variant="Published">{book.category}</Badge>
                  <Badge variant={book.stockStatus === 'In Stock' ? 'Accepted' : 'Pending'}>
                    {book.stockStatus}
                  </Badge>
                </div>

                <div className="relative z-10 flex flex-col gap-2">
                  <span className="text-xs font-mono font-bold text-gold-400">ISBN {book.isbn}</span>
                  <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-ivory-white leading-snug">
                    {book.title}
                  </h1>
                </div>

                <div className="pt-4 border-t border-[#D4AC54]/60 flex items-center justify-between text-xs text-text-muted z-10">
                  <span>{book.publisher || 'MMSR Publications'}</span>
                  <span>{book.publishYear} Edition</span>
                </div>
              </>
            )}
          </motion.div>
        </div>

        {/* Right Column — Details & Purchase Actions */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-left">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="Published">{book.category}</Badge>
              {book.isOpenAccess && <Badge variant="Open Access">Open Access</Badge>}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair text-ivory-white leading-tight">
              {book.title}
            </h1>

            {book.subtitle && (
              <p className="text-base font-medium text-gold-400/90 font-manrope">{book.subtitle}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-base text-text-muted">
              Editors / Authors:{' '}
              <span className="font-semibold text-ivory-white text-lg">{book.editors || book.authors}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 w-fit">
              <p className="font-mono text-sm text-gold-400 font-bold px-4 py-2.5 rounded-xl bg-black/5 border border-[#D4AC54]/50">
                ISBN: <span className="text-ivory-white font-mono">{book.isbn}</span>
              </p>
              {book.doi && (
                <p className="font-mono text-sm text-gold-400 px-4 py-2.5 rounded-xl bg-black/5 border border-[#D4AC54]/50">
                  DOI: <span className="text-ivory-white">{book.doi}</span>
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* Rating */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/40">
                <div className="w-10 h-10 rounded-lg bg-gold-500/15 flex items-center justify-center shrink-0">
                  <Star className="w-5 h-5 fill-gold-400 text-gold-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] uppercase tracking-wider text-text-muted">Rating</div>
                  <div className="text-base font-bold text-ivory-white">
                    {book.rating}
                    <span className="text-xs text-text-muted font-medium">/5</span>
                  </div>
                </div>
              </div>
              {/* Pages */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/40">
                <div className="w-10 h-10 rounded-lg bg-gold-500/15 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-gold-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] uppercase tracking-wider text-text-muted">Extent</div>
                  <div className="text-base font-bold text-ivory-white">{book.pages} Pages</div>
                </div>
              </div>
              {/* Edition */}
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/40">
                <div className="w-10 h-10 rounded-lg bg-gold-500/15 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-gold-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] uppercase tracking-wider text-text-muted">Edition</div>
                  <div className="text-base font-bold text-ivory-white truncate">{book.publishYear} Edition</div>
                </div>
              </div>
            </div>

            {/* Verified ISBN / publisher strip */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Verified ISBN Assigned · {book.publisher || 'MMSR Publications'}</span>
            </div>
          </div>

          {/* Pricing Banner */}
          <div className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-medium flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-text-muted uppercase">Purchase Price</span>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold font-playfair text-ivory-white gradient-gold-text">
                  {displayPrice}
                </span>
                {originalPrice && (
                  <span className="text-sm text-text-muted line-through font-mono">
                    {originalPrice}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleWishlist}
                className={`p-3 rounded-xl border transition-colors ${
                  saved
                    ? 'bg-gold-500/20 border-gold-500/50 text-gold-400'
                    : 'bg-[#F8EEDC] border-[#D4AC54]/60 hover:border-gold-500 text-text-muted hover:text-gold-400'
                }`}
                aria-label={saved ? 'Remove from Wishlist' : 'Add to Wishlist'}
              >
                <Heart className={`w-5 h-5 ${saved ? 'fill-gold-400 text-gold-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant={isAddedToCart ? 'success' : 'gold'}
              size="xl"
              onClick={handleAddToCart}
              leftIcon={
                isAddedToCart ? <Check className="w-5 h-5 text-white" /> : <ShoppingCart className="w-5 h-5 text-navy-900" />
              }
            >
              {isAddedToCart ? 'Added to Cart' : 'Add to Cart'}
            </Button>

            <Button
              variant="primary"
              size="xl"
              onClick={handleBuyNow}
              leftIcon={<Zap className="w-5 h-5 text-gold-400" />}
            >
              Buy Now
            </Button>

            {onPreviewSample && (
              <Button
                variant="outline"
                size="xl"
                onClick={onPreviewSample}
                leftIcon={<FileText className="w-5 h-5 text-gold-400" />}
              >
                Preview Sample PDF
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
