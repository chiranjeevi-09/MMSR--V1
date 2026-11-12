'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Info, AlertCircle, CheckCircle2, ArrowLeft, Send } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { authService } from '@/lib/services/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validate = () => {
    if (!email.trim()) {
      setError('Email address is required.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid academic or professional email address.');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await authService.requestPasswordReset(email.trim());
      setSuccessMessage(response.message);
    } catch (err: any) {
      setServerError(err?.message || 'Password reset request failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot Password"
      subtitle="Enter your registered academic email address to receive password recovery instructions."
      badgeText="Password Recovery"
      showTrustQuote={false}
    >
      {/* Backend Error Banner */}
      {serverError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-ruby-red/10 border border-ruby-red/30 text-ivory-white flex items-start gap-3 animate-fade-in text-xs leading-relaxed"
        >
          <AlertCircle className="w-5 h-5 text-ruby-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-ruby-red block mb-0.5">Request Error</span>
            {serverError}
          </div>
        </div>
      )}

      {/* Success Response Banner */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-ivory-white flex items-start gap-3 animate-fade-in text-xs leading-relaxed"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-emerald-400 leading-relaxed">{successMessage}</div>
        </div>
      )}

      {/* Forgot Password Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="forgot-email" className="block text-xs font-semibold text-ivory-white mb-1.5">
            Registered Email Address <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="forgot-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(null);
              }}
              placeholder="author@institution.edu"
              className={`w-full bg-navy-950 border ${
                error ? 'border-ruby-red' : 'border-[#D4AC54]/60 focus:border-gold-500'
              } rounded-xl pl-10 pr-4 py-3 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
            />
          </div>
          {error && (
            <p className="mt-1 text-[13px] text-ruby-red font-medium" role="alert">
              {error}
            </p>
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
            rightIcon={!isSubmitting ? <Send className="w-4 h-4" /> : undefined}
          >
            {isSubmitting ? 'Sending Request...' : 'Send Reset Link'}
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
    </AuthLayout>
  );
}
