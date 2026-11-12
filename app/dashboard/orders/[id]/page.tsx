'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  Newspaper,
  FileText,
  Download,
  ExternalLink,
  User,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Building,
  ShieldCheck,
  Copy,
  Check,
  Printer,
  Eye,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { PublicId } from '@/components/ui/PublicId';
import { downloadOrderInvoice, openProtectedFile } from '@/lib/services/protectedFiles';
import { displayReference, isPublicId, routeIdOf } from '@/lib/utils/publicId';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface OrderItem {
  id: number;
  /** MMSR public ID of the line item (MMSR-ORI-1931-NNNNNN). */
  public_id?: string | null;
  book?: { id: number; title: string; cover_image?: string; isbn?: string; slug?: string; public_id?: string | null } | null;
  journal_issue?: { id: number; title?: string; volume_number?: number; issue_number?: number; cover_image?: string; issn?: string; slug?: string } | null;
  journal_subscription?: { id: number; title: string; cover_image?: string; issn?: string; slug?: string } | null;
  article?: { id: number; title?: string; slug?: string; journal?: number; cover_image?: string } | null;
  format?: 'digital' | 'print' | 'bundle';
  quantity: number;
  price: string;
}

interface OrderDetail {
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
  fulfillment_notes?: string;
  has_physical_items?: boolean;
  total_amount: string;
  created_at: string;
  updated_at: string;
  full_name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  address?: string;
  shipping_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  payment_method?: string | null;
  transaction_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  invoice_pdf?: string | null;
  items: OrderItem[];
}

