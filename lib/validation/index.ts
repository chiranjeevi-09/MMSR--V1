// ─── Shared input validation (project-wide standard) ─────────────────────────
//
// Single source of truth for field validators used by BOTH the public site and
// the Admin Portal. Rules mirror the backend (backend/form_validation.py) —
// the backend stays authoritative; these utilities exist so invalid input is
// blocked in the UI with inline errors BEFORE a request is sent.
//
// Conventions (see docs/FORM_VALIDATION_STANDARDS.md):
//   • Every validate* function returns '' when the value is acceptable and a
//     short human-readable message otherwise (matches the pattern already used
//     across the admin pages: `if (x === '') delete errors.x`).
//   • Messages use the field's own label so they can be rendered inline.
//   • Identifiers that merely contain digits (phone, PIN, ISBN) are validated
//     as STRINGS — never coerced to numbers.

// ─── Patterns ────────────────────────────────────────────────────────────────

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Standard Indian mobile: exactly 10 digits, starting 6-9.
export const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;

// Indian postal PIN: 6 digits, first digit non-zero.
export const INDIAN_PIN_RE = /^[1-9]\d{5}$/;

// Generic international postcode (used only where a field is explicitly not
// India-only): 3-10 letters/digits/hyphen/space, must start alphanumeric.
export const POSTCODE_GENERIC_RE = /^[A-Za-z0-9][A-Za-z0-9\- ]{2,9}$/;

// ISBN-10 (digits + optional X check) or ISBN-13 (all digits), with or without
// hyphens. Checksum is verified separately by isValidIsbn().
const ISBN_CHARS_RE = /^(?:[\d-]{9,17}[\dXx])$/;

// ─── Generic text / required ─────────────────────────────────────────────────

/** Required, non-whitespace. */
export function required(value: string, label = 'This field'): string {
  return value && value.trim().length > 0 ? '' : `${label} is required.`;
}

/**
 * Length bounds on the TRIMMED value. Meaningful inner spaces, punctuation,
 * apostrophes, hyphens and non-Latin (e.g. Indian-language) characters are all
 * allowed — names and free text must not be restricted to English letters.
 */
export function textLength(value: string, min: number, max: number, label = 'This field'): string {
  const v = value.trim();
  if (v.length === 0) return `${label} is required.`;
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  return '';
}

/** Optional free-text max length (blank is acceptable). */
export function optionalTextLength(value: string, max: number, label = 'This field'): string {
  return value.trim().length > max ? `${label} must be at most ${max} characters.` : '';
}

// ─── Person / place names (letters only, never digits) ───────────────────────
//
// Names, cities, states and countries never contain digits. These mirror
// backend.form_validation.validate_alpha_text and are enforced in the UI so
// the invalid keystroke never even lands in the field. Letters of any script,
// spaces and name separators (apostrophe/hyphen/period/comma) are all kept —
// ONLY digits are removed, so international names such as "José Núñez" or
// "ललित" remain valid. Address lines, institutions and departments are NOT
// covered by these (digits there are legitimate, e.g. "Flat 2B", "IIT") .

/** onChange keystroke filter for name/place fields: drop digits & stray symbols,
 *  keep letters of any script, spaces and name separators, cap length.
 *  Mirrors backend.form_validation.validate_alpha_text (authoritative). */
export function lettersOnly(value: string, maxLen = 100): string {
  let out = '';
  for (const ch of value) {
    if (isAllowedNameChar(ch)) out += ch;
  }
  return out.slice(0, maxLen);
}

// Name separators permitted alongside letters (apostrophe, hyphen, period for
// initials, comma for "Last, First" style entries).
const NAME_SEPARATORS = "'-.,";

