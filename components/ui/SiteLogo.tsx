import React from 'react';
import Image from 'next/image';

interface SiteLogoProps {
  /** Tailwind sizing/rounding/layout classes, e.g. "w-11 h-11 shadow-sm". The
   *  logo is a circular emblem, so keep the container square. */
  className?: string;
  alt?: string;
  /** Pass true for above-the-fold / LCP usages (hero, intro overlay) so Next
   *  preloads the mark instead of lazy-deferring it. Defaults to false so the
   *  many below-the-fold usages stay lazy. */
  priority?: boolean;
  /** Responsive hint for next/image. Without it the browser would download the
   *  full-size source for every instance; the emblem never renders wider than
   *  ~128 CSS px, so callers can override for unusually small placements. */
  sizes?: string;
}

/**
 * Canonical MMSR Publications brand mark. Used across the public site, auth
 * pages and the admin portal so the logo is defined in exactly one place.
 *
 * Rendered through next/image (was a raw <img>) so the ~302 KB PNG is served
 * as size-appropriate WebP/AVIF by the existing image pipeline instead of the
 * full raster at every one of the many display sizes — the oversized-image
 * finding in the Lighthouse report. Same asset, same references, same circular
 * presentation; only the delivery is optimized.
 */
export function SiteLogo({
  className = '',
  alt = 'MMSR Publications',
  priority = false,
  sizes = '128px',
}: SiteLogoProps) {
  return (
    <Image
      src="/logos/mmsr-logo.webp"
      alt={alt}
      width={256}
      height={256}
      priority={priority}
      sizes={sizes}
      draggable={false}
      className={`rounded-full object-cover shrink-0 ${className}`}
    />
  );
}

export default SiteLogo;
