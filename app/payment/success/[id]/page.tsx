'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  FileText,
  ShoppingBag,
  Download,
  ArrowRight,
  ShieldCheck,
  MapPin,
  CreditCard,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/context/AuthContext';
import { downloadOrderInvoice } from '@/lib/services/protectedFiles';
import { PublicId } from '@/components/ui/PublicId';

function PaymentSuccessContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { tokens } = useAuth();

  const orderIdParam = params?.id as string;
  const paymentIdQuery = searchParams.get('payment_id');

  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The invoice is no longer a public /media link: the API returns an
  // authorised endpoint and the PDF is fetched with the buyer's bearer token
  // (SECURITY-QA-REPORT C-1), so the download happens here in memory.
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const handleDownloadInvoice = async () => {
    setDownloadingInvoice(true);
    setInvoiceError(null);
    try {
      await downloadOrderInvoice(order?.invoice_pdf, tokens?.access || '', orderIdParam);
    } catch (err: any) {
      setInvoiceError(err?.message || 'Invoice download failed. Please try again.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const fetchOrderDetails = useCallback(async () => {
    if (!tokens?.access || !orderIdParam) return;
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/commerce/${orderIdParam}/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data);
      }
    } catch (e) {
      console.error('Failed to fetch confirmed order details:', e);
    } finally {
      setIsLoading(false);
    }
  }, [tokens?.access, orderIdParam]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // Order reference comes straight from the API (public ID first, stored legacy
  // reference second). It is never padded or derived from the URL parameter.
  const displayPaymentId = paymentIdQuery || order?.transaction_id || 'Not reported by gateway';

  return (
    <main className="pt-28 pb-20 max-w-3xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="p-8 sm:p-12 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] shadow-glass w-full space-y-8 relative overflow-hidden"
      >
        {/* Success Animated Badge */}
        <div className="w-24 h-24 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto shadow-gold-glow">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-3.5 py-1 rounded-full border border-emerald-500/30 inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Payment Verified & Authorized
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-playfair text-ivory-white">
            Thank You for Your Order!
          </h1>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md mx-auto">
            Your publication order has been confirmed. A formal receipt and shipment confirmation email have been dispatched.
          </p>
        </div>

        {/* Detailed Summary Box */}
        <div className="p-6 rounded-2xl bg-white/5 border border-[#D4AC54]/60 space-y-4 text-xs text-left">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-[#D4AC54]/60">
            <div>
              <span className="text-text-muted block text-[10px] uppercase">Order Reference</span>
              <PublicId value={order?.public_id} legacy={order?.custom_order_id} size="sm" />
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase">Transaction / Payment ID</span>
              <span className="font-mono text-gold-400 font-semibold">{displayPaymentId}</span>
            </div>
          </div>

          {order?.payment_method && (
            <div className="flex items-center justify-between pb-3 border-b border-[#D4AC54]/60 text-text-muted">
              <span>Payment Method</span>
              <span className="text-ivory-white capitalize font-semibold flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-gold-400" />
                {order.payment_method}
              </span>
            </div>
          )}

          {(order?.city || order?.country) && (
            <div className="flex items-start gap-2 text-text-muted pb-3 border-b border-[#D4AC54]/60">
              <MapPin className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-ivory-white font-semibold block">Delivery Destination</span>
                <span>{[order.address, order.city, order.country].filter(Boolean).join(', ')}</span>
              </div>
            </div>
          )}

          {order?.total_amount && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-text-muted">Total Amount Paid:</span>
              <span className="font-bold text-gold-400 text-xl font-playfair">
                ₹{parseFloat(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
        </div>

        {/* Invoice Download CTA */}
        {order?.invoice_pdf && (
          <div className="space-y-2">
            <div className="p-4 rounded-xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-between text-xs text-left gap-4">
              <div className="flex items-center gap-2 text-gold-300">
                <FileText className="w-5 h-5 text-gold-400 shrink-0" />
                <span>Tax Invoice PDF Ready for Download</span>
              </div>
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={downloadingInvoice}
                className="px-4 py-2 rounded-xl bg-gradient-gold text-navy-950 font-bold flex items-center gap-1.5 hover:opacity-95 transition-opacity disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingInvoice ? 'Preparing…' : 'Download Invoice'}</span>
              </button>
            </div>
            {invoiceError && (
              <p className="text-xs text-red-600 text-left">{invoiceError}</p>
            )}
          </div>
        )}

        {/* Navigation Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link href={`/dashboard/orders/${orderIdParam}`}>
            <Button type="button" variant="gold" size="lg" leftIcon={<ShoppingBag className="w-4 h-4 text-navy-950" />}>
              Go to Dashboard Orders
            </Button>
          </Link>

          <Link href="/books">
            <Button type="button" variant="outline" size="lg" rightIcon={<ArrowRight className="w-4 h-4 text-gold-400" />}>
              Continue Shopping
            </Button>
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-navy-950 text-ivory-white font-manrope flex flex-col justify-between">
      <Navbar />
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <PaymentSuccessContent />
      </Suspense>
      <Footer />
    </div>
  );
}
