import type { NextConfig } from "next";

/**
 * Image allow-list (audit M-5 / TASK 14).
 *
 * Every remote image on this site is media served by the Django backend:
 * book/journal/issue covers, slider images and testimonial avatars all come
 * from the `/media/**` tree (see `formatMediaUrl` in lib/services/*.ts, which
 * prefixes the API origin onto serializer-relative paths). Nothing else is
 * rendered through next/image, so the broad `hostname: '**'` wildcards that
 * previously allowed ANY remote host are removed.
 *
 * The production media host is DERIVED from NEXT_PUBLIC_API_URL at build time
 * rather than hardcoded to a guessed domain, so it stays correct wherever the
 * API is deployed (and keeps localhost development working out of the box).
 */
const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

function mediaPattern(): { protocol: 'http' | 'https'; hostname: string; port?: string; pathname: string } {
  try {
    const u = new URL(apiBase);
    const protocol: 'http' | 'https' = u.protocol === 'https:' ? 'https' : 'http';
    const pattern: { protocol: 'http' | 'https'; hostname: string; port?: string; pathname: string } = {
      protocol,
      hostname: u.hostname,
      pathname: '/media/**',
    };
    // Only pin an explicit port when the URL specifies one; otherwise let next
    // use the protocol default (so https://api.example.com works unchanged).
    if (u.port) pattern.port = u.port;
    return pattern;
  } catch {
    // Malformed/absent env — fall back to the documented dev backend.
    return { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/media/**' };
  }
}

/**
 * Content-Security-Policy (SECURITY-QA-REPORT M-5).
 *
 * `script-src` must include `'unsafe-inline'`: Next.js App Router always emits
 * its OWN inline bootstrap / flight `<script>` tags (`self.__next_f.push…`) and
 * `app/layout.tsx` injects JSON-LD `<script>` blocks. A nonce-only policy can't
 * be used here because most routes are statically prerendered (a per-request
 * nonce is incompatible with cached HTML), and — contrary to an earlier
 * assumption — `<script type="application/ld+json">` IS gated by `script-src`
 * too. Without `'unsafe-inline'` every one of those inline scripts is blocked,
 * hydration never runs, and the site renders blank in production.
 *
 * The remaining directives are what actually contain XSS risk, and stay strict:
 * `connect-src` is locked to our origins (an injected script can't exfiltrate to
 * an attacker host), `frame-ancestors 'none'` blocks clickjacking, and
 * `object-src 'none'` / `base-uri 'self'` close the classic injection sinks.
 *
 * `style-src` keeps `'unsafe-inline'` because framer-motion and `next/image`
 * set inline `style` attributes on almost every node; attacking that would
 * break the site for no real gain, since style injection is not code execution.
 *
 * Dev is additionally looser: `next dev` needs `'unsafe-eval'` and a live
 * WebSocket for HMR, and injects an inline React Refresh preamble.
 */
function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== 'production';

  // Media/API origin, so plain <img>/<a download> tags that point straight at
  // /media/** and the client-side `fetch` calls to /api/** keep working.
  //
  // IMPORTANT: CSP host-source expressions must be UNQUOTED. Only keywords
  // ('self', 'none', 'unsafe-inline', …) are quoted; a quoted arbitrary string
  // like `'http://127.0.0.1:8000'` is an invalid source and browsers silently
  // IGNORE it — which previously meant the API origin was not actually allowed
  // and every production `connect-src` fetch (books/journals) was blocked.
  const mediaOrigins = [apiBase];
  if (apiBase.startsWith('http://')) {
    mediaOrigins.push(apiBase.replace(/^http:/, 'https:'));
  }

  const scriptSrc = [
    `'self'`,
    // See header comment — required for Next's inline flight scripts + JSON-LD,
    // otherwise the app renders blank in production.
    `'unsafe-inline'`,
    'https://checkout.razorpay.com',
    'https://accounts.google.com',
    'https://www.googletagmanager.com',
    'https://www.clarity.ms',
    ...(isDev ? [`'unsafe-eval'`] : []),
  ];

  const connectSrc = [
    `'self'`,
    ...mediaOrigins,
    'https://api.razorpay.com',
    'https://accounts.google.com',
    'https://www.google-analytics.com',
    'https://www.clarity.ms',
    ...(isDev ? ['ws://localhost:*', 'ws://127.0.0.1:*', 'http://localhost:*', 'http://127.0.0.1:*'] : []),
  ];

  const directives: string[] = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `font-src 'self'`,
    // blob: is required — protected PDFs, issue downloads and the slider image
    // previews are all rendered from URL.createObjectURL().
    `img-src 'self' data: blob: ${mediaOrigins.join(' ')}`,
    `media-src 'self' blob:`,
    `connect-src ${connectSrc.join(' ')}`,
    // GIS renders a same-iframe button/popup; Razorpay opens its checkout iframe.
    `frame-src 'self' blob: https://accounts.google.com https://*.google.com https://checkout.razorpay.com https://api.razorpay.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    // No form is ever posted to a third party: the enquiry, submission and
    // checkout forms all go to this origin or the API origin only.
    `form-action 'self' ${mediaOrigins.join(' ')}`,
    `frame-ancestors 'none'`,
  ];

  const isHttpsDeployment = !isDev && (process.env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') || apiBase.startsWith('https://'));
  if (isHttpsDeployment) {
    directives.push('upgrade-insecure-requests');
  }

  return directives.join('; ');
}

function securityHeaders(): Array<{ key: string; value: string }> {
  const csp = buildCsp();
  // Report-only mode lets an operator watch violations before enforcing.
  const headerName =
    process.env.CSP_REPORT_ONLY === 'true' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  return [
    { key: headerName, value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // The site is public; only the path must stay off third-party referrers.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    // camera/microphone/geolocation are never used; payment is left available
    // because the Razorpay checkout iframe relies on it.
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), usb=(), magnetometer=(), gyroscope=(), interest-cohort=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lighthouse best-practices/perf: drop the `X-Powered-By: Next.js` banner
  // (information disclosure + a trivial header) and tree-shake the barrel
  // imports of the icon library actually used across the app. `lucide-react`
  // re-exports every icon from one module; without this hint a naive import
  // can pull the whole set into the client bundle. No new dependency added.
  poweredByHeader: false,
  // Source maps are generated for the server build only. Keeping the browser
  // bundle un-sourcemapped avoids shipping readable source to production (the
  // report's "missing / exposed source map" concern) while preserving full
  // stack traces server-side for error triage.
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Local development backend.
      { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/media/**' },
      { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/media/**' },
      // Production backend (derived from NEXT_PUBLIC_API_URL — no wildcard).
      mediaPattern(),
    ],
  },
  // SECURITY-QA-REPORT M-5 — the frontend shipped no security headers at all:
  // no CSP, no nosniff, no Referrer-Policy, no frame restrictions, and the
  // sample nginx block added none either. These headers cover the marketing
  // site *and* the /admin CMS, which are served by this process.
  //
  // HSTS stays at the edge (nginx) because Next is usually served over plain
  // HTTP behind a proxy here, and `Strict-Transport-Security` from a non-HTTPS
  // origin is ignored anyway — see DEPLOYMENT.md.
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/logos/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/icons/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
        ],
      },
      {
        source: '/:path*',
        headers: securityHeaders(),
      },
    ];
  },
};

export default nextConfig;
