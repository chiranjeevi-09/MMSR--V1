/**
 * MMSR Publications V2 — CMS retry buffer.
 *
 * SECURITY-QA-REPORT L-5: the admin CMS used to write every form submit into
 * `localStorage` as an "override" and then merge that override back over the
 * server's data on read (`lib/services/books.ts`, `app/admin/*`). Two things
 * followed from it: a save that the API had *rejected* still looked successful
 * in the desk's own UI, and a later server-side change could be masked by a
 * stale local copy indefinitely. The desk silently disagreed with the database.
 *
 * The server is authoritative. Local storage is now used for exactly one
 * purpose — holding an unsent draft so an operator's typing survives a failed
 * request — and it is cleared the moment the write succeeds. Nothing here is
 * ever merged into catalog/list data.
 */

const PENDING_PREFIX = 'mmsr_pending_';

export interface PendingDraft<T = unknown> {
  /** The form values that could not be sent. */
  data: T;
  /** ISO timestamp, shown so an operator can judge how stale the draft is. */
  savedAt: string;
  /** Error message from the failed attempt. */
  reason: string;
}

function isAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function savePending(name: string, data: unknown, reason: string): void {
  if (!isAvailable()) return;
  try {
    const draft: PendingDraft = { data, savedAt: new Date().toISOString(), reason };
    window.localStorage.setItem(PENDING_PREFIX + name, JSON.stringify(draft));
  } catch {
    /* Quota exceeded or storage disabled — the draft is a convenience only. */
  }
}

export function readPending<T = unknown>(name: string): PendingDraft<T> | null {
  if (!isAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(PENDING_PREFIX + name);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Ignore anything written before this shape existed.
    return parsed && typeof parsed === 'object' && 'data' in parsed
      ? (parsed as PendingDraft<T>)
      : null;
  } catch {
    return null;
  }
}

export function clearPending(...names: string[]): void {
  if (!isAvailable()) return;
  names.forEach((name) => {
    try {
      window.localStorage.removeItem(PENDING_PREFIX + name);
    } catch {
      /* nothing to clean up */
    }
  });
}

/**
 * Drop the pre-fix "override" copies once, so a stale local snapshot cannot
 * resurface through any code path that still reads the old keys.
 */
export function purgeLegacyOverrides(...prefixes: string[]): void {
  if (!isAvailable()) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
        stale.push(key);
      }
    }
    stale.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* storage unavailable */
  }
}
