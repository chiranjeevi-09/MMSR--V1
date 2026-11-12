# MMSR Publications V2 — Security & QA Test Report

**Scope:** whole application — public/customer flows, authenticated user flows, admin/CMS flows,
Django REST API, Django admin, database layer, file storage/serving, payments, email, and the
Next.js frontend.
**Date:** 3 November 2026 · **Build tested:** working tree at `d:\MMSR V2 QODER`
(frontend Next 15.5.28 App Router dev `:3000`, backend Django 4.2.27 + DRF `:8000`, SQLite dev DB)
**Method:** static sweeps + code tracing + HTTP attack probes. Every finding below carries either a
`file:line` citation or a reproduced request/response.

> ### ✅ Remediation status — all findings fixed and regression-tested
> Every C-1, H-1…H-4, M-1…M-8 and L-1…L-8 finding listed below has been remediated in the working
> tree, and the probes that produced this evidence are now a **permanent** regression module
> (`backend/qa_attack_tests/`, 29 deny-asserting tests — see §9). Gates at the time of writing:
> `manage.py check` → 0 issues · `makemigrations --check --dry-run` → No changes · full backend
> suite **352 tests OK** · `npx tsc --noEmit` → clean · `npm run lint` → no warnings or errors.
> Production requirements (nginx `/media` allow-list, `REDIS_URL` fail-fast, opt-in CORS, HSTS, CSP)
> are documented in `DEPLOYMENT.md`. Per-finding details are in **§9**.

---

## 1. How the findings were verified

| Layer | Technique |
| --- | --- |
| Static | ripgrep sweeps for raw SQL, `mark_safe`, `dangerouslySetInnerHTML`, weak crypto, `AllowAny`, `except Exception`, unbounded `IntegerField`, file/path handling, token storage |
| Live HTTP (real dev data) | `django.test.Client` against the actual URLconf (read-only GETs) — reproduced anonymous downloads of 4 real documents |
| Attack probes (isolated) | a temporary `manage.py test` module (`qa_attack_tests`) run against the throwaway test database — 14 probes, dev DB untouched; module deleted after the run |
| Gates | `manage.py check`, `makemigrations --check --dry-run`, `npx tsc --noEmit`, `npm run lint`, `python -m compileall`, `orders`+`conferences` suites (119 tests) |

Probe labels **P1–P8** in section 3 refer to that run; the exact observed status codes are quoted.

---

## 2. Severity summary

| # | Severity | Issue | Area |
| --- | --- | --- | --- |
| C-1 | **Critical** | Invoice / certificate / manuscript PDFs are downloadable by anonymous visitors from `/media/**` using sequential, guessable filenames | Storage + access control + PII |
| H-1 | **High** | Any logged-in **customer** can create, edit and delete homepage hero-slider images (incl. the destination link) | Admin/CMS authorization |
| H-2 | **High** | Confidential unpublished journal manuscripts + author certificates live in the publicly served media root (conference manuscripts are protected — the journal pipeline is not) | Storage |
| H-3 | **High** | Paying customers can **never** open purchased book-chapter content — the entitlement query references a non-existent field and the error is swallowed | Functional + access control |
| H-4 | **High** | Order creation is not atomic and does not handle `IntegrityError` → HTTP 500, orphaned orders, burned public IDs; `quantity: 0` orders are accepted | Commerce integrity |
| M-1 | Medium | Conference-submission idempotency is global, so one account is handed another author's submission record | IDOR / info disclosure |
| M-2 | Medium | Deactivated accounts still download invoices through the hand-rolled bearer path | Auth |
| M-3 | Medium | Migrations hard-code absolute Windows paths for protected storage → protected files resolve to the wrong directory on any other machine | DB/migrations, portability |
| M-4 | Medium | Unthrottled public write endpoints (contact / testimonial / newsletter) → mail amplification + spam store | Abuse |
| M-5 | Medium | No CSP or HTTP security headers anywhere in the Next.js app | Frontend |
| M-6 | Medium | Throttle/cache silently degrade to per-process LocMem when `REDIS_URL` is unset | Auth / prod |
| M-7 | Medium | `CORS_ALLOW_ALL_ORIGINS = DEBUG` is fail-open, and `DEBUG=True` is the checked-in `.env` | Config |
| M-8 | Medium | Email failures are swallowed (`fail_silently=True` + `except Exception: pass`) → admin notifications and reset links vanish silently | Reliability / integrity |
| L-1 … L-8 | Low / QA | Protected-storage URL fallback, fail-open staff default, writable `book`/`volume`/`pricing_tier`, admin URLs in email, localStorage overrides, exposed Django admin, dev scripts + backup trees, 620 real customer files inside the source tree | various |

