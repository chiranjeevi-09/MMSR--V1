import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ArticleDetailClient from '@/components/journals/ArticleDetailClient';

/**
 * Legacy journal-scoped article route.
 * Delegates to the shared entitlement-aware article component and passes
 * the journal slug hint. Canonical route is /articles/[slug].
 *
 * Server-side existence check (audit soft-404 finding): an unknown article
 * slug now returns a real HTTP 404 instead of a 200 shell. Backend/network
 * errors are not treated as 404.
 */
interface PageProps {
  params: Promise<{ slug: string; articleSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { articleSlug } = await params;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // Existence check in generateMetadata resolves BEFORE Next.js starts
  // streaming (app/journals/loading.tsx would otherwise flush a 200 shell),
  // so notFound() produces a real HTTP 404 status. A backend/network error
  // is deliberately NOT treated as 404.
  let exists = true;
  let title = 'Research Article | MMSR Publications';
  try {
    const res = await fetch(`${apiBase}/api/publications/articles/${articleSlug}/`, { next: { revalidate: 600 } });
    exists = res.status !== 404;
    if (exists && res.ok) {
      const article = await res.json();
      title = `${article.title} | MMSR Publications`;
    }
  } catch {
    // Backend unreachable — fall through with fallback metadata.
  }
  if (!exists) notFound();
  return { title };
}

export default async function DedicatedArticlePage({ params }: PageProps) {
  const { slug, articleSlug } = await params;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  // notFound() runs OUTSIDE the try/catch: it signals via a thrown special
  // error that a surrounding catch would otherwise swallow (→ wrong 200).
  let exists = true;
  try {
    const res = await fetch(`${apiBase}/api/publications/articles/${articleSlug}/`, { next: { revalidate: 600 } });
    exists = res.status !== 404;
  } catch {
    // Backend unreachable — render normally so the client can show an error.
  }
  if (!exists) notFound();
  return <ArticleDetailClient articleSlug={articleSlug} journalHintSlug={slug} />;
}
