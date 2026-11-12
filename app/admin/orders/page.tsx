'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  X,
  MapPin,
  CreditCard,
  Download,
  Package,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Save,
  Check,
  Truck,
  RotateCcw,
  XCircle,
  DollarSign,
  BookOpen,
  Library,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { downloadOrderInvoice } from '@/lib/services/protectedFiles';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { displayId, displayReference } from '@/lib/utils/publicId';
import {
  AdminOrder,
  CommerceStats,
  fetchAdminOrders,
  fetchCommerceStats,
  updateAdminOrderStatus,
} from '@/lib/services/cms';

type FetchState = 'idle' | 'loading' | 'success' | 'error';

// The order desk stores and displays successfully paid orders only.
// Pending (unpaid) and cancelled orders stay in the database for the audit
// trail but are hidden from this view per the payments-consolidation decision.
const SUCCESSFUL_STATUSES = ['paid', 'processing', 'shipped', 'delivered'];
const isSuccessfulOrder = (status?: string) => SUCCESSFUL_STATUSES.includes((status || '').toLowerCase());

// Classifies an order from the product references its items carry: a book FK
// means a book purchase, while journal issue/subscription/article FKs mean
// journal products (order number prefixes alone don't say which).
function orderProductKind(ord: AdminOrder): 'book' | 'journal' | 'mixed' | 'other' {
  const hasBook = (ord.items || []).some((i) => !!i.book);
  const hasJournal = (ord.items || []).some((i) => !!(i.journal_issue || i.journal_subscription || i.article));
  if (hasBook && hasJournal) return 'mixed';
  if (hasBook) return 'book';
  if (hasJournal) return 'journal';
  return 'other';
}

