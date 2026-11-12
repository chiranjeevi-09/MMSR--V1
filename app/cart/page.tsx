'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Newspaper,
  Tag,
  Truck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/context/CartContext';

const SHIPPING_ORIGINAL = 80;
const SHIPPING_DISCOUNTED = 40;
const TAX_RATE = 0;

export default function CartPage() {
  const router = useRouter();
  const { items, removeItem, updateQuantity, clearCart, itemCount, subtotal } = useCart();
  const [itemToRemove, setItemToRemove] = useState<{ id: string; title: string } | null>(null);

  // Shipping applies only to physical (print/bundle) orders, matching the backend.
  const hasPhysicalItems = items.some(
    (i) => i.itemType === 'book' || (i.itemType === 'journal_issue' && (i.format === 'print' || i.format === 'bundle'))
  );
  const shipping = hasPhysicalItems ? SHIPPING_DISCOUNTED : 0;
  const tax = 0;
  const total = subtotal + shipping + tax;

  const confirmRemoveItem = () => {
    if (itemToRemove) {
      removeItem(itemToRemove.id);
      setItemToRemove(null);
    }
  };

  return (
    // AppLayout (root layout) already renders Navbar + <main> + Footer for
    // /cart — rendering them again here produced two fixed headers stacked at
    // top:0 and a nested second <main> landmark (Phase 4 browser audit).
    <div className="min-h-screen bg-[#F8F5EE] text-[#2F241A] font-manrope flex flex-col justify-between">
      <div className="pt-28 pb-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-8">
        {/* Hero & Breadcrumb */}
        <div className="p-6 sm:p-8 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#73614C] mb-2">
              <Link href="/home" className="hover:text-[#C99A2E]">Home</Link>
              <span>/</span>
              <span className="text-[#C99A2E] font-semibold">Shopping Cart</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold font-playfair text-[#2F241A] tracking-tight flex items-center gap-3">
              <ShoppingCart className="w-7 h-7 text-[#C99A2E]" />
              Your Shopping Cart
            </h1>
            <p className="text-xs sm:text-sm text-[#73614C] mt-1">
              Review selected books, monographs, and journal subscriptions before checkout.
            </p>
          </div>

          <Link
            href="/books"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C99A2E] border border-[#C99A2E] rounded-xl px-4 py-2 hover:bg-[#FFF2D9] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Continue Shopping</span>
          </Link>
        </div>

        {/* Empty Cart State */}
        {items.length === 0 ? (
          <div className="p-12 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] text-center space-y-6 max-w-2xl mx-auto my-12 shadow-md">
            <div className="w-20 h-20 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] flex items-center justify-center mx-auto text-[#C99A2E]">
              <ShoppingCart className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-playfair text-[#2F241A]">Your Cart is Currently Empty</h2>
              <p className="text-xs sm:text-sm text-[#73614C] leading-relaxed max-w-md mx-auto">
                Explore MMSR Publications peer-reviewed journals and academic books to add publications to your order.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Link href="/books">
                <Button variant="gold" size="lg" leftIcon={<BookOpen className="w-4 h-4 text-[#3E2A20]" />}>
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Cart Item List */}
            <div className="lg:col-span-8 space-y-6">
              <div className="p-6 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] space-y-4 shadow-md">
                <div className="flex items-center justify-between pb-4 border-b border-[#D4AC54] text-xs text-[#73614C]">
                  <span className="font-semibold text-[#2F241A]">Selected Items ({itemCount})</span>
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs text-red-700 border border-[#DC2626]/40 rounded-lg px-3 py-1 hover:bg-red-50 transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cart</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {items.map((item) => {
                    const unitPrice = item.salePrice ?? item.price;
                    const lineSubtotal = unitPrice * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-[#FFFDF8] border border-[#D4AC54] hover:border-[#C99A2E] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        {/* Cover Image / Icon */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="p-3 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] shrink-0 text-[#C99A2E]">
                            {item.itemType === 'book' ? (
                              <BookOpen className="w-6 h-6" />
                            ) : (
                              <Newspaper className="w-6 h-6 text-[#C99A2E]" />
                            )}
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[13px] font-bold uppercase tracking-wider text-[#C99A2E] bg-[#FFF2D9] px-2 py-0.5 rounded border border-[#D4AC54]">
                                {item.itemType === 'book' ? 'Book' : item.itemType === 'journal_issue' ? 'Journal Issue' : item.itemType === 'article' || item.id?.startsWith('art-') ? 'Article PDF' : 'Subscription'}
                              </span>
                              {item.formatLabel && (
                                <span className="text-[13px] font-semibold text-[#543D28] bg-[#F3E7D3] px-2 py-0.5 rounded border border-[#D4AC54]">
                                  {item.formatLabel}
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold font-playfair text-[#2F241A] line-clamp-2">
                              {item.title}
                            </h3>
                            {item.isbn && (
                              <span className="text-[13px] font-mono text-[#73614C] block">ISBN: {item.isbn}</span>
                            )}
                            {item.duration && (
                              <span className="text-[13px] text-[#73614C] block">Duration: {item.duration}</span>
                            )}
                          </div>
                        </div>

                        {/* Price, Stepper & Controls */}
                        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#D4AC54]">
                          {/* Quantity Stepper */}
                          <div className="flex items-center gap-2 bg-[#F8EEDC] border border-[#D4AC54] rounded-xl p-1">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="p-1 rounded-lg hover:bg-[#FFF2D9] text-[#73614C] hover:text-[#2F241A] transition-colors"
                              aria-label="Decrease Quantity"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-[#2F241A]">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="p-1 rounded-lg hover:bg-[#FFF2D9] text-[#73614C] hover:text-[#2F241A] transition-colors"
                              aria-label="Increase Quantity"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Unit & Line Price */}
                          <div className="text-right shrink-0">
                            <span className="text-xs font-bold text-[#C99A2E] font-playfair block">
                              ₹{lineSubtotal.toFixed(2)}
                            </span>
                            <span className="text-[13px] text-[#73614C] block font-mono">
                              (₹{unitPrice.toFixed(2)} each)
                            </span>
                          </div>

                          {/* Remove Trigger */}
                          <button
                            type="button"
                            onClick={() => setItemToRemove({ id: item.id, title: item.title })}
                            className="p-2 rounded-xl bg-red-50 border border-[#DC2626]/25 text-red-700 hover:bg-[#DC2626]/10 transition-colors shrink-0"
                            aria-label="Remove item from cart"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Shipping Info Banner */}
              <div className="p-4 rounded-[20px] bg-[#FFF9F1] border border-[#D4AC54] flex items-center gap-3 shadow-sm">
                <Truck className="w-5 h-5 text-[#C99A2E] shrink-0" />
                <p className="text-xs text-[#73614C]">
                                    <span className="font-semibold text-[#2F241A]">Flat ₹40 Shipping</span> — 50% off on standard delivery (originally ₹80). Applied automatically on all print / physical orders.
                </p>
              </div>
            </div>

            {/* Right Column: Order Summary Sticky Card */}
            <div className="lg:col-span-4 sticky top-28 space-y-6">
              <div className="p-6 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] space-y-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#C99A2E]/10 rounded-full blur-[70px] pointer-events-none" />

                <h2 className="text-base font-bold font-playfair text-[#2F241A] pb-3 border-b border-[#D4AC54]">
                  Order Summary
                </h2>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between text-[#73614C]">
                    <span>Items Subtotal</span>
                    <span className="font-semibold text-[#2F241A] font-mono">₹{subtotal.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between text-[#73614C]">
                    <span className="flex items-center gap-1">
                      Shipping
                      {hasPhysicalItems && (
                        <span className="text-[13px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded font-bold">50% OFF</span>
                      )}
                    </span>
                    {hasPhysicalItems ? (
                      <span className="flex items-center gap-1.5 font-semibold text-[#2F241A] font-mono">
                        <span className="line-through text-[#73614C] text-[13px]">₹{SHIPPING_ORIGINAL.toFixed(2)}</span>
                        ₹{SHIPPING_DISCOUNTED.toFixed(2)}
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-700">Free</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[#73614C]">
                    <span>Tax / GST</span>
                    <span className="font-semibold text-[#2F241A] font-mono">₹0.00 (0%)</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#D4AC54] flex items-center justify-between">
                  <span className="text-sm font-bold font-playfair text-[#2F241A]">Grand Total</span>
                  <span className="text-2xl font-bold font-playfair text-[#C99A2E]">₹{total.toFixed(2)}</span>
                </div>

                <Button
                  type="button"
                  variant="gold"
                  size="xl"
                  fullWidth
                  onClick={() => router.push('/checkout')}
                  rightIcon={<ArrowRight className="w-5 h-5 text-[#3E2A20]" />}
                >
                  Proceed to Checkout
                </Button>

                {/* Savings callout */}
                {hasPhysicalItems && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-emerald-700 text-center flex items-center justify-center gap-1.5">
                    <Tag className="w-4 h-4 shrink-0" />
                    <span>You save ₹{SHIPPING_ORIGINAL - SHIPPING_DISCOUNTED} on shipping with our 50% offer!</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Remove Confirmation Modal */}
      {itemToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2F241A]/50 backdrop-blur-md">
          <div className="p-6 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] max-w-sm w-full space-y-4 text-center shadow-xl">
            <Trash2 className="w-8 h-8 text-red-700 mx-auto" />
            <h3 className="text-base font-bold font-playfair text-[#2F241A]">Remove Item from Cart?</h3>
            <p className="text-xs text-[#73614C] line-clamp-2">"{itemToRemove.title}"</p>
            <div className="flex items-center gap-3 pt-2">
              <Button type="button" variant="outline" size="sm" fullWidth onClick={() => setItemToRemove(null)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" size="sm" fullWidth onClick={confirmRemoveItem}>
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
