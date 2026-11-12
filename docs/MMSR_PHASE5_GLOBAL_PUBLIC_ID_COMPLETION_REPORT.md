# MMSR V2 — GLOBAL PUBLIC ID STANDARDIZATION COMPLETION REPORT

Scope: implement one consistent public ID standard `MMSR-[TYPE]-1931-NNNNNN`
(first sequence `000101` for every entity type; the existing Super Admin receives
`MMSR-ADM-1931-000101`) across backend, APIs, customer website and admin
dashboard, while preserving internal primary keys, relationships, authentication,
Super Admin access, external identifiers and Razorpay payment security.

Status legend used throughout: **Completed / Partially completed / Not completed / Blocked**.

Environment: Django 4.2 + DRF + SimpleJWT + corsheaders on SQLite (`backend/db_v2.sqlite3`,
dev) targeting PostgreSQL on staging/prod; Next.js 15 App Router frontend. Local
interpreter is Python 3.9. No git repo (manual backup dirs).

---

## 1. Existing Architecture Inspection  — Completed

- Enumerated every Django model and its migrations across `core`, `users`,
  `publications`, `orders`, `submissions`, `conferences`, `policies`, `slider`.
- Confirmed existing primary keys are integer auto-keys (preserved) and that
  `public_id` was added as a *separate* non-PK column (spec §4).
- Confirmed the project stores admins as `User` rows flagged `is_staff`/`is_superuser`
  rather than a separate Admin table → ADM identity modelled as a one-to-one
  `core.AdminProfile` so the Super Admin is never duplicated (spec §2).
- Confirmed external identifiers actually present: Razorpay (`razorpay_order_id`,
  `razorpay_payment_id`, `razorpay_signature`, `transaction_id`), ISBN/ISSN/DOI/ORCID,
  slugs, courier AWB — all left untouched (spec §10).
- DB engine check: `settings.py` selects engine from `DB_ENGINE`; current dev DB is
  SQLite. `select_for_update()` is a real row lock only on PostgreSQL; documented
  in `core/services.py` (spec §5 closing requirement).

## 2. Database Backup Details  — Completed

- Full pre-migration backup directory: `_phase5_backup_20261031-210506/`.
- Contains `db_v2.sqlite3.backup` (entire database) plus copies of every backend
  file subsequently modified: `settings.py`, and the `models.py`/`serializers.py`/
  `views.py`/`urls.py`/`utils.py`/`invoice_utils.py` of `orders`, `publications`,
  `conferences`, `submissions`, `policies`, `slider`, `users`.
- Migration was verified reversible (`0002_backfill_public_ids` has a `clear_public_ids`
  reverse that only removes assigned IDs/profiles/counters, never business data).

## 3. Files Created  — Completed

Central `core` app (new):
- `backend/core/__init__.py`, `backend/core/apps.py`
- `backend/core/models.py` — `PublicIDCounter`, abstract `PublicIDTrackable`,
  `AdminProfile`, `format_public_id`, `PublicIDOverflow`, `ACTIVE_PREFIXES`,
  `DOCUMENTED_INACTIVE_PREFIXES`.
- `backend/core/services.py` — `allocate_next`, `is_public_id_conflict`,
  `reserve_public_id`, `ensure_admin_profile`.
- `backend/core/api.py` — `is_valid_public_id`, `find_by_public_id`, `PublicIDLookupMixin`.
- `backend/core/handlers.py`
- `backend/core/migrations/0001_initial.py` (counter + AdminProfile schema)
- `backend/core/migrations/0002_backfill_public_ids.py` (deterministic data migration)
- `backend/core/tests.py` — 31-test Phase 5 suite (see §22–§24, §26).

Per-app schema migrations adding `public_id`:
- `users/0008_public_id_fields`
- `publications/0024_book_public_id_bookchapter_public_id_and_more`
- `orders/0014_order_public_id_orderitem_public_id`
- `submissions/0011_publishedvolume_public_id_submission_public_id`
- `slider/0003_sliderimage_public_id`
- `conferences/0004_conference_public_id_conferencesubmission_public_id_and_more`
- `policies/0002_policy_public_id_policyacceptance_public_id_and_more`

