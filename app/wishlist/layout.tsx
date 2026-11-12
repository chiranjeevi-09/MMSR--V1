import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Wishlist',
  description: 'View and manage your saved academic monographs, books, and journal publications.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function WishlistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

