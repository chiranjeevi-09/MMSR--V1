'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  BookOpen,
  Newspaper,
  ExternalLink,
  Search,
  Filter,
  ChevronDown,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { displayReference, routeIdOf } from '@/lib/utils/publicId';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  id: number;
  book: { id: number; title: string; cover_image?: string } | null;
  journal_issue: { id: number; title?: string; volume_number?: number; issue_number?: number; cover_image?: string } | null;
  journal_subscription: { id: number; title: string; cover_image?: string } | null;
  article?: { id: number; title?: string; journal?: number; cover_image?: string } | null;
  format?: 'digital' | 'print' | 'bundle';
  quantity: number;
  price: string;
}

interface Order {
  id: number;
  /** MMSR public ID (MMSR-ORD-1931-NNNNNN) — the customer-facing reference. */
  public_id?: string | null;
  custom_order_id: string | null;
  status: string;
  fulfillment_status?: 'not_required' | 'pending' | 'processing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled';
  courier_name?: string;
  tracking_number?: string;
  tracking_url?: string;
  dispatched_at?: string;
  delivered_at?: string;
  has_physical_items?: boolean;
  total_amount: string;
  created_at: string;
  updated_at: string;
  full_name: string;
  city: string;
  country: string;
  payment_method: string | null;
  transaction_id: string | null;
  invoice_pdf: string | null;
  items: OrderItem[];
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';
type FilterStatus = 'all' | 'pending' | 'paid' | 'delivered' | 'cancelled';
type SortOption = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatAmount(amount: string) {
  const num = parseFloat(amount);
  return isNaN(num) ? amount : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function getItemLabel(item: OrderItem): string {
  if (item.book) return item.book.title;
  if (item.journal_issue) {
    const ji = item.journal_issue;
    if (ji.title) return ji.title;
    return `Vol. ${ji.volume_number ?? '?'} Issue ${ji.issue_number ?? '?'}`;
  }
  if (item.journal_subscription) return `Subscription: ${item.journal_subscription.title}`;
  if (item.article?.title) return item.article.title;
  return 'Unknown Item';
}

function getItemType(item: OrderItem): string {
  if (item.book) return 'Book';
  if (item.journal_issue) return 'Journal Issue';
  if (item.journal_subscription) return 'Journal Subscription';
  if (item.article) return 'Journal Article';
  return 'Product';
}

function getItemCover(item: OrderItem): string | null {
  if (item.book?.cover_image) return item.book.cover_image;
  if (item.journal_issue?.cover_image) return item.journal_issue.cover_image;
  if (item.journal_subscription?.cover_image) return item.journal_subscription.cover_image;
  if (item.article?.cover_image) return item.article.cover_image;
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardOrdersPage() {
  const { tokens } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  // Filter & Search & Sort states
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const fetchOrders = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/commerce/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || data.detail || `Error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const data = await res.json();
      const rawList: Order[] = Array.isArray(data) ? data : data.results ?? [];
      // Only successful payments belong on this page — pending/unpaid orders are hidden
      const list = rawList.filter((order) => (order.status || '').toLowerCase() !== 'pending');
      setOrders(list);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load orders.');
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const toggleExpand = (id: number) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Filtered & Sorted orders computation
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        // Status Filter
        if (statusFilter !== 'all') {
          const normStatus = (order.status || '').toLowerCase();
          const ful = (order.fulfillment_status || 'not_required').toLowerCase();
          if (statusFilter === 'pending' && normStatus !== 'pending') return false;
          if (statusFilter === 'paid' && normStatus !== 'paid' && normStatus !== 'processing') return false;
          // Admin fulfillment page writes fulfillment_status — order.status stays 'paid'
          if (statusFilter === 'delivered' && normStatus !== 'delivered' && ful !== 'delivered') return false;
          if (statusFilter === 'cancelled' && normStatus !== 'cancelled') return false;
        }

        // Search Query
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const orderIdStr = displayReference(order, order.custom_order_id).toLowerCase();
          const txIdStr = (order.transaction_id || '').toLowerCase();
          const matchesId = orderIdStr.includes(q) || txIdStr.includes(q);

          const matchesItems = order.items.some((item) => {
            const title = getItemLabel(item).toLowerCase();
            return title.includes(q);
          });

          if (!matchesId && !matchesItems) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (sortBy === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === 'amount_desc') {
          return parseFloat(b.total_amount || '0') - parseFloat(a.total_amount || '0');
        }
        if (sortBy === 'amount_asc') {
          return parseFloat(a.total_amount || '0') - parseFloat(b.total_amount || '0');
        }
        return 0;
      });
  }, [orders, statusFilter, searchQuery, sortBy]);

  return (
    <DashboardLayout
      title="My Orders"
      subtitle="View your MMSR Publications book, journal, and academic subscription history."
    >
      {/* Search, Filter & Sort Controls */}
      <div className="space-y-4">
        {/* Top Controls Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Book Title, Journal, or Transaction ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#F8EEDC] border border-[#D4AC54]/60 rounded-xl pl-10 pr-4 py-2.5 text-xs text-ivory-white placeholder-text-muted/60 focus:outline-none focus:border-gold-500/50 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-ivory-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Sort Dropdown & Refresh */}
          <div className="flex items-center gap-3 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort orders by"
              className="bg-[#FFF9F1] border border-[#D4AC54] rounded-xl px-3 py-2 text-xs font-medium text-[#2F241A] focus:outline-none focus:border-[#C99A2E] cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchOrders}
              isLoading={fetchState === 'loading'}
              leftIcon={fetchState !== 'loading' ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Orders' },
            { id: 'paid', label: 'Paid & Verified' },
            { id: 'delivered', label: 'Delivered' },
            { id: 'cancelled', label: 'Cancelled' },
          ].map((pill) => {
            const isActive = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id as FilterStatus)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                  isActive
                    ? 'bg-gold-500 text-navy-950 border-gold-500 font-bold shadow-gold-glow'
                    : 'bg-[#F8EEDC] text-text-muted border-[#D4AC54]/60 hover:border-[#D4AC54] hover:text-ivory-white'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Count Bar */}
      <div className="flex items-center justify-between text-xs text-text-muted pt-2">
        <span>
          Showing <strong className="text-ivory-white">{filteredOrders.length}</strong> of {orders.length} orders
        </span>
        {(statusFilter !== 'all' || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="text-gold-400 hover:underline text-[13px]"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Loading State */}
      {fetchState === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-text-muted">Loading order records...</p>
        </div>
      )}

      {/* Error State */}
      {fetchState === 'error' && (
        <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
          <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-ivory-white">Could Not Load Orders</p>
          <p className="text-xs text-text-muted">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={fetchOrders}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {fetchState === 'success' && filteredOrders.length === 0 && (
        <div className="p-10 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-center space-y-4">
          <div className="p-4 rounded-full bg-gold-500/8 border border-[#D4AC54] w-fit mx-auto">
            <ShoppingBag className="w-8 h-8 text-gold-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold font-playfair text-ivory-white">No Orders Found</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              {searchQuery || statusFilter !== 'all'
                ? 'No orders matched your active search filters. Try adjusting your query or resetting filters.'
                : 'Your book and journal purchase history will appear here once you place an order.'}
            </p>
          </div>
        </div>
      )}

      {/* Orders List with Cards */}
      {fetchState === 'success' && filteredOrders.length > 0 && (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isExpanded = expandedOrders.has(order.id);
            const orderId = displayReference(order, order.custom_order_id);
            const firstItem = order.items[0];
            const coverUrl = firstItem ? getItemCover(firstItem) : null;
            const itemCount = order.items.reduce((acc, it) => acc + (it.quantity || 1), 0);

            // Derived Delivery / Fulfillment Status
            const isPhysical = order.has_physical_items || order.items.some(it => it.format === 'print' || it.format === 'bundle');
            let deliveryStatus = 'Digital Delivery';
            if (isPhysical) {
              if (order.status.toLowerCase() === 'cancelled') {
                deliveryStatus = 'Cancelled';
              } else if (order.status.toLowerCase() !== 'paid') {
                deliveryStatus = 'Payment Pending';
              } else {
                switch (order.fulfillment_status) {
                  case 'delivered':
                    deliveryStatus = 'Delivered';
                    break;
                  case 'dispatched':
                    deliveryStatus = order.courier_name ? `Dispatched (${order.courier_name})` : 'Dispatched (In Transit)';
                    break;
                  case 'packed':
                    deliveryStatus = 'Packed & Ready';
                    break;
                  case 'processing':
                    deliveryStatus = 'Processing Shipment';
                    break;
                  case 'cancelled':
                    deliveryStatus = 'Fulfillment Cancelled';
                    break;
                  case 'pending':
                  default:
                    deliveryStatus = 'Awaiting Dispatch';
                    break;
                }
              }
            }

            return (
              <div
                key={order.id}
                className="rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-all overflow-hidden"
              >
                {/* Order Main Card Header */}
                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Section: Thumbnail & Order Info */}
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Cover Thumbnail */}
                    <div className="w-14 h-16 rounded-xl bg-white/5 border border-[#D4AC54]/60 shrink-0 overflow-hidden relative flex items-center justify-center">
                      {coverUrl ? (
                        <Image
                          src={coverUrl}
                          alt={firstItem ? getItemLabel(firstItem) : 'Publication cover'}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-2 text-center">
                          <BookOpen className="w-5 h-5 text-gold-400" />
                          <span className="text-[12px] text-text-muted mt-0.5 font-medium">{itemCount} items</span>
                        </div>
                      )}
                    </div>

                    {/* Meta Details */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-ivory-white">{orderId}</span>
                        <OrderStatusBadge status={order.status} size="sm" />
                      </div>

                      {/* Items Preview Title */}
                      <p className="text-xs font-semibold text-ivory-white font-playfair line-clamp-1">
                        {firstItem ? getItemLabel(firstItem) : 'Academic Order'}
                        {order.items.length > 1 && (
                          <span className="text-text-muted font-sans font-normal ml-1">
                            +{order.items.length - 1} more
                          </span>
                        )}
                      </p>

                      {/* Quick Meta Stats Row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gold-400" />
                          {formatDate(order.created_at)}
                        </span>
                        <span>
                          Items: <strong className="text-ivory-white">{itemCount}</strong>
                        </span>
                        <span>
                          Payment:{' '}
                          <strong className="text-ivory-white capitalize">
                            {order.payment_method || (order.status.toLowerCase() === 'paid' ? 'Verified' : 'Pending')}
                          </strong>
                        </span>
                        <span className="text-gold-300/90 font-medium">
                          Delivery: {deliveryStatus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Price & Action Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-[#D4AC54]/40">
                    <div className="text-left md:text-right pr-2">
                      <p className="text-[13px] text-text-muted uppercase tracking-wider font-semibold">Total Amount</p>
                      <p className="text-base font-bold text-gold-400 font-playfair">{formatAmount(order.total_amount)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.status.toLowerCase() === 'pending' && (
                        <Link
                          href={`/payment/processing/${routeIdOf(order)}`}
                          className="px-3 py-2 rounded-xl bg-gold-500 text-navy-950 font-bold hover:bg-gold-400 transition-all text-xs flex items-center gap-1.5 shadow-gold-glow"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Pay Now</span>
                        </Link>
                      )}

                      <Link
                        href={`/dashboard/orders/${routeIdOf(order)}`}
                        className="px-3 py-2 rounded-xl bg-gold-500/10 border border-[#D4AC54] hover:bg-gold-500/20 text-gold-400 transition-all text-xs font-bold flex items-center gap-1"
                      >
                        <span>Details</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      <button
                        type="button"
                        onClick={() => toggleExpand(order.id)}
                        className="p-2 rounded-xl bg-white/5 border border-[#D4AC54]/60 hover:border-[#D4AC54] text-text-muted hover:text-ivory-white transition-all text-xs flex items-center gap-1"
                        aria-expanded={isExpanded}
                        aria-label={`Toggle items for order ${orderId}`}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-gold-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expandable Animation Container */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-[#D4AC54]/60 bg-navy-950/50 px-5 py-4 space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-gold-400 font-playfair">
                          Order Itemization ({order.items.length})
                        </span>
                        <span className="text-[13px] text-text-muted font-mono">
                          TxID: {order.transaction_id || 'N/A'}
                        </span>
                      </div>

                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60"
                        >
                          <div className="w-10 h-12 rounded bg-[#F8EEDC] border border-[#D4AC54]/60 shrink-0 overflow-hidden relative flex items-center justify-center">
                            {getItemCover(item) ? (
                              <Image
                                src={getItemCover(item)!}
                                alt={getItemLabel(item)}
                                fill
                                className="object-cover"
                              />
                            ) : item.book ? (
                              <BookOpen className="w-4 h-4 text-gold-400" />
                            ) : (
                              <Newspaper className="w-4 h-4 text-gold-400" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-xs font-semibold text-ivory-white line-clamp-1">{getItemLabel(item)}</p>
                              {item.format === 'bundle' ? (
                                <span className="px-1.5 py-0.5 rounded text-[12px] font-semibold bg-[#8C6B1B]/15 border border-[#8C6B1B]/30 text-[#8C6B1B]">
                                  Print + Digital Bundle
                                </span>
                              ) : item.format === 'print' ? (
                                <span className="px-1.5 py-0.5 rounded text-[12px] font-semibold bg-[#C99A2E]/15 border border-[#D4AC54]/40 text-[#8C6B1B]">
                                  Printed Issue / Book
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[12px] font-medium bg-white/5 border border-white/10 text-text-muted">
                                  Digital (PDF)
                                </span>
                              )}
                            </div>
                            <p className="text-[13px] text-text-muted mt-0.5">
                              {getItemType(item)} · Qty: <strong className="text-ivory-white">{item.quantity}</strong>
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-gold-400">
                              ₹{parseFloat(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
