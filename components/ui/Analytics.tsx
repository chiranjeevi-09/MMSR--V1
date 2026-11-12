'use client';

import React from 'react';
import Script from 'next/script';

export const AnalyticsProvider: React.FC = () => {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  return (
    <>
      {/* Google Analytics (only when NEXT_PUBLIC_GA_ID is present).
          SECURITY-QA-REPORT M-5: the `gtag()` bootstrap used to be an inline
          script, which the new Content-Security-Policy forbids. It now lives in
          /public/scripts/ga-bootstrap.js and picks the measurement id up from
          the meta tag rendered by app/layout.tsx. */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script src="/scripts/ga-bootstrap.js" strategy="afterInteractive" />
        </>
      )}

      {/* Microsoft Clarity (only when NEXT_PUBLIC_CLARITY_ID is present).
          The hand-rolled loader snippet is replaced by Clarity's own tag URL,
          which needs no inline script and no dataLayer trickery. */}
      {clarityId && (
        <Script
          src={`https://www.clarity.ms/tag/${encodeURIComponent(clarityId)}`}
          strategy="afterInteractive"
        />
      )}
    </>
  );
};
