import React from 'react';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-navy-midnight text-ivory-white p-6">
      <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
        <div className="p-8 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-4 bg-white/10 rounded w-1/2" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-2">
              <div className="h-3 bg-white/10 rounded w-2/3" />
              <div className="h-8 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