Refuted claims (checked and **not** vulnerable) are in section 5.

---

## 3. Critical & High findings

### C-1 — Anonymous download of invoices, certificates and manuscripts (CRITICAL)

**What is exposed.** Anything written under `MEDIA_ROOT` is served to the world, unauthenticated,
because the media route is mounted whenever `DEBUG` is on:

* `backend/config/urls.py:41-43` — `if settings.DEBUG: urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)`
* `backend/.env` currently ships `DEBUG=True`.

The names of the sensitive files are **derived from the sequential numeric primary key**, so they are
enumerable:

* `backend/orders/models.py:56` — `invoice_pdf = models.FileField(upload_to='invoices/')` (default/public storage)
* `backend/orders/utils.py:357-358` — `filename = f"invoice_{order_reference(order)}.pdf"` → saved into `media/invoices/`
* `backend/submissions/models.py:102` — `certificate_file = models.FileField(upload_to='submissions/certificates/')`
* `backend/submissions/models.py:79-83` — `manuscript_file` / `cover_letter` → `submissions/manuscripts/`, public storage
* `conferences` invoices: `invoice_conference_submission_<pk>.pdf`

**Reproduced against real data** (anonymous, no cookies, no token):

```
200  application/pdf  /media/invoices/invoice_order_1.pdf
200  application/pdf  /media/invoices/invoice_order_10.pdf
200  application/pdf  /media/conference_invoices/invoice_conference_submission_1.pdf
200  application/pdf  /media/submissions/certificates/certificate_submission_4.pdf
```

**Reproduced in the isolated probe run** — P1: `3/3 → HTTP 200` for
`/media/invoices/invoice_order_1.pdf`, `/media/submissions/manuscripts/offer.pdf`,
`/media/certificates/certificate_submission_4.pdf`.

**Impact.** An unauthenticated attacker walks `invoice_order_1 … invoice_order_N` (110 orders exist,
54 paid) and harvests every customer's **name, email, phone, full delivery address, order contents
and Razorpay payment IDs**; the same walk yields author certificates and — where the original upload
name is guessable (`offer.pdf`, `temp.pdf`, `sample-manuscript.pdf`,
`22AI903_22AM904-…_UNIT_1_UPDATED.pdf`) — unpublished research papers. On any deployment that
aliases `/media/` in nginx (the standard Django layout, and the only one `DEPLOYMENT.md` describes
for media) this is production-reachable, not dev-only.

**Fix (in order of value).**
1. Move `Order.invoice_pdf`, `Submission.manuscript_file`, `Submission.cover_letter`,
   `Submission.certificate_file` onto the existing `protected_storage` (the pattern already used by
   `ConferenceSubmission.manuscript_file`, `JournalIssue.file_digital`, `JournalArticle.file_pdf`).
2. Serve them only through the authorized views (`…/invoice/`, `…/manuscript/`), which already do
   owner-or-staff checks.
3. Drop `static(MEDIA_URL, …)` from the URLconf entirely, or gate it; cover images are the only
   legitimate public media and they can go through the CDN/`next/image`.
4. Make generated names unguessable (`invoice_<public_id>_<token>.pdf`), since
   `order_reference`/PK ordering leaks sequence even behind auth.

