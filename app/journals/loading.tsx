import React from 'react';

export default function JournalsLoading() {
  return (
    <div className="min-h-screen bg-navy-midnight text-ivory-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-9 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#F8EEDC]/5 border border-[#D4AC54]/30 p-5 space-y-4">
              <div className="flex gap-4">
                <div className="w-20 aspect-[3/4] bg-white/10 rounded" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/10 rounded w-1/2" />
                  <div className="h-3 bg-white/10 rounded w-2/3" />
                </div>
              </div>
              <div className="h-8 bg-white/10 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
