'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const isLanding = pathname === '/';
  const isDashboard = pathname?.startsWith('/dashboard');
  const isAdmin = pathname?.startsWith('/admin');

  // Completely isolate Landing, Dashboard, and Admin Portal from public Navbar & Footer
  if (isLanding || isDashboard || isAdmin) {
    return <main className="min-h-screen bg-navy-950 text-ivory-white overflow-x-hidden">{children}</main>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope overflow-x-hidden">
      <Navbar />
      <main className="flex-1 pt-[84px]">{children}</main>
      <Footer />
    </div>
  );
};
