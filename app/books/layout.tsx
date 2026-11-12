import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Books Catalogue & Monographs | MMSR Publications',
  description: 'Explore high-impact academic books, research monographs, and edited volumes published by MMSR Publications.',
  keywords: ['Academic Books', 'Research Monographs', 'MMSR Books', 'Scientific Volumes', 'Edited Books', 'Book Chapters'],
  openGraph: {
    title: 'Books Catalogue & Monographs | MMSR Publications',
    description: 'Explore high-impact academic books, research monographs, and edited volumes published by MMSR Publications.',
    url: `${SITE_URL}/books`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Books Catalogue | MMSR Publications',
    description: 'High-impact academic books and monographs.',
  },
  alternates: {
    canonical: `${SITE_URL}/books`,
  },
};

export default function BooksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
