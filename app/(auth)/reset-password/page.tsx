'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { authService } from '@/lib/services/auth';

function ResetPasswordFormContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = () => {
    const newErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      newErrors.password = 'New password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!uid || !token) {
      setServerError('Missing reset link parameters (uid or token). Please click the reset link from your email.');
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await authService.confirmPasswordReset(uid, token, password);
      setSuccessMessage(response.message);
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      setServerError(err?.message || 'Password reset failed. The link may have expired or is invalid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backend Error Banner */}
      {serverError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-ruby-red/10 border border-ruby-red/30 text-ivory-white flex items-start gap-3 animate-fade-in text-xs leading-relaxed"
        >
          <AlertCircle className="w-5 h-5 text-ruby-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-ruby-red block mb-0.5">Reset Error</span>
            {serverError}
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-ivory-white flex items-start gap-3 animate-fade-in text-xs leading-relaxed"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-emerald-400 block mb-0.5">Password Reset Successful</span>
            {successMessage}
          </div>
        </div>
      )}

      {!uid || !token ? (
        <div className="p-4 rounded-xl bg-gold-500/10 border border-[#D4AC54] text-xs text-ivory-white leading-relaxed mb-6">
          <p className="font-semibold text-gold-400 mb-1">Reset Link Required</p>
          Please use the link sent to your registered email address to reset your password. It contains the required validation security parameters.
        </div>
      ) : null}

      {/* Reset Password Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* New Password */}
        <div>
          <label htmlFor="reset-password" className="block text-xs font-semibold text-ivory-white mb-1.5">
            New Password <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reset-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="Minimum 8 characters"
              className={`w-full bg-navy-950 border ${
                errors.password ? 'border-ruby-red' : 'border-[#D4AC54]/60 focus:border-gold-500'
              } rounded-xl pl-10 pr-11 py-3 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-ivory-white focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-[13px] text-ruby-red font-medium">{errors.password}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="reset-confirmpassword" className="block text-xs font-semibold text-ivory-white mb-1.5">
            Confirm New Password <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reset-confirmpassword"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              autoComplete="new-password"
              required
              disabled={isSubmitting}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
              }}
              placeholder="Re-enter new password"
              className={`w-full bg-navy-950 border ${
                errors.confirmPassword ? 'border-ruby-red' : 'border-[#D4AC54]/60 focus:border-gold-500'
              } rounded-xl pl-10 pr-11 py-3 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-ivory-white focus:outline-none"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-[13px] text-ruby-red font-medium">{errors.confirmPassword}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="gold"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            rightIcon={!isSubmitting ? <KeyRound className="w-4 h-4" /> : undefined}
          >
            {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
          </Button>
        </div>
      </form>

      {/* Navigation Links */}
      <div className="mt-6 text-center text-xs text-text-muted pt-4 border-t border-[#D4AC54]/60 flex items-center justify-between">
        <Link href="/login" className="flex items-center gap-1.5 font-semibold text-gold-400 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Login</span>
        </Link>
        <Link href="/register" className="text-text-muted hover:text-ivory-white">
          Create Account
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Set a new secure password for your MMSR Publications account."
      badgeText="Set New Password"
    >
      <Suspense fallback={<div className="py-8 text-center text-xs text-text-muted">Loading reset form...</div>}>
        <ResetPasswordFormContent />
      </Suspense>
    </AuthLayout>
  );
}