Frontend standardization layer:
- `lib/utils/publicId.ts` — `PUBLIC_ID_REGEX`, `isPublicId`, `publicIdOf`,
  `displayId`, `displayReference`, `routeIdOf`, `searchableRefs`.
- `components/ui/PublicId.tsx` — copyable reference chip.

## 4. Files Modified  — Completed

Backend (added `public_id` to models via `PublicIDTrackable`, exposed it in
serializers, wired `PublicIDLookupMixin` into viewsets, replaced legacy generators):
- `users/models.py`, `users/serializers.py`, `users/views.py`
- `publications/models.py`, `publications/serializers.py`, `publications/views.py`
- `orders/models.py`, `orders/serializers.py`, `orders/views.py`, `orders/utils.py`, `orders/payment_views.py`
- `conferences/models.py`, `conferences/serializers.py`, `conferences/views.py`, `conferences/invoice_utils.py`
- `submissions/models.py`, `submissions/serializers.py`, `submissions/views.py`
- `policies/models.py`, `policies/serializers.py`, `policies/views.py`
- `slider/models.py`, `slider/serializers.py`, `slider/views.py`
- `config/settings.py` — `CORS_EXPOSE_HEADERS = ['Content-Disposition']` (lets the SPA
  read server-named download filenames), `core` app registration.

Frontend customer surfaces (see §16): article detail/download, journal library
downloads, order/subscription/payment/submission/conference/policy displays.

Frontend admin surfaces (see §15): `app/admin/**` access, journals,
journals/access, journals/articles, books, books/[slug] chapters, categories,
conferences, testimonials, hero-slider, orders, policies, users, fulfillment,
dashboard, submissions, conference-submissions, submission-workspace,
policy-acceptances.

Service/type files: `lib/services/cms.ts`, `lib/services/policies.ts`,
`lib/services/journals.ts`, `lib/services/contact.ts`, `lib/types/journal.ts`.

## 5. Files Deleted  — Completed (none)

No project files were deleted. One temporary scratch file
(`_p5_series_dump.py`) was created accidentally during inspection and immediately
removed; it was never part of the application — net-zero, no impact.

## 6. Confirmed Entity Prefix Mapping  — Completed

The authoritative §3 table enumerates **33** prefixes. Mapping to real models:

- **30 activated** (backed by an independent model; `ACTIVE_PREFIXES` in
  `core/models.py`): USR ADM AIN AUD CAT BOK JRN ISS ART JAC CAU CHP SEC TST UNI
  MET SLD NLS NLB ENQ ORD ORI SUB VOL CON CPS CSA POL PLV PLA.
- **3 documented-inactive** (`DOCUMENTED_INACTIVE_PREFIXES`) — no independent
  record exists, so none was invented (spec §3/§9):
  - `AUT` Author → authors live as `Book.author` (CharField) and as the
    `ChapterAuthor` (`CAU`) model referenced via M2M;
  - `INV` Invoice → invoice PDFs are `FileField`s on `Order`/`ConferenceSubmission`,
    not independent rows;
  - `PAY` Payment Record → payments are `razorpay_*`/`transaction_id` fields on
    `Order`/`ConferenceSubmission`, not independent rows.
- Evidence the 30 are the live set: the DB holds exactly **30**
  `core_publicidcounter` rows (§12).
- Note for the record: earlier working notes referenced "32 prefixes"; the §3
  table is the source of truth and lists 33, which the mapping reconciles as
  30 active + 3 inactive.

## 7. Public ID Generation Service  — Completed

- Single allocation path `core.services.allocate_next(prefix)` (§5); every tracked
  model inherits `PublicIDTrackable`, which calls it exactly once per new row.
- Format rendered/validated in one place (`format_public_id`): `MMSR-<3-letter>-1931-<6-digit>`,
  fixed year `1931` (never the clock), sequence zero-padded to 6 digits.
