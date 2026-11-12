'use client';

import React from 'react';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/lib/context/AuthContext';
import { CartProvider } from '@/lib/context/CartContext';
import { WishlistProvider } from '@/lib/context/WishlistContext';

export const ClientProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    // reducedMotion="user" makes EVERY framer-motion component honour the
    // visitor's OS-level "prefers-reduced-motion" setting (transform/layout
    // animations are dropped, opacity fades kept) — the audit's global
    // motion-accessibility fix without touching individual components.
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>{children}</WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </MotionConfig>
  );
};
