import React from 'react';

export default function AdminDashboardLoading() {
  return (
    <div className="min-h-screen bg-navy-midnight text-ivory-white p-6">
      <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="p-8 rounded-2xl bg-navy-900 border border-white/10 space-y-3">
          <div className="h-6 bg-white/10 rounded w-1/4" />
          <div className="h-4 bg-white/10 rounded w-1/3" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-navy-900 border border-white/10 space-y-2">
              <div className="h-3 bg-white/10 rounded w-full" />
              <div className="h-6 bg-white/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
