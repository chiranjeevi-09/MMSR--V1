import type { Metadata, Viewport } from 'next';
import { NotFoundContent } from '@/components/shared/NotFoundContent';

/**
 * Root not-found page (branded 404 UI).
 *
 * SEO/soft-404 mitigation (audit TASK 12): on this Next.js version, streamed
 * App-Router responses that hit notFound() AFTER the shell has begun keep an
 * HTTP 200 status (upstream bug vercel/next.js#99318; fix PR #99343 not yet
 * merged). The documented SEO safety net is a `noindex` robots meta tag, but
 * the automatic injection does not apply to these streamed fallback responses,
 * and the root layout declares `index, follow`. Declaring noindex here — on the
 * actual rendered page for every not-found response — ensures crawlers drop
 * missing URLs from the index regardless of the 200 status.
 */
export const metadata: Metadata = {
  title: '404 — Page Not Found | MMSR Publications',
  description: 'The page you are looking for does not exist or has been moved.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0B1220',
};

export default function NotFound() {
  return <NotFoundContent />;
}
