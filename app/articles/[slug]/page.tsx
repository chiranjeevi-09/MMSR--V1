import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArticleDetailClient from '@/components/journals/ArticleDetailClient';
import { SITE_URL } from '@/lib/config/site';

/**
 * Canonical standalone article page (Type 3 of the journal architecture):
 * /articles/[slug] — journal-independent URL for a single article.
 * Full text and PDF visibility are decided server-side via the access API.
 *
 * This wrapper runs on the server purely to resolve the soft-404 audit
 * finding: an unknown slug now returns a real HTTP 404 (branded not-found
 * page) instead of a 200 shell whose client fetch later reports "not found".
 * Backend/network errors are NOT treated as 404, so an outage is not mistaken
 * for a missing article — the client then surfaces the error itself.
 */
interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // Existence check in generateMetadata resolves BEFORE Next.js starts
  // streaming, so notFound() produces a real HTTP 404 status. A backend/network
  // error is deliberately NOT treated as 404.
  let exists = true;
  let title = 'Research Article | MMSR Publications';
  let description = 'Peer-reviewed research article published by MMSR Publications.';
  try {
    const res = await fetch(`${apiBase}/api/publications/articles/${slug}/`, { next: { revalidate: 600 } });
    exists = res.status !== 404;
    if (exists && res.ok) {
      const article = await res.json();
      title = `${article.title} | MMSR Publications`;
      if (article.abstract) description = String(article.abstract).slice(0, 160);
    }
  } catch {
    // Backend unreachable — fall through with fallback metadata.
  }
  if (!exists) notFound();
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/articles/${slug}` },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // notFound() runs OUTSIDE the try/catch: it signals via a thrown special
  // error that a surrounding catch would otherwise swallow (→ wrong 200).
  let exists = true;
  try {
    const res = await fetch(`${apiBase}/api/publications/articles/${slug}/`, { next: { revalidate: 600 } });
    exists = res.status !== 404;
  } catch {
    // Backend unreachable — render normally so the client can show an error.
  }
  if (!exists) notFound();
  return <ArticleDetailClient articleSlug={slug} />;
}
