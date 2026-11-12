'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CreditCard,
  QrCode,
  Lock,
  FileText,
  ChevronDown,
  ArrowRight,
  Info,
  Building,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';

export default function PaymentLandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const FAQS = [
    {
      q: 'Which payment methods are accepted for MMSR Publications?',
      a: 'All purchases are processed securely through Razorpay. We accept Credit & Debit Cards (Visa, Mastercard, RuPay, Amex), NetBanking across 50+ major banks, UPI (GPay, PhonePe, Paytm, BHIM), and digital wallets.',
    },
    {
      q: 'Will I receive an official tax / GST invoice for my purchase?',
      a: 'Yes. Upon payment confirmation via Razorpay, an automated GST tax invoice is generated instantly and accessible directly inside your Author Dashboard Orders page, as well as emailed to your registered address.',
    },
    {
      q: 'Can institutions or universities pay online for departmental access?',
      a: 'Yes. Academic institutions, university libraries, and research laboratories can utilize institutional credit cards, corporate NetBanking, or UPI through our secure Razorpay gateway to receive an instant official GST tax invoice.',
    },
    {
      q: 'Is GST tax included in the listed prices?',
      a: 'All publication fees, book prices, and subscription rates comply with applicable Indian GST regulations. Specific GST breakdowns are itemized on your final invoice.',
    },
    {
      q: 'What happens if a payment transaction fails during checkout?',
      a: 'No funds are lost. You will be redirected to a payment recovery page where you can retry with Razorpay or select an alternative online payment method without losing your cart items.',
    },
    {
      q: 'How long does payment verification take?',
      a: 'All Razorpay payments (Card, NetBanking, UPI) are verified automatically in real-time. Digital entitlements and invoices are granted immediately upon successful transaction completion.',
    },
  ];

  return (
    <div className="min-h-screen bg-navy-950 text-ivory-white font-manrope flex flex-col justify-between">
      <Navbar />

      <main className="pt-28 pb-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-16">
        
        {/* HERO SECTION */}
        <section className="relative p-8 sm:p-12 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] overflow-hidden shadow-glass">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gold-500/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            <div className="lg:col-span-8 space-y-4 text-left">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-widest text-gold-400 bg-gold-500/15 px-3 py-1 rounded-full border border-[#D4AC54] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-gold-400" />
                  Razorpay & SSL Verified Gateway
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold font-playfair text-ivory-white leading-tight">
                Secure Academic Payments
              </h1>

              <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-2xl">
                Unified online payment gateway for MMSR Publications academic book purchases, annual journal subscriptions, book chapter indexing, peer-reviewed manuscript submission fees, conference proceedings, and Crossref DOI allocations.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link href="/checkout">
                  <Button variant="gold" size="lg" rightIcon={<ArrowRight className="w-4 h-4 text-navy-950" />}>
                    Go to Checkout
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" size="lg" leftIcon={<HelpCircle className="w-4 h-4 text-gold-400" />}>
                    Contact Finance Team
                  </Button>
                </Link>
              </div>
            </div>

            {/* Glass Payment Shield Card */}
            <div className="lg:col-span-4 p-6 rounded-2xl bg-white/5 border border-[#D4AC54]/60 backdrop-blur-xl space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gold-400 font-bold uppercase tracking-wider">Accepted Worldwide</span>
                <Lock className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-ivory-white font-semibold">
                Protected by 256-Bit SSL Encryption & Verified Razorpay Payment Network
              </p>
              <div className="grid grid-cols-3 gap-2 text-center text-[13px] text-text-muted pt-2 border-t border-[#D4AC54]/60">
                <div className="p-2 rounded-lg bg-navy-950">Cards</div>
                <div className="p-2 rounded-lg bg-navy-950">UPI QR</div>
                <div className="p-2 rounded-lg bg-navy-950">NetBanking</div>
              </div>
            </div>
          </div>
        </section>

        {/* PAYMENT METHODS SECTION */}
        <section className="space-y-8">
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Payment Options</span>
            <h2 className="text-2xl sm:text-4xl font-bold font-playfair text-ivory-white">
              100% Online & Secure Razorpay Channels
            </h2>
            <p className="text-xs sm:text-sm text-text-muted">
              All transactions are processed instantly through Razorpay with real-time verification and automated GST invoicing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 — Razorpay Online Gateway */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F8EEDC] border border-gold-500/40 hover:border-gold-500 transition-all space-y-6 relative overflow-hidden flex flex-col justify-between shadow-glass">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-gold-500/10 border border-[#D4AC54] text-gold-400">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <span className="text-[13px] font-extrabold uppercase bg-gold-500/20 text-gold-400 px-3 py-1 rounded-full border border-[#D4AC54]">
                    Recommended
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold font-playfair text-ivory-white">Credit & Debit Cards</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Instant automated payment with immediate digital receipt & order confirmation.
                  </p>
                </div>

                <div className="space-y-2 pt-2 text-xs text-text-muted">
                  <p className="font-semibold text-ivory-white">Supported Cards & Channels:</p>
                  <div className="flex flex-wrap gap-2 text-[13px]">
                    {['Visa', 'Mastercard', 'RuPay', 'American Express', 'NetBanking', 'Wallets'].map((b) => (
                      <span key={b} className="px-2.5 py-1 rounded-md bg-white/5 border border-[#D4AC54]/60 font-mono text-ivory-white">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D4AC54]/60 text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Instant Verification & Auto GST Invoice</span>
              </div>
            </div>

            {/* Card 2 — Instant UPI */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-gold-500/40 transition-all space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <span className="text-[13px] font-bold uppercase bg-white/5 text-text-muted px-2.5 py-1 rounded-full border border-[#D4AC54]/60">
                    Instant Scan
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold font-playfair text-ivory-white">Instant UPI & QR Scan</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Scan dynamic QR code or send payment request via GPay, PhonePe, Paytm, or BHIM.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-navy-950 border border-[#D4AC54]/60 text-center space-y-2">
                  <QrCode className="w-12 h-12 text-gold-400 mx-auto opacity-80" />
                  <p className="text-[13px] font-mono text-text-muted">Dynamic QR Generated at Checkout</p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D4AC54]/60 text-xs text-text-muted flex items-center gap-1.5">
                <Info className="w-4 h-4 text-gold-400 shrink-0" />
                <span>Zero Transaction Fees on Standard UPI</span>
              </div>
            </div>

            {/* Card 3 — Institutional & Corporate Billing via Razorpay */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-gold-500/40 transition-all space-y-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Building className="w-6 h-6" />
                  </div>
                  <span className="text-[13px] font-bold uppercase bg-white/5 text-text-muted px-2.5 py-1 rounded-full border border-[#D4AC54]/60">
                    Institutional
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold font-playfair text-ivory-white">Institutional Billing</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    Instant online checkout for university libraries, research laboratories, and academic departments.
                  </p>
                </div>

                <div className="space-y-2.5 text-xs text-text-muted pt-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Instant automated GST invoice generated on payment</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Corporate & Institutional NetBanking supported</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Immediate access entitlement for journals & proceedings</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D4AC54]/60 text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Official GST Compliant Receipts</span>
              </div>
            </div>
          </div>
        </section>

        {/* PAYMENT SECURITY CARDS */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { title: 'SSL Protected', desc: '256-Bit Encrypted Data', icon: Lock },
            { title: 'Razorpay Secured', desc: 'PCI-DSS Compliant', icon: ShieldCheck },
            { title: 'GST Tax Invoice', desc: 'Automated Billing', icon: FileText },
            { title: 'Secure Transactions', desc: 'Academic Protocol', icon: Building },
            { title: 'Privacy Guaranteed', desc: 'No Card Storage', icon: ShieldCheck },
          ].map((sc, idx) => {
            const IconComp = sc.icon;
            return (
              <div key={idx} className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-center space-y-2">
                <IconComp className="w-6 h-6 text-gold-400 mx-auto" />
                <p className="text-xs font-bold text-ivory-white">{sc.title}</p>
                <p className="text-[13px] text-text-muted">{sc.desc}</p>
              </div>
            );
          })}
        </section>

        {/* FREQUENTLY ASKED QUESTIONS */}
        <section className="space-y-6 max-w-3xl mx-auto w-full">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gold-400">Payment Help</span>
            <h2 className="text-2xl font-bold font-playfair text-ivory-white">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 text-xs sm:text-sm font-bold text-ivory-white hover:text-gold-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gold-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs text-text-muted leading-relaxed border-t border-[#D4AC54]/40 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA BOTTOM BAR */}
        <section className="p-8 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] text-center space-y-4">
          <h3 className="text-xl font-bold font-playfair text-ivory-white">Ready to Place Your Order?</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            Proceed to checkout to complete your transaction securely via Razorpay.
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link href="/checkout">
              <Button variant="gold" size="lg" rightIcon={<ArrowRight className="w-4 h-4 text-navy-950" />}>
                Go to Checkout
              </Button>
            </Link>
            <Link href="/contact">
              <Button variant="outline" size="lg">
                Contact Support
              </Button>
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
