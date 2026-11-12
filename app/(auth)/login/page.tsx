'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/context/AuthContext';

// Resolve where to send the user after login. Honors an explicit ?redirect=
// param (e.g. the paywall sends /articles/<slug>, the library sends
// /dashboard/journals). Only same-origin relative paths are allowed to prevent
// open-redirect abuse; anything else falls back to the home page.
function resolveRedirectTarget(): string {
  if (typeof window === 'undefined') return '/home';
  const raw = new URLSearchParams(window.location.search).get('redirect');
  if (raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\')) {
    return raw;
  }
  return '/home';
}

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace(resolveRedirectTarget());
    }
  }, [isAuthenticated, isAuthLoading, router]);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      newErrors.email = 'Please enter a valid academic or professional email address.';
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      router.push(resolveRedirectTarget());
    } catch (err: any) {
      setServerError(err?.message || 'Invalid credentials or authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleCredential = async (credential: string) => {
    setServerError(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle(credential);
      // Do NOT navigate from here. The Google callback runs outside React's event
      // cycle, and calling router.push here raced the authenticated-state effect
      // (above) that already redirects — the App Router cancelled the transition
      // and left the page on /login. Setting the session in context lets that
      // effect perform the redirect reliably.
    } catch (err: any) {
      setServerError(err?.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to your MMSR Publications account to access your author dashboard and submitted works."
      badgeText="Sign In"
      showTrustQuote={false}
    >
      {/* Backend / Server Error Banner */}
      {serverError && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-ruby-red/10 border border-ruby-red/30 text-ivory-white flex items-start gap-3 animate-fade-in text-xs leading-relaxed"
        >
          <AlertCircle className="w-5 h-5 text-ruby-red shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-ruby-red block mb-0.5">Authentication Error</span>
            {serverError}
          </div>
        </div>
      )}

      {/* Google sign-in errors surface through the shared server-error banner */}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email Field */}
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-ivory-white mb-1.5">
            Email Address <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              required
              disabled={isSubmitting}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder="author@institution.edu"
              className={`w-full bg-navy-950 border ${
                errors.email ? 'border-ruby-red' : 'border-[#D4AC54]/60 focus:border-gold-500'
              } rounded-xl pl-10 pr-4 py-3 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-[13px] text-ruby-red font-medium" role="alert">
              {errors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="login-password" className="block text-xs font-semibold text-ivory-white">
              Password <span className="text-gold-400">*</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-[13px] font-medium text-gold-400 hover:text-gold-300 hover:underline transition-colors"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              required
              disabled={isSubmitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder="••••••••••••"
              className={`w-full bg-navy-950 border ${
                errors.password ? 'border-ruby-red' : 'border-[#D4AC54]/60 focus:border-gold-500'
              } rounded-xl pl-10 pr-11 py-3 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-ivory-white focus:outline-none focus:text-gold-400 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-[13px] text-ruby-red font-medium" role="alert">
              {errors.password}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="login-remember"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded bg-navy-950 border-white/20 text-gold-500 focus:ring-gold-500/50 focus:ring-offset-navy-900 cursor-pointer"
            />
            <span className="text-xs text-text-muted">Remember me on this browser</span>
          </label>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="gold"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
            rightIcon={!isSubmitting ? <ArrowRight className="w-4 h-4" /> : undefined}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </div>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[13px] text-text-muted uppercase tracking-wider">Or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Google Login via Google Identity Services */}
      <GoogleLoginButton onCredential={handleGoogleCredential} disabled={googleLoading || isSubmitting} text="continue_with" />

      {/* Registration Link */}
      <div className="mt-6 text-center text-xs text-text-muted pt-4 border-t border-[#D4AC54]/60">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-semibold text-gold-400 hover:underline">
          Create an Account
        </Link>
      </div>
    </AuthLayout>
  );
}
