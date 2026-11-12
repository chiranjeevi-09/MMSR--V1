/**
 * Google Analytics 4 bootstrap (SECURITY-QA-REPORT M-5).
 *
 * This used to be an inline `<Script>` body inside components/ui/Analytics.tsx.
 * A Content-Security-Policy that allows inline scripts is not a policy worth
 * shipping, so the snippet moved into this file and the measurement id is now
 * read from the `<meta name="google-analytics-id">` tag that `app/layout.tsx`
 * renders. Loaded with next/script `afterInteractive`, alongside gtag.js.
 *
 * The dataLayer queue below is intentionally identical to Google's own
 * installation snippet: if this file runs before gtag.js has finished loading,
 * the calls are buffered and replayed by gtag.js; if it runs after, they are
 * executed immediately.
 */
(function () {
  var meta = document.querySelector('meta[name="google-analytics-id"]');
  var measurementId = meta ? meta.getAttribute('content') : '';
  if (!measurementId) return;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag('js', new Date());
  gtag('config', measurementId, {
    page_path: window.location.pathname,
  });
})();
