import React from 'react';
import { cn } from '@/lib/utils/cn';

export type BadgeVariant =
  | 'Published'
  | 'Open Access'
  | 'New'
  | 'Best Seller'
  | 'Pending'
  | 'Paid'
  | 'Rejected'
  | 'Accepted'
  | 'Reviewed'
  | 'Conference'
  | 'gold'
  | 'navy'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'Published',
  size = 'md',
  dot = false,
  children,
  ...props
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    Published: 'bg-[#F4EBE1] text-[#8C6239] border-[#D4AC54]/60 font-semibold',
    'Open Access': 'bg-royal-blue/15 text-blue-400 border-royal-blue/30',
    New: 'bg-orange-accent/15 text-orange-400 border-orange-accent/30',
    'Best Seller': 'bg-gold-500/20 text-gold-400 border-gold-500/40 font-semibold',
    Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Rejected: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30',
    Accepted: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Reviewed: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    Conference: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    gold: 'bg-gradient-gold text-navy-900 border-gold-500 font-semibold',
    navy: 'bg-navy-800 text-ivory-white border-[#D4AC54]/60',
    outline: 'bg-transparent text-text-muted border-white/20',
  };

  const sizeStyles = {
    sm: 'text-[13px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border transition-colors select-none font-manrope',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0 animate-pulse" />
      )}
      <span>{children || variant}</span>
    </span>
  );
};
