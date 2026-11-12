'use client';

import React, { useState } from 'react';
import { User, Mail, Phone, MapPin, Building2, Save, Info, AlertCircle, CheckCircle2, BookOpen, Sparkles, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  digitsOnly,
  lettersOnly,
  normalizeIndianMobile,
  validateOptionalIndianMobile,
  validateOptionalIndianPin,
} from '@/lib/validation';

export default function DashboardProfilePage() {
  const { user, tokens, updateUser } = useAuth();

  // Editable field states — pre-populated from authenticated backend profile
  const [firstName, setFirstName] = useState(lettersOnly(user?.first_name || ''));
  const [lastName, setLastName] = useState(lettersOnly(user?.last_name || ''));
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [address, setAddress] = useState(user?.address || '');
  const [city, setCity] = useState(lettersOnly(user?.city || ''));
  const [country, setCountry] = useState(lettersOnly(user?.country || ''));
  const [postalCode, setPostalCode] = useState(user?.postal_code || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ phone?: string; postal?: string }>({});

  /**
   * UserProfileView uses RetrieveUpdateAPIView (PATCH/PUT supported).
   * Endpoint: PATCH /api/users/profile/
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setServerError(null);

    // Mirror the backend UserSerializer rules so a bad value never round-trips.
    const nextErrors: { phone?: string; postal?: string } = {};
    const phoneError = validateOptionalIndianMobile(phone);
    if (phoneError) nextErrors.phone = phoneError;
    const pinError = validateOptionalIndianPin(postalCode);
    if (pinError) nextErrors.postal = pinError;
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (!tokens?.access) {
      setServerError('Authentication session unavailable. Please sign in again.');
      return;
    }

    setIsSubmitting(true);
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/users/profile/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.access}`,
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phone.trim() ? normalizeIndianMobile(phone) : '',
          address: address.trim(),
          city: city.trim(),
          country: country.trim(),
          postal_code: postalCode.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || data.detail || `Update failed (${res.status})`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }

      setSuccessMessage('Profile updated successfully.');
      // Refresh the shared session with the server's canonical profile so the
      // header, sidebar and every other consumer reflect the edit immediately
      // (otherwise the page looks unchanged and the save appears to have done
      // nothing). Falls back silently if the body can't be parsed.
      const updated = await res.clone().json().catch(() => null);
      if (updated && updated.email) updateUser(updated);
    } catch (err: any) {
      setServerError(err?.message || 'Failed to save profile changes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Profile Details"
      subtitle="View and update your MMSR Publications account profile information."
    >

      {/* Profile Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Read-only Section */}
        <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
          <h3 className="text-sm font-bold font-playfair text-gold-400 border-b border-[#D4AC54]/60 pb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Account Identity (Read-Only)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Email Address</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-xs text-[#2F241A]">
                <Mail className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span>{user?.email || '—'}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1">Account Role</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-xs">
                <Building2 className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <span className="text-gold-400 font-semibold">
                  {user?.is_staff ? 'Editorial Staff' : user?.is_author ? 'Academic Author' : 'Scholar & Reader'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editable Section */}
        <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
          <h3 className="text-sm font-bold font-playfair text-gold-400 border-b border-[#D4AC54]/60 pb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Personal Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name */}
            <div>
              <label htmlFor="profile-firstname" className="block text-xs font-semibold text-[#2F241A] mb-1">
                First Name
              </label>
              <input
                id="profile-firstname"
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(lettersOnly(e.target.value))}
                disabled={isSubmitting}
                placeholder="First name"
                className="w-full bg-[#FFF9F1] border border-[#D4AC54] focus:border-gold-500 rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50"
              />
            </div>

            {/* Last Name */}
            <div>
              <label htmlFor="profile-lastname" className="block text-xs font-semibold text-[#2F241A] mb-1">
                Last Name
              </label>
              <input
                id="profile-lastname"
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(lettersOnly(e.target.value))}
                disabled={isSubmitting}
                placeholder="Last name"
                className="w-full bg-[#FFF9F1] border border-[#D4AC54] focus:border-gold-500 rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="profile-phone" className="block text-xs font-semibold text-[#2F241A] mb-1">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="profile-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={10}
                  aria-invalid={!!fieldErrors.phone}
                  value={phone}
                  onChange={(e) => {
                    setPhone(digitsOnly(e.target.value, 10));
                    if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: undefined });
                  }}
                  disabled={isSubmitting}
                  placeholder="9876543210"
                  className={`w-full bg-[#FFF9F1] border ${
                    fieldErrors.phone ? 'border-ruby-red' : 'border-[#D4AC54] focus:border-gold-500'
                  } rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#5C4033] placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
                />
              </div>
              {fieldErrors.phone && (
                <p className="mt-1 text-[13px] text-ruby-red font-medium">{fieldErrors.phone}</p>
              )}
            </div>

            {/* Country */}
            <div>
              <label htmlFor="profile-country" className="block text-xs font-semibold text-[#2F241A] mb-1">
                Country
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="profile-country"
                  type="text"
                  autoComplete="country-name"
                  value={country}
                  onChange={(e) => setCountry(lettersOnly(e.target.value))}
                  disabled={isSubmitting}
                  placeholder="Country"
                  className="w-full bg-[#FFF9F1] border border-[#D4AC54] focus:border-gold-500 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#5C4033] placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50"
                />
              </div>
            </div>

            {/* City */}
            <div>
              <label htmlFor="profile-city" className="block text-xs font-semibold text-[#2F241A] mb-1">
                City
              </label>
              <input
                id="profile-city"
                type="text"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(lettersOnly(e.target.value))}
                disabled={isSubmitting}
                placeholder="City"
                className="w-full bg-[#FFF9F1] border border-[#D4AC54] focus:border-gold-500 rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50"
              />
            </div>

            {/* Postal Code */}
            <div>
              <label htmlFor="profile-postal" className="block text-xs font-semibold text-[#2F241A] mb-1">
                Postal Code
              </label>
              <input
                id="profile-postal"
                type="text"
                autoComplete="postal-code"
                inputMode="numeric"
                maxLength={6}
                aria-invalid={!!fieldErrors.postal}
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(digitsOnly(e.target.value, 6));
                  if (fieldErrors.postal) setFieldErrors({ ...fieldErrors, postal: undefined });
                }}
                disabled={isSubmitting}
                placeholder="600001"
                className={`w-full bg-[#FFF9F1] border ${
                  fieldErrors.postal ? 'border-ruby-red' : 'border-[#D4AC54] focus:border-gold-500'
                } rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50`}
              />
              {fieldErrors.postal && (
                <p className="mt-1 text-[13px] text-ruby-red font-medium">{fieldErrors.postal}</p>
              )}
            </div>

            {/* Address — full width */}
            <div className="sm:col-span-2">
              <label htmlFor="profile-address" className="block text-xs font-semibold text-[#2F241A] mb-1">
                Address
              </label>
              <textarea
                id="profile-address"
                autoComplete="street-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isSubmitting}
                rows={2}
                placeholder="Street address or institution address"
                className="w-full bg-[#FFF9F1] border border-[#D4AC54] focus:border-gold-500 rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-text-muted outline-none transition-all focus:ring-1 focus:ring-gold-500/50 resize-none"
              />
            </div>
          </div>

          {/* Save Button + inline result. The success/error message is rendered
              right here (next to the button the user just clicked) rather than at
              the top of the long form, so feedback is never off-screen. */}
          <div className="pt-2 flex flex-col items-end gap-2">
            {serverError && (
              <p role="alert" aria-live="assertive" className="flex items-center gap-2 text-xs font-semibold text-ruby-red">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {serverError}
              </p>
            )}
            {!serverError && successMessage && (
              <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {successMessage}
              </p>
            )}
            <Button
              type="submit"
              variant="gold"
              size="md"
              isLoading={isSubmitting}
              leftIcon={!isSubmitting ? <Save className="w-4 h-4" /> : undefined}
            >
              {isSubmitting ? 'Saving...' : 'Save Profile Changes'}
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
