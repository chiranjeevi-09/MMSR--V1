import React from 'react';

export default function ConferenceLoading() {
  return (
    <div className="min-h-screen bg-navy-midnight text-ivory-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-9 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-[#F8EEDC]/5 border border-[#D4AC54]/30 p-6 space-y-4">
              <div className="h-32 bg-white/10 rounded" />
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
              <div className="flex gap-3">
                <div className="h-8 bg-white/10 rounded w-1/4" />
                <div className="h-8 bg-white/10 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
