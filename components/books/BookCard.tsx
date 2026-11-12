'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Star, ShoppingCart, Eye, Heart, Check, BookOpen } from 'lucide-react';
import { Book } from '@/lib/types/book';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';

export interface BookCardProps {
  book: Book;
  onQuickView?: (book: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onQuickView }) => {
  const { addItem } = useCart();
  const { toggleItem, isWishlisted } = useWishlist();
  const [isAddedToCart, setIsAddedToCart] = useState(false);

  const bookWishlistId = `book-${book.id}`;
  const saved = isWishlisted(bookWishlistId);

  const bookDetailLink = `/books/${book.slug || book.id}`;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

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

  const displayPrice = book.salePrice ? `₹${book.salePrice.toLocaleString('en-IN')}` : `₹${book.price.toLocaleString('en-IN')}`;
  const originalPrice = book.salePrice ? `₹${book.price.toLocaleString('en-IN')}` : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#C99A2E] hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 overflow-hidden flex flex-col h-full group font-manrope relative shadow-md"
    >
      {/* Cover Image Header Section */}
      <Link href={bookDetailLink} className="h-56 bg-[#F8EEDC] relative flex items-center justify-center overflow-hidden border-b border-[#D4AC54] block">
        {book.coverImage ? (
          <Image
            src={book.coverImageWebp || book.coverImage}
            alt={`Cover of ${book.title}`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-[#9E7A3B]">
            <BookOpen className="w-12 h-12 mb-2 text-[#C99A2E]" />
            <span className="text-xs font-semibold uppercase tracking-wider">Academic Edition</span>
          </div>
        )}
        <div className="absolute top-0 right-0 w-36 h-36 bg-[#C99A2E]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#C99A2E]/20 transition-all duration-500" />

        {/* Wishlist Action */}
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`p-2 rounded-full border transition-all shadow-sm cursor-pointer ${
              saved
                ? 'bg-[#FFF2D9] border-[#C99A2E] text-[#C99A2E]'
                : 'bg-[#FFF9F1] border-[#D4AC54] hover:border-[#C99A2E] text-[#73614C] hover:text-[#C99A2E]'
            }`}
            aria-label={saved ? 'Remove from Wishlist' : 'Add to Wishlist'}
          >
            <Heart className={`w-4 h-4 ${saved ? 'fill-[#C99A2E] text-[#C99A2E]' : ''}`} />
          </button>
        </div>
      </Link>

      {/* Card Content Below Image */}
      <div className="p-5 flex flex-col justify-between flex-1 gap-4">
        <div className="flex flex-col gap-2">
          {/* Category Badge & ISBN Below Image */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#FFF2D9] text-[#C99A2E] border border-[#D4AC54]">
              {book.category || 'Academic Book'}
            </span>
            <span className="text-[13px] font-mono text-[#C99A2E] font-semibold uppercase tracking-wider">
              ISBN {book.isbn}
            </span>
          </div>

          <Link href={bookDetailLink}>
            <h3 className="text-base font-bold font-playfair text-[#2F241A] line-clamp-2 group-hover:text-[#C99A2E] transition-colors leading-snug">
              {book.title}
            </h3>
          </Link>
          {book.editors && (
            <p className="text-xs text-[#73614C] line-clamp-1">
              Editors: <span className="text-[#2F241A] font-medium">{book.editors}</span>
            </p>
          )}

          {/* Rating & Pages Info */}
          <div className="flex items-center justify-between text-xs text-[#73614C] pt-1">
            <div className="flex items-center gap-1 font-semibold text-[#C99A2E]">
              <Star className="w-3.5 h-3.5 fill-[#C99A2E] text-[#C99A2E]" />
              <span>{book.rating}</span>
            </div>
            <span>{book.pages} Pages</span>
            <span>{book.publishYear} Edition</span>
          </div>
        </div>

        {/* Price & Action Buttons */}
        <div className="pt-4 border-t border-[#D4AC54]/60 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-lg font-bold font-playfair text-[#2F241A]">
              {displayPrice}
            </span>
            {originalPrice && (
              <span className="text-[13px] text-[#73614C] line-through font-mono">
                {originalPrice}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onQuickView && (
              <button
                type="button"
                onClick={() => onQuickView(book)}
                className="p-2 rounded-lg bg-[#F8EEDC] hover:bg-[#FFF2D9] text-[#73614C] hover:text-[#C99A2E] transition-colors"
                aria-label="Quick View"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}

            <Button
              variant={isAddedToCart ? 'success' : 'gold'}
              size="sm"
              onClick={handleAddToCart}
              leftIcon={
                isAddedToCart ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <ShoppingCart className="w-3.5 h-3.5 text-[#3E2A20]" />
                )
              }
            >
              {isAddedToCart ? 'Added' : 'Cart'}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

