'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error silently for monitoring
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-navy-midnight text-ivory-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-md w-full text-center space-y-6 relative z-10 p-8 rounded-3xl bg-navy-950/90 border border-[#D4AC54] backdrop-blur-xl shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-[#DC2626]">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <span className="text-[13px] font-mono text-gold-400 uppercase tracking-widest block font-bold">
              Application Exception Captured
            </span>
            <h1 className="text-2xl font-bold font-serif text-[#2F241A]">
              Something Went Wrong
            </h1>
            <p className="text-xs text-text-muted leading-relaxed">
              An unexpected system exception occurred while rendering this view. Our technical team has been notified.
            </p>
          </div>

          {error.digest && (
            <div className="p-2.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-[13px] font-mono text-text-muted">
              Error Reference Digest: <span className="text-gold-300">{error.digest}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => reset()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold text-xs"
            >
              Try Again
            </Button>
            <a href="/" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Home className="w-3.5 h-3.5" />}
                className="w-full text-xs border-[#D4AC54]/60 hover:border-[#D4AC54]"
              >
                Go to Homepage
              </Button>
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
