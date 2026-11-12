import React from 'react';
import { cn } from '@/lib/utils/cn';

export interface StatCounterCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  trend?: string;
  gradient?: string;
  className?: string;
}

export const StatCounterCard: React.FC<StatCounterCardProps> = ({
  value,
  label,
  sublabel,
  icon,
  trend,
  className,
}) => {
  return (
    <div
      className={cn(
        'group relative p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] backdrop-blur-xl shadow-medium hover:-translate-y-1.5 hover:border-gold-500/60 hover:shadow-gold-glow transition-all duration-300 overflow-hidden font-manrope',
        className
      )}
    >
      {/* Subtle Background Glow Accent */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-gold-500/5 group-hover:bg-gold-500/10 blur-2xl transition-all duration-500 pointer-events-none" />

      <div className="flex items-start justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </span>
        {icon && (
          <div className="p-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-[#D4AC54] group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-navy-900 transition-all duration-300">
            {icon}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-playfair tracking-tight gradient-gold-text">
            {value}
          </span>
          {trend && (
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              {trend}
            </span>
          )}
        </div>
        {sublabel && (
          <p className="text-xs text-text-muted mt-1">{sublabel}</p>
        )}
      </div>
    </div>
  );
};
