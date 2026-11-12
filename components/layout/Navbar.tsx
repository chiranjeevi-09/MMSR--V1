'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  Award,
  BookMarked,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Trash2,
  Newspaper,
  Presentation,
  Plus,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/Button';
import { SiteLogo } from '@/components/ui/SiteLogo';
import dynamic from 'next/dynamic';
const GlobalSearchModal = dynamic(() => import('@/components/layout/GlobalSearchModal').then((m) => m.GlobalSearchModal), { ssr: false });
import { useAuth } from '@/lib/context/AuthContext';
import { useCart } from '@/lib/context/CartContext';
import { useWishlist } from '@/lib/context/WishlistContext';

interface NavDropdownItem {
  label: string;
  href: string;
  description?: string;
  icon?: React.ReactNode;
}

interface NavItem {
  label: string;
  href?: string;
  children?: NavDropdownItem[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/home' },
  { label: 'Books', href: '/books' },
  { label: 'Journals', href: '/journals' },
  { label: 'Conferences', href: '/conference' },
  {
    label: 'Publishing Services',
    href: '/services',
    children: [
      { label: 'Submit Manuscript', href: '/submit-manuscript', description: 'Online portal for journal papers & chapters', icon: <Sparkles className="w-4 h-4 text-gold-400" /> },
      { label: 'Publish Book Chapter', href: '/publish-chapter', description: 'Contribute a chapter to edited volume', icon: <BookMarked className="w-4 h-4 text-gold-400" /> },
      { label: 'Submit Conference Paper', href: '/submit-conference-paper', description: 'Present & publish at MMSR conferences', icon: <Presentation className="w-4 h-4 text-gold-400" /> },
      { label: 'All Publishing Services', href: '/services#all-services', description: 'Complete academic publishing service catalogue', icon: <BookOpen className="w-4 h-4 text-gold-400" /> },
      { label: 'DOI & ISBN Allocation', href: '/services#doi-isbn', description: 'Crossref registered DOIs and ISBNs', icon: <Award className="w-4 h-4 text-gold-400" /> },
      { label: 'Peer Review & Editing', href: '/services#peer-review', description: 'Rigorous peer review & formatting support', icon: <ShieldCheck className="w-4 h-4 text-gold-400" /> },
    ],
  },
  { label: 'Contact', href: '/contact' },
];

// Inserted into the main nav (before "Contact") for signed-in users only.
const LIBRARY_NAV_ITEM: NavItem = { label: 'Subscribed Library', href: '/dashboard/journals' };

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const { itemCount, subtotal, items, removeItem, updateQuantity, isMiniCartOpen, setIsMiniCartOpen, toast: cartToast, dismissToast: dismissCartToast } = useCart();
  const { wishlistCount, toast: wishlistToast, dismissToast: dismissWishlistToast } = useWishlist();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [expandedMobileMenu, setExpandedMobileMenu] = useState<string | null>(null);

