'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Shared landing-page stage: warm champagne panel inside a gold gradient frame.
 * Matches the full-bleed hero. Style only — children (content) render as passed.
 */
export const LandingPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
}> = ({ children, className, innerClassName }) => {
  return (
    <div
      className={cn(
        'relative rounded-[2.5rem] p-[1.5px] bg-gradient-to-br from-[#D4AC54] via-[#8C6239]/60 to-[#D4AC54] shadow-2xl',
        className
      )}
    >
      <div
        className={cn(
          'relative rounded-[calc(2.5rem-1.5px)] bg-gradient-to-br from-[#F5EBD6] via-[#EBD9B7] to-[#DFC59B] overflow-hidden',
          innerClassName
        )}
      >
        {/* Top gold hairline */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4AC54] to-transparent pointer-events-none" />
        {children}
      </div>
    </div>
  );
};