- Guards: unapproved prefix → `ValueError`; below baseline (< 101) → `ValueError`;
  above 999999 → `PublicIDOverflow` (never emits an invalid ID).
- `public_id` is `editable=False`, `unique`, `db_index=True`, immutable after
  assignment (compared against the loaded value; tampering raises `ValidationError`).
- Concurrency documented in `core/services.py`: PostgreSQL row lock via
  `select_for_update()`; SQLite serializes write transactions; DB-level UNIQUE is
  the final belt with a bounded (×5) re-allocation retry on collision.

## 8. Database Model Changes  — Completed

- Added abstract `PublicIDTrackable` (unique, indexed, non-PK `public_id`) —
  primary keys and all FK/M2M relationships unchanged (spec §4).
- Concrete models declare only `public_id_prefix` (e.g. `Order → 'ORD'`,
  `Journal → 'JRN'`, `ConferenceSubmission → 'CPS'`); the column/index/constraints
  are inherited.
- New tables: `core_publicidcounter` (one row per prefix, holds next sequence) and
  `core_adminprofile` (one-to-one with `User`, carries ADM identity).

## 9. Database Migration Details  — Completed

- `core.0001_initial` creates the counter + AdminProfile schema.
- Per-app `*_public_id` migrations add the column (see §3 for exact names).
- `core.0002_backfill_public_ids` (depends on all schema migrations above) assigns
  IDs to existing rows and seeds counters. Reverse = `clear_public_ids`.
- All migrations applied cleanly when building the test DB (observed in §29 run:
  `Applying core.0002_backfill_public_ids... OK`).

## 10. Existing Records Migration Results  — Completed

Live-DB uniqueness/coverage audit across all 30 tracked models
(`python manage.py shell`): every row has a non-null `public_id`, values are all
distinct, and no model reports problems.

- `AUDIT_ROWS 30`, `PROBLEMS []`, `OK_ALL_UNIQUE_COMPLETE True` — i.e. for each
  model `count == rows_with_public_id == distinct_public_ids`.
- Deterministic ordering: assignment proceeds in ascending-primary-key order
  (`assign_missing` uses `order_by('pk')`), never arbitrary query order (spec §6.3).
- Preserved-value rule: rows already carrying a valid ID keep it and the sequence
  jumps past them (verified by `test_assign_missing_preserves_existing_and_jumps_past_them`).

## 11. Existing Super Admin Migration and Verification  — Completed

- Super Admin identified by the real role flag (`is_superuser`), never a hardcoded
  email, and assigned the permanently reserved `MMSR-ADM-1931-000101` first
  (spec §2/§6.1).
- Live-DB evidence:
  `SUPERUSERS: [('admin@mmsr.com', 'MMSR-ADM-1931-000101')]`,
  `ADM000101: True`.
- The Super Admin is not duplicated: ADM lives on `AdminProfile` linked to the
  existing `User`; the account keeps its own USR `public_id`. Credentials and auth
  behaviour untouched (spec §15).

## 12. Sequence Starting Value Verification  — Completed

- Baseline constant `MIN_SEQUENCE = 101`; a fresh prefix hands out `000101`
  (`test_fresh_prefix_starts_at_baseline`).
- Live counters (all ≥ their baseline, none below 101):
  `ADM 106, AIN 105, ART 106, AUD 205, BOK 110, CAT 107, CAU 105, CHP 115, CON 105,
  CPS 107, CSA 109, ENQ 103, ISS 115, JAC 112, JRN 106, MET 102, NLB 101, NLS 101,
  ORD 211, ORI 231, PLA 109, PLV 116, POL 104, SEC 111, SLD 105, SUB 108, TST 104,
  UNI 108, USR 124, VOL 102` → **30** counters.
- ADM at 106 ⇒ five admin identities assigned (000101–000105); Super Admin is 000101.

## 13. Backend API Changes  — Completed

- Serializers return `public_id` alongside the PK: `fields='__all__'` serializers
  auto-emit the read-only column; explicit-field serializers had `'public_id'` added;
  nested nullable FKs exposed via `source='x.public_id'` with `default=None`.