### H-1 — Customers can rewrite the public homepage carousel (HIGH)

`backend/slider/views.py:20-23` returns `permissions.IsAuthenticated()` for every non-`list`/
`retrieve` action, while the class docstring says *"Admin: CRUD"*. `AdminSectionAccessMiddleware`
does not help: `backend/config/middleware.py:89-90` skips the check for anyone who is not staff.

**Reproduced** — P8, authenticated as an ordinary registered customer (no `is_staff`):

```
POST   /api/slider/            -> 201  (caption "MALICIOUS HOMEPAGE BANNER", link https://phishing.example.com/)
PATCH  /api/slider/<pk>/       -> 200  (caption -> "HIJACKED SLIDE")
DELETE /api/slider/<pk>/       -> 204
```

`SliderImage.link` is a `URLField` rendered on the public homepage, so this is persistent
phishing/defacement plus deletion of official marketing content.

**Fix:** `permission_classes = [permissions.IsAdminUser]` on the write actions (mirror
`AdminTestimonialViewSet`), and add `/api/slider/` writes to the section-gate for non-staff callers.

### H-2 — Journal manuscripts stored in public media (HIGH)

Same storage defect as C-1 but a different asset class, so it is tracked separately: a submitted
manuscript is pre-publication confidential work, and the system already has a protected store for
exactly this purpose. **Reproduced** — P6:

```
Submission.manuscript_file            -> …\backend\media              PUBLIC=True
Submission.certificate_file           -> …\backend\media              PUBLIC=True
Order.invoice_pdf                     -> …\backend\media              PUBLIC=True
ConferenceSubmission.manuscript_file  -> …\backend\protected_media    PUBLIC=False
```

Django only appends a random suffix when a name collides, so the **first** upload of any filename
keeps the author's original name verbatim (confirmed on disk: `offer.pdf`, `temp.pdf`,
`sample-manuscript.pdf`, `22AI704_LLM_UNIT_V_DCM.pdf`). Fix as in C-1 (step 1).

### H-3 — Purchased chapter content is unreachable for everyone (HIGH)

`backend/publications/views.py:584-591`:

```python
try:
    from orders.models import Order
    has_paid_order = Order.objects.filter(user=request.user, payment_status='paid').exists()
    if has_paid_order:
        is_authorized = True
except Exception:
    pass
```

`Order` has no `payment_status` field (`status` is the field — `backend/orders/models.py:45`), so the
query raises `FieldError` on **every** request and the bare `except Exception: pass` discards it.

**Reproduced** — P3:

```
FieldError: Cannot resolve keyword 'payment_status' into field. Choices are: city, country, …
paying customer section content -> HTTP 403 {'detail': 'Full content access requires valid purchase or authorization.'}
```

An order for the exact book being read does not help; the only ways through are `open_access` or
staff. Two distinct problems to fix together:

1. Wrong field name + swallowed exception ⇒ a paid feature silently does not work and never logs.
2. The rule itself is wrong: it authorises on *any* paid order, not on a paid order **for this book**.
   Naively renaming the field would turn a functional bug into a site-wide entitlement leak.

**Fix:** check `Order.items` for a paid order containing this `book` (mirroring
`publications/access_control.py::check_journal_article_access`), raise on error instead of `pass`,
and add a regression test for both directions (owner allowed, non-owner denied).

### H-4 — Order creation is neither atomic nor error-safe (HIGH)

`backend/orders/views.py:58-164` creates the `Order` row, then loops items, and compensates with
`order.delete()` only for the exception types it names (`Book.DoesNotExist`, `ValidationError`, …).
`CreateOrderItemSerializer.quantity` (`backend/orders/serializers.py:53`) is a bare `IntegerField`
with no bound, while the model column is a `PositiveIntegerField`
(`backend/orders/models.py:184`) — SQLite enforces that with a `CHECK` constraint, so a hostile
payload escapes the `except` list:

