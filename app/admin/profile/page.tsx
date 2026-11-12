'use client';

import React, { useState } from 'react';
import {
  User, ShieldCheck, Mail, Phone, Building2, Lock, Save,
  CheckCircle2, AlertCircle, Key, Clock, Shield, Award, FileText, BookOpen, Unlock, Eye, EyeOff, AtSign
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { authService } from '@/lib/services/auth';
import { ADMIN_ROLES } from '@/lib/services/cms';
import { digitsOnly, lettersOnly, normalizeIndianMobile, validateOptionalIndianMobile } from '@/lib/validation';

// Reusable password input with a show/hide (eye) toggle.
function PasswordField({
  value, onChange, placeholder, disabled = false, required = false,
  shown, onToggle, className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  shown: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="w-full px-4 py-2.5 pr-11 rounded-xl text-xs outline-none disabled:opacity-70 disabled:cursor-not-allowed"
        style={{ background: '#F7F3EB', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
      />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7B68] hover:text-[#5C4B3A] transition-colors"
      >
        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AdminProfilePage() {
  const { user, tokens, refreshAccessToken } = useAuth();

  // Profile Form State
  const [firstName, setFirstName] = useState(lettersOnly(user?.first_name || 'Admin'));
  const [lastName, setLastName] = useState(lettersOnly(user?.last_name || 'Administrator'));
  // Work email = the admin-portal login. For this Super Admin it is the
  // account's own address (issued explicitly as work_email in the DB); a
  // legacy account without one falls back to its primary email identity.
  const workEmail = user?.work_email || user?.email || '';
  // Editable personal email — blank when the account holds no separate
  // personal address beyond the work identity (the Super Admin's case).
  const [personalEmail, setPersonalEmail] = useState(() => {
    const primary = user?.email || '';
    const work = user?.work_email || primary;
    return primary && primary !== work ? primary : '';
  });
  const [phone, setPhone] = useState(user?.phone_number || '');
  // Assigned by the Super Admin in the invitation wizard — locked here.
  // Department comes from the wizard's "Department / Team" input; the
  // designation label mirrors the wizard's "Role Label" selection.
  const department = user?.department || '';
  const designation = user?.is_superuser
    ? 'Super Admin'
    : ADMIN_ROLES.find((r) => r.value === user?.admin_role)?.label || 'Editorial Staff';
  const [bio, setBio] = useState('Senior Academic Editor managing book volumes, peer review pipelines, and journal publications at MMSR Publications.');

  // Password Update State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // Two-step gate: new-password fields stay locked until the current password verifies.
  const [currentVerified, setCurrentVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Inline (in-box) password messaging + per-field reveal toggles.
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Status Alerts
  const [isSaving, setIsSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSuperuser = (user as any)?.is_superuser;
  const roleTitle = isSuperuser ? 'Super Administrator' : user?.is_staff ? 'Editorial Staff Admin' : 'Administrator';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setErrorMsg(null);

    const trimmed = personalEmail.trim().toLowerCase();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Please enter a valid personal email address.');
      return;
    }
    if (trimmed && trimmed === workEmail.toLowerCase()) {
      setErrorMsg('That matches your work email — leave the personal email blank if you do not have a separate one.');
      return;
    }
    // Same 10-digit Indian mobile rule the backend UserSerializer enforces.
    const phoneError = validateOptionalIndianMobile(phone);
    if (phoneError) {
      setErrorMsg(phoneError);
      return;
    }
    setIsSaving(true);

    try {
      const access = await getAccessToken();
      if (!access) {
        setErrorMsg('Your session has expired. Please log in again.');
        return;
      }
      // Real backend update — names and phone always; the personal email is
      // only sent when one is provided (blank keeps the identity untouched).
      // Work email, role and permissions are read-only server-side.
      const payload: { first_name: string; last_name: string; phone_number: string; email?: string } = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim() ? normalizeIndianMobile(phone) : '',
      };
      if (trimmed) payload.email = trimmed;
      const updated = await authService.updateProfile(access, payload);
      const emailChanged = trimmed !== '' && trimmed !== (user?.email || '').toLowerCase();
      setPersonalEmail(emailChanged ? (updated.email || trimmed) : personalEmail.trim());
      setProfileSuccess(
        emailChanged
          ? `Profile updated — your personal email is now ${updated.email}. Use it on the public site; keep signing in to the admin portal with your work email ${workEmail}.`
          : 'Administrator profile details updated successfully.'
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update admin profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Resolve a fresh access token for a sensitive call (falls back to stored token).
  const getAccessToken = async (): Promise<string | null> => {
    const fresh = await refreshAccessToken();
    return fresh || tokens?.access || null;
  };

  const resetPasswordForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentVerified(false);
  };

  // Turn a DRF field-error string like "NEW_PASSWORD: This password is too common."
  // into a friendlier "New password: this password is too common."
  const prettifyAuthError = (msg: string): string =>
    msg
      .replace(/NEW_PASSWORD:/g, 'New password:')
      .replace(/(CURRENT|OLD)_PASSWORD:/g, 'Current password:')
      .replace(/\s+/g, ' ')
      .trim();

  // STEP 1 — verify the current password before unlocking the new-password fields.
  const handleVerifyCurrent = async () => {
    setPasswordSuccess(null);
    setPasswordError(null);
    if (!currentPassword) {
      setPasswordError('Enter your current password to continue.');
      return;
    }
    setVerifying(true);
    try {
      const access = await getAccessToken();
      if (!access) {
        setPasswordError('Your session has expired. Please log in again.');
        return;
      }
      const valid = await authService.verifyPassword(access, currentPassword);
      if (valid) {
        setCurrentVerified(true);
      } else {
        setCurrentVerified(false);
        setPasswordError('Your current password is incorrect.');
      }
    } catch (err: any) {
      setCurrentVerified(false);
      setPasswordError(prettifyAuthError(err?.message || 'Could not verify your current password. Please try again.'));
    } finally {
      setVerifying(false);
    }
  };

  // STEP 2 — apply the new password (only reachable once current password verified).
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!currentVerified) {
      setPasswordError('Please verify your current password first.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation password do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const access = await getAccessToken();
      if (!access) {
        setPasswordError('Your session has expired. Please log in again.');
        return;
      }
      await authService.changePassword(access, currentPassword, newPassword);
      setPasswordSuccess('Password updated successfully. Use your new password the next time you log in.');
      resetPasswordForm();
    } catch (err: any) {
      setPasswordError(prettifyAuthError(err?.message || 'Failed to change password. Please check your details and try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout
      title="Administrator Profile"
      subtitle="View and manage your editorial credentials, security settings, and administrative access."
    >
      <div className="space-y-8">
        {/* Success / Error Alerts */}
        {profileSuccess && (
          <div className="p-4 rounded-2xl flex items-center justify-between text-xs font-bold"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#16a34a' }}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{profileSuccess}</span>
            </div>
            <button type="button" onClick={() => setProfileSuccess(null)} className="underline text-[13px]">Dismiss</button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl flex items-center justify-between text-xs font-bold"
            style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }}>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="underline text-[13px]">Dismiss</button>
          </div>
        )}

        {/* ── 1. BRAND HERO + PROFILE CARD ── */}
        <div className="space-y-5">
          <div className="relative h-28 sm:h-36 rounded-3xl overflow-hidden shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3E2E22 0%, #5C4B3A 48%, #C9A66B 130%)' }}>
            <div className="absolute inset-0 opacity-[0.14] bg-[radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute -right-10 -top-16 w-48 h-48 rounded-full opacity-20 blur-2xl" style={{ background: '#C9A66B' }} />
            <div className="absolute -left-8 -bottom-16 w-40 h-40 rounded-full opacity-20 blur-2xl" style={{ background: '#E9DFCF' }} />
            <div className="relative z-10 flex items-center gap-3 h-full px-7">
              <Award className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: '#E9DFCF' }} />
              <span className="text-sm sm:text-base font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(247,243,235,0.92)' }}>
                MMSR Publications &middot; Editorial Management
              </span>
            </div>
          </div>

          <div className="px-6 sm:px-8 pb-6 sm:pb-7 rounded-3xl shadow-sm" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF' }}>
            <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
              <div className="w-24 h-24 rounded-2xl flex items-center justify-center font-bold text-3xl shrink-0 relative"
                style={{ background: 'linear-gradient(135deg, #C9A66B 0%, #3E2E22 100%)', color: '#FFFFFF', border: '4px solid #FFFFFF', boxShadow: '0 8px 22px rgba(92,75,58,0.28)' }}>
                {firstName.charAt(0)}{lastName.charAt(0)}
                <div className="absolute -bottom-1 -right-1 p-1.5 rounded-xl" title="Active Staff Session"
                  style={{ background: '#22c55e', border: '2px solid #FFFFFF' }}>
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-playfair break-words" style={{ color: '#3E2E22' }}>{firstName} {lastName}</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[13px] font-bold uppercase tracking-wider"
                    style={{ background: 'rgba(201,166,107,0.15)', border: '1px solid rgba(201,166,107,0.3)', color: '#A98042' }}>
                    {roleTitle}
                  </span>
                </div>
              </div>
            </div>

            {/* Individual detail boxes — each value gets its own box, responsive grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
              {[
                { label: 'Work Email', value: workEmail || '—', icon: <Mail className="w-3.5 h-3.5" /> },
                { label: 'Personal Email', value: personalEmail || '—', icon: <AtSign className="w-3.5 h-3.5" /> },
                { label: 'Department', value: department || '—', icon: <Building2 className="w-3.5 h-3.5" /> },
                { label: 'Staff ID', value: 'ADM-2026-001', icon: <User className="w-3.5 h-3.5" /> },
              ].map((box) => (
                <div key={box.label} className="p-3.5 rounded-2xl flex items-center gap-2.5 min-w-0"
                  style={{ background: 'linear-gradient(135deg, #FFF8EE 0%, #F7F3EB 100%)', border: '1px solid #E9DFCF' }}>
                  <div className="p-2 rounded-lg shrink-0" style={{ background: 'rgba(201,166,107,0.15)', color: '#A98042' }}>{box.icon}</div>
                  <div className="min-w-0">
                    <span className="text-[12px] font-semibold block uppercase tracking-wider" style={{ color: '#8B7B68' }}>{box.label}</span>
                    <span className="text-[13px] font-semibold block leading-snug tracking-tight break-words" style={{ color: '#3E2E22' }}>{box.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 2. EDITABLE PERSONAL INFORMATION ── */}
        <div className="rounded-3xl overflow-hidden shadow-sm" style={{ border: '1px solid #E9DFCF' }}>
          <div className="flex items-center justify-between px-6 sm:px-8 py-4"
            style={{ background: 'linear-gradient(135deg, #FFF8EE 0%, #F7F3EB 100%)', borderBottom: '1px solid #E9DFCF' }}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'linear-gradient(135deg, #C9A66B 0%, #A98042 100%)', color: '#FFFFFF', boxShadow: '0 4px 12px rgba(201,166,107,0.35)' }}>
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold font-playfair leading-tight" style={{ color: '#3E2E22' }}>Personal &amp; Editorial Details</h3>
                <p className="text-[13px]" style={{ color: '#8B7B68' }}>Update your name, contact and editorial role information.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="p-6 sm:p-8 space-y-4" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>First Name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(lettersOnly(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: '#F7F3EB', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Last Name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(lettersOnly(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: '#F7F3EB', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Work Email (Admin Login)</label>
                <input
                  type="email"
                  disabled
                  readOnly
                  value={workEmail}
                  placeholder="— not issued —"
                  title={workEmail ? 'Managed by Super Admins only' : 'No separate work login — you sign in with your personal email'}
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none opacity-80 cursor-not-allowed placeholder:text-[#8B7B68]"
                  style={{ background: '#E9DFCF', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Personal Email (Optional)</label>
                <input
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="— none on record —"
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none placeholder:text-[#8B7B68]"
                  style={{ background: '#F7F3EB', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Phone Contact</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(digitsOnly(e.target.value, 10))}
                  placeholder="9876543210"
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none"
                  style={{ background: '#F7F3EB', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Editorial Designation</label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={designation}
                  title="Set by the Super Admin's role assignment — not editable"
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none opacity-80 cursor-not-allowed"
                  style={{ background: '#E9DFCF', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Department / Division</label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={department}
                  placeholder="— not assigned —"
                  title="Assigned by the Super Admin in the invitation wizard — not editable"
                  className="w-full px-4 py-2.5 rounded-xl text-xs outline-none opacity-80 cursor-not-allowed placeholder:text-[#8B7B68]"
                  style={{ background: '#E9DFCF', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Editorial Note / Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full p-3 rounded-xl text-xs outline-none resize-none"
                  style={{ background: '#F7F3EB', border: '1.5px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: '#C9A66B', color: '#3E2E22' }}
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── 3. SECURITY & PASSWORD UPDATE ── */}
        <div className="rounded-3xl overflow-hidden shadow-sm" style={{ border: '1px solid #E9DFCF' }}>
          <div className="flex items-center justify-between px-6 sm:px-8 py-4"
            style={{ background: 'linear-gradient(135deg, #3E2E22 0%, #5C4B3A 100%)', borderBottom: '1px solid #E9DFCF' }}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'rgba(201,166,107,0.18)', color: '#E9DFCF', border: '1px solid rgba(201,166,107,0.35)' }}>
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold font-playfair leading-tight" style={{ color: '#F7F3EB' }}>Security &amp; Password Management</h3>
                <p className="text-[13px]" style={{ color: 'rgba(233,223,207,0.7)' }}>Confirm your current password to unlock and set a new one.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="p-6 sm:p-8 space-y-5" style={{ backgroundColor: '#FFFFFF' }}>
            {/* Inline status messaging (kept inside the security box) */}
            {(passwordSuccess || passwordError) && (
              <div className="p-3 rounded-xl flex items-start gap-2 text-xs font-semibold"
                style={passwordSuccess
                  ? { background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#16a34a' }
                  : { background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#dc2626' }}>
                {passwordSuccess
                  ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span>{passwordSuccess || passwordError}</span>
              </div>
            )}

            {/* STEP 1 — verify current password */}
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[13px] font-bold shrink-0"
                style={{ background: currentVerified ? '#22c55e' : '#C9A66B', color: '#FFFFFF' }}>1</span>
              <span className="text-xs font-bold" style={{ color: '#3E2E22' }}>Confirm your current password</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <PasswordField
                className="flex-1"
                value={currentPassword}
                onChange={(v) => { setCurrentPassword(v); if (currentVerified) setCurrentVerified(false); }}
                placeholder="Enter current password"
                disabled={currentVerified || verifying}
                required
                shown={showCurrent}
                onToggle={() => setShowCurrent((s) => !s)}
              />
              {currentVerified ? (
                <span className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold shrink-0"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <CheckCircle2 className="w-4 h-4" /> Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleVerifyCurrent}
                  disabled={verifying || !currentPassword}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 shrink-0"
                  style={{ background: '#C9A66B', color: '#3E2E22' }}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{verifying ? 'Verifying...' : 'Verify Password'}</span>
                </button>
              )}
            </div>

            {/* STEP 2 — set new password (locked until STEP 1 verifies) */}
            <div className={`rounded-2xl p-4 transition-opacity ${currentVerified ? '' : 'opacity-50'}`}
              style={{ background: '#FFF8EE', border: '1px dashed #E9DFCF' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[13px] font-bold shrink-0"
                  style={{ background: currentVerified ? '#C9A66B' : '#C9B79A', color: '#FFFFFF' }}>2</span>
                <span className="text-xs font-bold" style={{ color: '#3E2E22' }}>Set a new password</span>
                {!currentVerified && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: '#8B7B68' }}>
                    <Lock className="w-3 h-3" /> Locked until step 1
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>New Admin Password</label>
                  <PasswordField
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="At least 8 characters"
                    disabled={!currentVerified}
                    shown={showNew}
                    onToggle={() => setShowNew((s) => !s)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#5C4B3A' }}>Confirm New Password</label>
                  <PasswordField
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    placeholder="Re-type new password"
                    disabled={!currentVerified}
                    shown={showConfirm}
                    onToggle={() => setShowConfirm((s) => !s)}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={!currentVerified || isSaving}
                className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: '#3E2E22', color: '#F7F3EB' }}
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Updating...' : 'Update Password'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* ── 4. ASSIGNED SYSTEM PERMISSIONS & AUDIT LOG ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Permissions Matrix */}
          <div className="p-6 rounded-3xl space-y-5 shadow-sm" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF' }}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'linear-gradient(135deg, #C9A66B 0%, #A98042 100%)', color: '#FFFFFF' }}>
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold font-playfair leading-tight" style={{ color: '#3E2E22' }}>Assigned Administrative Privileges</h4>
                <p className="text-[13px]" style={{ color: '#8B7B68' }}>Module-level access granted to your account.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2.5 text-xs">
              {[
                { name: 'User & Staff Control', level: 'Full Access', icon: <User className="w-3.5 h-3.5" /> },
                { name: 'Books Catalogue CMS', level: 'Manage / Edit', icon: <BookOpen className="w-3.5 h-3.5" /> },
                { name: 'Journals Management', level: 'Full Access', icon: <FileText className="w-3.5 h-3.5" /> },
                { name: 'Conference Papers', level: 'Review & Publish', icon: <Award className="w-3.5 h-3.5" /> },
                { name: 'Submissions Review Desk', level: 'Decision Maker', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
                { name: 'Payment Transactions', level: 'Read / Audit', icon: <Lock className="w-3.5 h-3.5" /> },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-2xl flex items-center justify-between gap-3 transition-colors hover:bg-[#FFF8EE]"
                  style={{ background: 'linear-gradient(135deg, #FFF8EE 0%, #F7F3EB 100%)', border: '1px solid #E9DFCF' }}>
                  <span className="flex items-center gap-2 font-semibold min-w-0 flex-1" style={{ color: '#5C4B3A' }}>
                    <span className="shrink-0" style={{ color: '#C9A66B' }}>{item.icon}</span>
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span className="text-[12px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap" style={{ background: 'rgba(201,166,107,0.15)', color: '#A98042', border: '1px solid rgba(201,166,107,0.25)' }}>
                    {item.level}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Activity Trail */}
          <div className="p-6 rounded-3xl space-y-5 shadow-sm" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF' }}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'linear-gradient(135deg, #5C4B3A 0%, #3E2E22 100%)', color: '#E9DFCF' }}>
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold font-playfair leading-tight" style={{ color: '#3E2E22' }}>Recent Admin Action History</h4>
                <p className="text-[13px]" style={{ color: '#8B7B68' }}>Your latest activity across the portal.</p>
              </div>
            </div>
            <div className="space-y-1 text-xs relative">
              {[
                { action: 'Approved Manuscript Submission', time: '15 mins ago' },
                { action: 'Updated Book Volume #3 Pricing', time: '2 hours ago' },
                { action: 'Added New Testimonial by Dr. Elena', time: 'Yesterday' },
                { action: 'Cleared Session Tokens for Admin Portal', time: '2 days ago' },
              ].map((log, idx) => (
                <div key={idx} className="flex items-start gap-3 py-2.5 relative"
                  style={{ borderBottom: idx < 3 ? '1px solid #F0EADF' : 'none' }}>
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: '#C9A66B', boxShadow: '0 0 0 3px rgba(201,166,107,0.15)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: '#5C4B3A' }}>{log.action}</p>
                    <span className="text-[13px] font-mono" style={{ color: '#8B7B68' }}>{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
