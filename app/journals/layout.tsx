import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Peer-Reviewed Journals Catalogue | MMSR Publications',
  description: 'Discover international open-access scientific journals covering engineering, technology, medicine, and applied sciences.',
  keywords: ['Scientific Journals', 'Peer-Reviewed Journals', 'Open Access Journals', 'MMSR Journals', 'Research Papers', 'ISSN Journals'],
  openGraph: {
    title: 'Peer-Reviewed Journals Catalogue | MMSR Publications',
    description: 'Discover international open-access scientific journals with rigorous peer review.',
    url: `${SITE_URL}/journals`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Peer-Reviewed Journals | MMSR Publications',
    description: 'International open-access scientific journals.',
  },
  alternates: {
    canonical: `${SITE_URL}/journals`,
  },
};

export default function JournalsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