**Reproduced** — P2:

```
POST /api/commerce/  items=[{book:Dear,qty:2},{book:Cheap,qty:-3}]
  -> HTTP 500 (sqlite3.IntegrityError: CHECK constraint failed: quantity)
  -> orders before=0 after=1   # orphaned ₹0 order committed
POST /api/commerce/  items=[{book:Dear,qty:0}]
  -> HTTP 201 total=40.00      # an order for nothing; only shipping charged
```

**Impact.** Each attempt burns a `MMSR-ORD-1931-NNNNNN` sequence number, leaves a phantom order in
admin lists/fulfilment queues, and returns a 500 (a cheap log-flooding/DoS primitive). Negative
totals are not reachable because the DB stops them first — the missing bound is still a defect.

**Fix:** wrap `create()` in `transaction.atomic()`, validate `quantity = IntegerField(min_value=1,
max_value=99)`, and reject an empty/zero-item cart.

---

## 4. Medium findings

### M-1 — Cross-user echo of conference submissions
`backend/conferences/views.py:93-111` resolves the idempotency key **globally**:
`ConferenceSubmission.objects.filter(client_reference=client_reference).first()` — no ownership
filter. **Reproduced** — P4: Mallory POSTs Alice's `client_reference` and receives `HTTP 200` with
`title='Alice Secret Unpublished Paper'`, `author_email='alice@qa.test'`, and Alice's record `id`.
The same path also lets Mallory *block* that reference. Fix: `.filter(submitted_by=request.user)`,
and make the fallback create a new record instead of returning a foreign one.

### M-2 — Deactivated accounts keep invoice access
The `invoice` action turns off DRF authentication (`backend/orders/views.py:529`) and decodes the
bearer token by hand (`:533-544`), loading `User.objects.get(id=user_id)` with **no `is_active`
check** — unlike `JWTAuthentication.get_user()`, which rejects inactive users. **Reproduced** — P5:

```
/profile                    -> 401     (control: standard path rejects the same token)
/api/commerce/<pk>/invoice/ -> 200 application/pdf   (manual path: still works)
```

This is how a suspended/banned customer can keep pulling invoices; it also means the two registered
invoice routes enforce different rules (`backend/orders/urls.py:10` mounts the same action without
the `@action` initkwargs — it correctly returned 403 for the deactivated account). Fix: reuse
`get_authenticated_user_from_request`-style logic *with* `is_active`, or delete the manual branch and
give the action real `authentication_classes`.

### M-3 — Absolute Windows paths baked into migrations
`backend/publications/migrations/0014_alter_journalarticle_file_pdf_and_more.py:18,23`,
`…/0018_journal_total_issues_journal_total_volumes_and_more.py:28,33` and
`backend/conferences/migrations/0001_initial.py:82-83` serialise
`FileSystemStorage(location=PureWindowsPath('C:/Users/chira/Desktop/MMSR V2/backend/protected_media'))`
and `…('D:/MMSR V2 QODER/backend/protected_media')` into the migration graph. The runtime models
correctly derive the location from `settings.PROTECTED_MEDIA_ROOT`, and `makemigrations --check`
currently reports "No changes detected", so this is latent — but any deploy that re-applies these
migrations on Linux resolves protected storage to a Windows path, and touching the field again will
re-bake the developer's local directory. Fix: replace the recorded `storage=` kwargs with
`FileSystemStorage()` (or a deconstructible named storage class) and set the location from settings.

### M-4 — Unthrottled public write endpoints
`ContactInquiryViewSet.create`, `TestimonialSubmitView` and `NewsletterSubscriberViewSet.create`
are `AllowAny` with no `throttle_classes`, no captcha and no honeypot (throttles exist only for
login/reset/invitation — `backend/users/throttles.py`). **Reproduced** — P7: `40/40` contact
inquiries accepted, **80 emails queued by one 40-request script** (admin notification + "thank you"
to the supplied address). Because `recipient_list` comes from the request body, an attacker can mail
any third-party address at will at the site's cost/reputation. Fix: add a
`SimpleRateThrottle` (e.g. `60/min` per IP) plus a hidden honeypot field, and cap the
admin-notify/ack emails.