  const mobileDrawerRef = useRef<HTMLDivElement>(null);
  const miniCartRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K Global Search Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll Listener for Sticky Glass Header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
    setActiveDropdown(null);
    setIsMiniCartOpen(false);
  }, [pathname, setIsMiniCartOpen]);

  // Handle ESC Key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileOpen(false);
        setActiveDropdown(null);
        setIsMiniCartOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsMiniCartOpen]);

  // Close the mini cart dropdown when clicking anywhere outside the cart box
  useEffect(() => {
    if (!isMiniCartOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (miniCartRef.current && !miniCartRef.current.contains(e.target as Node)) {
        setIsMiniCartOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMiniCartOpen, setIsMiniCartOpen]);

  const activeToast = cartToast || wishlistToast;
  const dismissActiveToast = () => {
    dismissCartToast();
    dismissWishlistToast();
  };

  const toggleMobileAccordion = (label: string) => {
    setExpandedMobileMenu(expandedMobileMenu === label ? null : label);
  };

  // For authenticated users, show "Subscribed Library" just before "Contact".
  const contactIndex = NAV_ITEMS.findIndex((i) => i.label === 'Contact');
  const navItems =
    isAuthenticated && contactIndex !== -1
      ? [...NAV_ITEMS.slice(0, contactIndex), LIBRARY_NAV_ITEM, ...NAV_ITEMS.slice(contactIndex)]
      : NAV_ITEMS;

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-40 h-[84px] transition-all duration-300 font-manrope',
          isScrolled
            ? 'bg-[#EEDBC0]/95 backdrop-blur-xl border-b border-[#D4AC54] shadow-sm'
            : 'bg-[#EEDBC0]/80 backdrop-blur-md border-b border-[#D4AC54]/60'
        )}
      >
        <div className="max-w-[1400px] h-full mx-auto px-4 sm:px-6 lg:px-3 xl:px-8 flex items-center justify-between">
          {/* LEFT SECTION — LOGO & TITLE */}
          <Link href="/home" className="flex items-center gap-3.5 group shrink-0 focus:outline-none" aria-label="MMSR Publications Home">
            <SiteLogo className="w-11 h-11 shadow-sm group-hover:scale-105 transition-transform duration-300" />
            <div className="flex items-center">
              <span className="text-lg sm:text-xl font-extrabold font-playfair tracking-tight text-[#5C4033] group-hover:text-[#C99A2E] transition-colors">
                MMSR
              </span>
            </div>
          </Link>

          {/* CENTER SECTION — DESKTOP NAVIGATION */}
          {/* flex-nowrap + tightened lg/xl padding/gap keep all nav buttons on ONE line even when "Subscribed Library" is shown */}
          <nav className="hidden lg:flex items-center flex-nowrap gap-0.5 xl:gap-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const hasChildren = Boolean(item.children && item.children.length > 0);
              const isActive = item.href
                ? pathname === item.href || (item.href !== '/home' && pathname.startsWith(item.href))
                : false;

              if (!hasChildren) {
                return (
                  <Link
                    key={item.label}
                    href={item.href || '/home'}
                    className={cn(
                      'px-2 lg:px-2.5 xl:px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200 relative whitespace-nowrap',
                      isActive
                        ? 'text-[#C99A2E] bg-[#C99A2E]/10 font-semibold border border-[#C99A2E]/30'
                        : 'text-[#6E5238] hover:text-[#C99A2E] hover:bg-[#FFF9F1]'
                    )}
                  >
                    {item.label}
                  </Link>
                );
              }

              return (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setActiveDropdown(item.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <Link
                    href={item.href || '/services'}
                    className={cn(
                      'px-2 lg:px-2.5 xl:px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 cursor-pointer whitespace-nowrap',
                      isActive || activeDropdown === item.label
                        ? 'text-[#C99A2E] bg-[#C99A2E]/10 font-semibold border border-[#C99A2E]/30'
                        : 'text-[#6E5238] hover:text-[#C99A2E] hover:bg-[#FFF9F1]'
                    )}
                    onFocus={() => setActiveDropdown(item.label)}
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      className={cn(
                        'w-3.5 h-3.5 text-[#8A6A4A] transition-transform duration-200',
                        activeDropdown === item.label && 'transform rotate-180 text-[#C99A2E]'
                      )}
                    />
                  </Link>

                  {/* Mega Dropdown Menu — pt-2 bridges the trigger/panel gap so hover never crosses a dead zone */}
                  {activeDropdown === item.label && (
                    <div className="absolute top-full left-0 pt-2 w-72 z-50">
                      <div className="bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl shadow-lg p-2 animate-scale-in">
                        <div className="flex flex-col gap-1">
                          {item.children?.map((child) => (
                            <Link
                              key={child.label}
                              href={child.href}
                              className="p-2.5 rounded-xl hover:bg-[#F8EEDC] transition-colors flex items-start gap-3 group"
                            >
                              {child.icon ? (
                                <div className="p-2 rounded-lg bg-[#C99A2E]/10 text-[#C99A2E] group-hover:scale-110 transition-transform">
                                  {child.icon}
                                </div>
                              ) : (
                                <div className="w-2 h-2 rounded-full bg-[#C99A2E] mt-2 shrink-0 group-hover:scale-150 transition-transform" />
                              )}
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-[#5C4033] group-hover:text-[#C99A2E] transition-colors">
                                  {child.label}
                                </span>
                                {child.description && (
                                  <span className="text-[13px] text-[#8A6A4A] leading-tight mt-0.5">
                                    {child.description}
                                  </span>
                                )}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* RIGHT SECTION — ACTIONS (flex-nowrap: icons/pill must never stack onto a second line) */}
          <div className="flex items-center flex-nowrap gap-1.5 sm:gap-3 relative">
            {/* Search Action */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="p-2 lg:p-1.5 xl:p-2.5 rounded-xl text-text-muted hover:text-gold-400 hover:bg-white/5 transition-colors relative"
              aria-label="Open Global Search"
              title="Global Search (Ctrl+K)"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Wishlist Button & Badge */}
            <Link
              href="/wishlist"
              className="p-2 lg:p-1.5 xl:p-2.5 rounded-xl text-[#8A6A4A] hover:text-[#C99A2E] hover:bg-[#FFF9F1] transition-colors relative flex items-center justify-center"
              aria-label={`Academic Wishlist (${wishlistCount} items)`}
              title="View Wishlist"
            >
              <Heart className="w-5 h-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#8C6239] text-[#C99A2E] font-bold text-[13px] flex items-center justify-center border border-[#C99A2E]/50 shadow-sm">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Shopping Cart Button & Badge */}
            <div className="relative" ref={miniCartRef}>
              <button
                type="button"
                onClick={() => setIsMiniCartOpen(!isMiniCartOpen)}
                className="p-2 lg:p-1.5 xl:p-2.5 rounded-xl text-[#8A6A4A] hover:text-[#C99A2E] hover:bg-[#FFF9F1] transition-colors relative flex items-center justify-center"
                aria-label={`Shopping Cart (${itemCount} items)`}
                aria-expanded={isMiniCartOpen}
                title="View Shopping Cart"
              >
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C99A2E] text-[#FFF9F1] font-bold text-[13px] flex items-center justify-center shadow-sm animate-pulse">
                    {itemCount}
                  </span>
                )}
              </button>

              {/* Polished Mini Cart Preview Dropdown */}
              {isMiniCartOpen && (
                <div
                  role="dialog"
                  aria-label="Mini cart preview"
                  className="absolute top-full right-0 mt-3 w-80 sm:w-96 bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl shadow-xl p-4 z-50 space-y-4 font-manrope animate-scale-in"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[#D4AC54]">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-[#C99A2E]" />
                      <span className="text-xs font-bold text-[#5C4033] font-playfair">Your Shopping Cart</span>
                    </div>
                    <span className="text-[13px] font-bold text-[#C99A2E] bg-[#C99A2E]/10 px-2.5 py-0.5 rounded-full border border-[#C99A2E]/30">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <ShoppingCart className="w-8 h-8 text-[#8A6A4A] mx-auto opacity-50" />
                      <p className="text-xs font-semibold text-[#5C4033]">Your cart is empty</p>
                      <p className="text-[13px] text-[#8A6A4A]">Explore books and journal issues to add publications.</p>
                      <Link
                        href="/books"
                        onClick={() => setIsMiniCartOpen(false)}
                        className="inline-block mt-2 text-xs font-bold text-[#C99A2E] hover:underline"
                      >
                        Browse Books Catalogue →
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* Scrollable List with Thumbnails & Controls */}
                      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="p-2 rounded-lg bg-[#FFF9F1] border border-[#D4AC54] shrink-0 text-[#C99A2E]">
                              {item.itemType === 'book' ? (
                                <BookOpen className="w-4 h-4" />
                              ) : (
                                <Newspaper className="w-4 h-4 text-[#8C6239]" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="font-semibold text-[#5C4033] line-clamp-1">{item.title}</p>
                              <div className="flex items-center gap-2 text-[13px] text-[#8A6A4A]">
                                <span>Qty: {item.quantity}</span>
                                <span>•</span>
                                <span>₹{(item.salePrice ?? item.price).toFixed(2)} each</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1 bg-[#FFF9F1] rounded-lg p-0.5 border border-[#D4AC54]">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="p-0.5 text-[#8A6A4A] hover:text-[#5C4033]"
                                  aria-label={`Decrease quantity of ${item.title}`}
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-4 text-center text-[13px] font-bold text-[#5C4033]">{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="p-0.5 text-[#8A6A4A] hover:text-[#5C4033]"
                                  aria-label={`Increase quantity of ${item.title}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeItem(item.id)}
                                className="p-1 rounded text-[#8A6A4A] hover:text-red-600"
                                title="Remove item"
                                aria-label={`Remove ${item.title} from cart`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-[#D4AC54] space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#8A6A4A]">Subtotal Amount</span>
                          <span className="font-bold text-[#C99A2E] text-sm font-playfair">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Link href="/cart" onClick={() => setIsMiniCartOpen(false)}>
                            <Button variant="outline" size="sm" fullWidth>
                              View Cart
                            </Button>
                          </Link>
                          <Link href="/checkout" onClick={() => setIsMiniCartOpen(false)}>
                            <Button variant="gold" size="sm" fullWidth>
                              Checkout
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Account / Sign In Dynamic Link */}
            {isAuthenticated && user ? (
              <Link
                href="/dashboard"
                className="hidden md:flex shrink-0 items-center gap-1 lg:gap-1.5 px-2 lg:px-2 xl:px-3.5 py-2 text-xs font-semibold text-[#C99A2E] bg-[#C99A2E]/10 hover:bg-[#C99A2E]/20 rounded-xl border border-[#C99A2E]/30 transition-all shadow-sm"
                aria-label="Author Dashboard"
              >
                <User className="w-4 h-4 shrink-0 text-[#C99A2E]" />
                {/* Hard-truncate to the first 10 characters + "..." (e.g.
                    "Chiranjeev...") so this button keeps a bounded size and the nav /
                    other header buttons don't shift as the name length changes. A
                    max-width (not a fixed width) lets the text hug its own size, so
                    there is no empty gap after shorter names. Full name on hover. */}
                <span className="max-w-[96px] xl:max-w-[110px] whitespace-nowrap overflow-hidden text-ellipsis" title={user.first_name || 'Dashboard'}>
                  {(() => { const n = user.first_name || 'Dashboard'; return n.length > 10 ? `${n.slice(0, 10)}...` : n; })()}
                </span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="hidden md:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#6E5238] hover:text-[#C99A2E] hover:bg-[#FFF9F1] rounded-xl border border-[#D4AC54] transition-all"
                aria-label="Sign In to Account"
              >
                <User className="w-4 h-4 text-[#C99A2E]" />
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              aria-expanded={isMobileOpen}
              aria-controls="mobile-menu-drawer"
              aria-label={isMobileOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
              className="lg:hidden p-2.5 rounded-xl text-[#5C4033] hover:text-[#C99A2E] hover:bg-[#FFF9F1] transition-colors cursor-pointer"
            >
              {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Animated Toast Banner */}
      {activeToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full p-4 rounded-2xl bg-[#F8EEDC] border border-gold-500/40 shadow-2xl flex items-start gap-3 animate-slide-up font-manrope">
          <div className="p-2 rounded-xl bg-gold-500/15 border border-[#D4AC54] text-gold-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            {activeToast.title && <h4 className="text-xs font-bold font-playfair text-ivory-white">{activeToast.title}</h4>}
            <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{activeToast.message}</p>
          </div>
          <button
            type="button"
            onClick={dismissActiveToast}
            className="p-1 text-text-muted hover:text-ivory-white"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MOBILE NAVIGATION DRAWER */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#5C4033]/40 backdrop-blur-md transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          <div
            id="mobile-menu-drawer"
            ref={mobileDrawerRef}
            className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-[#F1DFC3] border-r border-[#D4AC54] shadow-xl p-6 overflow-y-auto flex flex-col justify-between animate-slide-up z-10 font-manrope"
          >
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#D4AC54]">
                <div className="flex items-center gap-2.5">
                  <SiteLogo className="w-9 h-9" />
                  <span className="text-lg font-bold font-playfair text-[#5C4033]">
                    MMSR Publications
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 rounded-lg text-[#8A6A4A] hover:text-[#C99A2E] hover:bg-[#FFF9F1]"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Mobile Quick Links: Wishlist & Cart */}
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/wishlist"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F1] border border-[#D4AC54] text-xs font-bold text-[#8C6239]"
                >
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-4 h-4 text-[#C99A2E]" />
                    <span>Wishlist</span>
                  </div>
                  <span className="text-[#C99A2E]">{wishlistCount}</span>
                </Link>
                <Link
                  href="/cart"
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F1] border border-[#D4AC54] text-xs font-bold text-[#8C6239]"
                >
                  <div className="flex items-center gap-1.5">
                    <ShoppingCart className="w-4 h-4 text-[#C99A2E]" />
                    <span>Cart</span>
                  </div>
                  <span className="text-[#C99A2E]">{itemCount}</span>
                </Link>
              </div>

              {/* Mobile Search Bar */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileOpen(false);
                  setIsSearchOpen(true);
                }}
                className="w-full flex items-center gap-3 bg-[#FFF9F1] px-4 py-2.5 rounded-xl border border-[#D4AC54] text-xs text-[#8A6A4A] hover:border-[#C99A2E] transition-colors"
              >
                <Search className="w-4 h-4 text-[#C99A2E]" />
                <span>Search journals, books, articles...</span>
              </button>

              {/* Mobile Nav Links & Accordion */}
              <div className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const hasChildren = Boolean(item.children && item.children.length > 0);
                  const isExpanded = expandedMobileMenu === item.label;

                  if (!hasChildren) {
                    return (
                      <Link
                        key={item.label}
                        href={item.href || '#'}
                        onClick={() => setIsMobileOpen(false)}
                        className="px-4 py-3 rounded-xl text-sm font-medium text-[#5C4033] hover:text-[#C99A2E] hover:bg-[#FFF9F1] transition-colors"
                      >
                        {item.label}
                      </Link>
                    );
                  }

                  return (
                    <div key={item.label} className="flex flex-col">
                      <button
                        type="button"
                        onClick={() => toggleMobileAccordion(item.label)}
                        className="px-4 py-3 rounded-xl text-sm font-medium text-[#5C4033] hover:text-[#C99A2E] hover:bg-[#FFF9F1] flex items-center justify-between transition-colors"
                      >
                        <span>{item.label}</span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-[#8A6A4A] transition-transform duration-200',
                            isExpanded && 'transform rotate-180 text-[#C99A2E]'
                          )}
                        />
                      </button>

                      {/* Submenu uses pt-1/pb-1 (no margin) so there is no dead gap for the pointer to cross */}
                      {isExpanded && (
                        <div className="ml-4 pl-3 border-l border-[#C99A2E]/30 flex flex-col gap-1 pt-1 pb-1">
                          {item.children?.map((child) => (
                            <Link
                              key={child.label}
                              href={child.href}
                              onClick={() => setIsMobileOpen(false)}
                              className="px-3 py-2 text-xs text-[#8A6A4A] hover:text-[#C99A2E] hover:bg-[#FFF9F1] rounded-lg transition-colors flex items-center justify-between"
                            >
                              <span>{child.label}</span>
                              <ArrowRight className="w-3.5 h-3.5 text-[#C99A2E]" />
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Bottom CTA & Account Links */}
            <div className="pt-6 border-t border-[#D4AC54]/60 flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2 mt-1">
                {isAuthenticated && user ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setIsMobileOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gold-500/10 border border-[#D4AC54] text-xs font-semibold text-gold-400 hover:bg-gold-500/20 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-gold-400" />
                      <span>Dashboard</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMobileOpen(false);
                        logout();
                      }}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-xs font-semibold text-ruby-red hover:bg-white/10 transition-colors"
                    >
                      <span>Sign Out</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      onClick={() => setIsMobileOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-xs font-semibold text-ivory-white hover:text-gold-400 transition-colors"
                    >
                      <User className="w-3.5 h-3.5 text-gold-400" />
                      <span>Sign In</span>
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setIsMobileOpen(false)}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gold-500/10 border border-[#D4AC54] text-xs font-semibold text-gold-400 hover:bg-gold-500/20 transition-colors"
                    >
                      <span>Register</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Overlay Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
