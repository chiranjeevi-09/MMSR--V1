'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const ScrollIndicator: React.FC = () => {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 150) {
        setOpacity(0);
      } else {
        setOpacity(1 - currentScroll / 150);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (opacity <= 0) return null;

  return (
    <motion.div
      style={{ opacity }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.8 }}
      className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-text-muted z-20 cursor-pointer pointer-events-none"
    >
      <span className="text-[13px] font-semibold uppercase tracking-widest text-[#7A5A2E] font-manrope">
        Scroll to Discover
      </span>
      <div className="w-5 h-9 rounded-full border-2 border-[#8C6239]/70 flex items-start justify-center p-1">
        <motion.div
          animate={{
            y: [0, 12, 0],
          }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-1.5 h-1.5 rounded-full bg-[#8C6239]"
        />
      </div>
      <ChevronDown className="w-4 h-4 text-[#7A5A2E] animate-bounce mt-0.5" />
    </motion.div>
  );
};