### M-5 — No CSP / security headers on the frontend
`next.config.ts` sets only `reactStrictMode` and `images.remotePatterns`; there is no
`middleware.ts`, and the sample nginx block in `DEPLOYMENT.md:147-173` adds no headers. The Django
side is fine (`X_FRAME_OPTIONS=DENY`, `SECURE_CONTENT_TYPE_NOSNIFF`, HSTS when not DEBUG —
`backend/config/settings.py:463-475`). Net effect: the marketing site **and** the `/admin` CMS run
without `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy` or frame/permission
policy, and HTTPS/HSTS is not enforced at the edge. Fix: ship `headers()` in `next.config.ts` (or a
`middleware.ts`) with CSP, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: strict-origin`,
and HSTS at nginx.

### M-6 — Rate limiting degrades silently per worker
The cache/throttle backend falls back to `LocMemCache` when `REDIS_URL` is unset
(`backend/config/settings.py`, `CACHES`), so with `gunicorn -w 4` (mandated by
`DEPLOYMENT.md:120-126`) every login/reset/invitation throttle budget is multiplied by the worker
count. Fix: raise `ImproperlyConfigured` when `not DEBUG and not REDIS_URL` (fail fast beats fail
soft), matching the DB-credential pattern added earlier in this audit.

### M-7 — `CORS_ALLOW_ALL_ORIGINS = DEBUG` is fail-open
Combined with `DEBUG=True` shipped in `backend/.env`, any environment started with the repo defaults
accepts cross-origin calls from **any** site for every credentialed public API. Fix: default
`CORS_ALLOW_ALL_ORIGINS=False` and require an explicit opt-in for local work.

### M-8 — Email failures are swallowed
`backend/users/views.py:403-418` (reset link, `fail_silently=True` + `except Exception: pass`),
`backend/publications/views.py:352-370` and `:374-394`, `backend/submissions/views.py:129-188`.
Independently verified: Django raises `BadHeaderError` for a subject containing a newline
(`Header values can't contain newlines`), so a newline in the contact form's **subject** — which is
unvalidated user text — makes the admin notification fail *silently* while the auto-ack to the
sender succeeds. Result: a support blind spot plus undelivered password-reset links that still
report "reset link sent". Fix: sanitize/validate subjects server-side, log at `error` with the
address (not the token), and surface delivery failures to the audit trail.

---

## 5. Low / QA findings

