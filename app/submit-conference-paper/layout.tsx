import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Submit Conference Paper | Call for Papers & Submissions',
  description:
    'Submit your research paper to upcoming MMSR international conferences. Fast-track double-blind peer-review, Crossref DOI registration, and proceedings publication.',
  keywords: [
    'Conference Paper Submission',
    'Call for Papers',
    'Academic Conference',
    'Scientific Research Submission',
    'MMSR Conferences',
    'Conference Proceedings',
  ],
  alternates: {
    canonical: `${SITE_URL}/submit-conference-paper`,
  },
  openGraph: {
    title: 'Submit Conference Paper | MMSR Publications',
    description:
      'Submit your research paper to upcoming MMSR international conferences with fast-track double-blind peer-review.',
    url: `${SITE_URL}/submit-conference-paper`,
    type: 'website',
  },
};

export default function SubmitConferencePaperLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

