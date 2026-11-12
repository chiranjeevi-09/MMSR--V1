import React from 'react';

export const JournalCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl bg-[#FFF9F1]/80 border border-[#D4AC54]/40 p-6 flex flex-col justify-between h-full animate-pulse">
      <div className="flex justify-between items-center mb-4">
        <div className="w-24 h-5 bg-white/10 rounded shimmer" />
        <div className="w-20 h-5 bg-white/10 rounded-full shimmer" />
      </div>

      <div className="flex flex-col gap-3 my-2">
        <div className="w-full h-7 bg-white/10 rounded shimmer" />
        <div className="w-full h-4 bg-white/5 rounded shimmer" />
        <div className="w-3/4 h-4 bg-white/5 rounded shimmer" />
      </div>

      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 my-4">
        <div className="w-full h-8 bg-white/5 rounded shimmer" />
        <div className="w-full h-8 bg-white/5 rounded shimmer" />
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-[#D4AC54]/40">
        <div className="w-20 h-8 bg-white/5 rounded-lg shimmer" />
        <div className="w-24 h-8 bg-white/10 rounded-lg shimmer" />
      </div>
    </div>
  );
};

export const JournalGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <JournalCardSkeleton key={idx} />
      ))}
    </div>
  );
};

export const JournalDetailsSkeleton: React.FC = () => {
  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col gap-10 font-manrope animate-pulse">
      <div className="w-48 h-5 bg-white/5 rounded shimmer" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 h-80 rounded-3xl bg-white/5 shimmer" />
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="w-28 h-6 bg-white/10 rounded-full shimmer" />
          <div className="w-full h-10 bg-white/10 rounded shimmer" />
          <div className="w-3/4 h-4 bg-white/5 rounded shimmer" />
          <div className="grid grid-cols-3 gap-4 h-24 bg-white/5 rounded-2xl p-4 shimmer" />
        </div>
      </div>
    </div>
  );
};
