# MMSR Publications V2 — Form Validation & Data Integrity Standards

This document is the single, forward-looking contract for how **every** input in
the platform is validated — public website, Admin Portal, and Django/DRF backend.
Add new forms to follow these rules; do not re-invent per-page validation.

---

## 1. Golden rules

1. **The backend is authoritative.** Client-side `maxLength`, `pattern`, and JS
   validators are UX aids only; they protect nothing. Every business rule MUST be
   re-declared in a DRF serializer (see §6).
2. **Never silently mutate user input.** Invalid identifiers are **rejected with a
   field-level message**, not digit-stripped, truncated, or coerced into a
   different value. (The old order flow kept the *last 10 digits* of a junk phone
   string — that class of bug is banned.)
3. **One shared implementation per rule.** The rule lives in exactly two places —
   `backend/form_validation.py` (authoritative) and `lib/validation/index.ts`
   (its UI mirror). Pages call these; they do not inline regexes.
4. **Tell the user which field is wrong, before the request and after it.** Inline
   errors, `aria-invalid`, and mapped server errors (see §7).
5. **Preserve entered values on error.** A failed submit re-renders with what the
   user typed, minus the invalid field's stale error.

---

## 2. Identifiers vs. quantities

Fields that merely *contain* digits are **identifiers** (strings), never numbers:

| Field            | Type        | Rule                                                             |
|------------------|-------------|------------------------------------------------------------------|
| Mobile / phone   | identifier  | 10-digit Indian mobile, starts 6–9 (see §3).                     |
| PIN / postcode   | identifier  | 6-digit Indian PIN, or a valid international postcode (see §4).  |
| ISBN             | identifier  | ISBN-10/13 **with checksum**.                                     |
| ISSN             | identifier  | 8 digits `####-####` **with checksum**.                           |
| Price, pages, stock, fee, rating | quantity | Integer/decimal **with explicit min/max bounds** (see §5). |

Never use `Number(...)` or `type="number"` on an identifier; never apply an
identifier checksum to a quantity.

---

## 3. Phone (Indian mobile) — the default rule

- **Canonical form:** `^[6-9]\d{9}$` (10 digits, first digit 6–9).
- **Accepted while typing** (normalized, not truncated): spaces, dashes,
  parentheses, a `+91`/`91` country prefix, or a leading trunk `0`.
  e.g. `+91 98765 43210`, `09876543210`, `(098765) 43210` → `9876543210`.
- **Rejected:** any letters or other symbols; wrong length after normalization.
- **Input attributes:** `type="tel"`, `inputMode="numeric"`, `maxLength={10}`
  (India-only fields), digits-only `onChange` filter.
- **Shared helpers:** FE `validateIndianMobile` / `validateOptionalIndianMobile` /
  `normalizeIndianMobile` / `digitsOnly`; BE `normalize_indian_mobile` /
  `validate_phone_number`.

### International exception
Where the product genuinely supports non-Indian numbers (academic submissions &
conference papers — authors are worldwide), the **Indian rule does NOT apply**.
Those flows keep the documented international rule (10–15 digits after
normalization, `conferences/serializers.py::validate_author_phone`) and the shared
publish input only rejects letters/junk symbols at entry.

---

## 4. Postal codes

- Indian PIN: `^[1-9]\d{5}$` (6 digits, non-zero leading).
- A field labelled "Postal / ZIP" may hold a foreign postcode:
  `^[A-Za-z0-9][A-Za-z0-9\- ]{2,19}$`.
- Shared: FE `validateIndianPin` / `validateOptionalIndianPin`;
  BE `validate_optional_indian_pin`.

---

## 5. Numeric quantities

- **Integer** (stock, pages, seats, order): `validateInteger` / digits only, with
  `min`/`max`. Add `type="number"` + `min`/`max` attributes.
- **Decimal / price** (INR): `validateDecimal` (≤ 2 places) and `validatePrice`
  (0–1,000,000 cap). Free resources may be `0`.
- **Percentage / rating**: `validatePercent` (0–100) or an explicit 1–5 for
  testimonial ratings (both serializer layers).
- Backend mirrors each bound in `validate_<field>`.

---

