'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, Compass } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface EnterButtonProps {
  variant?: 'primary' | 'secondary';
  label?: string;
  size?: 'md' | 'lg' | 'xl';
  className?: string;
  targetPath?: string;
}

export const EnterButton: React.FC<EnterButtonProps> = ({
  variant = 'primary',
  label,
  size = 'xl',
  className,
  targetPath = '/home',
}) => {
  if (variant === 'primary') {
    return (
      <Link
        href={targetPath}
        aria-label="Enter MMSR Publications Website"
        className={cn(
          'relative group overflow-hidden rounded-xl font-bold font-manrope text-navy-900 bg-gradient-gold shadow-gold-glow cursor-pointer transition-all duration-300 flex items-center justify-center gap-3 border-2 border-[#D4AC54] hover:border-gold-300 hover:scale-[1.02] active:scale-[0.98]',
          size === 'xl' && 'px-8 py-4 text-base sm:text-lg min-w-[240px]',
          size === 'lg' && 'px-6 py-3.5 text-sm sm:text-base',
          size === 'md' && 'px-5 py-2.5 text-xs sm:text-sm',
          className
        )}
      >
        {/* Shimmer Effect */}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

        <Sparkles className="w-5 h-5 shrink-0 text-navy-900" />
        <span className="relative z-10">{label || 'Enter MMSR Publications'}</span>
        <ArrowRight className="w-5 h-5 shrink-0 group-hover:translate-x-1.5 transition-transform duration-300" />
      </Link>
    );
  }

  return (
    <Link
      href={targetPath}
      aria-label="Explore Our Research World"
      className={cn(
        'relative group rounded-xl font-semibold font-manrope text-ivory-white bg-[#FFF9F1]/80 border border-gold-500/40 hover:border-gold-500 hover:bg-gold-500/10 hover:text-gold-400 cursor-pointer transition-all duration-300 flex items-center justify-center gap-2.5 backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]',
        size === 'xl' && 'px-8 py-4 text-base sm:text-lg min-w-[240px]',
        size === 'lg' && 'px-6 py-3.5 text-sm sm:text-base',
        size === 'md' && 'px-5 py-2.5 text-xs sm:text-sm',
        className
      )}
    >
      <Compass className="w-5 h-5 text-gold-400 shrink-0 group-hover:rotate-45 transition-transform duration-500" />
      <span>{label || 'Explore Our Research World'}</span>
    </Link>
  );
};
