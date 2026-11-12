import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface SectionHeaderProps {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center' | 'right';
  cta?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  badge,
  title,
  subtitle,
  align = 'left',
  cta,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 font-manrope',
        align === 'center' && 'items-center text-center justify-center',
        className
      )}
    >
      <div className={cn('flex flex-col gap-3', align === 'center' ? 'max-w-3xl items-center' : 'max-w-2xl items-start')}>
        {badge && (
          <span className="inline-flex items-center px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-[#C99A2E]/15 text-[#B8860B] border border-[#D4AC54]">
            {badge}
          </span>
        )}

        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-playfair text-[#3A2312] tracking-tight leading-tight">
          {title}
        </h2>

        {subtitle && (
          <p className="text-sm sm:text-base text-[#6E5238] font-medium leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {cta && <div className="shrink-0 md:mb-1">{cta}</div>}
    </div>
  );
};