## 6. Backend (DRF) checklist — every write serializer

- [ ] Re-declare every model validator as `validate_<field>` / `validate()`.
      **Model `validators=[...]` never run through DRF**, and `full_clean()` is
      not called by `serializer.save()`.
- [ ] Return **structured field errors**: `{"phone_number": ["…"]}`, not
      `non_field_errors`, so the UI renders them inline. When normalizing an
      alias, `try/except` the `ValidationError` and re-raise under the real field
      name.
- [ ] Be **PATCH-safe**: required-field checks only on create (`not self.partial`);
      optional/blank fields pass through untouched.
- [ ] Normalize to the canonical stored form on success; reject on failure.
- [ ] Never weaken a schema/migration or accept data the model forbids.

Authoritative rules live in **`backend/form_validation.py`**:
`normalize_indian_mobile`, `validate_phone_number`, `validate_optional_indian_pin`,
`validate_isbn`, `validate_issn`, `validate_email_format`, and the compiled
patterns (`EMAIL_RE`, `INDIAN_MOBILE_RE`, `INDIAN_PIN_RE`, `POSTCODE_GENERIC_RE`).

---

## 7. Frontend UX requirements

- Validate on submit **before** firing the request; block if any rule fails.
- Render a message **adjacent to each field**, and set `aria-invalid` (and
  ideally `aria-describedby`) on the control.
- **Disable the submit button / guard against double-submit** while a request is
  in flight (`isSubmitting`/`saving` state).
- **Map server errors back to fields** (`parseDrfErrors` + field names) and show
  them inline rather than only a generic banner.
- Show **success only after the backend confirms** it — never optimistically.
- Preserve all entered values when a submit fails.
- Shared helpers live in **`lib/validation/index.ts`**; every function returns
  `''` when valid or a human message keyed to the field's own label (matches the
  admin error-map convention `if (err === '') delete errors.x`).

---

## 8. Email

- Format: `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` on both layers.
- **Uniqueness is enforced by the backend only.**
- Preserve the **personal vs. work email** distinction on admin identities:
  `User.email` = personal / sign-in on the public site; `User.work_email` = admin
  login minted by invitation. Activation/reset emails are delivered to the
  **personal** address.

---

## 9. Dates & cross-field

- Required dates must parse to a real calendar date.
- Enforce ordering server-side and client-side where it matters:
  conference `end_date >= start_date`; submission deadline not after start.
- Use `validateDate` / `validateDateRange` (FE) and serializer `validate()` (BE).

---

## 10. Passwords & auth

- Client guidance mirrors Django `AUTH_PASSWORD_VALIDATORS` (min 8, not entirely
  numeric, not a common password) via `passwordChecks`; **the server decides**.
- Never log or echo passwords; never leak which account exists (no
  user-enumeration on login/reset/register error messages).

---

## 11. Selects, checkboxes, enums & files

- **Server validates the allowed set** for every enum/dropdown; a client
  `<select>` is not trust. FE uses `validateChoice(value, allowed, label)`.
- Checkboxes/booleans are coerced to real booleans server-side.
- **Files:** validate extension **and** size on **both** layers.
  Manuscripts: `.pdf/.doc/.docx`, max **10 MB**
  (`FileExtensionValidator` + `MAX_FILE_SIZE`, FE `validateFile`).

---

## 12. Adding a new form — quick recipe

1. Identify each field as identifier / quantity / text / email / date / enum / file.
2. Call the matching `lib/validation` helper in the form's `validate()`.
3. Wire inline errors + `aria-invalid`; guard double-submit; map server errors.
4. Add the mirror `validate_<field>` / `validate()` to the DRF serializer using
   `backend/form_validation.py`.
5. Add a behavioural test (valid accepted, invalid rejected) — not an
   implementation echo.

---

## 13. Design-token preservation

Validation additions must not restyle forms. Keep Midnight Navy `#3E2E22`,
Royal Gold `#C9A66B`/`#A98042`, Ivory/Cream `#E9DFCF`/`#FFF8EE`/`#F7F3EB`,
muted `#8B7B68`, and danger red `#DC2626` / existing `ruby-red` tokens. Error
text uses the field's existing error style; no new packages.