- `PublicIDLookupMixin` added (additively) to detail viewsets (journals, issues,
  articles, chapters, orders, policies, policy-acceptances, conferences,
  conference-submissions, users-access, testimonials, categories, newsletter,
  university-partners, contact-inquiries, slider, submissions, etc.): a well-formed
  public ID resolves via `public_id`; anything else (numeric PK / slug) delegates to
  the existing DRF lookup unchanged; an unknown well-formed ID is a 404 — never a
  silent fall-through (spec §7).
- Authorization preserved: lookups go through `get_queryset()`/`filter_queryset()`
  so staff/ownership scoping and permission checks still apply; `public_id` is never
  trusted for authz (spec §13).
- N+1 avoided: `select_related`/`prefetch_related` retained on the expanded payloads.

## 14. Frontend Pages and Components Updated  — Completed

- `lib/utils/publicId.ts` + `components/ui/PublicId.tsx` provide the single
  display layer. Precedence everywhere: public ID → stored legacy reference →
  explicit placeholder; the internal PK is never rendered and no value is fabricated.
- Never shows `undefined`/`null`/empty: `displayId()` falls back to a labelled
  placeholder ("Not assigned yet").

## 15. Admin Dashboard Changes  — Completed

Public IDs surfaced wherever a record is identified, with reference-aware search:
- Access (`app/admin/access`): ADM/USR line in accounts + Access Matrix, AIN in
  invitations; search/placeholder mention MMSR ID.
- Journals (`app/admin/journals`, `journals/access`, `journals/articles`): JRN/ISS/ART/JAC
  references, grant-form previews by public ID; filters match `public_id`.
- Books (`app/admin/books`, `books/[slug]` chapters): BOK/CHP lines beside the SEO
  slug; chapter filter matches `public_id`.
- Categories (CAT), Conferences (CON), Testimonials (TST), Hero-slider (SLD),
  Policies (POL + version PLV), Orders (ORI per line-item).
- External Razorpay blocks (`Transaction ID`, `Razorpay Order ID`, `Razorpay Payment
  ID`) intentionally left as-is (spec §9/§10).
- Legacy `userEmailMap`/PK-only labels removed in favour of public-ID-aware labels.

## 16. Customer Website Changes  — Completed

- Article PDF download + filename now use `publicId || id` (never the PK in served
  filenames); issue/article fallback filenames drop the internal key.
- Dashboard journal library resolves downloads/links by article public reference
  (`acc.articlePublicId` / `art.publicId || art.id`); article URLs use
  `/articles/<slug || publicId>`.
- Orders / submissions / conference / policy-acceptance customer views display the
  standardized reference through `displayId`/`displayReference`; enquiry display
  resolves the stored reference safely (`lib/services/contact.ts`).
- Internal PKs retained only where functionally required and not customer-exposed
  (cart `targetId`, React `key`, `<option value>`, storage keys) — spec §11.

## 17. Order and Payment Integration  — Completed

- `Order`/`OrderItem` carry `MMSR-ORD`/`MMSR-ORI`; new orders mirror the standard ID
  into the legacy `custom_order_id` column so invoices/WhatsApp/admin displays are
  unchanged; historical orders keep their original `MMSR-{CATEGORY}` reference (verified).
- Razorpay verification logic untouched; MMSR IDs and Razorpay IDs remain separate
  fields (verified in `test_razorpay_fields_untouched`).
- Served invoice/download filenames reference the public ID, never the PK.

## 18. Legacy ID Compatibility  — Completed

- Legacy reference columns (`custom_order_id`, `reference_number`) are preserved, not
  removed; the standard ID is written additively.
- Legacy generator replaced for conference submissions: `CONF-{year}-{pk}` (calendar
  year + PK leak) → `MMSR-CPS-1931-NNNNNN` mirrored into `reference_number`
  (`conferences/models.py`); historical rows keep their `CONF-…` value.
