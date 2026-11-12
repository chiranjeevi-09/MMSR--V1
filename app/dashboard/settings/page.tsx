'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  KeyRound,
  FileText,
  ExternalLink,
  LogOut,
  Info,
  Mail,
  UserCircle,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { PublicId } from '@/components/ui/PublicId';

export default function DashboardSettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  return (
    <DashboardLayout
      title="Account Settings"
      subtitle="Manage your security, preferences, and legal information."
    >
      {/* Account Information */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
        <h3 className="text-sm font-bold font-playfair text-gold-400 border-b border-[#D4AC54]/60 pb-3 flex items-center gap-2">
          <UserCircle className="w-4 h-4" />
          Account Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-text-muted block mb-1">Registered Email</span>
            <div className="flex items-center gap-2 text-ivory-white">
              <Mail className="w-3.5 h-3.5 text-gold-400 shrink-0" />
              <span>{user?.email || '—'}</span>
            </div>
          </div>
          <div>
            <span className="text-text-muted block mb-1">Account Role</span>
            <span className="font-semibold text-gold-400">
              {user?.is_staff ? 'Editorial Staff' : user?.is_author ? 'Academic Author' : 'Scholar & Reader'}
            </span>
          </div>
          <div>
            <span className="text-text-muted block mb-1">MMSR Account ID</span>
            <PublicId value={user?.public_id} label="USR" size="sm" />
          </div>
          {user?.is_staff && (
            <div>
              <span className="text-text-muted block mb-1">Editorial Staff ID</span>
              <PublicId value={user?.admin_public_id} label="ADM" size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Security Section */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
        <h3 className="text-sm font-bold font-playfair text-gold-400 border-b border-[#D4AC54]/60 pb-3 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Security & Authentication
        </h3>

        {/* Password Reset via Email */}
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gold-400 shrink-0" />
              <span className="text-xs font-semibold text-ivory-white">Change Password</span>
            </div>
            <p className="text-[13px] text-text-muted leading-relaxed pl-6">
              Use the password reset flow. A reset link will be sent to your registered email address.
            </p>
          </div>
          <Link href="/forgot-password" className="shrink-0">
            <Button variant="outline" size="sm">
              Reset Password
            </Button>
          </Link>
        </div>
      </div>

      {/* Privacy & Legal */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
        <h3 className="text-sm font-bold font-playfair text-gold-400 border-b border-[#D4AC54]/60 pb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Privacy & Legal
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/privacy-policy"
            className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-colors group"
          >
            <div>
              <p className="text-xs font-semibold text-ivory-white group-hover:text-gold-400 transition-colors">Privacy Policy</p>
              <p className="text-[13px] text-text-muted mt-0.5">How MMSR handles your personal data.</p>
            </div>
            <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-gold-400 transition-colors shrink-0" />
          </Link>
          <Link
            href="/terms-and-conditions"
            className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-colors group"
          >
            <div>
              <p className="text-xs font-semibold text-ivory-white group-hover:text-gold-400 transition-colors">Terms & Conditions</p>
              <p className="text-[13px] text-text-muted mt-0.5">MMSR Publications usage terms.</p>
            </div>
            <ExternalLink className="w-4 h-4 text-text-muted group-hover:text-gold-400 transition-colors shrink-0" />
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
