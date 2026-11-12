import React from 'react';

export const BackgroundEffects: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#F8EEDC]">
      {/* Radial Gold Center Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-radial from-gold-500/15 via-gold-500/5 to-transparent blur-[120px]" />

      {/* Floating Animated Light Orb Top Left - GPU-accelerated CSS */}
      <div
        className="absolute top-10 left-10 w-[500px] h-[500px] rounded-full bg-gold-500/10 blur-[140px] animate-pulse"
        style={{ animationDuration: '8s' }}
      />

      {/* Floating Animated Light Orb Bottom Right - GPU-accelerated CSS */}
      <div
        className="absolute bottom-10 right-10 w-[600px] h-[600px] rounded-full bg-[#D4AC54]/15 blur-[160px] animate-pulse"
        style={{ animationDuration: '10s' }}
      />

      {/* Subtle Mesh Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(rgba(212, 175, 55, 0.4) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#F8EEDC]/80 via-transparent to-[#F8EEDC]" />
    </div>
  );
};
