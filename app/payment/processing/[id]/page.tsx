'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/context/AuthContext';
import { useCart } from '@/lib/context/CartContext';
import { SITE_URL } from '@/lib/config/site';
import { displayReference, isPublicId } from '@/lib/utils/publicId';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type ProcessingStage =
  | 'initializing'
  | 'opening_razorpay'
  | 'waiting_payment'
  | 'verifying_payment'
  | 'success'
  | 'failed';

// Categorised failure so the UI can give an accurate reason + the right recovery action.
type FailureKind =
  | 'auth'
  | 'network'
  | 'notfound'
  | 'server'
  | 'cancelled'
  | 'declined'
  | 'verify'
  | 'generic';

export default function PaymentProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tokens, user, isLoading } = useAuth();
  const { clearCart } = useCart();

  const orderIdParam = params?.id as string;

  const [stage, setStage] = useState<ProcessingStage>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<FailureKind>('generic');
  const [orderMeta, setOrderMeta] = useState<any>(null);
  // Watchdog: if init appears stuck on "initializing" for too long, surface a recovery panel.
  const [slowLoad, setSlowLoad] = useState(false);

  // Load Razorpay JS SDK dynamically
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const flowRef = useRef<{ rzpOrder: any; orderData: any } | null>(null);
  // Razorpay can fire multiple terminal events for a single attempt (the success
  // `handler`, then `modal.ondismiss` when it auto-closes after capture, and even
  // a stray `payment.failed`). Once this attempt has settled, later callbacks are
  // ignored so a successful payment is never incorrectly shown as failed/cancelled.
  const settledRef = useRef(false);
  // Live Razorpay instance so the success `handler` can explicitly close the
  // checkout window (a custom `handler` stops Razorpay auto-closing on capture).
  const rzpRef = useRef<any>(null);

  const apiBase = () => (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  // Build the Razorpay checkout options (shared by auto-open and the manual test button).
  const buildRazorpayOptions = useCallback((rzpOrder: any, orderData: any) => {
    const key = String(rzpOrder.key_id);
    const totalNum = parseFloat(orderData.total_amount || '0');
    const amountInPaise = Number(rzpOrder.amount) || Math.round(totalNum * 100);

    return {
      key,
      amount: amountInPaise,
      currency: rzpOrder.currency || 'INR',
      name: 'MMSR Publications',
      description: `Order #${orderData.custom_order_id || orderIdParam}`,
      // Canonical-domain logo (audit M-4): derived from SITE_URL so this can
      // never point at an unconfirmed spelling of the domain.
      image: `${SITE_URL}/logos/mmsr-logo.png`,
      order_id: rzpOrder.id || undefined,
      prefill: {
        name: orderData.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
        email: orderData.email || user?.email || '',
        contact: orderData.phone || orderData.phone_number || '',
      },
      theme: { color: '#C9962A' },
      modal: {
        ondismiss: () => {
          // Only treat a dismiss as a cancellation if the payment hasn't already
          // settled. Razorpay fires this when the modal closes after a SUCCESSFUL
          // capture too — guarding avoids the false "failed / you closed the window" flash.
          if (settledRef.current) return;
          settledRef.current = true;
          setStage('failed');
          setErrorKind('cancelled');
          setErrorMessage('You closed the payment before it was finished. No money was taken from your account — you can try again.');
        },
      },
      handler: async (response: any) => {
        // Success signal for this attempt — lock it so the modal's own close
        // (ondismiss) or a stray payment.failed can't override it below.
        if (settledRef.current) return;
        settledRef.current = true;
        // A custom `handler` prevents Razorpay from auto-closing on capture, so
        // close the checkout window ourselves — otherwise it lingers over the
        // result page (the "payment done but the window won't close" bug).
        try { rzpRef.current?.close(); } catch { /* ignore */ }
        setStage('verifying_payment');
        try {
          const verifyRes = await fetch(`${apiBase()}/api/commerce/${orderIdParam}/verify_razorpay/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens?.access}` },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          if (!verifyRes.ok) {
            const errData = await verifyRes.json().catch(() => ({}));
            throw new Error(errData.error || errData.detail || 'Payment signature verification failed.');
          }
          clearCart();
          setStage('success');
          router.push(`/payment/success/${orderIdParam}?payment_id=${response.razorpay_payment_id}&order_id=${response.razorpay_order_id}`);
        } catch (verifyErr: any) {
          setStage('failed');
          setErrorKind('verify');
          router.push(`/payment/failed/${orderIdParam}?reason=${encodeURIComponent(verifyErr?.message || 'Verification Error')}`);
        }
      },
    };
  }, [orderIdParam, tokens?.access, user, clearCart, router]);

  // Open the real Razorpay checkout modal.
  const openCheckout = useCallback(async () => {
    const data = flowRef.current;
    if (!data || !tokens?.access) return;
    setStage('opening_razorpay');
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setStage('failed');
      setErrorKind('network');
      setErrorMessage('Could not load the Razorpay payment SDK. Please check your network connection.');
      return;
    }
    setStage('waiting_payment');
    // Fresh checkout attempt → allow it to settle once.
    settledRef.current = false;
    const rzp = new window.Razorpay(buildRazorpayOptions(data.rzpOrder, data.orderData));
    rzpRef.current = rzp;
    // `payment.failed` is NOT terminal: Razorpay keeps the checkout open so the
    // shopper can retry with another card/method, and a later attempt may succeed.
    // Settling/navigating away on the first failure would make the eventual
    // success `handler` a no-op and leave a captured payment unverified. Only the
    // success `handler` or a genuine `modal.ondismiss` (see above) settle it; a
    // stray post-capture failure is already ignored by the settledRef guard.
    rzp.on('payment.failed', () => { /* surfaced by the Razorpay modal itself */ });
    rzp.open();
  }, [buildRazorpayOptions, orderIdParam, router, tokens?.access]);

  const startPaymentFlow = useCallback(async () => {
    // Wait for the auth session to hydrate before deciding anything.
    if (isLoading) return;
    // No order id or no session → this is an auth/entry problem, not a payment failure.
    if (!tokens?.access || !orderIdParam) {
      setStage('failed');
      setErrorKind('auth');
      setErrorMessage('Please sign in to your MMSR account to complete this payment.');
      return;
    }
    setStage('initializing');
    setErrorMessage(null);
    setErrorKind('generic');

    try {
      // 1. Fetch real order details from backend
      const res = await fetch(`${apiBase()}/api/commerce/${orderIdParam}/`, {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          setErrorKind('auth');
          throw new Error('Your session has expired. Please sign in again to continue your payment.');
        }
        if (res.status === 404) {
          setErrorKind('notfound');
          throw new Error(`${isPublicId(orderIdParam) ? `Order ${orderIdParam}` : 'This order'} could not be found on the server. It may have been cleared or belongs to another account.`);
        }
        setErrorKind('server');
        throw new Error(`Our servers had trouble loading your order (status ${res.status}). No payment has been taken yet.`);
      }

      const orderData = await res.json();
      setOrderMeta(orderData);

      // If already paid, redirect to success page directly
      if (orderData.status?.toLowerCase() === 'paid') {
        setStage('success');
        clearCart();
        router.push(`/payment/success/${orderIdParam}?transaction_id=${orderData.transaction_id || ''}`);
        return;
      }

      // 2. Create a real Razorpay order on the backend and fetch its publishable key.
      const initRes = await fetch(`${apiBase()}/api/commerce/${orderIdParam}/initiate_razorpay/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.access}` },
      });
      if (!initRes.ok) {
        const initErr = await initRes.json().catch(() => ({}));
        if (initRes.status === 401 || initRes.status === 403) setErrorKind('auth');
        else if (initRes.status === 404) setErrorKind('notfound');
        else setErrorKind('server');
        throw new Error(initErr.error || initErr.detail || 'Failed to start Razorpay payment. Please try again.');
      }
      const rzpOrder = await initRes.json();

      // Guard against a mock / misconfigured backend so we never open with a fake key.
      if (rzpOrder.use_mock === true || !rzpOrder.key_id || String(rzpOrder.key_id).startsWith('rzp_XXXXXXXXXX')) {
        setErrorKind('server');
        throw new Error('Razorpay is not configured on the server. Please set valid RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in the backend .env file.');
      }

      flowRef.current = { rzpOrder, orderData };

      // Open the Razorpay checkout modal.
      await openCheckout();
    } catch (err: any) {
      setStage('failed');
      const msg = err?.message || 'Failed to initialize payment gateway.';
      // A thrown TypeError / "Failed to fetch" means the request never reached the server.
      const isNetwork = err?.name === 'TypeError' || /fetch|network|Failed to connect|Load failed/i.test(msg);
      if (isNetwork) {
        setErrorKind('network');
        setErrorMessage('We could not reach the payment server. Check your internet connection and try again.');
      } else {
        setErrorMessage(msg);
      }
    }
  }, [tokens?.access, orderIdParam, isLoading, clearCart, router, openCheckout]);

  useEffect(() => {
    startPaymentFlow();
  }, [startPaymentFlow]);

  // Reset the slow-load flag whenever we leave 'initializing'; flag it if we linger.
  useEffect(() => {
    if (stage !== 'initializing') {
      setSlowLoad(false);
      return;
    }
    const t = setTimeout(() => setSlowLoad(true), 12000);
    return () => clearTimeout(t);
  }, [stage]);

  // Human-readable heading + reassurance about money, based on the failure category.
  const failureTitle: string = (() => {
    switch (errorKind) {
      case 'auth': return 'Sign In Required';
      case 'network': return 'Connection Problem';
      case 'notfound': return 'Order Not Found';
      case 'server': return 'Payment Service Unavailable';
      case 'cancelled': return 'Payment Failed';
      case 'declined': return 'Payment Declined';
      case 'verify': return 'Payment Verification Failed';
      default: return 'Payment Interrupted';
    }
  })();

  const chargeNote: string = (() => {
    switch (errorKind) {
      case 'auth':
      case 'cancelled':
      case 'notfound':
        return 'No money has been taken from your account.';
      case 'network':
      case 'server':
        return 'If any amount was deducted, it will be auto-refunded within 5–7 working days. You can safely retry.';
      case 'declined':
        return 'Your bank declined this transaction — no amount was debited. Try another card or UPI.';
      case 'verify':
        return 'If the amount was deducted, don’t worry — your order will be reconciled automatically. Check My Orders or contact support.';
      default:
        return '';
    }
  })();

  return (
    <div className="min-h-screen bg-navy-950 text-ivory-white font-manrope flex flex-col justify-between">
      <Navbar />

      <main className="pt-28 pb-20 max-w-2xl mx-auto px-4 sm:px-6 w-full flex-1 flex flex-col items-center justify-center text-center">
        <div className="p-8 sm:p-10 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] shadow-glass w-full space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-[90px] pointer-events-none" />

          {/* Animated Shield Icon */}
          <div className="relative mx-auto w-20 h-20 rounded-3xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-center text-gold-400 shadow-gold-glow">
            {stage === 'failed' ? (
              <XCircle className="w-10 h-10 text-[#DC2626]" />
            ) : stage === 'success' ? (
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            ) : (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <ShieldCheck className="w-10 h-10 text-gold-400" />
              </motion.div>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold text-gold-400 bg-gold-500/10 px-3 py-1 rounded-full border border-[#D4AC54]">
              Order {displayReference(orderMeta, orderMeta?.custom_order_id)}
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-ivory-white">
              {stage === 'failed'
                ? failureTitle
                : stage === 'verifying_payment'
                ? 'Verifying Payment Signature'
                : stage === 'waiting_payment'
                ? 'Waiting for Razorpay Authorization'
                : 'Initializing Secure Checkout'}
            </h1>
          <p className="text-xs text-text-muted leading-relaxed max-w-md mx-auto">
            {stage === 'failed'
              ? "Don't worry — your money is safe. Nothing has been taken from your account unless you finished the payment."
              : 'Please do not refresh or close this browser window while your payment is being processed.'}
          </p>
          </div>

          {/* Processing Timeline Indicator */}
          <div className="grid grid-cols-4 gap-2 pt-2 text-[10px]">
            {[
              { id: 'initializing', label: '1. Init' },
              { id: 'opening_razorpay', label: '2. Gateway' },
              { id: 'waiting_payment', label: '3. Payment' },
              { id: 'verifying_payment', label: '4. Verify' },
            ].map((st) => {
              const isActive = stage === st.id;
              return (
                <div
                  key={st.id}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    isActive
                      ? 'bg-[#C9962A]/20 border-[#C9962A] text-[#8C6239] font-bold shadow-gold-glow animate-pulse'
                      : 'bg-[#2F241A]/5 border-[#2F241A]/45 text-[#4A3626]'
                  }`}
                >
                  {st.label}
                </div>
              );
            })}
          </div>

          {/* Stuck-loading watchdog (only if init lingers on 'initializing') */}
          {stage === 'initializing' && slowLoad && (
            <div className="p-4 rounded-xl bg-[#FDECEC] border border-[#DC2626]/35 text-left space-y-3">
              <p className="text-xs font-bold text-[#B42318] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> This is taking longer than expected
              </p>
              <p className="text-[11px] text-[#B42318] leading-relaxed">
                We&apos;re having trouble reaching the payment server or confirming your session. Make sure you&apos;re signed in, then retry. No payment has been taken.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="gold" size="sm" onClick={startPaymentFlow}>Retry</Button>
                <Link href="/checkout">
                  <Button type="button" variant="outline" size="sm">Back to Checkout</Button>
                </Link>
              </div>
            </div>
          )}

          {/* Error & Recovery */}
          {stage === 'failed' && (
            <div className="p-4 rounded-xl bg-[#FDECEC] border border-[#DC2626]/35 text-xs text-[#B42318] space-y-3 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">{failureTitle}</p>
                  <p className="leading-relaxed opacity-90">
                    {errorMessage || 'The payment was closed or cancelled before it could be finished.'}
                  </p>
                  {chargeNote && <p className="text-[11px] opacity-75">{chargeNote}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {errorKind === 'auth' ? (
                  <Link href={`/login?redirect=${encodeURIComponent(`/payment/processing/${orderIdParam}`)}`}>
                    <Button type="button" variant="gold" size="sm">Sign In Again</Button>
                  </Link>
                ) : (
                  errorKind !== 'notfound' && (
                    <Button type="button" variant="gold" size="sm" onClick={startPaymentFlow}>
                      Retry Payment
                    </Button>
                  )
                )}
                {errorKind !== 'notfound' && (
                  <Link href="/checkout">
                    <Button type="button" variant="outline" size="sm">Back to Checkout</Button>
                  </Link>
                )}
                <Link href="/dashboard/orders">
                  <Button type="button" variant="outline" size="sm">View My Orders</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
