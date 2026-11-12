'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Lock,
  UserRound,
  Mail,
  Timer,
  KeyRound,
  ArrowLeft,
} from 'lucide-react';
import { validateInvitation, acceptInvitation, InvitationDetails } from '@/lib/services/cms';

type PageState = 'checking' | 'valid' | 'invalid';

export default function AcceptInvitationPage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <AcceptInvitationContent />
    </Suspense>
  );
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [state, setState] = useState<PageState>('checking');
  const [invalidMessage, setInvalidMessage] = useState('');
  const [details, setDetails] = useState<InvitationDetails | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Validate the token server-side on mount — never trust the link alone.
  useEffect(() => {
    if (!token) {
      setState('invalid');
      setInvalidMessage('This invitation link is invalid, expired, or has already been used.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await validateInvitation(token);
        if (cancelled) return;
        if (res.valid) {
          setDetails(res);
          setState('valid');
        } else {
          setState('invalid');
          setInvalidMessage('This invitation link is invalid, expired, or has already been used.');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setState('invalid');
        setInvalidMessage(
          err instanceof Error && err.message
            ? err.message
            : 'This invitation link is invalid, expired, or has already been used.'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Live strength hints mirroring Django's validators (enforced server-side).
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Not entirely numeric', ok: password.length > 0 && !/^\d+$/.test(password) },
    { label: 'Not a common password', ok: password.length > 0 && !/^(password|123456|qwerty|admin|welcome|letmein)[\d!@#$]*$/i.test(password) },
  ];

  const validate = () => {
    const next: Record<string, string> = {};
    if (!checks[0].ok) next.password = 'Password must be at least 8 characters.';
    else if (!checks[1].ok) next.password = 'Password cannot be entirely numeric.';
    else if (!checks[2].ok) next.password = 'This password is too common. Choose something stronger.';
    if (confirmPassword !== password) next.confirm = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await acceptInvitation(token, password);
      router.push('/admin/login?activated=1');
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : 'Activation failed. The invitation may have expired or been used already.'
      );
      setSubmitting(false);
    }
  };

  const expiryLabel = details?.expires_at
    ? new Date(details.expires_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
    : null;

  const inputCls =
    'w-full pl-10 pr-10 py-2.5 rounded-xl text-xs transition-colors outline-none';
  const inputStyle = { background: '#FFFFFF', border: '1.5px solid #E9DFCF', color: '#3E2E22' };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: '#F7F3EB' }}>
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between relative overflow-hidden"
        style={{ backgroundColor: '#3E2E22' }}>
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C9A66B_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="relative z-10">
          <Link href="/home" className="inline-flex items-center gap-3">
            <div className="p-2.5 rounded-2xl" style={{ background: 'rgba(201,166,107,0.15)', border: '1px solid rgba(201,166,107,0.3)' }}>
              <ShieldCheck className="w-7 h-7" style={{ color: '#C9A66B' }} />
            </div>
            <div>
              <span className="font-playfair font-bold text-xl tracking-wider block" style={{ color: '#F7F3EB' }}>
                MMSR <span style={{ color: '#C9A66B' }}>Publications</span>
              </span>
              <span className="text-[13px] font-semibold uppercase tracking-widest block" style={{ color: '#C9A66B' }}>
                Admin Portal Invitation
              </span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="space-y-3">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-widest inline-block"
              style={{ background: 'rgba(201,166,107,0.15)', border: '1px solid rgba(201,166,107,0.3)', color: '#C9A66B' }}>
              Secure Activation
            </span>
            <h2 className="text-3xl font-playfair font-bold leading-tight" style={{ color: '#F7F3EB' }}>
              Activate Your Admin Account
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(247,243,235,0.7)' }}>
              You have been invited to join the MMSR Publications editorial &amp; administration team.
              Set a password to activate your account — it takes less than a minute.
            </p>
          </div>

          <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(201,166,107,0.2)' }}>
            <p className="text-[13px] uppercase font-bold tracking-wider" style={{ color: '#C9A66B' }}>Security notice</p>
            <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(247,243,235,0.7)' }}>
              This link is single-use and HTTPS-secured. If you did not expect this invitation, do not
              activate the account — contact the MMSR administrator who manages your organisation&apos;s portal.
            </p>
          </div>
        </div>

        <div className="relative z-10 text-[13px]" style={{ color: 'rgba(247,243,235,0.4)' }}>
          Copyright 2026 MMSR Publications - All rights reserved
        </div>
      </div>

      {/* Right Activation Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <ShieldCheck className="w-6 h-6" style={{ color: '#C9A66B' }} />
            <span className="font-playfair font-bold text-lg" style={{ color: '#3E2E22' }}>MMSR Publications</span>
          </div>

          <div className="rounded-3xl p-8 space-y-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 4px 32px rgba(92,75,58,0.08)' }}>
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
                style={{ background: 'rgba(201,166,107,0.1)', border: '1px solid rgba(201,166,107,0.3)' }}>
                <KeyRound className="w-7 h-7" style={{ color: '#C9A66B' }} />
              </div>
              <h1 className="text-2xl font-bold font-playfair" style={{ color: '#3E2E22' }}>
                {state === 'valid' ? 'Create Your Password' : state === 'invalid' ? 'Invitation Unusable' : 'Verifying Invitation'}
              </h1>
              <p className="text-xs" style={{ color: '#8B7B68' }}>
                {state === 'valid'
                  ? 'Your invitation is valid. Create your own password — you will sign in with your work email afterwards.'
                  : state === 'invalid'
                    ? 'The activation link could not be verified.'
                    : 'Checking the link with the server...'}
              </p>
            </div>

            {/* Checking spinner */}
            {state === 'checking' && (
              <div className="py-8 flex flex-col items-center gap-3">
                <div className="w-7 h-7 border-2 border-[#C9A66B] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#8B7B68]">Validating your invitation token...</p>
              </div>
            )}

            {/* Invalid token */}
            {state === 'invalid' && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-semibold"
                  style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{invalidMessage}</span>
                </div>
                <p className="text-[13px] text-[#8B7B68] leading-relaxed">
                  Invitation links are single-use and expire for security reasons. If your link expired,
                  ask a Super Admin to resend a fresh invitation from the Admin Access page.
                </p>
                <Link href="/admin/login" className="flex items-center justify-center gap-2 text-[13px] font-bold hover:underline" style={{ color: '#A98042' }}>
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Admin Sign In
                </Link>
              </div>
            )}

            {/* Valid: password form */}
            {state === 'valid' && details && (
              <>
                {/* Invitee identity card */}
                <div className="p-4 rounded-xl space-y-2.5" style={{ background: '#FFF8EE', border: '1px solid #E9DFCF' }}>
                  <div className="flex items-center gap-2.5">
                    <UserRound className="w-4 h-4 shrink-0" style={{ color: '#A98042' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#3E2E22] truncate">{details.full_name}</p>
                      <p className="text-[13px] text-[#8B7B68] truncate" title="Work email — your admin login identifier">
                        Work Email — Admin Login: <span className="font-semibold text-[#5C4B3A]">{details.work_email || details.email}</span>
                      </p>
                      {details.personal_email && (
                        <p className="text-[13px] text-[#8B7B68] truncate" title="Personal email — your existing account, unchanged">
                          Personal Email — Existing Account: {details.personal_email}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-bold"
                      style={{ background: 'rgba(201,166,107,0.14)', border: '1px solid rgba(201,166,107,0.35)', color: '#A98042' }}>
                      <ShieldCheck className="w-3 h-3" /> {details.role_display}
                      {details.department ? ` · ${details.department}` : ''}
                    </span>
                    {expiryLabel && (
                      <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#8B7B68]">
                        <Timer className="w-3 h-3" /> Expires {expiryLabel} IST
                      </span>
                    )}
                  </div>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl flex items-start gap-2.5 text-xs font-semibold"
                    style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{submitError}</span>
                  </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold block" style={{ color: '#5C4B3A' }}>Create Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8B7B68' }} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: '' })); }}
                        placeholder="Minimum 8 characters"
                        className={`${inputCls} ${errors.password ? '!border-[#DC2626]' : ''}`}
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.borderColor = '#C9A66B')}
                        onBlur={(e) => (e.target.style.borderColor = errors.password ? '#DC2626' : '#E9DFCF')}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8B7B68' }}>
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-[13px] mt-1" style={{ color: '#DC2626' }}>{errors.password}</p>}
                    {/* Strength hints */}
                    <ul className="space-y-0.5 pt-0.5">
                      {checks.map((c) => (
                        <li key={c.label} className="flex items-center gap-1.5 text-[13px]"
                          style={{ color: c.ok ? '#16a34a' : '#8B7B68' }}>
                          {c.ok ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <span className="w-3 h-3 shrink-0 inline-block rounded-full border border-[#C9C0B2]" />}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold block" style={{ color: '#5C4B3A' }}>Confirm Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#8B7B68' }} />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); setErrors((x) => ({ ...x, confirm: '' })); }}
                        placeholder="Re-enter your password"
                        className={`${inputCls} ${errors.confirm ? '!border-[#DC2626]' : ''}`}
                        style={inputStyle}
                        onFocus={(e) => (e.target.style.borderColor = '#C9A66B')}
                        onBlur={(e) => (e.target.style.borderColor = errors.confirm ? '#DC2626' : '#E9DFCF')}
                        autoComplete="new-password"
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#8B7B68' }}>
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirm && <p className="text-[13px] mt-1" style={{ color: '#DC2626' }}>{errors.confirm}</p>}
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={submitting || !password || !confirmPassword}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: submitting ? '#E9DFCF' : '#C9A66B',
                        color: submitting ? '#8B7B68' : '#3E2E22',
                        boxShadow: submitting ? 'none' : '0 4px 16px rgba(201,166,107,0.3)',
                      }}
                      onMouseEnter={(e) => { if (!submitting) e.currentTarget.style.background = '#A98042'; }}
                      onMouseLeave={(e) => { if (!submitting) e.currentTarget.style.background = '#C9A66B'; }}
                    >
                      {submitting ? (
                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#8B7B68', borderTopColor: 'transparent' }} />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Set Password
                        </>
                      )}
                    </button>
                  </div>
                </form>

                <p className="text-[13px] text-[#8B7B68] text-center leading-relaxed">
                  Your password is hashed with Django&apos;s secure hashers — it is never emailed,
                  logged, or stored in plain text. You alone create it; no one at MMSR can see or set it.
                </p>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-[13px]" style={{ color: '#8B7B68' }}>
            <Mail className="w-3.5 h-3.5" />
            <span>
              Unexpected invitation?{' '}
              <Link href="/contact" className="font-bold hover:underline" style={{ color: '#A98042' }}>
                Contact the administrator
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
