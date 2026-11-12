'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Heart,
  Trash2,
  ShoppingCart,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Newspaper,
  Eye,
  Check,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useWishlist } from '@/lib/context/WishlistContext';
import { useCart } from '@/lib/context/CartContext';

export default function WishlistPage() {
  const router = useRouter();
  const { items, removeItem, clearWishlist, wishlistCount } = useWishlist();
  const { addItem } = useCart();

  const handleMoveToCart = (item: any) => {
    // Issue-level purchasing has been removed: journals are accessed via subscription,
    // not the cart. Send non-book (journal) wishlist items to the journal's page where
    // the annual subscription can be acquired. Books continue to move into the cart.
    if (item.type !== 'book') {
      router.push(item.slug ? `/journals/${item.slug}` : '/journals');
      return;
    }
    addItem({
      id: item.id,
      itemType: 'book',
      targetId: typeof item.targetId === 'number' ? item.targetId : 1,
      title: item.title,
      isbn: item.isbn,
      cover: item.cover,
      price: item.price,
    });
    removeItem(item.id);
  };

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#4A3B2C] font-manrope flex flex-col justify-between">
      <Navbar />

      <main className="pt-28 pb-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-8">
        {/* Hero & Breadcrumb */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54]/60 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
              <Link href="/home" className="hover:text-[#C99A2E]">Home</Link>
              <span>/</span>
              <span className="text-[#C99A2E] font-semibold">Wishlist</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold font-playfair text-[#2F241A] tracking-tight flex items-center gap-3">
              <Heart className="w-7 h-7 text-[#C99A2E] fill-[#C99A2E]/20" />
              My Saved Publications
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Your saved collection of MMSR academic books, monographs, and peer-reviewed journals.
            </p>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#C99A2E] bg-[#C99A2E]/10 px-3 py-1.5 rounded-xl border border-[#D4AC54]">
                {wishlistCount} Saved
              </span>
              <button
                type="button"
                onClick={clearWishlist}
                className="px-3.5 py-1.5 rounded-xl border-2 border-red-500/80 text-red-600 hover:bg-red-50 hover:border-red-600 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {items.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-center space-y-6 max-w-2xl mx-auto my-12">
            <div className="w-20 h-20 rounded-3xl bg-[#C99A2E]/10 border border-[#D4AC54] flex items-center justify-center mx-auto text-[#C99A2E] shadow-gold-glow">
              <Heart className="w-10 h-10 fill-[#C99A2E]/20" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-playfair text-[#2F241A]">Your Wishlist is Empty</h2>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md mx-auto">
                Click the heart icon on any academic book or journal issue to save publications to your personal reading list.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link href="/books">
                <Button variant="gold" size="lg" leftIcon={<BookOpen className="w-4 h-4 text-navy-950" />}>
                  Browse Books Catalogue
                </Button>
              </Link>
              <Link href="/journals">
                <Button variant="outline" size="lg" leftIcon={<Newspaper className="w-4 h-4 text-[#C99A2E]" />}>
                  Browse Open Access Journals
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Wishlist Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-[#C99A2E]/40 transition-all flex flex-col justify-between space-y-4 group relative"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold uppercase tracking-wider text-[#C99A2E] bg-[#C99A2E]/10 px-2.5 py-0.5 rounded border border-[#D4AC54]">
                      {item.category || (item.type === 'book' ? 'Book' : 'Journal')}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 rounded-lg border-2 border-[#DC2626]/70 hover:border-red-600 text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                      title="Remove from Wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold font-playfair text-[#2F241A] line-clamp-2 group-hover:text-[#C99A2E] transition-colors">
                      {item.title}
                    </h3>
                    {item.subtitle && <p className="text-xs text-text-muted line-clamp-1">{item.subtitle}</p>}
                    {item.isbn && <span className="text-[13px] font-mono text-text-muted block">ISBN: {item.isbn}</span>}
                  </div>
                </div>

                <div className="pt-4 border-t border-[#D4AC54]/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted">Price</span>
                    <span className="text-base font-bold font-playfair text-[#C99A2E]">₹{item.price.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => handleMoveToCart(item)}
                      leftIcon={<ShoppingCart className="w-3.5 h-3.5 text-navy-950" />}
                    >
                      Move to Cart
                    </Button>
                    <Link href={item.type === 'book' ? `/books/${item.targetId}` : `/journals/${item.slug || ''}`}>
                      <Button variant="outline" size="sm" fullWidth leftIcon={<Eye className="w-3.5 h-3.5 text-[#C99A2E]" />}>
                        Details
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
