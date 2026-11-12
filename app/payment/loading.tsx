import React from 'react';

export default function PaymentLoading() {
  return (
    <div className="min-h-screen bg-navy-midnight text-ivory-white flex items-center justify-center p-6">
      <div className="max-w-md w-full p-8 rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] text-center space-y-4 animate-pulse">
        <div className="w-12 h-12 rounded-full bg-gold-500/20 mx-auto" />
        <div className="h-6 bg-white/10 rounded w-2/3 mx-auto" />
        <div className="h-4 bg-white/10 rounded w-1/2 mx-auto" />
      </div>
    </div>
  );
}
