import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Submit Manuscript for Peer Review | MMSR Publications',
  description: 'Online author submission portal for original research papers, review articles, and book chapters.',
  keywords: ['Submit Manuscript', 'Author Portal', 'Paper Submission', 'Peer Review Submission', 'MMSR Submission'],
  openGraph: {
    title: 'Submit Manuscript for Peer Review | MMSR Publications',
    description: 'Online author submission portal for original research papers and review articles.',
    url: `${SITE_URL}/submit-manuscript`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Submit Manuscript | MMSR Publications',
    description: 'Online author manuscript submission portal.',
  },
  alternates: {
    canonical: `${SITE_URL}/submit-manuscript`,
  },
};

export default function SubmitManuscriptLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
