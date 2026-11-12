/**
 * Single source of truth for the canonical production site URL.
 *
 * Audit M-4 found three different domain spellings across the codebase
 * (mmsrpublications.org in frontend metadata, mmsrpublications.com in backend
 * fallback defaults, www.mmsr-publications.com in a PDF letterhead). The
 * intended production domain must be CONFIRMED BY THE OWNER — it is never
 * guessed in code. Set NEXT_PUBLIC_SITE_URL in the environment (see
 * .env.example) and every generated URL follows.
 *
 * The literal fallback is the value the overwhelming majority of the
 * repository (root metadata, sitemap, robots, JSON-LD, .env.example) already
 * treats as canonical; changing domains requires NO code edit — only the env
 * var. localhost development keeps working because dev deployments set
 * NEXT_PUBLIC_SITE_URL=http://localhost:3000 (or leave the fallback, which
 * only surfaces in production builds that were never given the env value).
 */
export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://mmsrpublications.org'
).replace(/\/+$/, '');

/** Bare hostname derived from SITE_URL, for display contexts (footers, mail domains). */
export const SITE_DOMAIN: string = (() => {
  try {
    return new URL(SITE_URL).hostname;
  } catch {
    return 'mmsrpublications.org';
  }
})();
