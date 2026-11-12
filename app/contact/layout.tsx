import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/config/site';

export const metadata: Metadata = {
  title: 'Contact Editorial Office & Support | MMSR Publications',
  description: 'Get in touch with the MMSR Publications editorial office for author queries, manuscript status, institutional partnerships, and support.',
  keywords: ['Contact MMSR', 'Editorial Office Support', 'Publisher Contact', 'Author Queries'],
  openGraph: {
    title: 'Contact Editorial Office & Support | MMSR Publications',
    description: 'Get in touch with the MMSR Publications editorial office for author queries and support.',
    url: `${SITE_URL}/contact`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact MMSR Publications',
    description: 'Editorial office contact and support.',
  },
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
