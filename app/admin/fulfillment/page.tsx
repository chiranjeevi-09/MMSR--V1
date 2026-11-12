'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck,
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  X,
  Phone,
  Mail,
  User,
  Calendar,
  Save,
  Check,
  ChevronRight,
  ShieldCheck,
  Tag,
  Building,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { AdminOrder, updateAdminOrderFulfillment } from '@/lib/services/cms';
import { displayReference, searchableRefs } from '@/lib/utils/publicId';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

type FulfillmentFilter = 'all' | 'pending' | 'processing' | 'packed' | 'dispatched' | 'delivered' | 'cancelled';
type FetchState = 'idle' | 'loading' | 'success' | 'error';

function formatDate(iso?: string | null) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatAmount(amount?: string) {
  if (!amount) return '₹0.00';
  const num = parseFloat(amount);
  return isNaN(num) ? amount : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function AdminFulfillmentPage() {
  const { tokens } = useAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FulfillmentFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Form State for Drawer
  const [targetStatus, setTargetStatus] = useState<string>('pending');
  const [courierName, setCourierName] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');
  const [trackingUrl, setTrackingUrl] = useState<string>('');
  const [fulfillmentNotes, setFulfillmentNotes] = useState<string>('');
  const [updatingState, setUpdatingState] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFulfillmentOrders = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    try {
      // Query orders with physical fulfillment requirements
      const res = await fetch(`${API_BASE_URL}/api/commerce/?fulfillment_only=true`, {
        headers: {
          Authorization: `Bearer ${tokens.access}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to load orders: ${res.statusText}`);
      }

      const data = await res.json();
      const list: AdminOrder[] = Array.isArray(data) ? data : data.results ?? [];
      
      // Filter strictly for paid orders that have physical items
      const physicalPaidOrders = list.filter(
        (o) => o.status === 'paid' && o.fulfillment_status !== 'not_required'
      );

      setOrders(physicalPaidOrders);
      setFetchState('success');
    } catch {
      setOrders([]);
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadFulfillmentOrders();
  }, [loadFulfillmentOrders]);

  const openDrawer = (ord: AdminOrder) => {
    setSelectedOrder(ord);
    setTargetStatus(ord.fulfillment_status || 'pending');
    setCourierName(ord.courier_name || '');
    setTrackingNumber(ord.tracking_number || '');
    setTrackingUrl(ord.tracking_url || '');
    setFulfillmentNotes(ord.fulfillment_notes || '');
    setActionSuccess(null);
    setActionError(null);
  };

  const closeDrawer = () => {
    setSelectedOrder(null);
    setActionSuccess(null);
    setActionError(null);
  };

  const handleSaveFulfillment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !tokens?.access) return;

    setUpdatingState(true);
    setActionSuccess(null);
    setActionError(null);

    try {
      const updated = await updateAdminOrderFulfillment(tokens.access, selectedOrder.id, {
        fulfillment_status: targetStatus,
        courier_name: courierName.trim(),
        tracking_number: trackingNumber.trim(),
        tracking_url: trackingUrl.trim(),
        fulfillment_notes: fulfillmentNotes.trim(),
      });

      // Update in local state
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setSelectedOrder(updated);
      setActionSuccess(`Order ${displayReference(updated, updated.custom_order_id)} fulfillment successfully updated.`);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update order fulfillment.');
    } finally {
      setUpdatingState(false);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    const awaitingPack = orders.filter((o) => o.fulfillment_status === 'pending' || o.fulfillment_status === 'processing').length;
    const packed = orders.filter((o) => o.fulfillment_status === 'packed').length;
    const dispatched = orders.filter((o) => o.fulfillment_status === 'dispatched').length;
    const delivered = orders.filter((o) => o.fulfillment_status === 'delivered').length;
    return { awaitingPack, packed, dispatched, delivered };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Status Filter
      if (statusFilter !== 'all' && ord.fulfillment_status !== statusFilter) {
        return false;
      }

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const refMatch = searchableRefs(ord.public_id, ord.custom_order_id).includes(q);
        const nameMatch = (ord.full_name || '').toLowerCase().includes(q);
        const postalMatch = (ord.postal_code || '').toLowerCase().includes(q);
        const courierMatch = (ord.courier_name || '').toLowerCase().includes(q);
        const trackingMatch = (ord.tracking_number || '').toLowerCase().includes(q);
        const itemMatch = ord.items.some((i) =>
          (i.journal_issue?.title || i.book?.title || '').toLowerCase().includes(q)
        );
        return refMatch || nameMatch || postalMatch || courierMatch || trackingMatch || itemMatch;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  return (
    <AdminLayout
      title="Physical Order Fulfillment"
      subtitle="Manual dispatch tracking and package management for print and bundle scholarly publications."
    >
      <div className="space-y-6">
        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-100 text-amber-800 border border-amber-300">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold font-playfair text-[#2F241A] block">{metrics.awaitingPack}</span>
              <span className="text-xs font-semibold text-[#73614C]">Awaiting Packing</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100 text-purple-800 border border-purple-300">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold font-playfair text-[#2F241A] block">{metrics.packed}</span>
              <span className="text-xs font-semibold text-[#73614C]">Packed & Ready</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-sky-100 text-sky-800 border border-sky-300">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold font-playfair text-[#2F241A] block">{metrics.dispatched}</span>
              <span className="text-xs font-semibold text-[#73614C]">Dispatched / In Transit</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-bold font-playfair text-[#2F241A] block">{metrics.delivered}</span>
              <span className="text-xs font-semibold text-[#73614C]">Confirmed Delivered</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#73614C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Order ID, Customer, PIN, or Tracking #..."
              className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl pl-9 pr-4 py-2 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            <Filter className="w-4 h-4 text-[#73614C] shrink-0" />
            {(['all', 'pending', 'processing', 'packed', 'dispatched', 'delivered', 'cancelled'] as FulfillmentFilter[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors border ${
                  statusFilter === st
                    ? 'bg-[#C99A2E] text-white border-[#C99A2E]'
                    : 'bg-[#FFFDF8] text-[#73614C] border-[#D4AC54] hover:bg-[#FFF2D9]'
                }`}
              >
                {st === 'all' ? 'All Formats' : st}
              </button>
            ))}

            <button
              type="button"
              onClick={loadFulfillmentOrders}
              className="p-2 rounded-xl border border-[#D4AC54] text-[#73614C] hover:bg-[#FFF2D9] transition-colors shrink-0"
              title="Refresh queue"
              aria-label="Refresh fulfillment queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl shadow-sm overflow-hidden">
          {fetchState === 'loading' ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#C99A2E] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-[#73614C] font-semibold">Loading physical fulfillment queue...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Package className="w-10 h-10 text-[#C99A2E] mx-auto opacity-70" />
              <h3 className="text-base font-bold font-playfair text-[#2F241A]">No Physical Orders in Queue</h3>
              <p className="text-xs text-[#73614C] max-w-md mx-auto">
                No orders match your filter. Only paid orders containing printed issues or print bundles require packaging and shipping.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8EEDC] border-b border-[#D4AC54] text-[#543D28] font-bold">
                  <tr>
                    <th className="py-3 px-4">Order Reference</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Amount Paid</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Physical Items</th>
                    <th className="py-3 px-4">Fulfillment Status</th>
                    <th className="py-3 px-4">Dispatch</th>
                    <th className="py-3 px-4">Courier</th>
                    <th className="py-3 px-4">Tracking #</th>
                    <th className="py-3 px-4">Tracking Link</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D4AC54]/40 bg-[#FFFDF8]">
                  {filteredOrders.map((ord) => {
                    const physicalItems = ord.items.filter((i) => i.format === 'print' || i.format === 'bundle');
                    const isAwaitingDispatch = ord.fulfillment_status === 'pending' || ord.fulfillment_status === 'processing' || ord.fulfillment_status === 'packed';

                    return (
                      <tr key={ord.id} className="hover:bg-[#FFF9F1] transition-colors">
                        {/* Order Reference */}
                        <td className="py-4 px-4 align-top font-mono font-bold text-[#2F241A]">
                          {displayReference(ord, ord.custom_order_id)}
                        </td>

                        {/* Date */}
                        <td className="py-4 px-4 align-top text-[13px] text-[#73614C]">
                          {formatDate(ord.created_at)}
                        </td>

                        {/* Amount Paid */}
                        <td className="py-4 px-4 align-top text-[13px] font-mono font-semibold text-emerald-700">
                          {formatAmount(ord.total_amount)}
                        </td>

                        {/* Customer */}
                        <td className="py-4 px-4 align-top font-bold text-[#2F241A]">
                          {ord.full_name || 'Customer'}
                        </td>

                        {/* Phone */}
                        <td className="py-4 px-4 align-top text-[13px] text-[#73614C] font-mono">
                          {ord.phone || ord.phone_number || 'No phone'}
                        </td>

                        {/* Address */}
                        <td className="py-4 px-4 align-top text-[13px] text-[#5C4033] max-w-xs">
                          {ord.shipping_address || ord.address || 'Address pending'}, {ord.city}, {ord.postal_code}, {ord.country}
                        </td>

                        {/* Physical Items List */}
                        <td className="py-4 px-4 align-top max-w-sm">
                          <div className="space-y-1.5">
                            {physicalItems.map((item) => (
                              <div key={item.id} className="text-[13px] flex items-start gap-1.5">
                                <span className="font-bold text-[#2F241A] shrink-0">[{item.quantity}x]</span>
                                <span className="text-[#3A2312] font-medium line-clamp-1">
                                  {item.journal_issue?.title || item.book?.title || 'Physical Publication'}
                                </span>
                                <span className="text-[12px] uppercase tracking-wider font-bold px-1.5 py-0.2 rounded border bg-[#FFF2D9] text-[#7A561E] border-[#D4AC54] shrink-0">
                                  {item.format === 'bundle' ? 'Bundle' : 'Print'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Fulfillment Status Badge */}
                        <td className="py-4 px-4 align-top">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border capitalize ${
                              ord.fulfillment_status === 'delivered'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : ord.fulfillment_status === 'dispatched'
                                ? 'bg-sky-50 text-sky-800 border-sky-300'
                                : ord.fulfillment_status === 'packed'
                                ? 'bg-purple-50 text-purple-800 border-purple-300'
                                : ord.fulfillment_status === 'processing'
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : ord.fulfillment_status === 'cancelled'
                                ? 'bg-red-50 text-red-800 border-[#DC2626]/40'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {ord.fulfillment_status || 'Pending'}
                          </span>
                        </td>

                        {/* Dispatch Hint */}
                        <td className="py-4 px-4 align-top text-[13px] text-amber-700 font-semibold">
                          {isAwaitingDispatch ? 'Awaiting Dispatch' : '—'}
                        </td>

                        {/* Courier */}
                        <td className="py-4 px-4 align-top font-bold text-[#2F241A]">
                          {ord.courier_name || '—'}
                        </td>

                        {/* Tracking Number */}
                        <td className="py-4 px-4 align-top font-mono text-[13px] text-[#73614C]">
                          {ord.tracking_number || '—'}
                        </td>

                        {/* Tracking Link */}
                        <td className="py-4 px-4 align-top">
                          {ord.tracking_url ? (
                            <a
                              href={ord.tracking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[13px] text-[#C99A2E] hover:underline"
                            >
                              Track Package
                            </a>
                          ) : (
                            <span className="text-[13px] text-[#8C7662] italic">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-4 align-top text-right">
                          <Button
                            variant="gold"
                            size="sm"
                            onClick={() => openDrawer(ord)}
                            leftIcon={<Truck className="w-3.5 h-3.5 text-[#3E2A20]" />}
                          >
                            Update
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Update Drawer */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm"
            />

            {/* Slide Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-lg bg-[#FFF9F1] border-l border-[#D4AC54] shadow-2xl h-full flex flex-col z-10 font-manrope overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-[#D4AC54] flex items-center justify-between bg-[#F8EEDC]">
                <div>
                  <h2 className="text-lg font-bold font-playfair text-[#2F241A]">
                    Update Physical Fulfillment
                  </h2>
                  <p className="text-xs text-[#73614C] mt-0.5">
                    Order {displayReference(selectedOrder, selectedOrder.custom_order_id)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeDrawer}
                  className="p-1.5 rounded-xl border border-[#D4AC54] text-[#73614C] hover:bg-[#FFF2D9] transition-colors"
                  aria-label="Close fulfillment update drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <form onSubmit={handleSaveFulfillment} className="p-6 space-y-6 flex-1">
                {/* Feedback Banners */}
                {actionSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{actionSuccess}</span>
                  </div>
                )}
                {actionError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-[#DC2626]/25 text-red-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Recipient & Shipping Summary Card */}
                <div className="p-4 rounded-xl bg-[#FFFDF8] border border-[#D4AC54] space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D4AC54]/40 font-bold text-[#2F241A]">
                    <span>Shipping Destination</span>
                    <span className="font-mono text-[#C99A2E]">{selectedOrder.postal_code}</span>
                  </div>
                  <p className="font-semibold text-[#2F241A]">{selectedOrder.full_name}</p>
                  <p className="text-[#73614C] leading-relaxed">
                    {selectedOrder.shipping_address || selectedOrder.address}, {selectedOrder.city}, {selectedOrder.country}
                  </p>
                  <p className="text-[13px] text-[#73614C] font-mono">
                    Phone: {selectedOrder.phone || selectedOrder.phone_number || 'N/A'} • Email: {selectedOrder.email}
                  </p>
                </div>

                {/* Status Selection */}
                <div className="space-y-1.5">
                  <label htmlFor="fulfillment-status-select" className="text-xs font-bold text-[#2F241A]">
                    Fulfillment Status *
                  </label>
                  <select
                    id="fulfillment-status-select"
                    value={targetStatus}
                    onChange={(e) => setTargetStatus(e.target.value)}
                    className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-xs text-[#2F241A] focus:outline-none"
                  >
                    <option value="pending">Pending (Awaiting Packaging)</option>
                    <option value="processing">Processing (Being Picked / Checked)</option>
                    <option value="packed">Packed (Boxed & Labelled)</option>
                    <option value="dispatched">Dispatched (Handed to Courier)</option>
                    <option value="delivered">Delivered (Confirmed by Carrier/Customer)</option>
                    <option value="cancelled">Cancelled (Fulfillment Halted)</option>
                  </select>
                </div>

                {/* Courier Partner Name */}
                <div className="space-y-1.5">
                  <label htmlFor="courier-name-input" className="text-xs font-bold text-[#2F241A]">
                    Courier Partner Name
                  </label>
                  <input
                    id="courier-name-input"
                    type="text"
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="e.g. India Post Speed Post, BlueDart, DTDC"
                    className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-xs text-[#2F241A] focus:outline-none"
                  />
                </div>

                {/* Tracking / Consignment Number */}
                <div className="space-y-1.5">
                  <label htmlFor="tracking-number-input" className="text-xs font-bold text-[#2F241A]">
                    Consignment / Tracking Reference Number
                  </label>
                  <input
                    id="tracking-number-input"
                    type="text"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="e.g. EM987654321IN or 1234567890"
                    className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-xs text-[#2F241A] font-mono focus:outline-none"
                  />
                </div>

                {/* Optional Tracking URL */}
                <div className="space-y-1.5">
                  <label htmlFor="tracking-url-input" className="text-xs font-bold text-[#2F241A]">
                    Direct Courier Tracking URL (Optional)
                  </label>
                  <input
                    id="tracking-url-input"
                    type="url"
                    value={trackingUrl}
                    onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://www.indiapost.gov.in/_layouts/15/dpt.ptis.tracking/trackconsignment.aspx"
                    className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-xs text-[#2F241A] focus:outline-none"
                  />
                </div>

                {/* Internal Staff Notes */}
                <div className="space-y-1.5">
                  <label htmlFor="fulfillment-notes-input" className="text-xs font-bold text-[#2F241A]">
                    Internal Packaging / Dispatch Notes
                  </label>
                  <textarea
                    id="fulfillment-notes-input"
                    rows={3}
                    value={fulfillmentNotes}
                    onChange={(e) => setFulfillmentNotes(e.target.value)}
                    placeholder="e.g. Dispatched in bubble envelope via local post office dispatch counter."
                    className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl p-3 text-xs text-[#2F241A] focus:outline-none"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="pt-4 border-t border-[#D4AC54] flex items-center justify-end gap-3">
                  <Button variant="outline" size="md" type="button" onClick={closeDrawer}>
                    Cancel
                  </Button>
                  <Button
                    variant="gold"
                    size="md"
                    type="submit"
                    isLoading={updatingState}
                    leftIcon={<Save className="w-4 h-4 text-[#3E2A20]" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
