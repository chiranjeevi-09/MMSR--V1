'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Conference } from '@/lib/types/conference';

interface ConferenceBreadcrumbProps {
  currentConference?: Pick<Conference, 'title' | 'shortTitle'>;
  className?: string;
}

export const ConferenceBreadcrumb: React.FC<ConferenceBreadcrumbProps> = ({
  currentConference,
  className,
}) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-xs font-manrope', className)}>
      <ol className="flex items-center flex-wrap gap-1.5 text-text-muted">
        <li className="flex items-center">
          <Link href="/home" className="flex items-center gap-1 hover:text-gold-400 transition-colors">
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
        </li>
        <li className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-text-muted/60 shrink-0" />
          {currentConference ? (
            <Link href="/conference" className="hover:text-gold-400 transition-colors">
              Conference
            </Link>
          ) : (
            <span className="font-semibold text-gold-400" aria-current="page">Conference</span>
          )}
        </li>
        {currentConference && (
          <li className="flex items-center gap-1.5">
            <ChevronRight className="w-3 h-3 text-text-muted/60 shrink-0" />
            <span className="font-semibold text-gold-400 truncate max-w-[240px]" aria-current="page">
              {currentConference.shortTitle || currentConference.title}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
};
