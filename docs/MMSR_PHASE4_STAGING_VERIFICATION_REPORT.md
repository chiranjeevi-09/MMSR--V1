# MMSR PUBLICATIONS V2 — PHASE 4: FINAL STAGING VERIFICATION & SECURITY CHECK

Date: 2026-10-30/31 (local staging machine, Windows)
Continues from: `FINAL-QA-REPORT.md` (Phase 3) and `_phase3_backup_20261029-214858/`.
All browser testing below was performed with the Qoder Browser automation subagent against the **fresh production build** (`next start`, Next.js 15.5.28) with the local dev database (`backend/db_v2.sqlite3`) and a dedicated test account only. No real payments, no real emails, no production data.

Status vocabulary: PASS / FAIL / BLOCKED / PARTIALLY FIXED / NOT TESTED / NOT VERIFIED.

---

## 1. Browser Testing Results

Browser automation availability: **AVAILABLE** (Qoder `Browser` subagent driving Chromium). Verdict: **PASS with caveats**.

- Real interaction coverage: navigation, search, authentication, sign-out, token tampering, wishlist, mini-cart, checkout validation (inspection), responsive layout at 795 px, Escape/keyboard behavior via dispatched DOM events.
- Environment caveats (recorded honestly): the automation viewport was fixed at 795×372 CSS px (no resize/emulation tooling; 390×844 could not be forced — 795 px is still below the `lg` 1024 px breakpoint, so genuine mobile layout was exercised). After the first capture the browser view went background (`visibilityState=hidden`), so only one screenshot was salvaged (`p4-check1-root-landing.png`); later screenshot requests failed and were substituted with accessibility-snapshot logs. Physical Tab/Escape keystrokes could not be delivered while hidden; key-event behavior was verified via dispatched `keydown` events plus the exact source handlers.
- Findings and their disposition: see §2–§6 and §8.

Result table (numbered as executed):

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | Home load, no flashes/blank | PASS | `/` intro-splash gate renders; DOMContentLoaded 211 ms; 27 resources; reload stable |
| 2 | Home→Books→Book→Home (anon) | FAIL→see §3 | Anonymous `/books` bounced to `/login?redirect=%2Fbooks` by client `RouteGuard` (policy conflict, §23/§24) |
| 3 | Same flow authenticated | PASS | `/books/ai-ai-…` rendered title + ₹300/₹200, Add to Cart/Buy Now present |
| 4 | Journals flow | PASS (authed) / same gate (anon) | `/journals/hii-hii-…` rendered h1, Impact Factor 3.95, ISSN, VOL 1 ISSUE 3 |
| 5 | Global search multi-query | PASS | "machine"/"water"→No Results; "nanotech"→ICAMS-2026; no stale results; client-side over cached catalogue; Escape closes (`GlobalSearchModal.tsx:93`) |
| 6 | Back/forward history | PASS | Back×3/Forward×3 restored content; no hydration errors; no blank screens |
| 7 | Console errors / failed requests | PARTIALLY FIXED | Only recurring failure: `GET /api/submissions/` 401 on `/` and `/home` (anon) — **fixed** (`lib/services/cms.ts`); Google GSI origin warning on `/login` — owner/env item (§24). Rebuild verified: fresh `next build` + route re-probes all clean |
| 8–12 | Auth suite | PASS | §3 |
| 13–15 | Wishlist/cart suite | PASS (1 gap) | §4; journal-detail lacks own wishlist button (§23) |
| 16 | Checkout safety | PASS | §5 |
| 17–21 | A11y/mobile | PARTIAL | §6 |

## 2. Navigation and Performance Results

