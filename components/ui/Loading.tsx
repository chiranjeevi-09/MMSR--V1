import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// Spinner Component
export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className, color = 'text-[#C99A2E]' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return <Loader2 className={cn('animate-spin', sizeClasses[size], color, className)} />;
};

// Full Page Loader
export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading MMSR Publications...' }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F8F5EE]/95 backdrop-blur-md">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-2 border-[#C99A2E]/20 border-t-[#C99A2E] animate-spin" />
        <p className="text-sm font-medium text-[#C99A2E] font-playfair tracking-wide animate-pulse">
          {label}
        </p>
      </div>
    </div>
  );
};

// Skeleton Card
export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] p-6 flex flex-col gap-4 overflow-hidden relative shadow-md',
        className
      )}
    >
      <div className="w-full h-40 bg-[#F8EEDC]/60 rounded-xl shimmer" />
      <div className="w-3/4 h-6 bg-[#F8EEDC]/60 rounded shimmer" />
      <div className="w-full h-4 bg-[#F8EEDC]/60 rounded shimmer" />
      <div className="w-5/6 h-4 bg-[#F8EEDC]/60 rounded shimmer" />
      <div className="flex justify-between items-center pt-4 border-t border-[#D4AC54]/50">
        <div className="w-20 h-4 bg-[#F8EEDC]/60 rounded shimmer" />
        <div className="w-24 h-4 bg-[#F8EEDC]/60 rounded shimmer" />
      </div>
    </div>
  );
};

// Skeleton Grid
export interface SkeletonGridProps {
  count?: number;
  columns?: 2 | 3 | 4;
  className?: string;
}

export const SkeletonGrid: React.FC<SkeletonGridProps> = ({ count = 6, columns = 3, className }) => {
  const gridClasses = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-6 w-full', gridClasses[columns], className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
};
