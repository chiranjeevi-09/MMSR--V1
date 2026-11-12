/**
 * Shared helpers for the MMSR public ID standard (Phase 5).
 *
 * Public IDs are the reference a human can quote: `MMSR-ORD-1931-000101`.
 * They are issued by the backend only, so the frontend must never invent,
 * pad, or derive one from an internal primary key — the old
 * `ORD-${String(id).padStart(5, '0')}` style fabricated a reference that no
 * record answers to.
 */

export const PUBLIC_ID_REGEX = /^MMSR-[A-Z]{3}-1931-[0-9]{6}$/;

/** True when the value is a well-formed public ID. */
export function isPublicId(value: unknown): value is string {
  return typeof value === 'string' && PUBLIC_ID_REGEX.test(value);
}

/**
 * The public ID of a record, or null when it has none yet.
 * `id` (the internal primary key) is deliberately never a fallback.
 */
export function publicIdOf(record: { public_id?: string | null } | null | undefined): string | null {
  const value = record?.public_id;
  return isPublicId(value) ? value : null;
}

/**
 * Text to render for an identifier: the public ID when present, otherwise the
 * documented placeholder. Never `undefined`, never an empty label.
 */
export function displayId(
  record: { public_id?: string | null } | null | undefined,
  fallback = 'Not assigned yet',
): string {
  return publicIdOf(record) ?? fallback;
}

/**
 * Legacy-friendly reference for records that still display a historical value
 * (e.g. an order's original `custom_order_id`). Preference order is public ID
 * first, then the stored legacy reference, then the placeholder — the internal
 * PK is never rendered.
 */
export function displayReference(
  record: { public_id?: string | null } | null | undefined,
  legacy: string | null | undefined,
  fallback = 'Not assigned yet',
): string {
  return publicIdOf(record) ?? (legacy && legacy.trim() ? legacy.trim() : fallback);
}

/**
 * URL segment for a record: its public ID when the API supplied one. Customers
 * should never see an internal primary key in an address bar, and every detail
 * endpoint resolves both forms, so the `id` branch is only a safety net for a
 * response that carries no public ID at all.
 */
export function routeIdOf(
  record: { public_id?: string | null; id?: number | string } | null | undefined,
): string {
  return publicIdOf(record) ?? String(record?.id ?? '');
}

/**
 * Identifier text for client-side search boxes: only the reference strings a
 * record actually carries, joined and lower-cased. Numbers (internal primary
 * keys) are excluded on purpose, and the display placeholder is never included
 * — so "Not assigned yet" cannot produce a phantom match.
 */
export function searchableRefs(
  ...values: Array<string | null | undefined>
): string {
  return values
    .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    .join(' ')
    .toLowerCase();
}
