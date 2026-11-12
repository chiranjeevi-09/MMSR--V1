'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Star, ShoppingCart, ArrowRight, Check } from 'lucide-react';
import { Book } from '@/lib/types/book';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/context/CartContext';

export interface BookQuickViewProps {
  book: Book | null;
  onClose: () => void;
}

export const BookQuickView: React.FC<BookQuickViewProps> = ({ book, onClose }) => {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  if (!book) return null;

  const handleAddToCart = () => {
    addItem({
      id: `book-${book.id}`,
      itemType: 'book',
      targetId: typeof book.id === 'string' ? parseInt(book.id, 10) || 1 : book.id,
      title: book.title,
      isbn: book.isbn,
      cover: book.coverImage,
      price: book.price,
      salePrice: book.salePrice,
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2500);
  };

  const displayPrice = book.salePrice ? `₹${book.salePrice.toLocaleString('en-IN')}` : `₹${book.price.toLocaleString('en-IN')}`;

  return (
    <Modal
      isOpen={Boolean(book)}
      onClose={onClose}
      title={book.title}
      subtitle={`ISBN: ${book.isbn} | ${book.publisher || 'MMSR Publications'}`}
      size="lg"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="outline" size="md" onClick={onClose}>
            Close
          </Button>
          <Button
            variant={isAdded ? 'success' : 'gold'}
            size="md"
            onClick={handleAddToCart}
            leftIcon={isAdded ? <Check className="w-4 h-4 text-white" /> : <ShoppingCart className="w-4 h-4 text-navy-900" />}
          >
            {isAdded ? 'Added to Cart' : 'Add to Cart'}
          </Button>
          <Link href={`/books/${book.slug || book.id}`} onClick={onClose}>
            <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4 text-gold-400" />}>
              Full Book Details
            </Button>
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start font-manrope">
        {/* Left Graphic Cover */}
        <div className="md:col-span-5 h-64 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] flex items-center justify-center overflow-hidden relative shadow-medium">
          {book.coverImage || (book as any).cover_image ? (
            <Image
              src={book.coverImage || (book as any).cover_image || ''}
              alt={book.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 320px"
            />
          ) : (
            <div className="p-6 flex flex-col justify-between h-full w-full relative z-10">
              <div className="flex justify-between items-start">
                <Badge variant="Published">{book.category}</Badge>
                <span className="text-xs font-bold text-navy-900 bg-gradient-gold px-2.5 py-1 rounded-full shadow-gold-glow">
                  {displayPrice}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-mono text-[#C99A2E] font-semibold">ISBN {book.isbn}</span>
                <h4 className="text-base font-bold font-playfair text-[#3A2312] line-clamp-2">{book.title}</h4>
              </div>
            </div>
          )}
        </div>

        {/* Right Details */}
        <div className="md:col-span-7 flex flex-col gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <span className="text-gold-400 font-semibold flex items-center gap-1 text-xs">
              <Star className="w-4 h-4 fill-gold-400 text-gold-400" />
              {book.rating} / 5.0
            </span>
            <span className="text-text-muted">• {book.pages} Pages</span>
            <span className="text-text-muted">• {book.publishYear} Edition</span>
          </div>

          <p className="text-ivory-white/90 text-sm leading-relaxed">{book.description}</p>

          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-xs mt-2">
            <div>
              <span className="text-text-muted block text-[13px] uppercase">Editors / Authors</span>
              <span className="font-semibold text-ivory-white">{book.editors || book.authors}</span>
            </div>
            <div>
              <span className="text-text-muted block text-[13px] uppercase">DOI Identifier</span>
              <span className="font-mono font-semibold text-gold-400 truncate block">{book.doi || '10.5281/mmsr'}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
