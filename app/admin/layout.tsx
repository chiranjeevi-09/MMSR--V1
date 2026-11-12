import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'MMSR Publications CMS | Administration Portal',
    template: '%s | MMSR CMS',
  },
  description: 'Editorial & Administration Management System for MMSR Publications V2.',
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-navy-950 text-ivory-white font-manrope">
      {children}
    </div>
  );
}
