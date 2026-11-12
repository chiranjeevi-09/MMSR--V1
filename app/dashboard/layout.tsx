import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scholar Dashboard | MMSR Publications',
  description: 'Manage journal subscriptions, conference submissions, manuscript status and publication orders.',
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
