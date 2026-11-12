'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Star, ArrowRight, Eye, ShoppingBag, Heart, RefreshCw, BookOpen } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { AdminBook, fetchPublicBooks } from '@/lib/services/cms';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';

export const FeaturedBooksPreview: React.FC = () => {
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<AdminBook | null>(null);

  const { addItem: addToCart } = useCart();
  const { toggleItem: toggleWishlist, isWishlisted } = useWishlist();

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPublicBooks();
      // Sort featured first, then cap at 6 books
      const sorted = [...data].sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return 0;
      });
      setBooks(sorted.slice(0, 6));
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleAddToCart = (e: React.MouseEvent, book: AdminBook) => {
    e.stopPropagation();
    const priceNum = typeof book.price === 'number' ? book.price : parseFloat(String(book.price || '0'));
    addToCart({
      id: `book-${book.id}`,
      itemType: 'book',
      targetId: book.id,
      title: book.title,
      cover: book.cover_image || undefined,
      price: priceNum,
      isbn: book.isbn,
    });
  };

  const handleWishlist = (e: React.MouseEvent, book: AdminBook) => {
    e.stopPropagation();
    const priceNum = typeof book.price === 'number' ? book.price : parseFloat(String(book.price || '0'));
    toggleWishlist({
      id: `book-${book.id}`,
      type: 'book',
      targetId: book.id,
      title: book.title,
      subtitle: book.author || 'Academic Editor',
      cover: book.cover_image || undefined,
      price: priceNum,
      slug: book.slug || String(book.id),
      category: typeof book.category === 'object' ? book.category?.name : undefined,
      isbn: book.isbn,
    });
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <SectionHeader
        badge="Curated Publications"
        title="Featured Academic Books"
        subtitle="Explore peer-reviewed edited volumes assigned with ISBN, Crossref DOI, and indexed chapter contributions."
        cta={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadBooks}
              isLoading={loading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Link href="/books">
              <Button variant="outline" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                View All Books
              </Button>
            </Link>
          </div>
        }
      />

      {/* SKELETON LOADER */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-96 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] animate-pulse p-6 space-y-4 shadow-md">
              <div className="h-48 rounded-xl bg-[#F1DFC3]" />
              <div className="h-6 w-3/4 rounded bg-[#F1DFC3]" />
              <div className="h-4 w-1/2 rounded bg-[#EAD3B0]" />
            </div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && books.length === 0 && (
        <div className="p-10 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] text-center space-y-3 shadow-md">
          <BookOpen className="w-8 h-8 text-[#C99A2E] mx-auto" />
          <p className="text-base font-bold text-[#2F241A] font-playfair">No Featured Books Available</p>
          <p className="text-xs text-[#73614C] max-w-sm mx-auto">
            Published academic books will appear here once released by our editorial team.
          </p>
          <Button variant="outline" size="sm" onClick={loadBooks}>
            Try Refreshing
          </Button>
        </div>
      )}

      {/* BOOKS GRID */}
      {!loading && books.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {books.map((book, idx) => {
            const categoryName = typeof book.category === 'object' && book.category?.name
              ? book.category.name
              : 'Academic Book';

            const priceNum = typeof book.price === 'number'
              ? book.price
              : parseFloat(String(book.price || '0'));

            const isSaved = isWishlisted(`book-${book.id}`);

            return (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <div className="rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#C99A2E] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col h-full group shadow-md">
                  {/* Clean Cover Image Header */}
                  <Link href={`/books/${book.slug || book.id}`} className="h-56 bg-[#F8EEDC] relative flex items-center justify-center overflow-hidden border-b border-[#D4AC54] block">
                    {book.cover_image ? (
                      <Image
                        src={book.cover_image}
                        alt={book.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center text-[#9E7A3B]">
                        <BookOpen className="w-12 h-12 mb-2 text-[#C99A2E]" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Academic Edition</span>
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-36 h-36 bg-gold-500/10 rounded-full blur-2xl pointer-events-none" />

                    {/* Wishlist Button Overlay on Image */}
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        type="button"
                        onClick={(e) => handleWishlist(e, book)}
                        className={`p-2 rounded-full border transition-all shadow-sm ${
                          isSaved
                            ? 'bg-[#FFF2D9] text-[#C99A2E] border-[#C99A2E]'
                            : 'bg-[#FFF9F1] text-[#73614C] hover:text-[#C99A2E] border-[#D4AC54] hover:border-[#C99A2E]'
                        }`}
                        aria-label="Add to wishlist"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-red-400' : ''}`} />
                      </button>
                    </div>
                  </Link>

                  {/* Structured Book Details Below Image */}
                  <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                    <div className="flex flex-col gap-2">
                      {/* Category Badge & Price Tag Below Image */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant={book.is_featured ? 'Best Seller' : 'Published'}>
                          {categoryName}
                        </Badge>
                        <span className="text-xs font-bold text-navy-900 bg-gradient-gold px-2.5 py-1 rounded-full shadow-gold-glow">
                          ₹{priceNum > 0 ? priceNum.toLocaleString('en-IN') : 'Open Access'}
                        </span>
                      </div>

                      <span className="text-[13px] font-mono text-[#C99A2E] font-semibold tracking-wider uppercase">
                        ISBN: {book.isbn || '978-93-98765-00-0'}
                      </span>
                      <Link href={`/books/${book.slug || book.id}`}>
                        <h4 className="text-lg font-bold font-playfair text-[#2F241A] line-clamp-2 group-hover:text-[#C99A2E] transition-colors leading-snug">
                          {book.title}
                        </h4>
                      </Link>
                      <p className="text-xs text-[#73614C]">
                        Author / Editor: <span className="text-[#2F241A] font-medium">{book.author || 'Academic Editor'}</span>
                      </p>
                      <div className="flex items-center gap-1.5 text-xs text-[#C99A2E] font-semibold mt-1">
                        <Star className="w-4 h-4 fill-[#C99A2E] text-[#C99A2E]" />
                        <span>4.9</span>
                        <span className="text-[#73614C] text-[13px] font-normal">
                          • ISBN Verified & Indexed
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#D4AC54]/70">
                      <Link href={`/books/${book.slug || book.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          rightIcon={<ArrowRight className="w-3.5 h-3.5 text-gold-400" />}
                        >
                          View Book
                        </Button>
                      </Link>

                      <Button
                        variant="gold"
                        size="sm"
                        onClick={(e) => handleAddToCart(e, book)}
                        leftIcon={<ShoppingBag className="w-3.5 h-3.5" />}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Quick View Modal */}
      {selectedBook && (
        <Modal
          isOpen={Boolean(selectedBook)}
          onClose={() => setSelectedBook(null)}
          title={selectedBook.title}
          subtitle={`ISBN: ${selectedBook.isbn || 'N/A'} | Category: ${
            typeof selectedBook.category === 'object' ? selectedBook.category?.name : 'Academic'
          }`}
          size="lg"
          footer={
            <div className="flex items-center gap-3">
              <Button variant="outline" size="md" onClick={() => setSelectedBook(null)}>
                Close
              </Button>
              <Link href={`/books/${selectedBook.slug || selectedBook.id}`}>
                <Button variant="gold" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  View Full Book Page
                </Button>
              </Link>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-sm font-manrope">
            <div className="flex items-center gap-2">
              <Badge variant="Published">
                {typeof selectedBook.category === 'object' ? selectedBook.category?.name : 'Academic'}
              </Badge>
              <Badge variant="Best Seller">
                ₹{(typeof selectedBook.price === 'number' ? selectedBook.price : parseFloat(String(selectedBook.price || '0'))).toLocaleString('en-IN')}
              </Badge>
              <span className="text-xs text-gold-400 font-semibold flex items-center gap-1">
                <Star className="w-4 h-4 fill-gold-400 text-gold-400" />
                4.9 / 5.0
              </span>
            </div>

            <p className="text-text-muted leading-relaxed">
              {selectedBook.description || 'Comprehensive peer-reviewed academic volume registered with official ISBN and Crossref DOI metadata.'}
            </p>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] text-xs">
              <div>
                <span className="text-[#73614C] block">Author / Editor</span>
                <span className="font-semibold text-[#2F241A]">{selectedBook.author || 'Academic Scholar'}</span>
              </div>
              <div>
                <span className="text-[#73614C] block">Published Date</span>
                <span className="font-semibold text-[#2F241A]">
                  {selectedBook.published_date
                    ? new Date(selectedBook.published_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' })
                    : '2026 Edition'}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
};
