'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { SiteLogo } from '@/components/ui/SiteLogo';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * Global route access policy.
 *
 * Marketing/informational pages are open to everyone; every other page requires
 * a signed-in user. The four explicitly-public pages are `/` (landing), `/home`,
 * `/contact` and `/services`. Additional prefixes stay open because the site
 * cannot function otherwise: the auth screens (so visitors can sign in), the
 * staff `/admin` portal (protected by its own AdminGuard), legal / policy pages
 * linked from forms and the footer, and the `/payment` gateway-return pages.
 *
 * Tokens live in sessionStorage and are verified client-side in AuthContext, so
 * this must run in the browser (Next.js middleware cannot read sessionStorage).
 * Unauthenticated visitors on a protected route are sent to /login with a
 * same-origin ?redirect= back to the page they tried to open.
 */
const PUBLIC_EXACT = new Set(['/', '/home', '/contact', '/services']);

const PUBLIC_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/admin',
  '/legal',
  '/privacy-policy',
  '/terms-and-conditions',
  '/publication-policies',
  '/payment',
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = isPublicRoute(pathname || '/');

  useEffect(() => {
    if (!isPublic && !isLoading && !isAuthenticated) {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const target = `${pathname}${search}`;
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
    }
  }, [isPublic, isLoading, isAuthenticated, pathname, router]);

  // Show a branded loader while the session is being restored, and during the
  // redirect to sign-in, so protected content is never briefly exposed. Public
  // routes render immediately with no waiting.
  if (!isPublic && (isLoading || !isAuthenticated)) {
    return (
      <div className="min-h-screen bg-[#F8F5EE] flex flex-col items-center justify-center font-manrope gap-4">
        <SiteLogo className="w-12 h-12 shadow-sm" />
        <div className="w-10 h-10 border-2 border-[#C99A2E] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-[#73614C]">Please sign in to continue…</p>
      </div>
    );
  }

  return <>{children}</>;
};
