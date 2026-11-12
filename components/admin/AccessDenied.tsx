'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft, LogIn, Lock } from 'lucide-react';

export const AccessDenied: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center font-manrope"
      style={{ backgroundColor: '#F7F3EB' }}>
      <div className="max-w-md w-full p-8 rounded-3xl space-y-6 relative overflow-hidden"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 4px 32px rgba(92,75,58,0.08)' }}>

        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.06), transparent)' }} />

        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)', color: '#dc2626' }}>
          <ShieldAlert className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="inline-block px-3 py-1 rounded-full text-[13px] font-mono font-bold uppercase tracking-widest"
            style={{ background: 'rgba(220,38,38,0.06)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)' }}>
            403 Unauthorized
          </span>
          <h2 className="text-2xl font-bold font-playfair" style={{ color: '#3E2E22' }}>Access Denied</h2>
          <p className="text-xs leading-relaxed" style={{ color: '#8B7B68' }}>
            You do not have permission to access the MMSR Administration Portal. Staff or Superuser credentials are required.
          </p>
        </div>

        <div className="p-3.5 rounded-xl text-[13px] flex items-center justify-between font-mono"
          style={{ background: '#F7F3EB', border: '1px solid #E9DFCF', color: '#8B7B68' }}>
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" style={{ color: '#C9A66B' }} /> Protected CMS Gateway
          </span>
          <span className="font-bold" style={{ color: '#dc2626' }}>Access Blocked</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Link href="/home" className="w-full">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: '#FFFFFF', border: '1.5px solid #E9DFCF', color: '#5C4B3A' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#C9A66B')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E9DFCF')}>
              <ArrowLeft className="w-4 h-4" /> Return to Website
            </button>
          </Link>
          <Link href="/admin/login" className="w-full">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{ background: '#C9A66B', color: '#3E2E22', boxShadow: '0 4px 16px rgba(201,166,107,0.3)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#A98042')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#C9A66B')}>
              <LogIn className="w-4 h-4" /> Admin Login
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};
