import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Academic Conferences & Symposiums | MMSR Publications',
  description: 'Participate in international academic conferences, submit proceedings, and network with global research scholars.',
  keywords: ['Academic Conferences', 'Scientific Symposiums', 'Conference Proceedings', 'Call for Papers', 'MMSR Conferences'],
  openGraph: {
    title: 'Academic Conferences & Symposiums | MMSR Publications',
    description: 'Participate in international academic conferences and publish indexed proceedings.',
    url: `${SITE_URL}/conference`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Academic Conferences | MMSR Publications',
    description: 'International academic conferences and proceedings.',
  },
  alternates: {
    canonical: `${SITE_URL}/conference`,
  },
};

export default function ConferenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
