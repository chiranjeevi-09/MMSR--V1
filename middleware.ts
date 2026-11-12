import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Server-side route protection (audit M-3).
 *
 * The MMSR session JWTs live in sessionStorage, which Edge middleware cannot
 * read — so this gate is deliberately a *presence* check, NOT an authorization
 * decision. It reads a single opaque, non-sensitive marker cookie
 * (`mmsr_session`) that the client sets when a session is established and
 * clears on logout. Its only job is to stop unauthenticated visitors from
 * receiving full 200 HTML shells of restricted areas and instead route them to
 * the correct sign-in page at the edge.
 *
 * Security boundary stays server-side:
 *  - This cookie carries NO role and NO token, so it can never be trusted (or
 *    abused) as authorization. Even a forged marker cookie yields only a
 *    data-less page shell; every restricted read/write is still gated by Django
 *    (IsAuthenticated / IsAdminUser + object-level ownership checks).
 *  - The existing client guards (AdminGuard / DashboardLayout / RouteGuard)
 *    remain as a second layer and continue to enforce staff/role UX.
 */

// Single source of truth for the marker cookie name — kept in sync with
// lib/context/AuthContext.tsx (persistTokens / logout).
export const SESSION_MARKER_COOKIE = 'mmsr_session';

// Public entry points that live *inside* a protected prefix and must never be
// redirected (otherwise anonymous staff would hit a login loop).
const PUBLIC_WITHIN_PROTECTED = new Set<string>([
  '/admin/login',
]);

function redirectWithReturn(request: nextLike, base: string): NextResponse {
  const target = new URL(base, request.nextUrl.origin);
  // Preserve the intended destination so the login flow can send the user back
  // after sign-in. Only same-origin path+search is used — never an absolute
  // attacker-supplied URL — so this cannot become an open redirect.
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  target.searchParams.set('redirect', returnTo);
  return NextResponse.redirect(target);
}

// Narrow structural type to keep the helper testable without importing the
// full NextRequest class at runtime.
interface nextLike {
  nextUrl: { origin: string; pathname: string; search: string };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the protected prefix's own public pages (admin sign-in) straight
  // through — no session required to view them.
  if (PUBLIC_WITHIN_PROTECTED.has(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.get(SESSION_MARKER_COOKIE)?.value === '1';
  if (hasSession) {
    return NextResponse.next();
  }

  // No session marker: route each area to its own login page.
  if (pathname.startsWith('/admin')) {
    // Admin login reads no `redirect` param today, but sending one is harmless
    // and future-proofs the flow.
    return redirectWithReturn(request, '/admin/login');
  }

  // Customer dashboard: reuse the existing `?redirect=` contract the client
  // guards already honour.
  return redirectWithReturn(request, '/login');
}

export const config = {
  // Protect restricted routes: books, journals, conference, articles, cart,
  // checkout, wishlist, author submissions, customer dashboard, and staff admin.
  // Only landing (/), home (/home), contact (/contact), services (/services),
  // auth routes (/login, /register, etc.), and legal policies are open without sign-in.
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/books',
    '/books/:path*',
    '/journals',
    '/journals/:path*',
    '/conference',
    '/conference/:path*',
    '/articles',
    '/articles/:path*',
    '/cart',
    '/checkout',
    '/wishlist',
    '/submit-manuscript',
    '/publish-chapter',
    '/submit-conference-paper',
  ],
};
