'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, User, Phone, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/context/AuthContext';
import { digitsOnly, lettersOnly, validateName, validateOptionalIndianMobile, EMAIL_RE } from '@/lib/validation';

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, isAuthenticated, isLoading: isAuthLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form Submission States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    phone?: string;
    password?: string;
    confirmPassword?: string;
    termsAccepted?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isAuthLoading, router]);

  const validate = () => {
    const newErrors: typeof errors = {};

    const nameErr = validateName(fullName, 'Full name');
    if (nameErr) {
      newErrors.fullName = nameErr;
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!EMAIL_RE.test(email.trim())) {
      newErrors.email = 'Please enter a valid academic or professional email address.';
    }

    // Optional, but if given it must be a real 10-digit Indian mobile — the
    // same rule the backend enforces on User.phone_number.
    if (phone.trim()) {
      const phoneError = validateOptionalIndianMobile(phone);
      if (phoneError) newErrors.phone = phoneError;
    }

    if (!password) {
      newErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long.';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!termsAccepted) {
      newErrors.termsAccepted = 'You must accept the Terms & Conditions and Privacy Policy.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) return;

    setIsSubmitting(true);

    // Split Full Name into first_name and last_name for Django User model
    const nameParts = fullName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || ' ';

    try {
      await register({
        email: email.trim(),
        password,
        first_name: firstName,
        last_name: lastName,
        phone_number: phone.trim() || undefined,
      });

      setSuccessMessage('Account created successfully! Redirecting to login page...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setServerError(err?.message || 'Registration failed. Please verify your information.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Google sign-up: the backend creates a new public customer (or signs in a
  // previously Google-linked one) and returns an MMSR session directly, so a
  // successful exchange authenticates the user without a separate password step.
  const handleGoogleCredential = async (credential: string) => {
    setServerError(null);
    setSuccessMessage(null);
    setGoogleLoading(true);
    try {
      await loginWithGoogle(credential);
      // Navigation is handled by the authenticated-state effect above (it
      // redirects to /dashboard once a session exists). Navigating from the
      // Google callback would race that effect and get cancelled.
    } catch (err: any) {
      setServerError(err?.message || 'Google sign-up failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Register as an author or reader to submit manuscripts and access research publications."
      badgeText="Registration"
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
            <span className="font-semibold text-ruby-red block mb-0.5">Registration Error</span>
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
          <div className="flex-1 font-semibold text-emerald-400">{successMessage}</div>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
        {/* Full Name */}
        <div>
          <label htmlFor="reg-fullname" className="block text-xs font-semibold text-ivory-white mb-1">
            Full Name <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-fullname"
              type="text"
              name="fullName"
              autoComplete="name"
              required
              disabled={isSubmitting}
              value={fullName}
              onChange={(e) => {
                setFullName(lettersOnly(e.target.value));
                if (errors.fullName) setErrors({ ...errors, fullName: undefined });
              }}
              placeholder="Dr. Alexander Wright"
              className={`w-full bg-navy-950 border ${
                errors.fullName ? 'border-ruby-red' : 'border-[#D4AC54]/60 focus:border-gold-500'
              } rounded-xl pl-10 pr-4 py-2.5 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
            />
          </div>
          {errors.fullName && <p className="mt-1 text-[13px] text-ruby-red font-medium">{errors.fullName}</p>}
        </div>

        {/* Email Address */}
        <div>
          <label htmlFor="reg-email" className="block text-xs font-semibold text-ivory-white mb-1">
            Email Address <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-email"
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
              } rounded-xl pl-10 pr-4 py-2.5 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
            />
          </div>
          {errors.email && <p className="mt-1 text-[13px] text-ruby-red font-medium">{errors.email}</p>}
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="reg-phone" className="block text-xs font-semibold text-ivory-white mb-1">
            Phone Number <span className="text-text-muted text-[13px]">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-phone"
              type="tel"
              name="phone"
              autoComplete="tel national"
              inputMode="numeric"
              maxLength={10}
              disabled={isSubmitting}
              value={phone}
              onChange={(e) => {
                setPhone(digitsOnly(e.target.value, 10));
                if (errors.phone) setErrors({ ...errors, phone: undefined });
              }}
              placeholder="9876543210"
              aria-invalid={!!errors.phone}
              className="w-full bg-navy-950 border border-[#D4AC54]/60 focus:border-gold-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50"
            />
          </div>
          {errors.phone && <p className="mt-1 text-[13px] text-ruby-red font-medium">{errors.phone}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="reg-password" className="block text-xs font-semibold text-ivory-white mb-1">
            Password <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-password"
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
              } rounded-xl pl-10 pr-11 py-2.5 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
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
          <label htmlFor="reg-confirmpassword" className="block text-xs font-semibold text-ivory-white mb-1">
            Confirm Password <span className="text-gold-400">*</span>
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="reg-confirmpassword"
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
              placeholder="Re-enter password"
              className={`w-full bg-navy-950 border ${
                errors.confirmPassword ? 'border-ruby-red' : 'border-[#D4AC54]/60 focus:border-gold-500'
              } rounded-xl pl-10 pr-11 py-2.5 text-sm text-ivory-white placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
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

        {/* Terms Acceptance Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              id="reg-terms"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => {
                setTermsAccepted(e.target.checked);
                if (errors.termsAccepted) setErrors({ ...errors, termsAccepted: undefined });
              }}
              className="w-4 h-4 rounded bg-navy-950 border-white/20 text-gold-500 focus:ring-gold-500/50 focus:ring-offset-navy-900 mt-0.5"
            />
            <span className="text-xs text-text-muted leading-relaxed">
              I agree to the MMSR Publications{' '}
              <Link href="/terms-and-conditions" className="text-gold-400 hover:underline">
                Terms & Conditions
              </Link>{' '}
              and{' '}
              <Link href="/privacy-policy" className="text-gold-400 hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {errors.termsAccepted && (
            <p className="mt-1 text-[13px] text-ruby-red font-medium">{errors.termsAccepted}</p>
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
            rightIcon={!isSubmitting ? <ArrowRight className="w-4 h-4" /> : undefined}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </Button>
        </div>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-[13px] text-text-muted uppercase tracking-wider">Or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Sign up with Google via Google Identity Services */}
      <GoogleLoginButton onCredential={handleGoogleCredential} disabled={googleLoading || isSubmitting} text="sign_up_with" />

      {/* Login Link */}
      <div className="mt-5 text-center text-xs text-text-muted pt-3 border-t border-[#D4AC54]/60">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-gold-400 hover:underline">
          Sign In
        </Link>
      </div>
    </AuthLayout>
  );
}