// True for characters a person/place name may contain: whitespace, an
// approved separator, or a letter of ANY script. Rejected: ASCII digits and
// ASCII punctuation/symbols (e.g. @ # / !). Everything at code-point >= 0x80
// (accented Latin, Devanagari, CJK, …) is treated as a letter and kept —
// avoids Unicode property escapes so this runs under the ES2017 target.
function isAllowedNameChar(ch: string): boolean {
  if (ch === ' ' || ch === '\t' || ch === '\n') return true;
  if (NAME_SEPARATORS.includes(ch)) return true;
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x80) return true; // non-ASCII letters/space → keep
  if (code >= 0x61 && code <= 0x7a) return true; // a-z
  if (code >= 0x41 && code <= 0x5a) return true; // A-Z
  return false; // ASCII digits + ASCII symbols → reject
}

/** Person/place name validator: required/blank + digit/symbol rejection + length.
 *  Mirrors backend.form_validation.validate_alpha_text. */
export function validateName(
  value: string,
  label = 'This field',
  opts: { min?: number; max?: number; required?: boolean } = {}
): string {
  const { min = 2, max = 100, required: isReq = true } = opts;
  const v = value.trim();
  if (!v) return isReq ? `${label} is required.` : '';
  if (/\d/.test(v)) return `${label} must contain letters only — numbers are not allowed.`;
  for (const ch of v) {
    if (!isAllowedNameChar(ch)) {
      return `${label} must contain letters only — symbols such as "@", "#", "/" are not allowed.`;
    }
  }
  if (v.length < min) return `${label} must be at least ${min} characters.`;
  if (v.length > max) return `${label} must be at most ${max} characters.`;
  return '';
}

// ─── Email ───────────────────────────────────────────────────────────────────

export function validateEmail(value: string, label = 'Email address'): string {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (!EMAIL_RE.test(v)) return `Enter a valid email address.`;
  return '';
}

/** Email that may be left blank. */
export function validateOptionalEmail(value: string, label = 'Email address'): string {
  const v = value.trim();
  if (!v) return '';
  if (!EMAIL_RE.test(v)) return `Enter a valid ${label.toLowerCase()}, or leave it blank.`;
  return '';
}

// ─── Phone (identifiers, not quantities) ─────────────────────────────────────

/** Strip everything except digits — for onChange input filtering only. */
export function digitsOnly(value: string, maxDigits = 10): string {
  return value.replace(/\D/g, '').slice(0, maxDigits);
}

/**
 * Strict Indian 10-digit mobile. Input may contain spaces/dashes/+91 while
 * typing; they are normalized before matching. Alphabets or other symbols in
 * the digit run REJECT the value — nothing is silently truncated.
 */
export function validateIndianMobile(value: string, label = 'Phone number'): string {
  const raw = value.trim();
  if (!raw) return `${label} is required.`;
  return matchIndianMobile(raw)
    ? ''
    : `${label} must be a 10-digit Indian mobile number (starting 6-9).`;
}

/** Same rule as validateIndianMobile but blank passes. */
export function validateOptionalIndianMobile(value: string, label = 'Phone number'): string {
  const raw = value.trim();
  if (!raw) return '';
  return matchIndianMobile(raw)
    ? ''
    : `${label} must be a 10-digit Indian mobile number (starting 6-9), or left blank.`;
}

function matchIndianMobile(raw: string): boolean {
  // Allow the familiar written forms; only digits participate in the match.
  if (!/^[6-9]\d{9}$|^\+?91[\s-]?[6-9]\d{9}$|^0?[\s-]?[6-9]\d{9}$/.test(raw)) {
    // Tolerate separators only (no letters/symbols) as a fallback path.
    if (/[\s+-]/.test(raw) && !/^[0-9+\-\s]+$/.test(raw)) return false;
    const digits = raw.replace(/\D/g, '');
    return INDIAN_MOBILE_RE.test(digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits);
  }
  return true;
}

/** Normalization for SUBMISSION: always the bare 10 digits. */
export function normalizeIndianMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
}

// ─── Postal codes ────────────────────────────────────────────────────────────

export function validateIndianPin(value: string, label = 'PIN code'): string {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  return INDIAN_PIN_RE.test(v) ? '' : `${label} must be exactly 6 digits.`;
}

