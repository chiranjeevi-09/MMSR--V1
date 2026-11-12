'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { SiteLogo } from '@/components/ui/SiteLogo';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  badgeText?: string;
  showTrustQuote?: boolean;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#2F241A] font-manrope flex flex-col justify-between relative overflow-hidden">
      {/* Background Decorative Glow Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#C99A2E]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-40 w-96 h-96 bg-[#F8EEDC]/40 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between z-10">
        <Link
          href="/home"
          className="flex items-center gap-3 group focus:outline-none"
          aria-label="MMSR Publications Home"
        >
          <SiteLogo className="w-10 h-10 shadow-sm group-hover:scale-105 transition-transform duration-300" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold font-playfair text-[#2F241A] group-hover:text-[#C99A2E] transition-colors">
                MMSR Publications
              </span>
            </div>
            <span className="text-[13px] text-[#73614C] tracking-wider uppercase">
              Scientific & Academic Publishing
            </span>
          </div>
        </Link>

        <Link
          href="/home"
          className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#C99A2E] text-xs font-bold text-[#C99A2E] bg-[#FFF2D9]/60 hover:bg-[#C99A2E] hover:text-[#FFF9F1] hover:shadow-gold-glow hover:-translate-y-0.5 transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Return to Website</span>
        </Link>
      </header>

      {/* Main Content Area — centered auth form */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center z-10">
        <div className="w-full flex justify-center">
          {/* Auth Form Container */}
          <div className="w-full max-w-md bg-[#FFF9F1] border border-[#D4AC54] rounded-3xl p-6 sm:p-8 shadow-xl relative">
            {/* Form Title & Subtitle Header */}
            <div className="mb-6 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold font-playfair text-[#2F241A] tracking-tight">
                {title}
              </h2>
              <p className="text-xs sm:text-sm text-[#73614C] mt-1.5 leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Page Form Content */}
            {children}
          </div>
        </div>
      </main>

      {/* Footer Bar */}
      <footer className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-xs text-[#73614C] z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[#D4AC54]/60 pt-4">
          <p>© {new Date().getFullYear()} MMSR Publications. All Rights Reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-[#C99A2E] transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms-and-conditions" className="hover:text-[#C99A2E] transition-colors">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link href="/contact" className="hover:text-[#C99A2E] transition-colors">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
