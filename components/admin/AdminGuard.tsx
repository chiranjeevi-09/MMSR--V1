'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { ShieldCheck } from 'lucide-react';
import { AccessDenied } from './AccessDenied';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === '/admin/login';

  // Fast synchronous token check to prevent full-screen spinner on unauthenticated visits
  const [hasToken] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!sessionStorage.getItem('mmsr_v2_rt');
  });

  useEffect(() => {
    if (!isLoginPage) {
      if (!hasToken || (!isLoading && (!isAuthenticated || !user))) {
        router.replace('/admin/login');
      }
    }
  }, [isLoading, isAuthenticated, user, isLoginPage, hasToken, router]);

  if (isLoginPage) return <>{children}</>;

  if (!hasToken) {
    return null;
  }

  if (isLoading && !user) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 font-manrope"
        style={{ backgroundColor: '#F7F3EB' }}
      >
        <div
          className="p-4 rounded-full mb-4 animate-pulse"
          style={{ background: 'rgba(201,166,107,0.1)', border: '1px solid rgba(201,166,107,0.3)' }}
        >
          <ShieldCheck className="w-8 h-8" style={{ color: '#C9A66B' }} />
        </div>
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3"
          style={{ borderColor: '#C9A66B', borderTopColor: 'transparent' }}
        />
        <p className="text-xs font-medium" style={{ color: '#8B7B68' }}>Verifying Staff Authorization...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  if (!user.is_staff && !(user as any).is_superuser) return <AccessDenied />;

  return <>{children}</>;
};