export function validateOptionalIndianPin(value: string, label = 'PIN code'): string {
  const v = value.trim();
  if (!v) return '';
  return INDIAN_PIN_RE.test(v) ? '' : `${label} must be exactly 6 digits, or left blank.`;
}

// ─── Numbers: quantities, prices, percentages ────────────────────────────────

/** Whole-number field (quantity, stock, pages, seats…). */
export function validateInteger(
  value: string | number,
  opts: { min?: number; max?: number; required?: boolean; label?: string } = {}
): string {
  const { min, max, required: isReq = true, label = 'This field' } = opts;
  const raw = String(value).trim();
  if (!raw) return isReq ? `${label} is required.` : '';
  if (!/^-?\d+$/.test(raw)) return `${label} must be a whole number (digits only).`;
  const n = Number(raw);
  if (min !== undefined && n < min) return `${label} must be ${min} or more.`;
  if (max !== undefined && n > max) return `${label} must be ${max} or less.`;
  return '';
}

/** Decimal money/measure field: digits with up to `decimals` places. */
export function validateDecimal(
  value: string | number,
  opts: { min?: number; max?: number; decimals?: number; required?: boolean; label?: string } = {}
): string {
  const { min, max, decimals = 2, required: isReq = true, label = 'This field' } = opts;
  const raw = String(value).trim();
  if (!raw) return isReq ? `${label} is required.` : '';
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return `${label} must be a positive number.`;
  const frac = raw.split('.')[1];
  if (frac && frac.length > decimals) return `${label} can have at most ${decimals} decimal places.`;
  const n = Number(raw);
  if (Number.isNaN(n) || !Number.isFinite(n)) return `${label} must be a valid number.`;
  if (min !== undefined && n < min) return `${label} must be at least ${min}.`;
  if (max !== undefined && n > max) return `${label} must be ${max} or less.`;
  return '';
}

/** Indian book price: ₹0 is allowed for free resources; sane ₹ cap. */
export function validatePrice(value: string | number, label = 'Price', opts: { required?: boolean; allowZero?: boolean } = {}): string {
  return validateDecimal(value, {
    min: opts.allowZero === false ? 0.01 : 0,
    max: 1000000,
    decimals: 2,
    required: opts.required !== false,
    label,
  });
}

/** Percentage 0-100. */
export function validatePercent(value: string | number, label = 'Percentage'): string {
  return validateDecimal(value, { min: 0, max: 100, decimals: 2, label });
}

// ─── ISBN (identifier) ───────────────────────────────────────────────────────

/** Format + checksum validation for ISBN-10 / ISBN-13. Blank passes. */
export function validateIsbn(value: string, label = 'ISBN'): string {
  const v = value.trim();
  if (!v) return '';
  if (!ISBN_CHARS_RE.test(v)) return `${label} must be a valid ISBN-10 or ISBN-13.`;
  return isValidIsbn(v) ? '' : `${label} checksum is invalid — re-check the digits.`;
}

export function isValidIsbn(raw: string): boolean {
  const isbn = raw.replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += (i + 1) * Number(isbn[i]);
    if (isbn[9] === 'X') sum += 100;
    else sum += 10 * Number(isbn[9]);
    return sum % 11 === 0;
  }
  if (/^\d{13}$/.test(isbn)) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
    const check = (10 - (sum % 10)) % 10;
    return check === Number(isbn[12]);
  }
  return false;
}

// ─── ISSN (identifier) ───────────────────────────────────────────────────────

/** Format + checksum validation for an 8-digit ISSN (####-####). Blank passes. */
export function validateIssn(value: string, label = 'ISSN'): string {
  const v = value.trim();
  if (!v) return '';
  const compact = v.replace(/[\s-]/g, '').toUpperCase();
  if (!/^\d{7}[\dX]$/.test(compact)) return `${label} must be 8 digits (format ####-####).`;
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (8 - i) * Number(compact[i]);
  const check = (11 - (sum % 11)) % 11;
  const checkChar = check === 10 ? 'X' : String(check);
  return checkChar === compact[7] ? '' : `${label} checksum is invalid — re-check the digits.`;
}

