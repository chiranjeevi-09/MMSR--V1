'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { XCircle, RefreshCw, ArrowLeft, HelpCircle, AlertTriangle, Info } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { isPublicId } from '@/lib/utils/publicId';

function PaymentFailedContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const orderIdParam = params?.id as string;
  const reasonQuery = searchParams.get('reason') || 'Transaction was cancelled or declined by your card issuer/bank.';

  return (
    <main className="pt-28 pb-20 max-w-2xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="p-8 sm:p-12 rounded-3xl bg-[#F8EEDC] border border-red-500/30 shadow-glass w-full space-y-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Failure Animation Icon */}
        <div className="w-24 h-24 rounded-3xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-[#DC2626] mx-auto">
          <XCircle className="w-12 h-12 text-[#DC2626]" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest bg-red-500/20 text-[#DC2626] px-3.5 py-1 rounded-full border border-red-500/30 inline-flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            Payment Not Completed
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold font-playfair text-ivory-white">
            Payment Could Not Be Processed
          </h1>
          <p className="text-xs sm:text-sm text-text-muted leading-relaxed max-w-md mx-auto">
            No money was deducted from your account. You can retry with Razorpay or select another payment option.
          </p>
        </div>

        {/* Reason Box */}
        <div className="p-5 rounded-2xl bg-white/5 border border-[#D4AC54]/60 text-xs text-left space-y-3">
          <div className="flex items-center justify-between text-text-muted">
            <span>Order Reference:</span>
            {/* The URL segment is only echoed when it is a public ID — an
                internal primary key must never be shown to the customer. */}
            <span className="font-mono text-ivory-white font-bold">
              {isPublicId(orderIdParam) ? orderIdParam : 'See your order history'}
            </span>
          </div>
          <div className="pt-2 border-t border-[#D4AC54]/60 text-[#DC2626]">
            <span className="text-[10px] uppercase text-text-muted block">Decline Reason:</span>
            <p className="font-medium mt-0.5">{reasonQuery}</p>
          </div>
        </div>

        {/* Common Reasons Helpful Guidance */}
        <div className="p-4 rounded-xl bg-navy-950 border border-[#D4AC54]/60 text-left text-xs text-text-muted space-y-1.5">
          <p className="font-semibold text-ivory-white flex items-center gap-1.5">
            <Info className="w-4 h-4 text-gold-400" /> Common Payment Issues:
          </p>
          <ul className="list-disc list-inside space-y-1 text-[11px]">
            <li>Incorrect OTP or 3D-Secure password entered during payment window.</li>
            <li>Bank card daily online transaction limits exceeded.</li>
            <li>Razorpay checkout popup modal was dismissed before completion.</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link href={`/payment/processing/${orderIdParam}`}>
            <Button type="button" variant="gold" size="lg" leftIcon={<RefreshCw className="w-4 h-4 text-navy-950" />}>
              Retry Payment Now
            </Button>
          </Link>

          <Link href="/checkout">
            <Button type="button" variant="outline" size="lg" leftIcon={<ArrowLeft className="w-4 h-4 text-gold-400" />}>
              Back to Checkout
            </Button>
          </Link>

          <Link href="/contact">
            <Button type="button" variant="primary" size="lg" leftIcon={<HelpCircle className="w-4 h-4 text-gold-400" />}>
              Contact Support
            </Button>
          </Link>
        </div>
      </motion.div>
    </main>
  );
}

export default function PaymentFailedPage() {
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
        <PaymentFailedContent />
      </Suspense>
      <Footer />
    </div>
  );
}
