'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Building,
  User,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  BookOpen,
  Newspaper,
  ArrowLeft,
  ArrowRight,
  Truck,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/context/CartContext';
import { useAuth } from '@/lib/context/AuthContext';
import {
  EMAIL_RE,
  INDIAN_MOBILE_RE,
  INDIAN_PIN_RE,
  digitsOnly,
  lettersOnly,
  validateName,
  normalizeIndianMobile,
  validateIndianMobile,
} from '@/lib/validation';

const SHIPPING_ORIGINAL = 80;
const SHIPPING_DISCOUNTED = 40;

function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items: cartItems, subtotal: cartSubtotal } = useCart();
  const { user, tokens, isAuthenticated } = useAuth();

  const isBuyNowMode = searchParams.get('mode') === 'buy-now';

  const [buyNowItem, setBuyNowItem] = useState<any | null>(null);
  const [paymentMethod] = useState<'razorpay'>('razorpay');

  // Coupon State
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponNotice, setCouponNotice] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Retrieve Buy Now transient item if mode=buy-now
  useEffect(() => {
    if (isBuyNowMode && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('mmsr_buy_now_item');
        if (stored) {
          setBuyNowItem(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to read buy now item from sessionStorage:', e);
      }
    }
  }, [isBuyNowMode]);

  // Pre-fill user details from AuthContext if logged in
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || prev.fullName,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  // Effective checkout items & totals
  const effectiveItems = useMemo(() => {
    if (isBuyNowMode && buyNowItem) {
      return [buyNowItem];
    }
    return cartItems;
  }, [isBuyNowMode, buyNowItem, cartItems]);

  const effectiveSubtotal = useMemo(() => {
    if (isBuyNowMode && buyNowItem) {
      return (buyNowItem.price || 0) * (buyNowItem.quantity || 1);
    }
    return cartSubtotal;
  }, [isBuyNowMode, buyNowItem, cartSubtotal]);

  // Shipping applies only to physical (print/bundle) orders, matching the backend.
  const hasPhysicalItems = effectiveItems.some(
    (item: any) => item.itemType === 'book' || item.id?.startsWith('book-') ||
      ((item.itemType === 'journal_issue' || item.id?.startsWith('issue-')) && (item.format === 'print' || item.format === 'bundle'))
  );
  const effectiveShipping = hasPhysicalItems ? SHIPPING_DISCOUNTED : 0;
  const effectiveTotal = effectiveSubtotal + effectiveShipping;

  // Redirect if cart & buy-now items are both empty
  useEffect(() => {
    if (!isBuyNowMode && cartItems.length === 0) {
      router.replace('/cart');
    }
  }, [isBuyNowMode, cartItems, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Person / place name fields never contain digits — filter them out at the
    // keystroke level so an invalid value can never be typed or pasted in.
    const ALPHA_FIELDS = ['fullName', 'city', 'state', 'country'];
    const next = ALPHA_FIELDS.includes(name) ? lettersOnly(value) : value;
    setFormData((prev) => ({ ...prev, [name]: next }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    const nameErr = validateName(formData.fullName, 'Full Name');
    if (nameErr) errors.fullName = nameErr;
    if (formData.email.trim() && !EMAIL_RE.test(formData.email.trim())) {
      errors.email = 'Valid Email Address is required.';
    } else if (!formData.email.trim()) {
      errors.email = 'Email address is required.';
    }

    // Strict rule, no silent digit-stripping: letters/symbols or a wrong
    // length block submission with an inline message (backend mirrors this).
    const phoneError = validateIndianMobile(formData.phone, 'Phone number');
    if (phoneError) errors.phone = `${phoneError} It is required for delivery SMS.`;

    if (!formData.addressLine1.trim()) errors.addressLine1 = 'Address Line 1 is required.';
    const cityErr = validateName(formData.city, 'City');
    if (cityErr) errors.city = cityErr;
    const stateErr = validateName(formData.state, 'State / Region');
    if (stateErr) errors.state = stateErr;

    if (formData.postalCode.trim() && INDIAN_PIN_RE.test(formData.postalCode.trim())) {
      // valid PIN
    } else {
      errors.postalCode = 'PIN code must be exactly 6 digits (e.g. 600001).';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const isFormValid = useMemo(() => {
    return (
      formData.fullName.trim() !== '' &&
      EMAIL_RE.test(formData.email.trim()) &&
      INDIAN_MOBILE_RE.test(normalizeIndianMobile(formData.phone)) &&
      formData.addressLine1.trim() !== '' &&
      formData.city.trim() !== '' &&
      formData.state.trim() !== '' &&
      INDIAN_PIN_RE.test(formData.postalCode.trim())
    );
  }, [formData]);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setAppliedCoupon(couponCode.trim().toUpperCase());
    setCouponNotice('Coupon applied. Discounts are validated and applied during backend verification.');
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) return;

    if (!isAuthenticated || !tokens?.access) {
      setSubmitError('Please sign in to your MMSR account to place an order.');
      setTimeout(() => {
        router.push(`/login?redirect=/checkout`);
      }, 2000);
      return;
    }

    setIsSubmitting(true);

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

      const payload = {
        full_name: formData.fullName,
        email: formData.email,
        // Model field is phone_number; validation above guarantees a clean
        // 10-digit Indian mobile, this only normalizes +91/trunk-prefixed forms.
        phone_number: normalizeIndianMobile(formData.phone),
        // Street address only; city/state/pin/country are their own columns now.
        shipping_address: [formData.addressLine1, formData.addressLine2].filter(Boolean).join(', '),
        city: formData.city,
        state: formData.state,
        postal_code: formData.postalCode,
        country: formData.country,
        payment_method: paymentMethod,
        coupon_code: appliedCoupon || undefined,
        items: effectiveItems.flatMap((item) => {
          // Complete-issue purchases are retired; the backend rejects such items.
          // Never send one even if a stale cart/checkout state still holds it.
          if (item.itemType === 'journal_issue' || item.id?.startsWith('issue-')) return [];
          return [{
            ...(item.itemType === 'book' || item.id?.startsWith('book-') ? { book: item.targetId } : {}),
            ...(item.itemType === 'journal_subscription' || item.id?.startsWith('sub-') ? { journal_subscription: item.targetId } : {}),
            ...(item.itemType === 'article' || item.id?.startsWith('art-') ? { article: item.targetId } : {}),
            quantity: item.quantity || 1,
            format: item.format || 'digital',
          }];
        }),
      };

      const res = await fetch(`${apiBase}/api/commerce/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || data.detail || `Server returned error ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      const orderData = await res.json();
      // Route the payment flow on the public order reference; the API also
      // accepts the numeric id, so the fallback keeps old responses working.
      const orderId = orderData.public_id || orderData.id;

      router.push(`/payment/processing/${orderId}`);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to initialize order on server. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    // AppLayout (root layout) already renders Navbar + <main> + Footer for
    // /checkout — rendering them again here produced two fixed headers stacked
    // at top:0 and a nested second <main> landmark (Phase 4 browser audit).
    <div className="pt-28 pb-20 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="p-6 sm:p-8 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#73614C] mb-2">
            <Link href="/home" className="hover:text-[#C99A2E]">Home</Link>
            <span>/</span>
            <Link href="/cart" className="hover:text-[#C99A2E]">Cart</Link>
            <span>/</span>
            <span className="text-[#C99A2E] font-semibold">
              {isBuyNowMode ? 'Instant Express Checkout' : 'Checkout'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold font-playfair text-[#2F241A] tracking-tight flex items-center gap-3">
            <Lock className="w-7 h-7 text-[#C99A2E]" />
            {isBuyNowMode ? 'Buy Now Express Checkout' : 'Secure Checkout'}
          </h1>
          <p className="text-xs sm:text-sm text-[#73614C] mt-1">
            {isBuyNowMode
              ? 'Complete instant single-item checkout without modifying your main cart.'
              : 'Complete your shipping address and select your preferred payment option.'}
          </p>
        </div>

        <Link href="/cart" className="text-xs font-semibold text-[#C99A2E] hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Cart</span>
        </Link>
      </div>

      {/* Global Error Banner */}
      {submitError && (
        <div className="p-4 rounded-2xl bg-red-50 border border-[#DC2626]/25 text-red-800 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{submitError}</span>
        </div>
      )}

      <form onSubmit={handleCheckoutSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Shipping Form & Payment Method Cards */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Shipping Info Banner */}
          <div className="p-4 rounded-[20px] bg-[#FFF9F1] border border-[#D4AC54] flex items-center gap-3 shadow-sm">
            <Truck className="w-5 h-5 text-[#C99A2E] shrink-0" />
            <p className="text-xs text-[#73614C]">
                            <span className="font-semibold text-[#2F241A]">Flat ₹40 Shipping</span> — 50% off on standard delivery (originally ₹80). Applied automatically on all print / physical orders.
            </p>
          </div>

          {/* Shipping Information Card */}
          <div className="p-6 sm:p-8 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] space-y-6 shadow-md">
            <h2 className="text-base font-bold font-playfair text-[#2F241A] pb-3 border-b border-[#D4AC54] flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#C99A2E]" />
              Shipping & Recipient Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#73614C] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#C99A2E]" /> Full Name *
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Rajesh Kumar"
                  className={`w-full bg-[#FFFDF8] border rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none ${
                    formErrors.fullName ? 'border-red-500' : 'border-[#D4AC54] focus:border-[#C99A2E]'
                  }`}
                />
                {formErrors.fullName && <p className="text-[13px] text-red-600">{formErrors.fullName}</p>}
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#73614C] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#C99A2E]" /> Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. rajesh@university.edu"
                  className={`w-full bg-[#FFFDF8] border rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none ${
                    formErrors.email ? 'border-red-500' : 'border-[#D4AC54] focus:border-[#C99A2E]'
                  }`}
                />
                {formErrors.email && <p className="text-[13px] text-red-600">{formErrors.email}</p>}
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#73614C] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#C99A2E]" /> Phone Number (10 Digits) *
                </label>
                <input
                  type="tel"
                  name="phone"
                  inputMode="numeric"
                  maxLength={10}
                  value={formData.phone}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 10);
                    setFormData((prev) => ({ ...prev, phone: v }));
                    if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
                  }}
                  aria-invalid={!!formErrors.phone}
                  placeholder="e.g. 9876543210"
                  className={`w-full bg-[#FFFDF8] border rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none ${
                    formErrors.phone ? 'border-red-500' : 'border-[#D4AC54] focus:border-[#C99A2E]'
                  }`}
                />
                {formErrors.phone && <p className="text-[13px] text-red-600">{formErrors.phone}</p>}
              </div>

              {/* Address Line 1 */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#73614C] flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#C99A2E]" /> Address Line 1 *
                </label>
                <input
                  type="text"
                  name="addressLine1"
                  value={formData.addressLine1}
                  onChange={handleChange}
                  placeholder="Department, Building, Street Address"
                  className={`w-full bg-[#FFFDF8] border rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none ${
                    formErrors.addressLine1 ? 'border-red-500' : 'border-[#D4AC54] focus:border-[#C99A2E]'
                  }`}
                />
                {formErrors.addressLine1 && <p className="text-[13px] text-red-600">{formErrors.addressLine1}</p>}
              </div>

              {/* Address Line 2 */}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-[#73614C]">Address Line 2 (Optional)</label>
                <input
                  type="text"
                  name="addressLine2"
                  value={formData.addressLine2}
                  onChange={handleChange}
                  placeholder="Suite, Landmark, Campus area"
                  className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none"
                />
              </div>

              {/* City */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#73614C]">City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. New Delhi"
                  className={`w-full bg-[#FFFDF8] border rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none ${
                    formErrors.city ? 'border-red-500' : 'border-[#D4AC54] focus:border-[#C99A2E]'
                  }`}
                />
                {formErrors.city && <p className="text-[13px] text-red-600">{formErrors.city}</p>}
              </div>

              {/* State */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#73614C]">State / Region *</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="e.g. Delhi NCR"
                  className={`w-full bg-[#FFFDF8] border rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none ${
                    formErrors.state ? 'border-red-500' : 'border-[#D4AC54] focus:border-[#C99A2E]'
                  }`}
                />
                {formErrors.state && <p className="text-[13px] text-red-600">{formErrors.state}</p>}
              </div>

              {/* Country */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#73614C]">Country *</label>
                <select
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="w-full bg-[#FFFDF8] border border-[#D4AC54] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-xs text-[#2F241A] focus:outline-none"
                >
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Germany">Germany</option>
                  <option value="Other">Other Country</option>
                </select>
              </div>

              {/* Postal Code */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#73614C]">Postal / PIN Code *</label>
                <input
                  type="text"
                  name="postalCode"
                  inputMode="numeric"
                  maxLength={6}
                  value={formData.postalCode}
                  onChange={(e) => {
                    const v = digitsOnly(e.target.value, 6);
                    setFormData((prev) => ({ ...prev, postalCode: v }));
                    if (formErrors.postalCode) setFormErrors((prev) => ({ ...prev, postalCode: '' }));
                  }}
                  aria-invalid={!!formErrors.postalCode}
                  placeholder="e.g. 110001"
                  className={`w-full bg-[#FFFDF8] border rounded-xl px-4 py-2.5 text-xs text-[#2F241A] placeholder:text-[#73614C] focus:outline-none ${
                    formErrors.postalCode ? 'border-red-500' : 'border-[#D4AC54] focus:border-[#C99A2E]'
                  }`}
                />
                {formErrors.postalCode && <p className="text-[13px] text-red-600">{formErrors.postalCode}</p>}
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Order Summary & Action */}
        <div className="lg:col-span-4 sticky top-28 space-y-6">
          <div className="p-6 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] space-y-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#C99A2E]/10 rounded-full blur-[70px] pointer-events-none" />

            <h2 className="text-base font-bold font-playfair text-[#2F241A] pb-3 border-b border-[#D4AC54] flex items-center justify-between">
              <span>Selected Items</span>
              <span className="text-xs font-mono text-[#C99A2E]">{effectiveItems.length}</span>
            </h2>

            {/* Items List Thumbnails */}
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {effectiveItems.map((item, idx) => (
                <div key={item.id || idx} className="p-2.5 rounded-xl bg-[#FFFDF8] border border-[#D4AC54] flex items-center justify-between gap-3 text-xs">
                  <div className="p-2 rounded-lg bg-[#F8EEDC] border border-[#D4AC54] shrink-0 text-[#C99A2E]">
                    {item.itemType === 'book' || item.id?.startsWith('book-') ? (
                      <BookOpen className="w-4 h-4" />
                    ) : (
                      <Newspaper className="w-4 h-4 text-[#C99A2E]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#2F241A] line-clamp-1">{item.title}</p>
                    <div className="flex items-center gap-1.5 text-[13px] text-[#73614C]">
                      <span>Qty: {item.quantity || 1}</span>
                      {item.formatLabel && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-[#C99A2E]">{item.formatLabel}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-[#C99A2E] shrink-0">
                    ₹{((item.salePrice ?? item.price ?? 0) * (item.quantity || 1)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals Breakdown */}
            <div className="space-y-3 text-xs pt-3 border-t border-[#D4AC54]">
              <div className="flex items-center justify-between text-[#73614C]">
                <span>Items Subtotal</span>
                <span className="font-semibold text-[#2F241A] font-mono">₹{effectiveSubtotal.toFixed(2)}</span>
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
              <span className="text-2xl font-bold font-playfair text-[#C99A2E]">₹{effectiveTotal.toFixed(2)}</span>
            </div>

            {/* Savings callout */}
            {hasPhysicalItems && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[13px] text-emerald-700 text-center flex items-center justify-center gap-1.5">
                <Tag className="w-4 h-4 shrink-0" />
                <span>You save ₹{SHIPPING_ORIGINAL - SHIPPING_DISCOUNTED} on shipping with our 50% offer!</span>
              </div>
            )}

            <Button
              type="submit"
              variant="gold"
              size="xl"
              fullWidth
              disabled={isSubmitting}
              isLoading={isSubmitting}
              rightIcon={!isSubmitting ? <ArrowRight className="w-5 h-5 text-[#3E2A20]" /> : undefined}
            >
              Proceed to Payment
            </Button>


          </div>
        </div>
      </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#2F241A] font-manrope flex flex-col justify-between">
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-[#C99A2E] border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
