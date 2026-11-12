/**
 * MMSR Publications V2 — public-form bot trap.
 *
 * SECURITY-QA-REPORT M-4: the contact, testimonial and newsletter endpoints are
 * anonymous by design, so a plain script could POST them at will (40 enquiries
 * accepted in one run, 80 outbound emails queued). The backend now throttles
 * those writes per IP and silently discards any submission that fills this
 * hidden field — a field no human ever sees, so a non-empty value proves the
 * request came from a bot rather than a visitor.
 *
 * The name must stay in sync with `HONEYPOT_FIELD` in `backend/core/spam_guard.py`.
 */
export const HONEYPOT_FIELD = 'website';

/**
 * Build the honeypot half of a public-form payload. Real visitors always send
 * an empty string; a bot that scrapes the markup fills whatever looks like a
 * URL field, and the backend then accepts-and-drops the submission.
 */
export function honeypotValue(value?: string): string {
  return (value || '').trim();
}
