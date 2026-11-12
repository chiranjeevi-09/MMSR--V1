import React from 'react';

export default function CheckoutLoading() {
  return (
    <div className="min-h-screen bg-navy-midnight text-ivory-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 bg-white/10 rounded w-1/3" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <div className="h-4 bg-white/10 rounded w-1/4" />
            <div className="h-10 bg-white/10 rounded w-full" />
            <div className="h-10 bg-white/10 rounded w-full" />
          </div>
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <div className="h-4 bg-white/10 rounded w-1/2" />
            <div className="h-20 bg-white/10 rounded w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