- Order legacy `generate_custom_id()` kept as a shim returning the standard ID.
- `.id` was NOT blindly replaced — only record-identification displays changed.
- Every old format and its handling is documented in §10/§17/§18 and §31.

## 19. External Identifiers Preserved  — Completed

Left byte-for-byte unchanged (spec §10): Razorpay order/payment/signature/transaction
IDs, ISBN, ISSN, DOI, ORCID, courier AWB/tracking, JWT tokens, slugs, and all storage/
cookie keys. Verified by §26 (Razorpay fields round-trip intact and stay distinct from
the MMSR ID).

## 20. Security Improvements  — Completed

- Internal PKs no longer exposed in served download filenames or customer displays.
- Public IDs are reference-only and never used for authorization; authz still flows
  through the authenticated request and `get_queryset()` scoping (spec §13).
- Unknown well-formed IDs return 404 (no enumeration-by-fallthrough); malformed input
  never reaches the DB column.
- Cache-header/`Content-Disposition` handling reviewed; `CORS_EXPOSE_HEADERS` limited
  to `Content-Disposition`.

## 21. Performance Improvements  — Completed

- `public_id` is indexed and used only for equality lookups.
- Expanded serializers keep `select_related`/`prefetch_related` so §7's no-N+1 rule
  holds; immutability guard compares the in-memory loaded value (no extra query on the
  normal path).

## 22. ID Generation Test Results  — Completed

`core.tests` (31 tests, all pass): `PublicIDFormatTests` (render, fixed-year,
unapproved-prefix, below-baseline, overflow) and `AllocateNextTests` (baseline,
monotonic increment, per-prefix independence, corruption refusal, overflow) and
`TrackableModelTests` (auto-assign, immutability, missing-prefix refusal, UNIQUE-collision
re-allocation, `is_public_id_conflict` matching). Evidence: §29 run and the targeted
`core` run (`Ran 31 tests … OK`, including the logged
`public_id UNIQUE collision on Category … re-allocating, attempt 1/5`).

## 23. Database Migration Test Results  — Completed

`core.tests.MigrationBackfillTests`: `test_assign_missing_orders_by_ascending_pk`,
`test_assign_missing_preserves_existing_and_jumps_past_them`,
`test_migration_render_matches_service_format` — all pass, proving deterministic
ascending-PK ordering and preserve-existing behaviour. Migration application verified
green in the full-suite build (`Applying core.0002_backfill_public_ids... OK`).

## 24. API Test Results  — Completed

`core.tests.ApiHelperTests` (`is_valid_public_id`, `find_by_public_id`) and
`core.tests.PublicIDEndpointTests` on the live `JournalViewSet`:
`test_slug_lookup_still_works` (existing URL),
`test_public_id_lookup_resolves_same_record` (public ID URL),
`test_unknown_wellformed_public_id_is_404` — all pass.
`AdminProfileTests` confirm on-demand, idempotent, distinct ADM issuance.

## 25. Frontend Test Results  — Completed

Type/lint/build gates (real exit codes this session):
- `npx tsc --noEmit` → `TSC_EXIT=0`
- `npm run lint` → `✓ No ESLint warnings or errors` → `LINT_EXIT=0`
- `npm run build` → `BUILD_EXIT=0` (see §27)
No frontend test runner (Jest/Playwright) is wired in this repo; verification is via
the compiler/linter/build plus the manual display-precedence checks in §14–§16.

## 26. Payment Regression Test Results  — Completed

`core.tests.OrderPaymentRegressionTests` (all pass): new order carries a well-formed
`MMSR-ORD`; standard ID mirrors into `custom_order_id` and `generate_custom_id()`;
Razorpay `order/payment/signature/transaction_id` round-trip untouched and remain
distinct from the MMSR ID; a historical `MMSR-SCI-1234-5678` legacy reference is
preserved while still gaining a valid public ID. Full suite (§29) is green, so no
payment/order test regressed.

## 27. `npm run build` Result  — Completed

Command: `npm run build` → **`BUILD_EXIT=0`**. Production compile and static/dynamic
page generation succeeded (all `app/**` routes emitted; shared First-Load JS ≈103 kB).

