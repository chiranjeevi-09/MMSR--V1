/**
 * Authenticated downloads for documents that are no longer on a public URL.
 *
 * SECURITY-QA-REPORT C-1 / H-2: invoices, publication certificates/notice PDFs
 * and author manuscripts used to be written into the publicly served MEDIA_ROOT
 * and handed to the browser as plain ``/media/...`` links. Anyone who had a
 * link — or who simply enumerated the predictable file names — could download
 * another customer's invoice or another author's unpublished manuscript with no
 * session at all.
 *
 * Those files now live in PROTECTED_MEDIA_ROOT, which deliberately has no URL.
 * The API returns the *authorised endpoint* instead (for example
 * ``/api/commerce/MMSR-ORD-1931-000042/invoice/``), and the endpoint re-checks
 * ownership on every request. So the browser must fetch them with its bearer
 * token and open the result as a blob — which is exactly what this module does.
 *
 * The value stored in the API response is a path relative to the API origin, so
 * it is resolved against NEXT_PUBLIC_API_URL here; a full URL is passed through
 * untouched (older cached records may still carry one).
 */

const getApiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export function resolveApiUrl(pathOrUrl?: string | null): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${getApiBase()}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

/** Filename advertised by the server's Content-Disposition header, if any. */
function filenameFromDisposition(disposition: string): string | null {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  return match?.[1]?.trim() || null;
}

async function fetchProtectedBlob(
  pathOrUrl: string,
  accessToken: string,
): Promise<{ objectUrl: string; filename: string | null }> {
  const url = resolveApiUrl(pathOrUrl);
  if (!url) {
    throw new Error('This document is not available yet.');
  }

  const res = await fetch(url, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('You do not have permission to open this document.');
  }
  if (res.status === 404) {
    throw new Error('This document is not available yet.');
  }
  if (!res.ok) {
    throw new Error('Download failed. Please try again.');
  }

  const blob = await res.blob();
  return {
    objectUrl: URL.createObjectURL(blob),
    filename: filenameFromDisposition(res.headers.get('Content-Disposition') || ''),
  };
}

/**
 * Force a save-to-disk of a protected document. `fallbackName` is only used when
 * the server sent no Content-Disposition (it should have).
 */
export async function downloadProtectedFile(
  pathOrUrl: string | null | undefined,
  accessToken: string,
  fallbackName = 'document',
): Promise<void> {
  if (!pathOrUrl) {
    throw new Error('This document is not available yet.');
  }
  const { objectUrl, filename } = await fetchProtectedBlob(pathOrUrl, accessToken);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoke on the next tick so Safari has time to start the transfer.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  }
}

/**
 * Open a protected document in a new tab (the "View invoice" case). A blob URL
 * is used because a plain window.open() of the API path would arrive without the
 * Authorization header and be rejected.
 */
export async function openProtectedFile(
  pathOrUrl: string | null | undefined,
  accessToken: string,
): Promise<void> {
  if (!pathOrUrl) {
    throw new Error('This document is not available yet.');
  }
  const { objectUrl } = await fetchProtectedBlob(pathOrUrl, accessToken);
  const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    // Pop-up blocked: fall back to a download rather than losing the file.
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'document';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

/** Download the tax invoice PDF of a commerce order. */
export async function downloadOrderInvoice(
  invoicePath: string | null | undefined,
  accessToken: string,
  orderId: string | number,
): Promise<void> {
  await downloadProtectedFile(invoicePath, accessToken, `invoice_order_${orderId}.pdf`);
}

/** Download one of an author's own submission documents (manuscript, notice…). */
export async function downloadSubmissionDocument(
  documentPath: string | null | undefined,
  accessToken: string,
  fallbackName: string,
): Promise<void> {
  await downloadProtectedFile(documentPath, accessToken, fallbackName);
}
