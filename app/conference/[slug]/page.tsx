import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ConferenceDetailClient } from '@/components/conference/ConferenceDetailClient';
import { SITE_URL } from '@/lib/config/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const baseUrl = SITE_URL;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  // Existence check must happen here, in generateMetadata: it resolves BEFORE
  // Next.js starts streaming the response, so notFound() produces a real HTTP
  // 404. If it were only called in the page body, the loading.tsx Suspense
  // boundary would already have flushed a 200 (soft-404) with the branded
  // not-found UI rendered afterward.
  let exists = true;
  try {
    const res = await fetch(`${apiBase}/api/conferences/${slug}/`, { cache: 'no-store' });
    exists = res.status !== 404;
    if (exists && res.ok) {
      const conf = await res.json();
      const title = `${conf.title} | MMSR Publications`;
      const description = conf.description ? conf.description.slice(0, 160) : `International academic conference hosted by ${conf.organizer || 'MMSR Publications'}.`;
      const bannerImage = conf.banner || conf.cover_image || `${baseUrl}/images/conf-placeholder.jpg`;
      const canonicalUrl = `${baseUrl}/conference/${slug}`;

      return {
        title,
        description,
        keywords: [
          conf.title,
          conf.acronym,
          conf.location,
          'MMSR Publications',
          'Academic Conference',
          'Scientific Symposium',
          'Call for Papers',
        ].filter(Boolean),
        robots: { index: true, follow: true },
        alternates: { canonical: canonicalUrl },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          type: 'website',
          siteName: 'MMSR Publications',
          images: [{ url: bannerImage, alt: conf.title }],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [bannerImage],
        },
      };
    }
  } catch {
    // Backend/network error is deliberately NOT treated as 404 — the page body
    // renders and the client surfaces the outage.
  }
  if (!exists) notFound();

  return {
    title: 'Conference Details | MMSR Publications',
    description: 'Participate in international academic conferences and publish indexed proceedings.',
    alternates: { canonical: `${baseUrl}/conference/${slug}` },
  };
}

export default async function ConferenceDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // Real HTTP 404 for a nonexistent conference (audit soft-404 finding).
  // notFound() must run OUTSIDE the try/catch: it signals via a thrown
  // special error, which a surrounding catch would otherwise swallow and
  // wrongly render a 200 shell.
  let exists = true;
  try {
    const res = await fetch(`${apiBase}/api/conferences/${slug}/`, { cache: 'no-store' });
    exists = res.status !== 404;
  } catch {
    // Backend unreachable — render normally so the client can show an error.
  }
  if (!exists) notFound();
  return <ConferenceDetailClient slug={slug} />;
}