// ─── URLs (optional identifiers, e.g. ORCID) ─────────────────────────────────

export function validateOptionalUrl(value: string, label = 'Link'): string {
  const v = value.trim();
  if (!v) return '';
  try {
    const u = new URL(/^(https?:|mailto:)/i.test(v) ? v : `https://${v}`);
    return u.hostname.includes('.') ? '' : `Enter a valid ${label.toLowerCase()} (e.g. https://orcid.org/0000-…).`;
  } catch {
    return `Enter a valid ${label.toLowerCase()}.`;
  }
}

// ─── Dates & cross-field ─────────────────────────────────────────────────────

/** Required ISO yyyy-mm-dd that is a real calendar date. */
export function validateDate(value: string, label = 'Date'): string {
  if (!value) return `${label} is required.`;
  return isNaN(new Date(value).getTime()) ? `Enter a valid ${label.toLowerCase()}.` : '';
}

/** End must not precede start (when the workflow requires ordering). */
export function validateDateRange(start: string, end: string, startLabel = 'Start date', endLabel = 'End date'): string {
  if (!start || !end) return '';
  return new Date(end).getTime() < new Date(start).getTime()
    ? `${endLabel} cannot be before ${startLabel}.`
    : '';
}

// ─── Passwords (UX guidance only — the backend stays authoritative) ──────────

export interface PasswordCheck { label: string; ok: boolean }

/** Mirrors Django AUTH_PASSWORD_VALIDATORS that can be mirrored client-side
 *  (min length 8; entirely-numeric and common passwords are warnings the
 *  server also rejects via its common-password list). */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Not entirely numeric', ok: password.length > 0 && !/^\d+$/.test(password) },
    {
      label: 'Not a common password',
      ok: password.length > 0 && !/^(password|123456|qwerty|admin|welcome|letmein)[\d!@#$]*$/i.test(password),
    },
  ];
}

export function validatePassword(password: string, label = 'Password'): string {
  return password.length >= 8 ? '' : `${label} must be at least 8 characters.`;
}

export function validatePasswordMatch(password: string, confirm: string): string {
  if (!confirm) return 'Please confirm the password.';
  return password === confirm ? '' : 'Passwords do not match.';
}

// ─── File uploads (client-side pre-check; backend re-validates content) ──────

export function validateFile(
  file: File | null | undefined,
  opts: { accept?: string[]; maxMB?: number; required?: boolean; label?: string } = {}
): string {
  const { accept, maxMB, required: isReq = false, label = 'File' } = opts;
  if (!file || file.size === 0) return isReq ? `Please choose a ${label.toLowerCase()}.` : '';
  if (maxMB && file.size > maxMB * 1024 * 1024) return `${label} must be ${maxMB} MB or smaller.`;
  if (accept && accept.length > 0) {
    const name = file.name.toLowerCase();
    const ok = accept.some((ext) => {
      const e = ext.replace(/^\./, '').toLowerCase();
      return name.endsWith(`.${e}`) || (file.type || '').toLowerCase().includes(e === 'pdf' ? 'pdf' : e);
    });
    if (!ok) return `${label} must be one of: ${accept.join(', ').toUpperCase()}.`;
  }
  return '';
}

// ─── Enums / selects ─────────────────────────────────────────────────────────

/** Required selection from a known value set. */
export function validateChoice(value: string, allowed: readonly string[], label = 'This option'): string {
  if (!value) return `Please select ${label.toLowerCase()}.`;
  return allowed.includes(value) ? '' : `Invalid selection for ${label.toLowerCase()}.`;
}

// ─── Error-map helper ────────────────────────────────────────────────────────

/** Collapse { field: message | '' } to only the fields that actually failed. */
export function pruneErrors<T extends Record<string, string>>(errors: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(errors) as (keyof T)[]).forEach((k) => {
    if (errors[k]) out[k] = errors[k];
  });
  return out;
}