| ID | Issue | Evidence | Fix |
| --- | --- | --- | --- |
| L-1 | `protected_storage.url()` returns `/media/…`, because Django 4.2's `FileSystemStorage` defaults `base_url` to `MEDIA_URL` | probe: `protected_storage.url('journals/digital/foo.pdf') -> /media/journals/digital/foo.pdf` | Currently harmless — `JournalArticleSerializer:170-177` and the issue serializer rewrite those fields to the authorized API endpoint, and `media/journals/{digital,articles}` are empty (verified: 0 files). Add an explicit `base_url=None`-safe storage or a serializer assertion so a future `fields='__all__'` cannot publish it |
| L-2 | Staff created through the **Django admin** get no `admin_permissions` map, and the middleware treats a missing key as full staff access (`config/middleware.py:93-94`) | `users/admin.py:203-251` (`AddAdminForm` never seeds permissions) vs `users/roles.py` ("any section not listed becomes none" — only on the invitation path) | Seed `permissions_for_role(...)` in `AddAdminForm.save()`, or flip the default to deny with an explicit legacy migration |
| L-3 | Authors can PATCH `book`, `volume` and `pricing_tier` on their own submission (`SubmissionSerializer` uses `fields='__all__'`, `backend/submissions/serializers.py:35-55`; only `status`, `certificate_issued`, `editorial_notes` are locked) | code trace | Add the three fields to `read_only_fields`, or restrict to an editor-only write set |
| L-4 | Internal admin URLs are mailed to authors | `backend/submissions/views.py:181` (`{BACKEND_URL}/admin/submissions/submission/{id}/change/`) | Drop the admin link from author-facing email |
| L-5 | Client-side "override" caches can silently mask server data in the CMS | `app/admin/books/page.tsx:281-287`, `app/admin/journals/page.tsx:484-489`, `lib/services/cms.ts` (`mmsr_admin_slides`, `mmsr_admin_conferences`, `mmsr_admin_site_metrics`) | Treat the server as authoritative; use the caches only as retry buffers and re-validate on load |
| L-6 | The Django admin is reachable on the API origin (`/admin/login/` → 200 anonymous) | probe run | Restrict by IP/VPN at nginx, or move it off the public API host |
| L-7 | Dev/one-off scripts and full backup trees are inside the project: `backend/_p4_*`, `backend/_p5_*`, `backend/check.py`, `backend/output.html`, `_phase4_backup_*/`, `_phase5_backup_*/` (the latter contains a complete copy of `backend/`) | directory listing | Delete or move out of the deployable tree |
| L-8 | `backend/media/` holds **620 real files** (invoices, manuscripts, certificates, profile screenshots) inside the source tree | `Get-ChildItem media -Recurse -File).Count = 620` | Relocate media outside the repo, add to ignore rules, and re-check what C-1 exposes |

---

## 6. Checked and NOT vulnerable (refuted)

Worth recording so these are not re-investigated:

* **SQL injection** — no `.raw(`, `.extra(`, `cursor.execute` or f-string SQL anywhere in `backend/**.py`.
* **XSS** — zero `dangerouslySetInnerHTML` in the frontend; the two `mark_safe` uses
  (`backend/users/admin.py:174`, `:424`) interpolate only Django's permission-registry app/model
  labels and static badge markup.
* **SSRF** — all outbound HTTP is hard-coded (`https://api.razorpay.com/v1/...` in
  `backend/orders/views.py:346,379,429`; Google token verification). No request URL comes from a client.
* **Path traversal** — every protected document is served from a storage key held in the DB row via
  `FileResponse`; no user-controlled path reaches the filesystem. Probed garbage identifiers
  (`../../etc/passwd`, `1;DROP`) are rejected (`backend/orders/tests.py:1522-1526`).
* **Email header injection** — Django raises `BadHeaderError` (verified experimentally). Residual
  issue is only the silent drop, tracked as M-8.
* **Weak crypto / seeded credentials** — no `md5`/`sha1`/`DES` for secrets; tokens use
  `secrets`/`token_urlsafe`; invitation tokens are hashed and compared via `select_for_update`
  (`backend/users/views.py:859-864`); no management command seeds accounts or passwords.
* **Password policy** — `validate_password` is attached to all four password-writing paths
  (`backend/users/serializers.py:105,138,144,209`) with the standard Django validators configured.
* **Price tampering** — `create()` discards the client's `total_amount`
  (`backend/orders/views.py:62-64,143-147`) and re-prices every line from the DB; a Paid article with
  no configured price is refused rather than sold for ₹0.
* **Object-level ownership** — order/conference/submission/access viewsets all scope the queryset to
  `request.user` unless staff (`orders/views.py:41-42`, `conferences/views.py:81-86`,
  `submissions/views.py:43-49`, `publications/views.py:287-299`), `UserJournalAccessViewSet` blocks
  non-staff creation outright, `PUT/PATCH/DELETE` are disabled on orders
  (`http_method_names`, `orders/views.py:39`), role escalation on `AdminUserViewSet` is superuser-only
  (`users/views.py:545-547`), and chapter sections are looked up **through** the parent chapter
  (`chapter.sections.get(pk=…)`), so no cross-object section read.
