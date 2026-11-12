import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Publish Edited Book Chapter | MMSR Publications',
  description: 'Submit your research chapter for inclusion in peer-reviewed edited volumes and academic books with global indexing.',
  keywords: ['Publish Book Chapter', 'Edited Volumes', 'Academic Book Submission', 'MMSR Book Chapter'],
  openGraph: {
    title: 'Publish Edited Book Chapter | MMSR Publications',
    description: 'Submit your research chapter for inclusion in peer-reviewed edited volumes.',
    url: `${SITE_URL}/publish-chapter`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Publish Book Chapter | MMSR Publications',
    description: 'Submit research chapters for edited volumes.',
  },
  alternates: {
    canonical: `${SITE_URL}/publish-chapter`,
  },
};

export default function PublishChapterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
