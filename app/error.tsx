'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log unexpected errors for client monitoring
    console.error('Route segment error captured:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="max-w-md w-full text-center space-y-6 relative z-10 p-8 rounded-3xl bg-white/90 dark:bg-navy-950/90 border border-[#D4AC54]/40 backdrop-blur-xl shadow-xl">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-[#DC2626]">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <span className="text-[12px] font-mono text-[#C99A2E] uppercase tracking-widest block font-bold">
            Application Error
          </span>
          <h1 className="text-2xl font-bold font-serif text-[#2F241A] dark:text-[#E8DCC7]">
            Something Went Wrong
          </h1>
          <p className="text-sm text-gray-600 dark:text-[#E8DCC7]/70 leading-relaxed">
            We encountered an unexpected error while loading this page. You can try refreshing the section or return home.
          </p>
        </div>

        {error.digest && (
          <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-xs font-mono text-gray-500">
            Digest: <span className="text-[#C99A2E]">{error.digest}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => reset()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>

          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              className="w-full inline-flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

