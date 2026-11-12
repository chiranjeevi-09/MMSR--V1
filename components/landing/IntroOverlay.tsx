import React from 'react';

/**
 * First-visit overlay is retired to ensure immediate First Contentful Paint (FCP)
 * and Largest Contentful Paint (LCP) under 1.0s, eliminating the 2.6s blocking
 * curtain previously flagged by Core Web Vitals and Lighthouse audits.
 */
export const IntroOverlay: React.FC = () => {
  return null;
};
