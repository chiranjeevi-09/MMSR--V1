'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, LogIn, ArrowLeft } from 'lucide-react';
import { SiteLogo } from '@/components/ui/SiteLogo';
import { useAuth } from '@/lib/context/AuthContext';
import { SITE_DOMAIN } from '@/lib/config/site';

export default function AdminLoginPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AdminLoginContent />
    </Suspense>
  );
}

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Success banners: ?activated=1 from the invitation flow, ?reset=1 from reset.
  const notice = searchParams.get('activated')
    ? 'Password set! Sign in with your work email and the password you just created.'
    : searchParams.get('reset')
      ? 'Password reset successfully. Sign in with your new password.'
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const userProfile = await login({ email, password });
      if (userProfile?.is_staff || userProfile?.is_superuser) {
        router.push('/admin/dashboard');
      } else {
        setErrorMessage('Access denied: You do not have editorial staff or administrator permissions.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid credentials or connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#F7F3EB' }}>
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between relative overflow-hidden"
        style={{ backgroundColor: '#3E2E22' }}>
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C9A66B_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10">
          <Link href="/home" className="inline-flex items-center gap-3">
            <SiteLogo className="w-12 h-12" />
            <div>
              <span className="font-playfair font-bold text-xl tracking-wider block" style={{ color: '#F7F3EB' }}>
                MMSR <span style={{ color: '#C9A66B' }}>CMS</span>
              </span>
              <span className="text-[13px] font-semibold uppercase tracking-widest block" style={{ color: '#C9A66B' }}>
                Editorial Management System
              </span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="space-y-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest inline-block"
              style={{ background: 'rgba(201,166,107,0.15)', border: '1px solid rgba(201,166,107,0.3)', color: '#C9A66B' }}>
              Restricted Area
            </span>
            <h2 className="text-3xl font-playfair font-bold leading-tight" style={{ color: '#F7F3EB' }}>
              Editorial Staff & Administration Portal
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(247,243,235,0.7)' }}>
              Secure access to MMSR Publications content management - books, journals, submissions, and more.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Editorial Reviews', value: 'Real-time' },
              { label: 'Secure JWT Auth', value: 'Encrypted' },
              { label: 'Manuscript CMS', value: 'Full Access' },
              { label: 'Publisher Tools', value: 'Complete' },
            ].map((item) => (
              <div key={item.label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,166,107,0.2)' }}>
                <p className="text-[13px] uppercase font-bold tracking-wider" style={{ color: '#C9A66B' }}>{item.label}</p>
                <p className="text-xs font-semibold mt-0.5" style={{ color: '#F7F3EB' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[13px]" style={{ color: 'rgba(247,243,235,0.4)' }}>
          Copyright 2026 MMSR Publications - All rights reserved
        </div>
      </div>

      {/* Right Login Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <SiteLogo className="w-7 h-7" />
            <span className="font-playfair font-bold text-lg" style={{ color: '#3E2E22' }}>MMSR CMS</span>
          </div>

          {/* Card */}
          <div className="rounded-3xl p-8 space-y-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 4px 32px rgba(92,75,58,0.08)' }}>
            <div className="text-center space-y-2">
              <SiteLogo className="w-14 h-14 mx-auto" />
              <span className="inline-block px-3 py-1 rounded-full text-[13px] font-mono font-bold uppercase tracking-widest"
                style={{ background: 'rgba(201,166,107,0.1)', color: '#A98042', border: '1px solid rgba(201,166,107,0.3)' }}>
                Editorial Management Gateway
              </span>
              <h1 className="text-2xl font-bold font-playfair" style={{ color: '#3E2E22' }}>Admin Sign In</h1>
              <p className="text-xs" style={{ color: '#8B7B68' }}>Editorial & Administration Portal</p>
            </div>

            {notice && (
              <div className="p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold"
                style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.25)', color: '#16a34a' }}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-semibold"
                style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block" style={{ color: '#5C4B3A' }}>
                  Admin Email Address <span className="font-normal text-[#8B7B68]">— work or personal email</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8B7B68' }} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`admin@${SITE_DOMAIN}`}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs transition-colors outline-none"
                    style={{
                      background: '#FFFFFF',
                      border: '1.5px solid #E9DFCF',
                      color: '#3E2E22',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#C9A66B')}
                    onBlur={(e) => (e.target.style.borderColor = '#E9DFCF')}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold block" style={{ color: '#5C4B3A' }}>Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8B7B68' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs transition-colors outline-none"
                    style={{ background: '#FFFFFF', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                    onFocus={(e) => (e.target.style.borderColor = '#C9A66B')}
                    onBlur={(e) => (e.target.style.borderColor = '#E9DFCF')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: '#8B7B68' }}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <Link href="/forgot-password" className="text-[13px] font-semibold hover:underline" style={{ color: '#A98042' }}>
                    Forgot password?
                  </Link>
                </div>
              </div>

              {/* Sign In Button */}
              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: isSubmitting ? '#E9DFCF' : '#C9A66B',
                    color: isSubmitting ? '#8B7B68' : '#3E2E22',
                    boxShadow: '0 4px 16px rgba(201,166,107,0.3)',
                  }}
                  onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = '#A98042'; }}
                  onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.background = '#C9A66B'; }}
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#8B7B68', borderTopColor: 'transparent' }} />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  {isSubmitting ? 'Verifying...' : 'Secure Admin Sign In'}
                </button>

                <Link href="/home" className="block">
                  <button
                    type="button"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ background: '#FFFFFF', border: '1.5px solid #E9DFCF', color: '#5C4B3A' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#C9A66B')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E9DFCF')}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Public Website
                  </button>
                </Link>
              </div>
            </form>

            <div className="pt-4 text-center text-[13px] flex items-center justify-center gap-2 font-mono"
              style={{ borderTop: '1px solid #E9DFCF', color: '#8B7B68' }}>
              <Lock className="w-3.5 h-3.5" style={{ color: '#C9A66B' }} />
              <span>JWT Encrypted - Protected Staff Session</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}