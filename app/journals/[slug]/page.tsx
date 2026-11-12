import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JournalDetailClient } from '@/components/journals/JournalDetailClient';
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
    const res = await fetch(`${apiBase}/api/publications/journals/${slug}/`, { cache: 'no-store' });
    exists = res.status !== 404;
    if (exists && res.ok) {
      const journal = await res.json();
      const title = `${journal.title} | MMSR Publications`;
      const description = journal.description ? journal.description.slice(0, 160) : `Peer-reviewed scientific journal published by MMSR Publications.`;
      const coverImage = journal.cover_image || journal.cover || `${baseUrl}/images/journal-placeholder.jpg`;
      const canonicalUrl = `${baseUrl}/journals/${slug}`;

      return {
        title,
        description,
        keywords: [
          journal.title,
          journal.issn,
          journal.discipline || journal.category,
          'MMSR Publications',
          'Scientific Journal',
          'Peer-Reviewed',
          'Open Access',
        ].filter(Boolean),
        robots: { index: true, follow: true },
        alternates: { canonical: canonicalUrl },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          type: 'website',
          siteName: 'MMSR Publications',
          images: [{ url: coverImage, alt: journal.title }],
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
          images: [coverImage],
        },
      };
    }
  } catch {
    // Backend/network error is deliberately NOT treated as 404 — the page body
    // renders and the client surfaces the outage.
  }
  if (!exists) notFound();

  return {
    title: 'Journal Details | MMSR Publications',
    description: 'Discover peer-reviewed scientific journals published by MMSR Publications.',
    alternates: { canonical: `${baseUrl}/journals/${slug}` },
  };
}

export default async function JournalDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // Server-side existence check so a nonexistent journal returns a real HTTP
  // 404 (branded not-found page) instead of a 200 shell that later "not
  // found"s client-side (audit soft-404 finding). A network/backend error is
  // deliberately NOT treated as 404 — the client then surfaces the outage.
  // notFound() must run OUTSIDE the try/catch: it signals via a thrown
  // special error, which a surrounding catch would otherwise swallow and
  // wrongly render a 200 shell.
  let exists = true;
  try {
    const res = await fetch(`${apiBase}/api/publications/journals/${slug}/`, { cache: 'no-store' });
    exists = res.status !== 404;
  } catch {
    // Backend unreachable — render normally so the client can show an error.
  }
  if (!exists) notFound();
  return <JournalDetailClient slug={slug} />;
}