export default function AdminOrdersPage() {
  const { tokens } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [stats, setStats] = useState<CommerceStats | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order for Summary & Status Management Drawer
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Status Change State
  const [updatingState, setUpdatingState] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Confirmation Modal for Cancelled / Refunded
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    status: string;
    label: string;
  } | null>(null);

  const loadOrders = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    try {
      // Revenue figures come from the server-side SQL aggregate so they stay
      // correct even though the order list below only returns one page.
      const [list, st] = await Promise.all([
        fetchAdminOrders(tokens.access),
        fetchCommerceStats(tokens.access).catch(() => null),
      ]);
      setOrders(list);
      setStats(st);
      setFetchState('success');
    } catch {
      setOrders([]);
      setFetchState('success');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Open Drawer
  const openOrderDrawer = (ord: AdminOrder) => {
    setSelectedOrder(ord);
    setActionSuccess(null);
    setActionError(null);
    setPendingConfirmation(null);
  };

  // Close Drawer
  const closeOrderDrawer = () => {
    setSelectedOrder(null);
    setActionSuccess(null);
    setActionError(null);
    setPendingConfirmation(null);
  };

  // The invoice is no longer a public /media file — the API hands out an
  // authorised endpoint and the PDF is fetched with the staff bearer token
  // (SECURITY-QA-REPORT C-1), so this is a blob download rather than a link.
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const handleDownloadInvoice = async () => {
    if (!selectedOrder) return;
    setDownloadingInvoice(true);
    setActionError(null);
    try {
      await downloadOrderInvoice(
        selectedOrder.invoice_pdf,
        tokens?.access || '',
        displayId(selectedOrder) || selectedOrder.id,
      );
    } catch (err: any) {
      setActionError(err?.message || 'Invoice download failed. Please try again.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  // Submit status change through the staff-only validated endpoint. The
  // backend persists the transition and returns the saved order; success is
  // only reported after the server confirms it.
  const executeStatusUpdate = async (newStatus: string) => {
    if (!selectedOrder || !tokens?.access) return;

    setUpdatingState(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const updated = await updateAdminOrderStatus(tokens.access, selectedOrder.id, newStatus);

      setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
      setSelectedOrder((prev) => (prev ? { ...prev, ...updated } : null));

      setActionSuccess(`Order status updated to "${(updated.status || newStatus).toUpperCase()}" and saved.`);
      setPendingConfirmation(null);
      setTimeout(() => setActionSuccess(null), 4000);
      loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update order status.';
      setActionError(msg);
    } finally {
      setUpdatingState(false);
    }
  };

  // Destructive actions run only after explicit confirmation.
  const handleStatusChangeRequest = (newStatus: string) => {
    if (newStatus === 'cancelled') {
      setPendingConfirmation({ status: newStatus, label: 'Cancel Order' });
    } else {
      executeStatusUpdate(newStatus);
    }
  };

  // Only successfully-paid orders are shown; pending/cancelled stay stored
  // but hidden from this desk.
  const visibleOrders = useMemo(() => orders.filter((ord) => isSuccessfulOrder(ord.status)), [orders]);

  // Filter Logic
  const filteredOrders = useMemo(() => {
    return visibleOrders.filter((ord) => {
      // Search
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const idStr = displayReference(ord, ord.custom_order_id).toLowerCase();
        const nameStr = (ord.full_name || '').toLowerCase();
        const emailStr = (ord.email || '').toLowerCase();
        const txStr = (ord.transaction_id || '').toLowerCase();

        if (!idStr.includes(q) && !nameStr.includes(q) && !emailStr.includes(q) && !txStr.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [visibleOrders, searchQuery]);

  return (
    <AdminLayout
      title="Platform Customer Orders"
      subtitle="Central order desk for successful payments: revenue summary, transaction references, invoices, and order audits. Physical dispatch is handled on the Fulfillment desk."
    >
      {/* Controls Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer Name, Email, or Transaction Reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E9DFCF] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B] transition-colors"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadOrders}
            isLoading={fetchState === 'loading'}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Orders
          </Button>
        </div>
      </div>

      {/* Revenue Summary — server-side aggregates from /api/commerce/stats/ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Gross Revenue',
            value: stats
              ? `₹${(parseFloat(stats.total_revenue) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
              : fetchState === 'loading' ? '...' : '—',
            icon: DollarSign,
            iconColor: '#C9A66B',
          },
          {
            label: 'Paid Orders',
            value: stats ? stats.paid_orders.toLocaleString('en-IN') : fetchState === 'loading' ? '...' : '—',
            icon: CheckCircle2,
            iconColor: '#16a34a',
          },
          {
            label: 'Orders Today',
            value: stats ? stats.orders_today.toLocaleString('en-IN') : fetchState === 'loading' ? '...' : '—',
            icon: ShoppingBag,
            iconColor: '#0284c7',
          },
          {
            label: 'Total Orders (All Time)',
            value: stats ? stats.orders_total.toLocaleString('en-IN') : fetchState === 'loading' ? '...' : '—',
            icon: CreditCard,
            iconColor: '#5C4B3A',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="p-5 rounded-2xl bg-white border border-[#E9DFCF] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] uppercase tracking-wider font-bold text-[#8B7B68]">{card.label}</span>
                <div className="p-2 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF]">
                  <Icon className="w-4 h-4" style={{ color: card.iconColor }} />
                </div>
              </div>
              <p className="text-xl font-bold font-playfair text-[#5C4B3A]">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Count Header */}
      <div className="text-xs text-[#8B7B68]">
        Showing <strong className="text-[#5C4B3A]">{filteredOrders.length}</strong> of {visibleOrders.length} successful order records
      </div>

      {/* Loading */}
      {fetchState === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#8B7B68]">Fetching commerce orders...</p>
        </div>
      )}

      {/* Empty State */}
      {fetchState === 'success' && filteredOrders.length === 0 && (
        <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <ShoppingBag className="w-8 h-8 text-[#C9A66B] mx-auto" />
          <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Orders Found</p>
          <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
            {searchQuery
              ? 'No orders match your active search filters.'
              : 'No successful orders yet. Paid orders will appear here.'}
          </p>
        </div>
      )}

      {/* Orders Table */}
      {fetchState === 'success' && filteredOrders.length > 0 && (
        <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                  <th className="py-3 px-4 font-bold">Order Reference</th>
                  <th className="py-3 px-4 font-bold">Product Type</th>
                  <th className="py-3 px-4 font-bold">Customer</th>
                  <th className="py-3 px-4 font-bold">Email</th>
                  <th className="py-3 px-4 font-bold">Payment Method</th>
                  <th className="py-3 px-4 font-bold">Total Amount</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Created Date</th>
                  <th className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((ord) => {
                  const orderIdStr = displayReference(ord, ord.custom_order_id);
                  const kind = orderProductKind(ord);
                  const custName = ord.full_name || ord.email || 'Customer';
                  const dateStr = ord.created_at
                    ? new Date(ord.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
                    : 'N/A';

                  return (
                    <tr key={ord.id} className="hover:bg-[#FFF8EE] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#5C4B3A] text-[13px]">
                        {orderIdStr}
                      </td>

                      <td className="py-3 px-4">
                        {kind === 'book' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold border bg-[#FFF2D9] border-[#D4AC54] text-[#8C6B1B]">
                            <BookOpen className="w-3.5 h-3.5" /> Book
                          </span>
                        )}
                        {kind === 'journal' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold border bg-[#F5EFE6] border-[#CBB99B] text-[#5C4B3A]">
                            <Library className="w-3.5 h-3.5" /> Journal
                          </span>
                        )}
                        {kind === 'mixed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold border bg-[#FFF2D9] border-[#D4AC54] text-[#8C6B1B]">
                            <BookOpen className="w-3.5 h-3.5" /> Book + Journal
                          </span>
                        )}
                        {kind === 'other' && (
                          <span className="text-[13px] font-bold text-[#8B7B68]">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-[#5C4B3A] font-medium">
                        {custName}
                      </td>

                      <td className="py-3 px-4 text-[#8B7B68] font-mono">
                        {ord.email || 'N/A'}
                      </td>

                      <td className="py-3 px-4 text-[#8B7B68] capitalize">
                        {ord.payment_method || 'Online'}
                      </td>

                      <td className="py-3 px-4 font-bold text-[#C9A66B] font-playfair">
                        ₹{parseFloat(ord.total_amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3 px-4">
                        <OrderStatusBadge status={ord.status} size="sm" />
                      </td>

                      <td className="py-3 px-4 text-[#8B7B68]">
                        {dateStr}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openOrderDrawer(ord)}
                          className="px-3 py-1 rounded-lg bg-[#FFF2D9] border border-[#E9DFCF] hover:bg-[#FFF2D9] text-[#C9A66B] text-[13px] font-bold transition-all"
                        >
                          Manage Order
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Order Details & Status Update Drawer */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeOrderDrawer}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-lg bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                    Order Details & Status Panel
                  </span>
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    {displayReference(selectedOrder, selectedOrder.custom_order_id)}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeOrderDrawer}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Alert Messages */}
              {actionSuccess && (
                <div className="m-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{actionSuccess}</span>
                </div>
              )}
              {actionError && (
                <div className="m-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[#DC2626] text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Current Status & Total */}
                <div className="p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] flex items-center justify-between">
                  <div>
                    <span className="text-[13px] text-[#8B7B68] uppercase tracking-wider block">Current Status</span>
                    <OrderStatusBadge status={selectedOrder.status} size="md" />
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] text-[#8B7B68] uppercase tracking-wider block">Total Amount</span>
                    <span className="text-lg font-bold text-[#C9A66B] font-playfair">
                      ₹{parseFloat(selectedOrder.total_amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Order Actions Panel */}
                <div className="space-y-3 p-4 rounded-xl bg-white border border-[#E9DFCF]">
                  <label className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block">
                    Order Actions
                  </label>

                  {(selectedOrder.status || '').toLowerCase() === 'pending' && (
                    <div className="space-y-2">
                      <p className="text-xs text-[#8B7B68]">
                        This order is unpaid. You can cancel it here — no money was captured and no entitlement was granted.
                      </p>
                      <button
                        type="button"
                        disabled={updatingState}
                        onClick={() => handleStatusChangeRequest('cancelled')}
                        className="w-full px-3 py-2 rounded-lg text-xs font-bold border transition-all bg-red-500/10 border-red-500/30 text-[#DC2626] hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {updatingState ? 'Cancelling Order...' : 'Cancel Unpaid Order'}
                      </button>
                    </div>
                  )}

                  {(selectedOrder.status || '').toLowerCase() === 'paid' && (
                    <div className="space-y-2">
                      <p className="text-xs text-[#8B7B68]">
                        Payment was verified by Razorpay, so this order is locked to <strong>paid</strong>. Dispatch and delivery stages are managed on the Fulfillment desk.
                      </p>
                      {selectedOrder.has_physical_items && (
                        <Link
                          href="/admin/fulfillment"
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all bg-[#FFF8EE] border-[#E9DFCF] text-[#5C4B3A] hover:border-[#C9A66B]"
                        >
                          <Truck className="w-3.5 h-3.5" /> Manage Fulfillment
                        </Link>
                      )}
                    </div>
                  )}

                  {['shipped', 'delivered'].includes((selectedOrder.status || '').toLowerCase()) && (
                    <p className="text-xs text-[#8B7B68]">
                      Legacy logistics status kept for the audit trail. The authoritative shipment stage is managed on the{' '}
                      <Link href="/admin/fulfillment" className="text-[#C9A66B] font-bold hover:underline">Fulfillment desk</Link>.
                    </p>
                  )}

                  {(selectedOrder.status || '').toLowerCase() === 'cancelled' && (
                    <p className="text-xs text-[#8B7B68]">
                      This order was cancelled. Cancelled orders are retained for auditing and cannot be reopened here.
                    </p>
                  )}
                </div>

                {/* Shipping Address */}
                <div className="space-y-2">
                  <span className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Shipping & Customer Address
                  </span>
                  <div className="p-3.5 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs space-y-1">
                    <p className="font-bold text-[#5C4B3A]">{selectedOrder.full_name || 'Customer'}</p>
                    <p className="text-[#8B7B68] font-mono">{selectedOrder.email}</p>
                    {selectedOrder.phone && (
                      <p className="text-[#8B7B68]">{selectedOrder.phone}</p>
                    )}
                    <p className="text-[#8B7B68] font-medium pt-1 border-t border-[#E9DFCF]">
                      {[selectedOrder.address, selectedOrder.city, selectedOrder.postal_code, selectedOrder.country]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  </div>
                </div>

                {/* Payment Breakdown & Gateway Credentials */}
                <div className="space-y-2">
                  <span className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Payment Metadata
                  </span>
                  <div className="p-3.5 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs space-y-1.5 font-mono text-[13px]">
                    <p className="text-[#8B7B68]">Method: <strong className="text-[#5C4B3A] font-sans capitalize">{selectedOrder.payment_method || 'Online'}</strong></p>
                    <p className="text-[#8B7B68]">Transaction ID: <strong className="text-[#C9A66B]">{selectedOrder.transaction_id || 'N/A'}</strong></p>
                    {selectedOrder.razorpay_order_id && (
                      <p className="text-[#8B7B68]">Razorpay Order ID: <strong className="text-[#5C4B3A]">{selectedOrder.razorpay_order_id}</strong></p>
                    )}
                    {selectedOrder.razorpay_payment_id && (
                      <p className="text-[#8B7B68]">Razorpay Payment ID: <strong className="text-[#5C4B3A]">{selectedOrder.razorpay_payment_id}</strong></p>
                    )}
                  </div>
                </div>

                {/* Purchased Items */}
                <div className="space-y-2">
                  <span className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" /> Purchased Items ({selectedOrder.items?.length || 0})
                  </span>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item) => {
                      const itemTitle = item.book?.title || item.journal_issue?.title || item.journal_subscription?.title || 'Academic Item';
                      return (
                        <div key={item.id} className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-[#5C4B3A] block line-clamp-1">{itemTitle}</span>
                            <span className="text-[13px] text-[#8B7B68]">Qty: {item.quantity}</span>
                            {/* Line-item reference (MMSR-ORI) for dispatch/return trails */}
                            <span className="block text-[13px] font-mono text-[#8B7B68]">{displayId(item)}</span>
                          </div>
                          <span className="font-bold text-[#C9A66B] shrink-0 ml-2">
                            ₹{parseFloat(item.price || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Tax Invoice Link */}
                {selectedOrder.invoice_pdf && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleDownloadInvoice}
                      disabled={downloadingInvoice}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A66B] text-white font-bold text-xs disabled:opacity-60"
                    >
                      {downloadingInvoice
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      {downloadingInvoice ? 'Preparing Invoice PDF…' : 'Download Tax Invoice PDF'}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Order Cancellation */}
      <AnimatePresence>
        {pendingConfirmation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-[#E9DFCF] rounded-2xl p-6 shadow-2xl z-50 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-[#DC2626] border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#5C4B3A] font-playfair">
                    Confirm Action: {pendingConfirmation.label}
                  </h3>
                  <p className="text-xs text-[#8B7B68]">
                    Are you sure you want to cancel order {selectedOrder ? displayReference(selectedOrder, selectedOrder.custom_order_id) : ''}?
                    Only unpaid orders can be cancelled — this action is saved on the server and persists after refresh.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingConfirmation(null)}
                  disabled={updatingState}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  isLoading={updatingState}
                  onClick={() => executeStatusUpdate('cancelled')}
                >
                  Confirm Cancellation
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
