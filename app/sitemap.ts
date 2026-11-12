import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/config/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SITE_URL;
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/home`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/books`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/journals`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/conference`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/services`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/publish-chapter`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/submit-manuscript`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/terms-and-conditions`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/privacy-policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/publication-policies`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];

  // Dynamic book entries
  let bookRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${apiBase}/api/publications/books/`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const books = Array.isArray(data) ? data : data.results || [];
      bookRoutes = books.map((book: any) => ({
        url: `${baseUrl}/books/${book.slug || book.id}`,
        lastModified: book.updated_at ? new Date(book.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
    }
  } catch {
    // Fallback gracefully
  }

  // Dynamic journal entries
  let journalRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${apiBase}/api/publications/journals/`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const journals = Array.isArray(data) ? data : data.results || [];
      journalRoutes = journals.map((journal: any) => ({
        url: `${baseUrl}/journals/${journal.slug || journal.id}`,
        lastModified: journal.updated_at ? new Date(journal.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
    }
  } catch {
    // Fallback gracefully
  }

  // Dynamic conference entries
  let confRoutes: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${apiBase}/api/conferences/`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      const confs = Array.isArray(data) ? data : data.results || [];
      confRoutes = confs.map((conf: any) => ({
        url: `${baseUrl}/conference/${conf.slug || conf.id}`,
        lastModified: conf.updated_at ? new Date(conf.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.7,
      }));
    }
  } catch {
    // Fallback gracefully
  }

  return [...staticRoutes, ...bookRoutes, ...journalRoutes, ...confRoutes];
}