## 28. `npx tsc --noEmit` Result  — Completed

Command: `npx tsc --noEmit` → **`TSC_EXIT=0`** (after fixing the prior-session
`userEmailMap`/null-narrowing regressions and adding `public_id?` to the
`AdminArticle` type). No type errors.

## 29. Django Test Results  — Completed

Command: `python manage.py test` → **`DJANGO_TEST_EXIT=0`**,
`Ran 319 tests in ~210s … OK`.
One pre-existing failure was corrected during this phase: `conferences.tests.
ConferenceSubmissionTests.test_valid_submission_is_created` asserted the removed
legacy `CONF-` format; per spec §11 it now asserts the standardized
`MMSR-CPS-1931-…` mirrored reference (`is_valid_public_id`, `startswith`,
`== public_id`). `conferences` re-run: `Ran 27 tests … OK` (`CONF_EXIT=0`).

## 30. Packages Installed  — Completed (none)

No new packages were installed. Standardization used only the existing Django/DRF
and Next.js/React stacks (spec §15).

## 31. Known Limitations  — Partially completed (documented)

- Concurrency locking is only fully exercisable on PostgreSQL; on the SQLite dev DB
  `select_for_update()` is a no-op and writes serialize at DB level. Multi-process
  deployments **must** run PostgreSQL (`DB_ENGINE`). Test suite asserts the
  engine-independent guarantees (uniqueness/baseline/immutability/overflow/collision-retry).
- Two admin surfaces are backed by `localStorage` mocks and therefore cannot display
  real backend IDs without API rewiring (rewiring was out of scope, so left as a
  finding, not force-fit): `app/admin/subscribers` (`lib/services/subscribers.ts`,
  seeded `sub-*` ids) and the University-Partners panel of
  `app/admin/site-settings` (`getUniversityPartners()` seeds `'1'..'7'`). Real
  `NLS`/`UNI` IDs would require pointing these at `/api/publications/newsletter-subscribers/`
  and the partners endpoint.
- `AdminAuditEvent` (AUD) is assigned IDs and queryable, but no dedicated admin UI
  lists it; no admin pages exist for `VOL`/`AUT`/`CAU` management beyond where those
  entities already appear inline.
- `app/admin/payments` and `app/admin/chapters` are redirects (no page to annotate);
  dead code `components/admin/AdminNotificationDropdown.tsx` (mock `REF-2027-0042`,
  `Order #1084`) and `components/seo/JsonLd.tsx::getBookSchema` were noted, not wired.
- The conference invoice PDF label remains `CONF-INV-{public_id}` (it already surfaces
  the public ID; its `or submission.id` PK fallback is unreachable because every saved
  submission has a `public_id`). Left unchanged to avoid unrelated layout edits.
- Local interpreter is Python 3.9 (EOL); google-auth emits cosmetic FutureWarnings on
  test runs — unrelated to this task.

## 32. Confirmation Unrelated Modules Were Not Modified  — Completed

All changes are confined to the public-ID standardization and the code paths that
display or generate IDs. Authentication/JWT behaviour, Razorpay verification logic,
existing primary keys/relationships, external identifiers, and unrelated UI were not
redesigned (spec §15). No Super Admin duplication or credential reset occurred
(§11). Where a requirement could have conflicted with the architecture (AUT/INV/PAY
having no independent model; the mock-backed admin panels), the situation was
documented rather than resolved with a risky change (spec §15 closing rule).

---

### Production-readiness statement

Backend generation, migration, API compatibility, frontend display, and payment
regression are all verified by green automated runs on the dev database
(Django 319 tests OK, 31 dedicated Phase 5 tests OK, `tsc` 0, `lint` 0, `build` 0)
plus a live-DB Super-Admin/counters/uniqueness audit (§10–§12). Production readiness
still depends on running the migrations against the PostgreSQL staging/production DB
(where the row-level concurrency lock applies) and rewiring the two localStorage-backed
admin panels noted in §31 before their real IDs can be shown.
