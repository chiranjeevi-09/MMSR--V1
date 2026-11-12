import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookDetailClient } from '@/components/books/BookDetailClient';
import { SITE_URL } from '@/lib/config/site';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const baseUrl = SITE_URL;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  // Existence check must happen here, in generateMetadata: it resolves BEFORE
  // Next.js starts streaming the response, so notFound() produces a real HTTP
  // 404. If it were only called in the page body, the loading.tsx Suspense
  // boundary would already have flushed a 200 (soft-404) with the branded
  // not-found UI rendered afterward.
  let exists = true;
  try {
    const res = await fetch(`${apiBase}/api/publications/books/${id}/`, { cache: 'no-store' });
    exists = res.status !== 404;
    if (exists && res.ok) {
      const book = await res.json();
      const title = `${book.title} | MMSR Publications`;
      const description = book.description ? book.description.slice(0, 160) : `Academic book published by MMSR Publications.`;
      const coverImage = book.cover_image || `${baseUrl}/images/book-placeholder.jpg`;
      const canonicalUrl = `${baseUrl}/books/${id}`;

      return {
        title,
        description,
        keywords: [
          book.title,
          book.author_name || book.editors || 'MMSR Editors',
          book.isbn,
          book.category,
          'MMSR Publications',
          'Academic Book',
          'Research Monograph',
        ].filter(Boolean),
        robots: { index: true, follow: true },
        alternates: { canonical: canonicalUrl },
        openGraph: {
          title,
          description,
          url: canonicalUrl,
          type: 'book',
          siteName: 'MMSR Publications',
          images: [{ url: coverImage, alt: book.title }],
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
    title: 'Book Details | MMSR Publications',
    description: 'Explore high-impact academic books and monographs published by MMSR Publications.',
    alternates: { canonical: `${baseUrl}/books/${id}` },
  };
}

export default async function BookDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // Real HTTP 404 for a nonexistent book (audit soft-404 finding). Backend
  // errors are not treated as 404 so an outage is not mistaken for absence.
  // notFound() must run OUTSIDE the try/catch: it signals via a thrown
  // special error, which a surrounding catch would otherwise swallow and
  // wrongly render a 200 shell.
  let exists = true;
  try {
    const res = await fetch(`${apiBase}/api/publications/books/${id}/`, { cache: 'no-store' });
    exists = res.status !== 404;
  } catch {
    // Backend unreachable — render normally so the client can show an error.
  }
  if (!exists) notFound();
  return <BookDetailClient id={id} />;
}