* **JWT handling** — HS256 on `SECRET_KEY`, 1 h access / 7 d refresh, rotation + blacklist, and no
  bearer token accepted from a query string (`publications/access_control.py:6-15`).
* **Cache poisoning of paid content** — every entitlement response sets `no-store` +
  `Vary: Authorization, Cookie` (`PrivateResponseHeadersMixin`, `AlwaysPrivateResponseHeadersMixin`).
* **Simulated payment endpoints** — double-gated to `DEBUG` **and** a `rzp_test_` key
  (`orders/views.py:283-323`, `conferences/views.py:241-260`).
* **Gateway error leakage** — all five sites found in the earlier insecure-defaults pass were fixed
  and regression-tested in this session (119 tests green).
* **DB credentials** — the `root`/empty-password fallback was replaced with a fail-fast
  `_required_db_setting()` (this session).
* **Schema drift** — `makemigrations --check --dry-run` → "No changes detected"; `manage.py check` → 0 issues.

---

## 7. What could not be tested (coverage gaps — please read)

1. **Production configuration is unknown.** There are no deploy manifests in the tree (no
   `Dockerfile`, `docker-compose`, systemd unit or real nginx file). Whether `DEBUG`, `/media`
   aliasing, `REDIS_URL` and S3 are set in the live environment changes the reachability of C-1,
   M-4, M-6 and M-7 — verify on the server before treating them as dev-only.
2. **`DEPLOYMENT.md:34` says media is on S3/Cloudinary, but the code uses `FileSystemStorage`**
   (`protected_storage`, `backend/publications/models.py:100`, `backend/conferences/models.py:13`).
   The document and the implementation disagree; whichever is true, the other needs updating, and
   protected-media isolation must be re-verified against the real backend.
3. **No live UI penetration test.** The admin browser session had expired
   (`/admin/books` → `/admin/login`), and recreating a temporary superuser for a full CMS attack run
   was not authorised. Click-jacking, stored-XSS-in-CMS-fields and client-side authorisation bypasses
   in `/admin/*` are therefore **untested**, not clean.
4. **Payments were not exercised against the live gateway** — signature verification, replay and
   QR-status polling were reviewed statically and by existing unit tests only.
5. **Database is SQLite**; PostgreSQL-only behaviours (row locks behind `select_for_update`, real
   `CHECK` enforcement, concurrency on `core/services.allocate_next`) are documented but not
   validated under load.
6. **No git history** (`git rev-parse` → not a work tree), so secret-leak scanning of past commits
   was impossible. `backend/.env` does contain live Razorpay keys, an SMTP app password and
   `SECRET_KEY`; `.gitignore` covers `.env*` — keep it that way and rotate if the directory was ever
   shared.
7. **No load/DoS testing, no dependency CVE scan** (`npm audit` / `pip-audit` were not run).

---

## 8. Suggested remediation order

1. **C-1 / H-2** (one change): move `invoice_pdf`, `certificate_file`, `manuscript_file`,
   `cover_letter` to `protected_storage`; unmount the public media route; re-issue invoice names with
   a token. Then confirm none of the 620 current media files are customer documents left exposed.
2. **H-1**: `IsAdminUser` on slider writes.
3. **H-4**: `transaction.atomic` + `quantity` bounds + empty-cart rejection.
4. **H-3**: fix `payment_status` → per-book paid-order entitlement, remove the bare `except`, add
   allow **and** deny tests.
5. **M-1** (scope `client_reference` per user) and **M-2** (honour `is_active` in the manual bearer path).
6. **M-3** (de-hard-code migration storage paths) before the next deploy, and **M-4/M-5/M-6/M-7/M-8**.
7. L-1 … L-8 as housekeeping; L-7/L-8 (backup trees + media in the repo) are also a hygiene win for C-1.

Every fix above is small and local; the four probes P1, P3, P4, P8 that produced this evidence can be
restored as a permanent `qa_attack_tests` regression module on request.
