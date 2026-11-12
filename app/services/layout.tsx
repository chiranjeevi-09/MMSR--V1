import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Publishing Services, DOI & Indexing | MMSR Publications',
  description: 'Professional academic publishing services including DOI assignment, copyediting, indexing assistance, and open-access licensing.',
  keywords: ['Publishing Services', 'DOI Registration', 'Academic Copyediting', 'Indexing Assistance', 'Open Access Licensing'],
  openGraph: {
    title: 'Publishing Services, DOI & Indexing | MMSR Publications',
    description: 'Professional academic publishing services including DOI assignment and indexing.',
    url: `${SITE_URL}/services`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Publishing Services | MMSR Publications',
    description: 'Professional academic publishing services.',
  },
  alternates: {
    canonical: `${SITE_URL}/services`,
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