type FetchState = 'idle' | 'loading' | 'success' | 'error' | 'not_found' | 'unauthorized';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(amount?: string) {
  if (!amount) return '₹0.00';
  const num = parseFloat(amount);
  return isNaN(num) ? amount : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function getItemTitle(item: OrderItem): string {
  if (item.book) return item.book.title;
  if (item.journal_issue) {
    if (item.journal_issue.title) return item.journal_issue.title;
    return `Journal Issue — Vol. ${item.journal_issue.volume_number ?? '?'} Issue ${item.journal_issue.issue_number ?? '?'}`;
  }
  if (item.journal_subscription) return `Subscription: ${item.journal_subscription.title}`;
  if (item.article?.title) return item.article.title;
  return 'Publication Item';
}

function getItemCategory(item: OrderItem): string {
  if (item.book) return 'Book / Monograph';
  if (item.journal_issue) return 'Journal Issue';
  if (item.journal_subscription) return 'Journal Subscription';
  if (item.article) return 'Journal Article';
  return 'Publication';
}

function getItemIsbnIssn(item: OrderItem): string {
  if (item.book?.isbn) return `ISBN: ${item.book.isbn}`;
  if (item.journal_issue?.issn) return `ISSN: ${item.journal_issue.issn}`;
  if (item.journal_subscription?.issn) return `ISSN: ${item.journal_subscription.issn}`;
  if (item.article) return 'Journal Article Purchase';
  return 'ISBN / ISSN: Recorded';
}

function getItemCover(item: OrderItem): string | null {
  if (item.book?.cover_image) return item.book.cover_image;
  if (item.journal_issue?.cover_image) return item.journal_issue.cover_image;
  if (item.journal_subscription?.cover_image) return item.journal_subscription.cover_image;
  if (item.article?.cover_image) return item.article.cover_image;
  return null;
}

function getItemLink(item: OrderItem): string {
  if (item.book) return `/books/${item.book.id}`;
  if (item.journal_issue) return `/journals/${item.journal_issue.id}`;
  if (item.journal_subscription) return `/journals/${item.journal_subscription.id}`;
  if (item.article?.slug) return `/articles/${item.article.slug}`;
  return '/books';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrderDetailsPage() {
  const params = useParams();
  const { tokens } = useAuth();
  const orderIdParam = params?.id as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // Invoice PDFs moved off the public /media route, so both the "view" and
  // "download" actions fetch the authorised endpoint with the buyer's bearer
  // token and hand the browser a blob (SECURITY-QA-REPORT C-1).
  const [invoiceBusy, setInvoiceBusy] = useState<'view' | 'download' | null>(null);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const handleInvoice = async (mode: 'view' | 'download') => {
    setInvoiceBusy(mode);
    setInvoiceError(null);
    try {
      if (mode === 'view') {
        await openProtectedFile(order?.invoice_pdf, tokens?.access || '');
      } else {
        await downloadOrderInvoice(order?.invoice_pdf, tokens?.access || '', orderIdParam);
      }
    } catch (err: any) {
      setInvoiceError(err?.message || 'The invoice could not be opened. Please try again.');
    } finally {
      setInvoiceBusy(null);
    }
  };

  const copyTracking = (num?: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedTracking(true);
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const fetchOrderDetails = useCallback(async () => {
    if (!tokens?.access || !orderIdParam) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/commerce/${orderIdParam}/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      if (res.status === 404) {
        setFetchState('not_found');
        return;
      }

      if (res.status === 403 || res.status === 401) {
        setFetchState('unauthorized');
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || data.detail || `Error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const data: OrderDetail = await res.json();
      setOrder(data);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to fetch order details.');
      setFetchState('error');
    }
  }, [tokens?.access, orderIdParam]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  const copyAddress = () => {
    if (!order) return;
    // Full delivery address only (no recipient name). The street line lives in
    // shipping_address on the backend; the legacy "address" key is often empty,
    // so fall back between the two. State was previously missing from the copy.
    const parts = [
      order.address || order.shipping_address,
      order.city,
      order.state,
      order.postal_code,
      order.country,
      (order.phone_number || order.phone) ? `Phone: ${order.phone_number || order.phone}` : null,
    ].filter(Boolean);
    navigator.clipboard.writeText(parts.join('\n'));
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const displayOrderId = displayReference(order, order?.custom_order_id);
  const statusNorm = (order?.status || '').toLowerCase();
  const isCancelled = statusNorm === 'cancelled';
  const isPhysical = Boolean(order?.has_physical_items || (order?.items && order.items.some(it => it.format === 'print' || it.format === 'bundle')));
  const fStatus = order?.fulfillment_status || 'not_required';

  // Canonical logistics flags shared by every timeline & badge on this page so they
  // never contradict each other or the admin Fulfillment desk.
  // The operational STAGE is the only source of truth (fulfillment_status written by
  // the admin fulfillment desk, advanced further by order.status). dispatched_at /
  // delivered_at are audit history and must never be used as evidence of a stage —
  // a stale delivered_at should not show "Delivered" while admin says "Dispatched".
  // Completion is monotonic: delivered ⇒ dispatched ⇒ packed.
  const FULFILLMENT_STAGES = ['not_required', 'pending', 'processing', 'packed', 'dispatched', 'delivered'];
  const stageRank = fStatus === 'cancelled' ? -1 : Math.max(0, FULFILLMENT_STAGES.indexOf(fStatus));
  const statusRank = statusNorm === 'delivered' ? 5 : statusNorm === 'shipped' ? 4 : 0;
  const logisticsRank = Math.max(stageRank, statusRank);
  const hasPaidStatus = ['paid', 'processing', 'shipped', 'delivered', 'completed'].includes(statusNorm);
  const isDelivered = logisticsRank >= 5;
  const isDispatched = logisticsRank >= 4;
  const isPacked = logisticsRank >= 3;

  // Subtotal Math
  const itemsSubtotal = order?.items
    ? order.items.reduce((acc, it) => acc + (parseFloat(it.price || '0') * (it.quantity || 1)), 0)
    : 0;

  return (
    <DashboardLayout
      title={`Order ${displayOrderId}`}
      subtitle="View itemized breakdown, tax invoice, shipping details, and transaction timeline."
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gold-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Orders</span>
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchOrderDetails}
          isLoading={fetchState === 'loading'}
          leftIcon={fetchState !== 'loading' ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
        >
          Refresh Details
        </Button>
      </div>

      {/* Loading Skeleton */}
      {fetchState === 'loading' && (
        <div className="space-y-6 animate-pulse">
          <div className="h-32 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
            <div className="h-48 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
          </div>
          <div className="h-40 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
        </div>
      )}

      {/* 404 State */}
      {fetchState === 'not_found' && (
        <div className="p-10 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-center space-y-4">
          <div className="p-4 rounded-full bg-[#C99A2E]/10 border border-[#D4AC54]/40 w-fit mx-auto">
            <ShoppingBag className="w-8 h-8 text-[#C99A2E]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-playfair text-ivory-white">Order Not Found</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              {isPublicId(orderIdParam)
                ? `Order ${orderIdParam} could not be located. Please check the order number or return to your order list.`
                : 'This order could not be located. Please check the order number or return to your order list.'}
            </p>
          </div>
          <Link href="/dashboard/orders">
            <Button type="button" variant="gold" size="sm">
              Return to Orders List
            </Button>
          </Link>
        </div>
      )}

      {/* Unauthorized State */}
      {fetchState === 'unauthorized' && (
        <div className="p-10 rounded-2xl bg-[#F8EEDC] border border-red-500/20 text-center space-y-4">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 w-fit mx-auto">
            <ShieldCheck className="w-8 h-8 text-[#DC2626]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-playfair text-ivory-white">Access Denied</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              You do not have authorization to view this order record.
            </p>
          </div>
          <Link href="/dashboard/orders">
            <Button type="button" variant="outline" size="sm">
              Back to My Orders
            </Button>
          </Link>
        </div>
      )}

      {/* Generic Error State */}
      {fetchState === 'error' && (
        <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
          <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-ivory-white">Unable to Load Order Details</p>
          <p className="text-xs text-text-muted">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={fetchOrderDetails}>
            Retry Request
          </Button>
        </div>
      )}

      {/* Main Order Details View */}
      {fetchState === 'success' && order && (
        <div className="space-y-6 print:space-y-4">
          {/* Header Hero Card */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/5 rounded-full blur-[80px] pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <PublicId value={order.public_id} legacy={order.custom_order_id} label="Order ID" size="md" />
                  <OrderStatusBadge status={order.status} size="md" />
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-text-muted pt-1">
                  <span>Ordered on: <strong className="text-ivory-white font-medium">{formatDate(order.created_at)}</strong></span>
                  <span>Last Updated: <strong className="text-ivory-white font-medium">{formatDate(order.updated_at)}</strong></span>
                </div>
              </div>

              {/* Total & Action */}
              <div className="flex items-center gap-4">
                <div className="text-left md:text-right p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 min-w-[180px]">
                  <p className="text-xs text-text-muted">Total Order Value</p>
                  <p className="text-2xl font-bold text-gold-400 font-playfair">{formatAmount(order.total_amount)}</p>
                </div>
                {order.status.toLowerCase() === 'pending' && (
                  <Link
                    href={`/payment/processing/${routeIdOf(order)}`}
                    className="px-4 py-3 rounded-xl bg-gold-500 text-navy-950 font-bold hover:bg-gold-400 transition-all text-xs flex items-center gap-2 shadow-gold-glow shrink-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Complete Payment</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* TASK 4 — Luxury Vertical Timeline */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-5">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gold-400" /> Fulfillment & Payment Timeline
            </h3>

            {isCancelled ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[#DC2626] text-xs flex items-center gap-3">
                <XCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
                <div>
                  <strong className="block text-[#DC2626] font-bold">Order Cancelled</strong>
                  <span>This transaction was cancelled. If you believe this is an error, please contact finance support.</span>
                </div>
              </div>
            ) : isPhysical ? (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {[
                  {
                    stage: 'Order Created',
                    desc: `Order received and logged under reference ${displayOrderId}`,
                    date: formatDate(order.created_at),
                    isDone: true,
                    icon: ShoppingBag,
                  },
                  {
                    stage: 'Payment Completed',
                    desc: order.transaction_id
                      ? `Verified via Razorpay / Direct Gateway (TxID: ${order.transaction_id})`
                      : statusNorm === 'pending'
                      ? 'Waiting for payment confirmation'
                      : 'Payment completed successfully',
                    date: hasPaidStatus ? formatDate(order.updated_at) : 'Pending',
                    isDone: hasPaidStatus,
                    icon: CheckCircle2,
                  },
                  {
                    stage: 'Invoice Generated',
                    desc: order.invoice_pdf ? 'Official GST Tax Invoice ready for download' : 'Tax invoice generated upon payment clearance',
                    date: order.invoice_pdf ? 'Available' : 'Pending Clearance',
                    isDone: !!order.invoice_pdf || hasPaidStatus,
                    icon: FileText,
                  },
                  {
                    stage: 'Packing & Preparation',
                    desc: 'Warehouse allocating physical copies and preparing parcel packaging',
                    date: isPacked
                      ? 'Packed & Ready'
                      : fStatus === 'processing' || statusNorm === 'processing'
                      ? 'In Progress'
                      : 'Queued',
                    isDone: isPacked,
                    icon: Package,
                  },
                  {
                    stage: 'Courier Handover & Dispatch',
                    desc: order.courier_name
                      ? `Consignment handed to ${order.courier_name}${order.tracking_number ? ` (AWB: ${order.tracking_number})` : ''}`
                      : 'Consignment dispatched via institutional courier',
                    date: isDispatched
                      ? order.dispatched_at
                        ? formatDate(order.dispatched_at)
                        : 'Dispatched'
                      : 'Pending Dispatch',
                    isDone: isDispatched,
                    icon: Truck,
                  },
                  {
                    stage: 'Consignment Delivered',
                    desc: 'Physical shipment safely delivered to customer shipping address',
                    date: isDelivered
                      ? order.delivered_at
                        ? formatDate(order.delivered_at)
                        : 'Delivered'
                      : 'Pending Delivery',
                    isDone: isDelivered,
                    icon: CheckCircle2,
                  },
                ].map((step, idx) => {
                  const IconComp = step.icon;
                  return (
                    <div key={idx} className="relative flex items-start gap-4 group">
                      <div
                        className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] z-10 transition-all ${
                          step.isDone
                            ? 'bg-[#C99A2E] border-[#C99A2E] text-white shadow-sm'
                            : 'bg-[#FFF9F1] border-[#D4AC54]/60 text-text-muted'
                        }`}
                      >
                        {step.isDone ? (
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#73614C]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 bg-white/5 border border-[#D4AC54]/60 rounded-xl p-3.5 space-y-1 hover:border-[#D4AC54] transition-all">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className={`text-xs font-bold ${step.isDone ? 'text-ivory-white' : 'text-text-muted'}`}>
                            {step.stage}
                          </h4>
                          <span className="text-[10px] font-mono text-gold-400/90">{step.date}</span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                {[
                  {
                    stage: 'Order Created',
                    desc: `Digital order created under reference ${displayOrderId}`,
                    date: formatDate(order.created_at),
                    isDone: true,
                    icon: ShoppingBag,
                  },
                  {
                    stage: 'Payment Completed',
                    desc: order.transaction_id
                      ? `Verified via Razorpay / Direct Gateway (TxID: ${order.transaction_id})`
                      : statusNorm === 'pending'
                      ? 'Waiting for payment confirmation'
                      : 'Payment completed successfully',
                    date: hasPaidStatus ? formatDate(order.updated_at) : 'Pending',
                    isDone: hasPaidStatus,
                    icon: CheckCircle2,
                  },
                  {
                    stage: 'Invoice Generated',
                    desc: order.invoice_pdf ? 'Official GST Tax Invoice ready for download' : 'Tax invoice generated upon payment clearance',
                    date: order.invoice_pdf ? 'Available' : 'Pending Clearance',
                    isDone: !!order.invoice_pdf || hasPaidStatus,
                    icon: FileText,
                  },
                  {
                    stage: 'Digital Access Granted',
                    desc: 'Digital PDF publications, chapters, and reader permissions unlocked immediately',
                    date: hasPaidStatus ? formatDate(order.updated_at) : 'Queued for Payment',
                    isDone: hasPaidStatus,
                    icon: Sparkles,
                  },
                ].map((step, idx) => {
                  const IconComp = step.icon;
                  return (
                    <div key={idx} className="relative flex items-start gap-4 group">
                      <div
                        className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] z-10 transition-all ${
                          step.isDone
                            ? 'bg-[#C99A2E] border-[#C99A2E] text-white shadow-sm'
                            : 'bg-[#FFF9F1] border-[#D4AC54]/60 text-text-muted'
                        }`}
                      >
                        {step.isDone ? (
                          <Check className="w-3 h-3 text-white stroke-[3]" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#73614C]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 bg-white/5 border border-[#D4AC54]/60 rounded-xl p-3.5 space-y-1 hover:border-[#D4AC54] transition-all">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className={`text-xs font-bold ${step.isDone ? 'text-ivory-white' : 'text-text-muted'}`}>
                            {step.stage}
                          </h4>
                          <span className="text-[10px] font-mono text-gold-400/90">{step.date}</span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grid: Shipping & Payment Cards (Task 4) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TASK 4 — Shipping / Consignment Card */}
            {isPhysical ? (
              <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Physical Shipping & Tracking
                    </h3>
                    <div className="flex items-center gap-2">
                      {isDelivered ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          Delivered
                        </span>
                      ) : isDispatched ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#C99A2E]/15 border border-[#D4AC54]/40 text-[#8C6B1B]">
                          In Transit
                        </span>
                      ) : isPacked ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#C99A2E]/15 border border-[#D4AC54]/40 text-[#8C6B1B]">
                          Packed & Ready
                        </span>
                      ) : fStatus === 'processing' || statusNorm === 'processing' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#C99A2E]/15 border border-[#D4AC54]/40 text-[#8C6B1B]">
                          Processing
                        </span>
                      ) : fStatus === 'cancelled' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/15 border border-red-500/30 text-[#DC2626]">
                          Cancelled
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/5 border border-[#D4AC54]/40 text-[#73614C]">
                          Awaiting Dispatch
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={copyAddress}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-[#D4AC54]/60 hover:border-[#D4AC54] text-[11px] text-gold-400 font-semibold transition-all"
                        title="Copy full shipping address"
                      >
                        {copiedAddress ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Address</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs pt-1">
                    {order.full_name && (
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-text-muted block text-[10px]">Recipient Name</span>
                          <span className="font-semibold text-ivory-white">{order.full_name}</span>
                        </div>
                      </div>
                    )}

                    {(order.phone || order.phone_number) && (
                      <div className="flex items-start gap-3">
                        <Phone className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-text-muted block text-[10px]">Contact Number</span>
                          <span className="text-ivory-white">{order.phone || order.phone_number}</span>
                        </div>
                      </div>
                    )}

                    {(order.address || order.shipping_address || order.city || order.country) && (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-text-muted block text-[10px]">Delivery Address</span>
                          <p className="text-ivory-white leading-relaxed font-medium">
                            {[order.address || order.shipping_address, order.city, order.state, order.postal_code, order.country]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted text-[11px]">Courier Partner:</span>
                      <strong className="text-ivory-white font-medium">
                        {order.courier_name || 'Assigned upon dispatch'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-text-muted text-[11px]">Tracking Reference:</span>
                      {order.tracking_number ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <strong className="text-gold-400 font-bold">{order.tracking_number}</strong>
                          <button
                            type="button"
                            onClick={() => copyTracking(order.tracking_number)}
                            className="p-1 rounded hover:bg-white/10 text-text-muted hover:text-ivory-white transition-colors"
                            title="Copy tracking number"
                          >
                            {copiedTracking ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-gold-400" />
                            )}
                          </button>
                          {order.tracking_url && (
                            <a
                              href={order.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded hover:bg-white/10 text-gold-400 hover:text-gold-300 transition-colors inline-flex items-center"
                              title="Open courier tracking page"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted text-[11px] italic">Generated upon dispatch</span>
                      )}
                    </div>

                    {order.dispatched_at && isDispatched && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted text-[11px]">Dispatched On:</span>
                        <span className="text-ivory-white text-[11px]">{formatDate(order.dispatched_at)}</span>
                      </div>
                    )}

                    {isDelivered && order.delivered_at && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted text-[11px]">Delivered On:</span>
                        <span className="text-emerald-400 font-semibold text-[11px]">{formatDate(order.delivered_at)}</span>
                      </div>
                    )}
                  </div>

                  {!isDispatched && (
                    <div className="p-3 rounded-xl bg-[#C99A2E]/10 border border-[#D4AC54]/40 text-[11px] text-[#5C4033] leading-relaxed flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-[#C99A2E] shrink-0 mt-0.5" />
                      <div>
                        <strong className="block text-[#8C6B1B] font-bold mb-0.5">Order In Preparation</strong>
                        <span>
                          Your physical publication is being carefully printed and packaged at our facility. Courier partner and tracking reference will appear here as soon as the consignment is dispatched.
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#D4AC54]/60 text-[10px] text-text-muted flex items-center justify-between">
                  <span>Fulfillment Type: Physical Consignment</span>
                  <span className="text-gold-400 font-semibold">Institutional Courier</span>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> Digital Access & Delivery
                    </h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      Instant Access
                    </span>
                  </div>

                  <div className="space-y-3 text-xs pt-1">
                    <div className="flex items-start gap-3">
                      <Mail className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-text-muted block text-[10px]">Authorized Subscriber Account</span>
                        <span className="font-semibold text-ivory-white">{order.email || 'Subscriber Email'}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-[11px] text-text-muted leading-relaxed">
                      This order consists exclusively of digital publications. Digital PDF downloads and online journal viewing rights are linked to your account immediately upon payment clearance. No physical delivery is required.
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#D4AC54]/60 text-[10px] text-text-muted flex items-center justify-between">
                  <span>Fulfillment Type: Digital Instant Access</span>
                  <span className="text-emerald-400 font-semibold">Unlocked Online</span>
                </div>
              </div>
            )}

            {/* TASK 4 — Payment Details Card */}
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> Payment Breakdown
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-1">
                    <span className="text-text-muted block text-[10px]">Payment Method</span>
                    <span className="font-semibold text-ivory-white capitalize">
                      {order.payment_method || 'Razorpay / Online'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-1">
                    <span className="text-text-muted block text-[10px]">Verification Status</span>
                    <span
                      className={`font-semibold capitalize ${
                        hasPaidStatus
                          ? 'text-emerald-400'
                          : statusNorm === 'cancelled'
                          ? 'text-[#DC2626]'
                          : 'text-[#8C6B1B]'
                      }`}
                    >
                      {hasPaidStatus ? 'Verified' : statusNorm}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-1 sm:col-span-2">
                    <span className="text-text-muted block text-[10px]">Transaction ID</span>
                    <span className="font-mono font-semibold text-gold-400 text-xs break-all">
                      {order.transaction_id || 'Pending Transaction Record'}
                    </span>
                  </div>

                  {order.razorpay_order_id && (
                    <div className="p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-1">
                      <span className="text-text-muted block text-[10px]">Razorpay Order ID</span>
                      <span className="font-mono text-ivory-white text-[11px] break-all">
                        {order.razorpay_order_id}
                      </span>
                    </div>
                  )}

                  {order.razorpay_payment_id && (
                    <div className="p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-1">
                      <span className="text-text-muted block text-[10px]">Razorpay Payment ID</span>
                      <span className="font-mono text-ivory-white text-[11px] break-all">
                        {order.razorpay_payment_id}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#D4AC54]/60 text-[10px] text-text-muted flex items-center justify-between">
                <span className="text-gold-400 font-semibold">{formatDate(order.created_at)}</span>
              </div>
            </div>
          </div>

          {/* TASK 5 — INVOICE EXPERIENCE & PREVIEW CARD */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-gold-400" /> Tax Invoice & Official Document
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Official GST-compliant invoice generated by MMSR Publications.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {order.invoice_pdf ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleInvoice('view')}
                      disabled={invoiceBusy !== null}
                      className="px-3 py-2 rounded-xl bg-gold-500/10 border border-[#D4AC54] hover:bg-gold-500/20 text-gold-400 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-60"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{invoiceBusy === 'view' ? 'Opening…' : 'View Invoice'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInvoice('download')}
                      disabled={invoiceBusy !== null}
                      className="px-4 py-2 rounded-xl bg-gradient-gold border-2 border-[#C99A2E] text-navy-950 font-bold text-xs flex items-center gap-1.5 shadow-gold-glow hover:border-[#8C6239] hover:opacity-95 transition-all disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{invoiceBusy === 'download' ? 'Preparing…' : 'Download PDF'}</span>
                    </button>
                  </>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-[#C99A2E]/10 border border-[#D4AC54]/40 text-[#8C6B1B] text-xs font-medium">
                    Invoice Generating...
                  </span>
                )}
              </div>
            </div>

            {invoiceError && (
              <p className="text-xs text-red-600">{invoiceError}</p>
            )}

            {/* Invoice Preview Card Layout — clean two-column document layout */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] font-sans space-y-5 print:border-none print:p-0">
              {/* Invoice Header */}
              <div className="flex flex-col sm:flex-row justify-between gap-4 pb-4 border-b-2 border-[#C99A2E]/40">
                <div>
                  <h4 className="text-sm sm:text-base font-bold font-playfair text-[#2F241A] tracking-wide">
                    MMSR PUBLICATIONS PRIVATE LIMITED
                  </h4>
                  <p className="text-[11px] text-[#73614C] mt-1 leading-relaxed">
                    Higher Education Academic Publishing Division<br />
                    GSTIN: 36AAACM1234F1Z9 · PAN: AAACM1234F<br />
                    New Delhi / Hyderabad, India
                  </p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <span className="inline-block px-3 py-1 rounded bg-[#FFF2D9] border border-[#D4AC54] text-[#8C6B1B] text-xs font-bold uppercase tracking-wider mb-2">
                    Tax Invoice
                  </span>
                  <p className="text-xs font-mono text-[#2F241A] font-bold">{displayOrderId}</p>
                  <p className="text-[11px] text-[#73614C] mt-0.5">Date: {formatDate(order.created_at)}</p>
                </div>
              </div>

              {/* Bill To & Payment Status — labelled panels */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-white/60 border border-[#D4AC54]/50 space-y-1">
                  <span className="text-[10px] text-[#8C6B1B] uppercase tracking-wider font-bold block mb-1">Billed To</span>
                  <p className="font-bold text-[#2F241A]">{order.full_name || 'Academic Subscriber'}</p>
                  <p className="text-[#73614C]">{order.email}</p>
                  <p className="text-[#73614C]">{[order.address || order.shipping_address, order.city, order.state, order.postal_code, order.country].filter(Boolean).join(', ')}</p>
                </div>
                <div className="p-4 rounded-xl bg-white/60 border border-[#D4AC54]/50 space-y-1 sm:text-right">
                  <span className="text-[10px] text-[#8C6B1B] uppercase tracking-wider font-bold block mb-1">Payment Status</span>
                  <p className={`font-bold capitalize ${['paid', 'shipped', 'delivered'].includes(statusNorm) ? 'text-[#1B4332]' : statusNorm === 'cancelled' ? 'text-[#DC2626]' : 'text-[#8C6B1B]'}`}>
                    {order.status}
                  </p>
                  <p className="text-[#73614C] font-mono text-[11px] break-all">TxID: {order.transaction_id || 'N/A'}</p>
                </div>
              </div>

              {/* Items Line Table */}
              <div className="overflow-x-auto rounded-xl border border-[#D4AC54]/50">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FFF2D9] text-[#8C6B1B] uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 pr-4 pl-4 font-bold">Publication</th>
                      <th className="py-2.5 px-4 font-bold text-center">Qty</th>
                      <th className="py-2.5 px-4 font-bold text-right">Unit Price</th>
                      <th className="py-2.5 pl-4 pr-4 font-bold text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D4AC54]/30">
                    {order.items.map((item) => {
                      const title = getItemTitle(item);
                      const unit = parseFloat(item.price || '0');
                      const line = unit * item.quantity;
                      return (
                        <tr key={item.id} className="text-[#2F241A]">
                          <td className="py-3 pr-4 pl-4">
                            <span className="font-medium block">{title}</span>
                            <span className="text-[10px] text-[#73614C]">{getItemIsbnIssn(item)}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold">{item.quantity}</td>
                          <td className="py-3 px-4 text-right">₹{unit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="py-3 pl-4 pr-4 text-right font-bold text-[#8C6B1B]">₹{line.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#FFF2D9] border-t-2 border-[#C99A2E]/40">
                      <td className="py-2.5 pr-4 pl-4 font-bold text-[#2F241A]" colSpan={3}>Grand Total</td>
                      <td className="py-2.5 pl-4 pr-4 text-right font-bold text-[#8C6B1B]">{formatAmount(order.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Invoice Skeleton overlay if not available */}
              {!order.invoice_pdf && (
                <div className="p-4 rounded-xl bg-[#C99A2E]/10 border border-[#D4AC54]/40 text-center space-y-1">
                  <p className="text-xs font-bold text-[#8C6B1B]">Preview Layout (Invoice PDF Processing)</p>
                  <p className="text-[11px] text-[#73614C]">
                    Official stamped PDF document will be linked here shortly upon complete server sync.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* TASK 6 — PURCHASED ITEMS EXPERIENCE */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Package className="w-4 h-4" /> Purchased Publications ({order.items?.length || 0})
            </h3>

            {!order.items || order.items.length === 0 ? (
              <p className="text-xs text-text-muted py-4">No itemized publication data available.</p>
            ) : (
              <div className="space-y-4">
                {order.items.map((item) => {
                  const title = getItemTitle(item);
                  const category = getItemCategory(item);
                  const isbnIssn = getItemIsbnIssn(item);
                  const unitPrice = parseFloat(item.price || '0');
                  const lineTotal = unitPrice * item.quantity;
                  const coverUrl = getItemCover(item);
                  const pubLink = getItemLink(item);

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      {/* Left: Thumbnail & Details */}
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        {/* Cover Image */}
                        <div className="w-14 h-18 rounded-lg bg-navy-950 border border-[#D4AC54]/60 shrink-0 overflow-hidden relative flex items-center justify-center">
                          {coverUrl ? (
                            <Image
                              src={coverUrl}
                              alt={title}
                              fill
                              className="object-cover"
                            />
                          ) : item.book ? (
                            <BookOpen className="w-6 h-6 text-gold-400" />
                          ) : (
                            <Newspaper className="w-6 h-6 text-gold-400" />
                          )}
                        </div>

                        {/* Text Metadata */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold text-gold-400 uppercase tracking-wider bg-gold-500/10 px-2 py-0.5 rounded border border-[#D4AC54]">
                              {category}
                            </span>
                            {item.format === 'bundle' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#8C6B1B]/15 border border-[#8C6B1B]/30 text-[#8C6B1B]">
                                Print + Digital Bundle
                              </span>
                            ) : item.format === 'print' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C99A2E]/15 border border-[#D4AC54]/40 text-[#8C6B1B]">
                                Printed Edition
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 border border-white/15 text-text-muted">
                                Digital (PDF)
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-text-muted">
                              {isbnIssn}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-ivory-white font-playfair line-clamp-2">
                            {title}
                          </h4>

                          <p className="text-xs text-text-muted pt-0.5">
                            Quantity: <strong className="text-ivory-white font-medium">{item.quantity}</strong> × ₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Right: Subtotal & View Button */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#D4AC54]/40">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-text-muted block uppercase tracking-wider">Subtotal</span>
                          <span className="text-base font-bold text-gold-400 font-playfair">
                            ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <Link
                          href={pubLink}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-[#D4AC54]/60 hover:border-gold-500/40 text-gold-400 hover:text-gold-300 transition-all text-xs font-semibold flex items-center gap-1"
                        >
                          <span>View Publication</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* TASK 4 — ORDER SUMMARY CARD */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-3">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 mb-2">
              Financial Summary Breakdown
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-text-muted">
                <span>Items Subtotal ({order.items.length} items)</span>
                <span className="text-ivory-white">₹{itemsSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex items-center justify-between text-text-muted">
                <span className="flex items-center gap-1.5">
                  Shipping
                  {isPhysical && (
                    <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded font-bold">50% OFF</span>
                  )}
                </span>
                {isPhysical ? (
                  <span className="flex items-center gap-1.5 text-ivory-white font-medium">
                    <span className="line-through text-[10px] text-text-muted">₹80.00</span>
                    ₹40.00
                  </span>
                ) : (
                  <span className="text-emerald-400 font-medium">Free</span>
                )}
              </div>

              <div className="flex items-center justify-between text-text-muted">
                <span>Institutional Discount</span>
                <span className="text-text-muted">₹0.00</span>
              </div>

              <div className="border-t border-[#D4AC54] my-3 pt-3 flex items-center justify-between text-sm font-bold">
                <span className="text-ivory-white font-playfair">Grand Total</span>
                <span className="text-gold-400 text-lg font-playfair">{formatAmount(order.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* TASK 6 — ORDER EMAIL & LOGISTICS TIMELINE */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] space-y-4">
            <div className="flex items-center justify-between border-b border-[#D4AC54]/60 pb-3">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <Truck className="w-4 h-4" /> Order Communication & Logistics Timeline
              </h3>
              <span className="text-[10px] text-text-muted font-mono uppercase">Delivery Status</span>
            </div>

            {(() => {
              // Reuse the canonical logistics flags computed above so this timeline
              // can never disagree with the Fulfillment & Payment Timeline above.
              const isPaid = hasPaidStatus;
              // Delivery guarantee: within 7 days of the order date until actually delivered.
              const estimatedDeliveryIso = (() => {
                const d = new Date(order.created_at);
                d.setDate(d.getDate() + 7);
                return d.toISOString();
              })();

              const orderTimelineEvents = [
                {
                  title: 'Order Confirmed',
                  subtitle: 'Official order placement receipt generated.',
                  date: formatDate(order.created_at),
                  active: true,
                  icon: Package,
                },
                {
                  title: 'Payment Successful',
                  subtitle: isPaid ? `Payment verified via ${order.payment_method || 'Razorpay'}.` : 'Awaiting payment verification.',
                  date: isPaid ? formatDate(order.updated_at || order.created_at) : 'Pending',
                  active: isPaid,
                  icon: CheckCircle2,
                },
                {
                  title: 'Invoice Generated',
                  subtitle: 'Tax compliant invoice issued with GST breakdown.',
                  date: isPaid ? formatDate(order.updated_at || order.created_at) : 'Pending',
                  active: isPaid,
                  icon: Receipt,
                },
                ...(isPhysical ? [
                  {
                    title: 'Shipment Created',
                    subtitle: isDispatched ? 'Carrier dispatch tracking initiated.' : 'Preparation in logistics fulfillment center.',
                    date: isDispatched
                      ? order.dispatched_at
                        ? formatDate(order.dispatched_at)
                        : 'Dispatched'
                      : 'In Queue',
                    active: isDispatched,
                    icon: Truck,
                  },
                  {
                    title: 'Delivered',
                    subtitle: isDelivered ? 'Shipment delivered to recipient address.' : 'Delivery expected within 7 days of order date.',
                    date: isDelivered
                      ? order.delivered_at
                        ? formatDate(order.delivered_at)
                        : formatDate(order.updated_at)
                      : `Estimated: ${formatDate(estimatedDeliveryIso)}`,
                    active: isDelivered,
                    icon: ShieldCheck,
                  },
                ] : []),
              ];

              return (
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 ${isPhysical ? 'md:grid-cols-5' : 'md:grid-cols-3'}`}>
                  {orderTimelineEvents.map((evt, idx) => {
                    const EvtIcon = evt.icon;
                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border space-y-1.5 transition-all ${
                          evt.active
                            ? 'bg-navy-950 border-gold-500/40 shadow-sm shadow-gold-500/5'
                            : 'bg-white/5 border-[#D4AC54]/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <EvtIcon className={`w-4 h-4 ${evt.active ? 'text-gold-400' : 'text-text-muted'}`} />
                          <span className={`text-[10px] font-bold ${evt.active ? 'text-emerald-400' : 'text-text-muted'}`}>
                            {evt.active ? 'Completed' : 'Pending'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-ivory-white">{evt.title}</h4>
                        <p className="text-[10px] text-text-muted leading-tight">{evt.subtitle}</p>
                        <span className="text-[9px] font-mono text-gold-300/80 block pt-1">{evt.date}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
