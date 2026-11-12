import React from 'react';
import { cn } from '@/lib/utils/cn';

export const BookCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl bg-[#FFF9F1]/80 border border-[#D4AC54]/40 overflow-hidden flex flex-col h-full animate-pulse">
      <div className="h-56 bg-white/5 shimmer" />
      <div className="p-6 flex flex-col gap-4 flex-1 justify-between">
        <div className="flex flex-col gap-2">
          <div className="w-20 h-4 bg-white/10 rounded shimmer" />
          <div className="w-full h-6 bg-white/10 rounded shimmer" />
          <div className="w-3/4 h-4 bg-white/5 rounded shimmer" />
        </div>
        <div className="flex justify-between items-center pt-4 border-t border-[#D4AC54]/40">
          <div className="w-16 h-6 bg-white/10 rounded shimmer" />
          <div className="w-24 h-8 bg-white/10 rounded-lg shimmer" />
        </div>
      </div>
    </div>
  );
};

export const BookGridSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <BookCardSkeleton key={idx} />
      ))}
    </div>
  );
};

export const BookDetailsSkeleton: React.FC = () => {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col gap-12 font-manrope animate-pulse">
      <div className="w-48 h-5 bg-white/5 rounded shimmer" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-5 h-96 rounded-3xl bg-white/5 shimmer" />
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="w-28 h-6 bg-white/10 rounded-full shimmer" />
          <div className="w-full h-10 bg-white/10 rounded shimmer" />
          <div className="w-1/2 h-5 bg-white/5 rounded shimmer" />
          <div className="w-full h-24 bg-white/5 rounded-2xl shimmer" />
          <div className="flex gap-4 pt-4">
            <div className="w-36 h-12 bg-white/10 rounded-xl shimmer" />
            <div className="w-36 h-12 bg-white/10 rounded-xl shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
};
