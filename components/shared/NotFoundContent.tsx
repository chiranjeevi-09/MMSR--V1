'use client';

import React from 'react';
import Link from 'next/link';
import { Home, BookOpen, Newspaper, Calendar, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFoundContent() {
  return (
    <div className="min-h-screen bg-navy-midnight text-ivory-white flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gold-500/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-2xl w-full text-center space-y-8 relative z-10">
        {/* Large 404 Display */}
        <div className="space-y-2">
          <span className="font-mono text-xs text-gold-400 uppercase tracking-widest bg-gold-500/10 border border-[#D4AC54] px-3.5 py-1 rounded-full inline-block">
            404 — Page Not Found
          </span>
          <h1 className="text-7xl sm:text-9xl font-extrabold font-serif bg-gradient-to-r from-[#C99A2E] via-[#B8860B] to-[#8C6239] bg-clip-text text-transparent">
            404
          </h1>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#2F241A]">
            The Page You Are Seeking Does Not Exist
          </h2>
          <p className="text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
            The academic resource or catalogue item may have been moved, renamed, or is temporarily unavailable. Explore our official publication archives below.
          </p>
        </div>

        {/* Helpful Navigation Shortcuts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <Link
            href="/"
            className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-gold-500/40 transition-all group text-left space-y-1"
          >
            <Home className="w-4 h-4 text-gold-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-[#5C4033] block">Homepage</span>
            <span className="text-[13px] text-text-muted block">Main Portal</span>
          </Link>

          <Link
            href="/books"
            className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-gold-500/40 transition-all group text-left space-y-1"
          >
            <BookOpen className="w-4 h-4 text-gold-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-[#5C4033] block">Books</span>
            <span className="text-[13px] text-text-muted block">Monographs</span>
          </Link>

          <Link
            href="/journals"
            className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-gold-500/40 transition-all group text-left space-y-1"
          >
            <Newspaper className="w-4 h-4 text-gold-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-[#5C4033] block">Journals</span>
            <span className="text-[13px] text-text-muted block">Peer-Reviewed</span>
          </Link>

          <Link
            href="/conference"
            className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-gold-500/40 transition-all group text-left space-y-1"
          >
            <Calendar className="w-4 h-4 text-gold-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-[#5C4033] block">Conferences</span>
            <span className="text-[13px] text-text-muted block">Symposiums</span>
          </Link>
        </div>

        {/* Action Button */}
        <div className="pt-4 flex items-center justify-center space-x-3">
          <Link href="/">
            <Button
              variant="primary"
              size="md"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              className="bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold"
            >
              Return to Homepage
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
