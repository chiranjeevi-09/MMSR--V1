'use client';

import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export const Particles: React.FC<{ count?: number }> = ({ count = 20 }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMobile, setIsMobile] = useState(true);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Completely disable continuous particles on mobile to save CPU and main-thread work
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    if (mobile || shouldReduceMotion) return;

    const actualCount = Math.min(count, 18);
    const generated: Particle[] = Array.from({ length: actualCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 2,
      duration: Math.random() * 10 + 12,
      delay: Math.random() * 4,
      opacity: Math.random() * 0.4 + 0.15,
    }));
    setParticles(generated);
  }, [count, shouldReduceMotion]);

  if (shouldReduceMotion || isMobile || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-gold-400"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `floatParticle ${p.duration}s linear infinite ${p.delay}s`,
            willChange: 'transform, opacity',
          }}
        />
      ))}
      <style jsx>{`
        @keyframes floatParticle {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          15% {
            opacity: 0.5;
          }
          85% {
            opacity: 0.5;
          }
          100% {
            transform: translateY(-100vh);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};