Verdict: **PASS** (after fix #7). Details/evidence as rows 1–7 above. Loading flashes, stale results, blank screens: none observed. Only console error on catalog/dashboard/checkout pages: none (post-fix build; the single 401 is gone from code path — `fetchPublicSubmissions()` now skips the guaranteed-to-fail request when signed out and attaches the session token when present).

## 3. Authentication Results

Verdict: **PASS** (all sub-checks, with the anon catalog-gating question logged as an owner decision, §24).

- Sign in (test account `phase4.tester@example.com`, created locally): `POST /api/users/auth/login/` → 200; landed on `/books` honoring `?redirect=`; header switched to "Phase4 → Author Dashboard".
- Dashboard + refresh: `/dashboard` survived two F5 reloads + a hard load; content fully populated; zero console errors; no bounce.
- Protected↔public navigation: `/dashboard/orders` ("Showing 0 of 0"), `/dashboard/profile` (shows test email), `/home`, `/books` — all clean.
- Sign out: drawer "Sign Out" → `/login?redirect=%2Fdashboard`; `mmsr_v2_at`/`mmsr_v2_rt` + `mmsr_session` marker cookie all cleared; reloading `/dashboard` bounced **at the edge (middleware)** to `/login?redirect=%2Fdashboard`; body contained no dashboard/orders/email data.
- Invalid/expired token: `mmsr_v2_at`/`mmsr_v2_rt` corrupted to an invalid JWT → `/dashboard` bounced to login, tampered tokens purged, marker cookie removed. (Access-token-usable-until-expiry-after-logout remains the documented SimpleJWT behavior from Phase 2/3; refresh rotation + blacklist intact — semantics unchanged this phase.)
- FAIL context (row 2): `components/auth/RouteGuard.tsx` gates `/books`,`/journals` behind login, while `middleware.ts` (L76–81) documents public browsing as intentional. Contradiction → owner decision, not silently changed (§24).

## 4. Wishlist and Cart Results

Verdict: **PASS (one feature gap logged)**.

- Book wishlist: "Add to Wishlist" ⇄ "Remove from Wishlist" icon button (aria-labelled); header badge 0→1→0; toasts "Saved to Wishlist"/"Removed from Wishlist"; storage key `mmsr_wishlist_v2` gained/lost `book-8`.
- Journal wishlist: journal detail hero offers only Subscribe/Submit — **no wishlist control for the journal itself**. The "Save Journal to Wishlist" that does work belongs to a Related-Journals card (verified add/remove). Logged as an outstanding feature gap (§23).
- Mini-cart: add → toast "Added to Cart", badge 0→1, panel auto-open ("Qty: 1 • ₹300.00 each", Subtotal ₹300.00, View Cart→`/cart`, Checkout→`/checkout`); "+" → qty 2, Subtotal ₹600.00 (correct doubling); "−" → back to ₹300.00; Remove → empty state "Your cart is empty" + "Browse Books Catalogue →" link + toast "Item Removed".
- A11y defect found & FIXED: mini-cart quantity −/+ and remove buttons had no accessible names and the panel had no dialog role → `role="dialog"`, `aria-label`s, `aria-expanded` added in `components/layout/Navbar.tsx` (verified by rebuild; browser re-check recommended on staging).

## 5. Checkout and Payment Safety Results

Verdict: **PASS** — no payment initiated, duplicate-order surface unchanged, backend verification still gates success.

- `/checkout` with 1 item: 9 shipping fields (fullName/email prefilled), Subtotal ₹300 + Shipping ₹40 = Grand Total ₹340.00; submit = "Proceed to Payment"; disabled/`isSubmitting` loading state implemented in code (button re-enabled only after completion/failure).
- Validation proof: clicked submit with required address fields EMPTY → client `validateForm()` short-circuited with 5 inline errors (Phone, Address Line 1, City, State, 6-digit PIN) — **no Razorpay frame, no navigation, and network log shows no POST to any order/payment endpoint**. With valid data the button would open Razorpay → deliberately NOT clicked (safety rule honored).
- Duplicate-order safety: not exercisable against a real gateway by design; the Phase 2/3 server-side contract (single `Order` per cart checkout, Razorpay `order_id` cross-check, signature verification, amount/currency match, idempotent QR verify) is untouched this phase and re-verified green by the full Django suite (§17: 288 tests incl. all Razorpay attack/regression classes).
- Layout defect found & FIXED: `/cart` and `/checkout` rendered a second `Navbar` + nested second `<main>` (duplicate landmarks; two fixed headers) while `AppLayout` already supplies both → page-level duplicates removed (`app/cart/page.tsx`, `app/checkout/page.tsx`); no visual redesign.
- Copy nit (not fixed, cosmetic): checkout copy mentions "select your preferred payment option" though payment method is chosen in the Razorpay sheet.

## 6. Accessibility and Mobile Results

Verdict: **PARTIAL** (tooling limits; code-verified where browser-emulation was impossible).

- Focus visibility: global `:focus-visible{outline:2px solid #C99A2E;outline-offset:2px}` (`app/globals.css:258`) + `focus-visible:ring-2` on `Button`; DOM walk of 8 tabbables all focused with computed solid outline — PARTIAL (physical Tab key could not be delivered while the view was hidden).
- Escape: global search closes (`GlobalSearchModal.tsx:93`); mini-cart closes (`Navbar.tsx:124` `setIsMiniCartOpen(false)`); mobile drawer closes — all PASS via dispatched keydown + verified handlers.
- Search keyboard path: trigger tabbable ("Open Global Search", Ctrl+K shortcut registered); opening autofocuses the input — PASS; Tab+Enter activation NOT TESTED (no physical keys).
- Mobile: at 795 px (< `lg`): hamburger toggles `aria-expanded`, full menu list, navigation works, menu auto-closes on nav; **no horizontal overflow** (scrollWidth 787 ≤ 795 in all states). Dashboard sidebar hidden <1024 px but reachable via "Open Navigation Drawer" (by design). PASS at 795 px; exact 390×844 NOT TESTED (no resize tooling).
- Reduced motion: NOT TESTED in browser (no emulation; OS value false). Code evidence: two `@media (prefers-reduced-motion: reduce)` blocks in `globals.css` + framer-motion `<MotionConfig reducedMotion="user">`.

## 7. Authenticated Endpoint Cache Audit

Audit method: every DRF view/viewset in `users/`, `publications/`, `orders/`, `submissions/`, `conferences/`, `slider/`, `policies/`, `orders/payment_views.py` inspected for (a) auth/permission requirements, (b) response sensitivity, (c) `Cache-Control: no-store`, (d) `Vary: Authorization, Cookie`, (e) shared-cache cross-user exposure (Django has NO per-site cache middleware — exposure is via external CDN/proxy only; Next.js fetches server-side with private in-memory ISR cache).

Endpoints already safe before this phase (no change):
| Endpoint | Why safe |
|---|---|
| `orders.OrderViewSet` (+invoice, /stats, fulfillment) | Phase 2 inline `finalize_response` → no-store+Vary on ALL responses (incl. 401 denials); test `PrivateNoStoreCacheHeaderPhase2Tests` |
| `JournalIssueViewSet.pdf`, `JournalArticleViewSet.access/fulltext/pdf`, `BookChapterViewSet.section_content` | Phase 3 `PrivateResponseHeadersMixin.private_actions` |
| Auth endpoints (login/register/logout/reset/invitation validate/accept) | POST-only, no per-user GET bodies; same-enumeration-safe responses by design |
| `payment_success/failed/pending` (`orders/payment_views.py`) | 302 redirects only; bodyless; no `Cache-Control` set → default-uncached; carry no user data |
| Public catalog (books/journals/categories/articles list+detail, conferences list/retrieve, testimonials public, slider list, site-metrics, published volumes) | PUBLIC — deliberately left cacheable (rule: no blanket private headers on public catalog) |
| Google/`POST` mutation actions on mixed viewsets | POST/PUT/DELETE responses are never stored by shared caches; denial 401/403 bodies carry the private headers now added |

Endpoints found WITHOUT explicit private headers and FIXED this phase (all per-user or staff-only data):
| Endpoint | Data | Fix |
|---|---|---|
| `SubmissionViewSet` `/api/submissions/` | author manuscripts + staff queue | `AlwaysPrivateResponseHeadersMixin` |
| `ConferenceSubmissionViewSet` `/api/conference-submissions/` | per-author PII, Razorpay trail, manuscript/invoice downloads | mixin |
| `UserProfileView` `/api/users/profile/` | profile PII (GET/PUT/PATCH) | mixin |
| `AdminUserViewSet` `/api/users/` | staff user directory | mixin |
| `AdminStatsView` `/api/users/admin-stats/` | admin headcounts | mixin |
| `AdminInvitationView` `/api/users/invitations/` | invitations + hashed tokens | mixin |
| `UserJournalAccessViewSet` `/api/publications/user-access/` | entitlements/subscriptions | mixin |
| `AdminTestimonialViewSet` `/api/publications/admin/testimonials/` | moderation queue incl. pending | mixin |
| `ContactInquiryViewSet` `/api/publications/contact-inquiries/` | customer enquiry PII (list; create stays AllowAny) | mixin |
| `NewsletterSubscriberViewSet` `/api/publications/newsletter-subscribers/` | subscriber emails (admin list; public POST unaffected) | mixin |
| `NewsletterBroadcastViewSet` `/api/publications/newsletter-broadcasts/` | admin broadcast records | mixin |
| `AdminChapterViewSet` `/api/publications/admin/chapters/` | admin chapter queue | mixin |

Low-sensitivity residual noted (NOT changed — mixed public list whose staff view adds unpublished rows; no PII; would require `Vary`-keyed partial caching to "fix", out of smallest-change scope): `SliderImageViewSet.list`, `UniversityPartnerViewSet.list`.
Wishlist: frontend-only (localStorage `mmsr_wishlist_v2`) — no backend endpoint, nothing to cache.

## 8. Security Fixes Applied

1. `backend/config/security_mixins.py` (NEW): `AlwaysPrivateResponseHeadersMixin` — sets `Cache-Control: no-store` + `Vary: Authorization, Cookie` on every response of a fully-private view; import-free of app models (no circular imports); works for APIView and ViewSet (hooks `finalize_response`).
2. Mixin applied to the 12 endpoints listed in §7 (smallest possible diff: one class declaration line each; permissions and response schemas untouched).
3. `backend/config/settings.py`: production Redis fallback now emits an unmistakable `RuntimeWarning` at startup when `DEBUG=False` and `REDIS_URL` is unset (see §10).
4. Browser-audit defect fixes (frontend): `/cart` & `/checkout` duplicate Navbar/`<main>` removed; anonymous 401 console error on landing pages eliminated (`lib/services/cms.ts fetchPublicSubmissions` — attaches session token if present, skips the request entirely if signed out); mini-cart accessible names added (`components/layout/Navbar.tsx`).
5. Tooling hygiene: `tsconfig.json` + `eslint.config.mjs` exclude `_phase4_backup_*/` so recovery copies don't pollute `tsc`/lint results.
6. NOT touched (rule compliance): Razorpay verification, payment calculations, JWT/session semantics, permissions, `PrivateResponseHeadersMixin` public-action splits, Phase 1/2/3 fixes.

Denial semantics verified: unauthenticated requests to every changed endpoint still return the same 401/403 as before (asserted exactly in tests), and non-staff users still get 403 from staff-only listings.

## 9. Canonical Domain Status

Verdict: **OWNER DECISION — left unchanged** (correct per rules; no guessing).

Authoritative configuration found:
- Frontend: `lib/config/site.ts` → `SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://mmsrpublications.org'` (single source; no per-page hardcodes — full scan for `mmsrpublications|mmsr-publications` across `app/`, `components/`, `lib/` found only site.ts, social-handle URLs in `JsonLd.tsx`, and `.example` placeholder contact emails in `lib/services/contact.ts`).
- Backend: `config/settings.py` → `SITE_URL`/`SITE_DOMAIN` (default `.org`), and `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` all derive from it (`www.`/`api.` variants) unless explicitly set; `FRONTEND_URL` defaults to `SITE_URL` in prod, `http://localhost:3000` in dev.
- OAuth: Google Sign-In is ID-token based (`GOOGLE_OAUTH_CLIENT_ID` verified server-side; frontend `GoogleLoginButton` — no redirect URI in code; allowed origins live in Google Cloud Console). Browser console showed `GSI_LOGGER: origin not allowed for client ID` on localhost → environment configuration item, not code.
- Payment return URLs: never taken from the request; `_frontend_redirect` builds from `settings.FRONTEND_URL` only (`/payment/success|failed|<id>` re-verify server-side — Phase 2/3 tests green).
- Conflict check: the historic `.com`/`mmsr-publications.com` hardcodes were removed in Phase 3 (audit M-4); the only remaining domain spellings are the `.org` fallback + `.env.example` documentation — consistent.
- Current env state (variable NAMES only, values withheld): `.env.local` sets `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; `backend/.env` sets `DEBUG … FRONTEND_URL …` etc. **`SITE_URL`, `SITE_DOMAIN`, `NEXT_PUBLIC_SITE_URL`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `REDIS_URL` are NOT set in either file** → the `.org` fallback is what is live.

Environment variables the owner must set once the domain is confirmed:
- Backend: `SITE_URL`, `SITE_DOMAIN` (optional if derived), `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`
- Frontend build: `NEXT_PUBLIC_SITE_URL`
Plus corresponding Google Cloud OAuth Authorized JavaScript origins and Razorpay checkout domains for that host.

## 10. Redis Readiness

Verdict: **BLOCKED — real Redis could not be tested here; no readiness claim made.**

Evidence on this machine: `redis-server` not on PATH; `127.0.0.1:6379` not reachable. Python client stack IS present in the current env: `redis-py 7.0.1`, `django-redis 6.0.0` (no new installs needed).
Configuration inspection (`settings.py` L377–404 + fix): `REDIS_URL` set → `django_redis.cache.RedisCache` shared backend (`academic_pub` key prefix, 300 s timeout); unset → `LocMemCache 'mmsr-local-cache'`.
- LocMem fallback suitability: single-process dev/test ONLY (throttle counters and any shared state are per-process; multi-worker = rate limits effectively bypassed) — stated in settings comments and now enforced behaviorally:
- New startup proof (measured): DEBUG=True → LocMem, **no** warning (exit 0); DEBUG=False, no REDIS_URL → LocMem + `RuntimeWarning: "REDIS_URL is not configured while DEBUG=False … PER-WORKER ONLY and unsafe for multi-worker deployments…"` (exit 0, fail-soft); DEBUG=False + `REDIS_URL=redis://…` → `django_redis.cache.RedisCache` selected (exit 0).
Setup + verification steps for the staging machine (NOT executed here — do not mark Redis PASS until executed):
1. Install/provision Redis; set `REDIS_URL=redis://<host>:6379/1` in `backend/.env`.
2. `python -c "import django,os;os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings');django.setup();from django.core.cache import cache;cache.set('p5-probe',1,60);assert cache.get('p5-probe')==1;print('REDIS OK')"` (adapted) — plus `redis-cli PING` → `PONG`.
3. Run ≥2 gunicorn workers, log in 11× wrong within 15 min → expect HTTP 429 (shared throttle proves shared cache).
4. Confirm the RedisRuntimeWarning is ABSENT from startup logs.

## 11. Python 3.11/3.12 Verification

Verdict: **NOT VERIFIED** (runtime absent — honest block, no claim).

Measured: `python --version` = 3.9.13; `py -0p` lists ONLY `3.9-64` and `3.14-64` → 3.11/3.12 not installed; creating a 3.11/3.12 venv is impossible without installing a new runtime (prohibited: "do not replace the current environment"). 3.14 is NOT the target version and Django 4.2 does not support 3.13+ anyway.
Static compatibility read: `requirements.txt` pins `Django>=4.2,<5.0` (installed 4.2.27 — officially supports Python 3.8–3.12), DRF, simplejwt, django-redis 6.x, Pillow≥10, reportlab≥4, psycopg2-binary≥2.9, mysqlclient≥2.2 — all declared 3.11/3.12-compatible per their own metadata; only observed caveat is google-auth's cosmetic "Python 3.9 EOL" FutureWarning on the current interpreter.
Exact commands for a staging machine (3.11 or 3.12):
```
py -3.11 -m venv D:\mmsr-p311 ; D:\mmsr-p311\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
cd backend ; python manage.py check ; python manage.py test
```
(Repeat with `py -3.12`.) Record actual `python --version` output per run.

## 12. Git and Backup Status

Verdict: **NOT A GIT REPO — init deferred pending owner approval (per rules).**

- `git` binary available: v2.52.0.windows.1. `git rev-parse --is-inside-work-tree` fails (exit ≠ 0) → workspace has NO repository and no recoverable git history.
- No `git init`, staging, commit or push performed (rule: not without owner intent; also nothing was discarded/reset).
- Backups intact and NEVER deleted: `_phase3_backup_20261029-214858/` (Phase 3) and `_phase4_backup_20261030-205532/` (this phase: `backend/` tree copies of the 4 modified view modules + their tests, plus `settings.py`, `cms.ts`, `Navbar.tsx`, `cart-page.tsx`, `checkout-page.tsx`). Every file edited this phase was backed up BEFORE editing (Git unavailable → mandatory).
- Safe initialization recipe for owner approval: review backup dirs → `git init` → verify `.gitignore` covers `node_modules/`, `.next/`, `backend/.env`, `.env.local`, `db_v2.sqlite3`, `backend/media/`, `backend/protected_media/`, `_phase*_backup*/`, `__pycache__/` → `git add -A ; git status` review → baseline commit after owner confirms no secrets are staged.

## 13. Dynamic HTTP 404 Status

Verdict: **PARTIALLY FIXED (Phase 3 mitigation retained) — upstream limitation, outstanding.** Reproduced on the fresh build with backend up:

| URL | Expected | Actual |
|---|---|---|
| `/books/9` (valid) | 200 + content | 200, len 22 016, real detail content |
| `/books/999999` (invalid) | 404 | **200**, branded not-found UI rendered (`Transfer-Encoding: chunked` shell flushed by `app/books/loading.tsx`) + `<title>404 — Page Not Found…` + `noindex` PRESENT |
| `/books/not-a-uuid-123` | 404 | backend API 404s; page shows not-found UI (same soft-404) |
| `/journals/international-journal-of-scientific-research` (valid) | 200 + content | 200, len 23 325 |
| `/journals/this-journal-does-not-exist` (invalid) | 404 | 200 + not-found UI + noindex |
| `/definitely-not-a-real-route-xyz` (unknown static) | 404 | **404** (correct — non-streamed routes are fine) |

Root cause is the documented Next.js 15 behavior (official not-found docs: "Before streaming starts Next.js returns a 404; after streaming starts the status remains 200"; upstream issue vercel/next.js#99318): a `loading.tsx` in the route folder flushes the 200 shell before `notFound()` resolves — the Phase 3 `generateMetadata` mitigation does not change the flush order on 15.5.28. SEO harm neutralized: the rendered fallback carries `robots: noindex, nofollow` (`app/not-found.tsx` — presence verified in served HTML). The ONLY supported resolution without a major upgrade is deleting `app/books/loading.tsx`/`app/journals/loading.tsx` (real 404, but loses the streaming skeleton UX on every valid detail page) — that is a UX trade decision, so existing behavior was retained per "do not break valid pages merely to force a status code". Marked outstanding + owner decision.

## 14. Files Created

- `backend/config/security_mixins.py`
- `docs/MMSR_PHASE4_STAGING_VERIFICATION_REPORT.md` (this file)
- `_phase4_backup_20261030-205532/` (pre-edit recovery copies incl. `backend/` views+tests, `settings.py`, `cms.ts`, `Navbar.tsx`, `cart-page.tsx`, `checkout-page.tsx`)
- Helper scripts (re-runnable evidence tools, underscore-prefixed): `_p4_probe.ps1`, `_p4_probe404.ps1`, `_p4_verify_fixes.ps1`, `_p4_envcheck.ps1`, `_p4_envnames.ps1`, `_p4_domain_scan.ps1`, `_p4_cfg_scan.ps1`, `_p4_djtest.ps1`, `_p4_kill3000.ps1`, `backend/_p4_cache_probe.py`, `backend/_p4_makeuser.py`
- Test artifacts: local test user `phase4.tester@example.com` (id 38, non-staff, dev DB only), screenshot `p4-check1-root-landing.png`

## 15. Files Modified

- `backend/submissions/views.py` — mixin on `SubmissionViewSet`
- `backend/conferences/views.py` — mixin on `ConferenceSubmissionViewSet`
- `backend/users/views.py` — mixin on `UserProfileView`, `AdminUserViewSet`, `AdminStatsView`, `AdminInvitationView`
- `backend/publications/views.py` — mixin on `UserJournalAccessViewSet`, `AdminTestimonialViewSet`, `ContactInquiryViewSet`, `NewsletterSubscriberViewSet`, `NewsletterBroadcastViewSet`, `AdminChapterViewSet`
- `backend/publications/tests.py` — NEW class `AuthenticatedEndpointCacheHeadersPhase4Tests` (5 regression tests)
- `backend/config/settings.py` — production-Redis `RuntimeWarning` on LocMem fallback
- `app/cart/page.tsx`, `app/checkout/page.tsx` — duplicate Navbar/Footer/`<main>` removed
- `lib/services/cms.ts` — `fetchPublicSubmissions` token-aware / skip-when-anon
- `components/layout/Navbar.tsx` — mini-cart `role="dialog"`, `aria-expanded`, quantity/remove accessible names
- `tsconfig.json`, `eslint.config.mjs` — exclude `_phase4_backup_*/**`

## 16. Files Deleted

None. (All Phase 3 backups and every original remain recoverable; nothing was discarded.)

## 17. Django Check and Test Results

- `python manage.py check` → "System check identified no issues (0 silenced)." **EXIT 0**
- `python manage.py test` (full suite, Python 3.9.13 env, sqlite in-memory test DB): **Ran 288 tests in 248.4 s — OK — EXIT 0**, including the 5 new Phase 4 cache-header tests (`test_all_authenticated_endpoints_carry_no_store`, `test_denials_keep_status_and_are_no_store`, `test_non_admin_denied_admin_endpoints`, `test_public_catalog_endpoints_remain_cacheable`, `test_one_users_submissions_never_appear_for_another`) and all Phase 2/3 Razorpay/QR/IDOR/subscription/fulfillment regressions.
- Standalone run of the new class earlier: 5/5 OK, EXIT 0.

## 18. TypeScript Result

`npx tsc --noEmit` → **EXIT 0, no errors** on real sources. (First run surfaced 7 errors — ALL from the `_phase4_backup_20261030-205532/cms.ts` recovery copy being type-checked, not from project code; fixed by excluding backup dirs in `tsconfig.json` rather than touching backups.)

## 19. Lint Result

`npm run lint` → "✔ No ESLint warnings or errors." **EXIT 0**. (`next lint` deprecation notice printed — informational only; no action taken, migration is a future maintainer task.)

## 20. npm Audit Result

`npm audit` → **found 0 vulnerabilities. EXIT 0.**

## 21. PostCSS Version

`npm ls postcss` → **postcss 8.5.28** (top-level `overrides` pin, consumed by `@tailwindcss/postcss@4.3.3`; `next@15.5.28` dedupes to the same 8.5.28). EXIT 0.

## 22. Production Build Result

`npm run build` → "Compiled successfully in 15.7 s", 67 pages generated, types+lint validated during build, **EXIT 0**. Route table verified as expected (static catalog pages; dynamic `/books/[id]`, `/journals/[slug]`, `/payment/*/id`, middleware 34.2 kB). Server re-verification on the fresh `next start`: `/`, `/books`, `/journals`, `/books/9`, valid journal detail, `/cart`, `/checkout` → HTTP 200; unknown static route → 404; invalid detail pages → branded not-found UI with `noindex` (limitation per §13). Backend left running only for these verifications; no unrelated servers touched.

## 23. Remaining Blockers

1. Production Redis untested — **BLOCKED** (§10); no claim made.
2. Python 3.11/3.12 **NOT VERIFIED** (§11) — runtimes absent.
3. Canonical domain unset → fallback `.org` live; **BLOCKED on owner** (§9).
4. Dynamic detail pages soft-404 (HTTP 200 + noindex) — upstream limitation (§13).
5. Anonymous catalog browsing FAIL: `RouteGuard` vs `middleware.ts` policy contradiction (`/books`,`/journals` login-walled client-side) — needs owner ruling before a code change (auth semantics).
6. Journal detail has no wishlist control for the journal itself (feature gap).
7. `BookChapterViewSet.section_content` purchaser check uses `Order.objects.filter(payment_status='paid')` — field doesn't exist → FieldError swallowed → purchasers currently NOT auto-authorized (fail-closed). Correct entitlement rule ("which purchase unlocks this chapter?") is an owner/product decision; left untouched per safety rules; latent bug documented.
8. Google Sign-In rejects `http://localhost:3000` origin (env config in Google Console; expected off-production).
9. Full 390×844 + screenshot-level browser re-validation of the §4/§5 frontend fixes pending a foreground browser window on staging hardware.
10. Git baseline commit not created (awaiting owner approval; §12).

## 24. Owner Decisions Required

- Confirm production domain (.org vs .com) and set the §9 variables + Google OAuth origins + Razorpay allowed domains.
- Rule on the login-wall: public catalog browsing (per `middleware.ts` intent) vs `RouteGuard`'s sign-in requirement for `/books`, `/journals`, `/cart`, `/checkout`.
- Accept soft-404+`noindex` OR remove detail-page `loading.tsx` skeletons to force true 404s (§13).
- Define chapter-section entitlement rule and fix `section_content` filter (§23.7).
- Approve journal-detail wishlist button.
- Provision Redis for staging/production (§10) and approve Python 3.11/3.12 upgrade path (§11).
- Approve `git init` + baseline commit (§12).

## 25. Final Readiness Verdict

**READY FOR STAGING** — conditioned on: single-worker process deployment until Redis is provisioned (§10), and the staging setup steps in §9–§11 being executed there.
**NOT READY FOR PRODUCTION**: canonical domain unconfirmed, production Redis untested, Python 3.11/3.12 unverified, catalog access policy unresolved, and the soft-404 limitation stands.
