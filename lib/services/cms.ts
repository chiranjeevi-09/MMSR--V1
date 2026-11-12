/**
 * MMSR Publications V2 — Reusable Admin CMS API Service Foundation
 * Interfaces cleanly with Django REST Framework endpoints for Books, Journals, Issues, and Categories.
 */

import { cachedGet, clearCache } from '../utils/microCache';
import { honeypotValue } from '../utils/spamGuard';
import { clearPending, purgeLegacyOverrides, savePending } from '../utils/pendingSync';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

/**
 * SECURITY-QA-REPORT L-5 — one-time cleanup of the pre-fix "override" keys.
 * These caches used to be merged *over* the server's data on every read, so a
 * stale or rejected local copy could mask real rows indefinitely. They are
 * purged on the first CMS read of a session; nothing writes to them any more.
 */
export function purgeLegacyCmsOverrides(): void {
  purgeLegacyOverrides('mmsr_admin_slides', 'mmsr_admin_site_metrics', 'mmsr_admin_conferences');
}

/**
 * Text-only copy of a slider form, for the retry buffer. Files cannot be kept
 * in localStorage, so an image must be re-selected after a failed send.
 */
function formDraft(formData: FormData): Record<string, string | number | boolean> {
  const pick = (key: string): string => (formData.get(key) as string) || '';
  return {
    title: pick('title'),
    subtitle: pick('subtitle') || pick('caption'),
    cta_text: pick('cta_text'),
    cta_url: pick('cta_url') || pick('link'),
    display_order: Number(formData.get('display_order') || formData.get('order') || 1),
    is_active: formData.get('is_active') !== 'false',
  };
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  /** Standardized MMSR public ID (MMSR-CAT-1931-NNNNNN). */
  public_id?: string | null;
  name: string;
  slug: string;
  description?: string;
  category_type?: 'books' | 'journals' | 'conferences' | 'all';
}

export interface AdminBook {
  id: number;
  /** Standardized MMSR public ID (MMSR-BOK-1931-NNNNNN). */
  public_id?: string | null;
  title: string;
  slug: string;
  author?: string;
  isbn?: string;
  category?: Category | number | null;
  category_id?: number | null;
  description?: string;
  price?: string | number;
  stock?: number;
  pages?: number;
  edition?: string;
  rating?: number;
  cover_image?: string | null;
  file_sample?: string | null;
  file_pdf?: string | null;
  published_date?: string | null;
  is_featured?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdminJournal {
  id: number;
  /** Standardized MMSR public ID (MMSR-JRN-1931-NNNNNN). */
  public_id?: string | null;
  title: string;
  slug: string;
  issn?: string;
  category?: Category | number | null;
  category_id?: number | null;
  description?: string;
  indexed_in?: string;
  frequency?: string;
  access_type?: string;
  cover_image?: string | null;
  subscription_price_annual?: string | number;
  is_featured?: boolean;
  issues?: AdminIssue[];
  created_at?: string;
  updated_at?: string;
}

export interface AdminIssue {
  id: number;
  /** Standardized MMSR public ID (MMSR-ISS-1931-NNNNNN). */
  public_id?: string | null;
  journal: number | { id: number; title: string; slug: string };
  title: string;
  volume_number?: number | null;
  issue_number?: number | null;
  publication_date?: string | null;
  price?: string | number;
  cover_image?: string | null;
  file_digital?: string | null;
  file_digital_url?: string | null;
  file_digital_name?: string | null;
  has_file_digital?: boolean;
  stock?: number;
  created_at?: string;
  updated_at?: string;
}

// ─── Error Parser ──────────────────────────────────────────────────────────────

// Friendly labels for known backend field keys so validation errors read naturally
// instead of surfacing raw DB column names (e.g. "AUTHOR_NAMES_RAW").
const CMS_FIELD_LABELS: Record<string, string> = {
  author_names_raw: 'Authors',
  non_field_errors: 'Error',
  page_range: 'Page range',
  access_mode: 'Access mode',
  chapter_number: 'Chapter number',
  published_date: 'Published date',
  publication_date: 'Publication date',
  cover_image: 'Cover image',
  file_pdf: 'File',
  file_sample: 'Sample file',
  is_featured: 'Featured',
  display_order: 'Display order',
  short_description: 'Short description',
  full_description: 'Full description',
};

function humanizeCmsFieldKey(key: string): string {
  if (CMS_FIELD_LABELS[key]) return CMS_FIELD_LABELS[key];
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function parseCmsError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data.detail && typeof data.detail === 'string') return data.detail;
    if (data.error && typeof data.error === 'string') return data.error;
    if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
      return data.non_field_errors.join(' ');
    }

    const fieldErrors: string[] = [];
    for (const key of Object.keys(data)) {
      const val = data[key];
      const label = humanizeCmsFieldKey(key);
      if (Array.isArray(val)) {
        fieldErrors.push(`${label}: ${val.join(' ')}`);
      } else if (typeof val === 'string') {
        fieldErrors.push(`${label}: ${val}`);
      }
    }
    if (fieldErrors.length > 0) return fieldErrors.join(' | ');

    return `API Request Failed (HTTP ${response.status})`;
  } catch {
    return `Server returned error code ${response.status}. Please check backend logs.`;
  }
}

// ─── Categories API ───────────────────────────────────────────────────────────

export async function fetchCategories(accessToken?: string, categoryType?: string): Promise<Category[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  const query = categoryType ? `?category_type=${encodeURIComponent(categoryType)}` : '';
  const res = await fetch(`${API_BASE_URL}/api/publications/categories/${query}`, { headers, cache: 'no-store' });
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createAdminCategory(accessToken: string, payload: Partial<Category>): Promise<Category> {
  const res = await fetch(`${API_BASE_URL}/api/publications/categories/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function updateAdminCategory(
  accessToken: string,
  id: number,
  payload: Partial<Category>
): Promise<Category> {
  const res = await fetch(`${API_BASE_URL}/api/publications/categories/${id}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function deleteAdminCategory(accessToken: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/publications/categories/${id}/`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }
}

// ─── Books API (Task 1) ───────────────────────────────────────────────────────

export async function fetchAdminBooks(accessToken: string): Promise<AdminBook[]> {
  const res = await fetch(`${API_BASE_URL}/api/publications/books/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function fetchAdminBookDetail(accessToken: string, slug: string): Promise<AdminBook> {
  const res = await fetch(`${API_BASE_URL}/api/publications/books/${slug}/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function createAdminBook(accessToken: string, formData: FormData): Promise<AdminBook> {
  const res = await fetch(`${API_BASE_URL}/api/publications/books/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // NOTE: Do not set Content-Type header when sending FormData!
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  clearCache('pub:books');
  return await res.json();
}

export async function updateAdminBook(
  accessToken: string,
  slug: string,
  formData: FormData
): Promise<AdminBook> {
  const res = await fetch(`${API_BASE_URL}/api/publications/books/${slug}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  clearCache('pub:books');
  return await res.json();
}

export async function deleteAdminBook(accessToken: string, slug: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/publications/books/${slug}/`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok && res.status !== 204) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  clearCache('pub:books');
}

// ─── Journals API (Task 2) ────────────────────────────────────────────────────

export async function fetchAdminJournals(accessToken: string): Promise<AdminJournal[]> {
  const res = await fetch(`${API_BASE_URL}/api/publications/journals/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createAdminJournal(accessToken: string, formData: FormData): Promise<AdminJournal> {
  const res = await fetch(`${API_BASE_URL}/api/publications/journals/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  clearCache('pub:journals');
  return await res.json();
}

export async function updateAdminJournal(
  accessToken: string,
  slug: string,
  formData: FormData
): Promise<AdminJournal> {
  const res = await fetch(`${API_BASE_URL}/api/publications/journals/${slug}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  clearCache('pub:journals');
  return await res.json();
}

export async function deleteAdminJournal(accessToken: string, slug: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/publications/journals/${slug}/`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok && res.status !== 204) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  clearCache('pub:journals');
}

// ─── Journal Issues API (Task 2) ──────────────────────────────────────────────

export async function fetchAdminIssues(accessToken: string): Promise<AdminIssue[]> {
  const res = await fetch(`${API_BASE_URL}/api/publications/issues/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createAdminIssue(accessToken: string, formData: FormData): Promise<AdminIssue> {
  const res = await fetch(`${API_BASE_URL}/api/publications/issues/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function updateAdminIssue(
  accessToken: string,
  id: number,
  formData: FormData
): Promise<AdminIssue> {
  const res = await fetch(`${API_BASE_URL}/api/publications/issues/${id}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

// Remove the persisted complete-issue PDF without touching any other field.
// Sent as JSON (not multipart) so DRF receives an explicit null and clears the file.
export async function clearAdminIssueDigitalFile(
  accessToken: string,
  id: number
): Promise<AdminIssue> {
  const res = await fetch(`${API_BASE_URL}/api/publications/issues/${id}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_digital: null }),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function deleteAdminIssue(accessToken: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/publications/issues/${id}/`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok && res.status !== 204) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }
}

// ─── User Management API (Phase 7C - Task 1) ──────────────────────────────────

export type AccessLevel = 'none' | 'read' | 'edit';

export interface AdminUser {
  id: number;
  /** Standardized MMSR public ID (MMSR-USR-1931-NNNNNN). */
  public_id?: string | null;
  /** Staff display identity (MMSR-ADM-1931-NNNNNN); null for non-staff. */
  admin_public_id?: string | null;
  email: string;
  // Administrative login email granted through the invitation workflow;
  // staff may sign in with either this or their personal `email`.
  work_email?: string | null;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  is_author?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
  date_joined?: string;
  joined_at?: string;
  last_login?: string;
  admin_role?: string;
  department?: string;
  // Keys MUST stay in sync with backend/config/middleware.py SECTION_ROUTES.
  admin_permissions?: Record<string, AccessLevel>;
}

// ─── Admin Invitation API (Add Admin flow on /admin/access) ────────────────

export type AdminRole =
  | 'super_admin'
  | 'publication_admin'
  | 'editorial_admin'
  | 'finance_admin'
  | 'support_admin';

// Mirrors backend ADMIN_ROLE_CHOICES + users/roles.py presets.
export const ADMIN_ROLES: { value: AdminRole; label: string; description: string }[] = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full control of the CMS, including granting other admins access.' },
  { value: 'publication_admin', label: 'Publication Admin', description: 'Books, chapters, journals, issues, articles, categories and policies.' },
  { value: 'editorial_admin', label: 'Editorial Admin', description: 'Manuscript & conference submissions and the editorial workflow.' },
  { value: 'finance_admin', label: 'Finance Admin', description: 'Orders, payments and fulfillment records.' },
  { value: 'support_admin', label: 'Support Admin', description: 'Enquiries, subscribers and testimonial moderation.' },
];

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface AdminInvitation {
  id: number;
  /** Standardized MMSR public ID (MMSR-AIN-1931-NNNNNN). */
  public_id?: string | null;
  // Work email: invitation delivery address + admin login identifier.
  email: string;
  // Personal email of the invitee's existing account (never overwritten).
  personal_email: string;
  full_name: string;
  role: AdminRole;
  role_display: string;
  department: string;
  phone: string;
  notes: string;
  // Explicit per-section map chosen in the wizard before sending.
  permissions?: Record<string, AccessLevel>;
  status: InvitationStatus;
  created_at: string;
  sent_at: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_by_email: string;
  user: number;
}

export interface CreateInvitationPayload {
  full_name: string;
  // Work email — receives the invitation and becomes the admin login.
  email: string;
  // Personal email of a brand-new staff member (existing-user mode sends
  // user_id instead; the server then reads the identity from the account).
  personal_email?: string;
  // Set when inviting an existing reader — reuses that account, never
  // duplicates it.
  user_id?: number;
  role: AdminRole;
  department?: string;
  phone?: string;
  notes?: string;
  // Explicit grant map chosen in Step 2 — sent as all 13 keys so an absent
  // section can never imply edit access.
  permissions?: Record<string, AccessLevel>;
}

// Sections a Super Admin can grant per user on the /admin/access page.
// Dashboard, Profile and Settings are always available once staff access is on;
// anything else is enforced here in the sidebar and (authoritatively) by the
// API middleware.
export const ADMIN_SECTIONS: { key: string; label: string; pages: string }[] = [
  { key: 'users', label: 'User Accounts', pages: 'User accounts directory' },
  { key: 'books', label: 'Books & Chapters', pages: 'Books & Chapters' },
  { key: 'journals', label: 'Journals', pages: 'Journals, Issues & Articles' },
  { key: 'submissions', label: 'Submissions', pages: 'Book & Journal Submissions' },
  { key: 'conferences', label: 'Conferences', pages: 'Conferences & Paper Submissions' },
  { key: 'orders', label: 'Orders', pages: 'Orders & Fulfillment' },
  { key: 'categories', label: 'Categories', pages: 'Publication Categories' },
  { key: 'testimonials', label: 'Testimonials', pages: 'Testimonial Moderation' },
  { key: 'enquiries', label: 'Enquiries', pages: 'Enquiries & Departments' },
  { key: 'subscribers', label: 'Subscribers', pages: 'Newsletter Subscribers & Broadcasts' },
  { key: 'hero_slider', label: 'Hero Slider', pages: 'Homepage Slider' },
  { key: 'site_content', label: 'Site Content', pages: 'Site Settings, Services & FAQs' },
  { key: 'policies', label: 'Policies', pages: 'Policies & Acceptances' },
];

export interface AdminNotificationRaw {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  category: 'submission' | 'order' | 'conference' | 'user';
  section: 'submissions' | 'orders' | 'conferences' | 'users';
  linkUrl: string;
}

export async function fetchAdminNotifications(accessToken: string): Promise<AdminNotificationRaw[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/admin-notifications/`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchAdminUsers(accessToken: string): Promise<AdminUser[]> {
  const res = await fetch(`${API_BASE_URL}/api/users/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function updateAdminUser(
  accessToken: string,
  id: number,
  patchData: Partial<AdminUser>
): Promise<AdminUser> {
  const res = await fetch(`${API_BASE_URL}/api/users/${id}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchData),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function fetchAdminInvitations(accessToken: string): Promise<AdminInvitation[]> {
  const res = await fetch(`${API_BASE_URL}/api/users/invitations/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createAdminInvitation(
  accessToken: string,
  payload: CreateInvitationPayload
): Promise<{ message: string; real_email_configured?: boolean; invitation: AdminInvitation }> {
  const res = await fetch(`${API_BASE_URL}/api/users/invitations/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function resendAdminInvitation(
  accessToken: string,
  id: number
): Promise<{ message: string; real_email_configured?: boolean; invitation: AdminInvitation }> {
  const res = await fetch(`${API_BASE_URL}/api/users/invitations/${id}/resend/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function revokeAdminInvitation(
  accessToken: string,
  id: number
): Promise<{ message: string; invitation: AdminInvitation }> {
  const res = await fetch(`${API_BASE_URL}/api/users/invitations/${id}/revoke/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

// ─── Public invitation activation (no auth; invitee is not signed in) ─────

export interface InvitationDetails {
  valid: boolean;
  full_name: string;
  email: string;
  work_email?: string;
  personal_email?: string;
  role: AdminRole;
  role_display: string;
  department: string;
  expires_at: string;
}

export async function validateInvitation(rawToken: string): Promise<InvitationDetails> {
  const res = await fetch(`${API_BASE_URL}/api/users/invitations/validate/?token=${encodeURIComponent(rawToken)}`, {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function acceptInvitation(
  rawToken: string,
  password: string
): Promise<{ message: string; email: string }> {
  const res = await fetch(`${API_BASE_URL}/api/users/invitations/accept/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rawToken, password }),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

// ─── Submission Review API (Phase 7C - Task 2) ───────────────────────────────

export interface AdminSubmission {
  id: number;
  /** Standardized MMSR public ID (MMSR-SUB-1931-NNNNNN). */
  public_id?: string | null;
  reference_id?: string;
  title: string;
  author_name?: string;
  author_email?: string;
  corresponding_email?: string;
  submission_type?: string;
  target_journal?: string;
  journal?: number | null;
  journal_title?: string | null;
  journal_issn?: string | null;
  book_title?: string | null;
  book_isbn?: string | null;
  volume_title?: string | null;
  category?: string;
  research_domain?: string;
  status: string;
  status_display?: string;
  submitted_at?: string;
  created_at?: string;
  abstract?: string;
  keywords?: string;
  co_authors?: string;
  phone_number?: string;
  author_affiliation?: string;
  country?: string;
  pricing_tier?: string;
  file_url?: string;
  file_manuscript?: string;
  file_supplementary?: string;
  manuscript_file?: string;
  cover_letter?: string | null;
  doi?: string;
  certificate_issued?: boolean;
  certificate_file?: string | null;
  editorial_notes?: string;
}

// The SubmissionSerializer returns the raw model shape (nested `author` object,
// `manuscript_file`, `corresponding_email`, …) but the review UI is written
// against flattened keys (author_name, file_manuscript, …). Normalize here so
// the admin table and drawer reliably show the author's submitted details and
// uploaded manuscript instead of rendering blanks.
function normalizeAdminSubmission(raw: any): AdminSubmission {
  const a = raw?.author && typeof raw.author === 'object' ? raw.author : {};
  const fullName = [a.first_name, a.last_name].filter(Boolean).join(' ').trim();
  const manuscript = raw.manuscript_file || raw.file_manuscript || raw.file_url || '';
  return {
    ...raw,
    author_name: raw.author_name || fullName || raw.corresponding_email || a.email || '',
    author_email: raw.author_email || raw.corresponding_email || a.email || '',
    phone_number: raw.phone_number || a.phone_number || '',
    country: raw.country || a.country || '',
    // Surface the linked journal's title as target_journal so the admin table
    // and drawer reliably show the journal name (serializer sends journal_title).
    target_journal: raw.target_journal || raw.journal_title || null,
    file_url: manuscript,
    file_manuscript: manuscript,
    file_supplementary: raw.cover_letter || raw.file_supplementary || '',
  };
}

export async function fetchAdminSubmissions(accessToken: string): Promise<AdminSubmission[]> {
  const res = await fetch(`${API_BASE_URL}/api/submissions/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const data = await res.json();
  const rows = Array.isArray(data) ? data : data.results ?? [];
  return rows.map(normalizeAdminSubmission);
}

export async function updateAdminSubmission(
  accessToken: string,
  id: number,
  patchData: { status?: string; editorial_notes?: string; certificate_issued?: boolean; journal?: number | null }
): Promise<AdminSubmission> {
  const res = await fetch(`${API_BASE_URL}/api/submissions/${id}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchData),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const updated = await res.json();
  return normalizeAdminSubmission(updated);
}

// Values shown on the admin Publication Notice document. The backend renders
// these into a PDF and attaches it to certificate_file for author download.
export interface NoticePdfPayload {
  heading: string;
  ref_no: string;
  issued_on: string;
  author: string;
  email: string;
  affiliation: string;
  work_kind: string;
  title: string;
  target: string;
  id_label: string;
  id_value: string;
  volume: string;
  doi: string;
  status: string;
  contact_email: string;
  contact_site: string;
}

export async function generateNoticePdf(
  accessToken: string,
  id: number,
  values: NoticePdfPayload,
): Promise<AdminSubmission> {
  const res = await fetch(`${API_BASE_URL}/api/submissions/${id}/generate_notice/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(values),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const updated = await res.json();
  return normalizeAdminSubmission(updated);
}

// ─── Commerce & Orders API (Phase 7C - Task 3 & 4) ───────────────────────────

export interface AdminOrderItem {
  id: number;
  /** Standardized MMSR public ID (MMSR-ORI-1931-NNNNNN). */
  public_id?: string | null;
  book?: { title: string } | null;
  journal_issue?: { title?: string; volume_number?: number; issue_number?: number } | null;
  journal_subscription?: { title: string } | null;
  article?: { title?: string } | null;
  format?: 'digital' | 'print' | 'bundle';
  quantity: number;
  price: string;
}

export interface AdminOrder {
  id: number;
  /** Standardized MMSR public ID (MMSR-ORD-1931-NNNNNN). */
  public_id?: string | null;
  custom_order_id: string | null;
  status: string;
  total_amount: string;
  created_at: string;
  full_name?: string;
  email?: string;
  phone?: string;
  phone_number?: string;
  address?: string;
  shipping_address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  payment_method?: string | null;
  transaction_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  invoice_pdf?: string | null;
  fulfillment_status?: string;
  courier_name?: string;
  tracking_number?: string;
  tracking_url?: string;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  fulfillment_notes?: string;
  has_physical_items?: boolean;
  items: AdminOrderItem[];
}

export async function updateAdminOrderFulfillment(
  accessToken: string,
  id: number,
  data: {
    fulfillment_status?: string;
    courier_name?: string;
    tracking_number?: string;
    tracking_url?: string;
    fulfillment_notes?: string;
  }
): Promise<AdminOrder> {
  const res = await fetch(`${API_BASE_URL}/api/commerce/${id}/update_fulfillment/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export async function fetchAdminOrders(accessToken: string): Promise<AdminOrder[]> {
  const res = await fetch(`${API_BASE_URL}/api/commerce/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function updateAdminOrderStatus(
  accessToken: string,
  id: number,
  status: string
): Promise<AdminOrder> {
  // Staff-only validated endpoint. The generic PATCH route was disabled after
  // the audit proved status writes through it were silent no-ops (serializer
  // marks `status` read-only), so transitions must go through the narrow
  // server-validated action instead.
  const res = await fetch(`${API_BASE_URL}/api/commerce/${id}/update_status/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

export interface CommerceStats {
  total_revenue: string;
  paid_orders: number;
  orders_today: number;
  orders_total: number;
}

// Server-side SQL aggregates (staff-only endpoint). Always prefer these over
// computing revenue from the order list, which only ever returns one page.
export async function fetchCommerceStats(accessToken: string): Promise<CommerceStats> {
  const res = await fetch(`${API_BASE_URL}/api/commerce/stats/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await parseCmsError(res);
    throw new Error(err);
  }

  return await res.json();
}

// ─── Hero Slider API (Phase 7D - Task 1) ──────────────────────────────────────

export interface AdminSlide {
  id: number;
  /** Standardized MMSR public ID (MMSR-SLD-1931-NNNNNN). */
  public_id?: string | null;
  title: string;
  subtitle?: string;
  image?: string;
  cover_image?: string;
  cta_text?: string;
  cta_url?: string;
  cta_link?: string;
  order?: number;
  display_order?: number;
  is_active?: boolean;
  active?: boolean;
  created_at?: string;
}

export async function fetchAdminSlider(accessToken?: string): Promise<AdminSlide[]> {
  let apiSlides: AdminSlide[] = [];
  let loadError: string | null = null;
  const normalize = (raw: any[]): AdminSlide[] =>
    raw.map((item: any) => ({
      ...item,
      title: item.title || 'Hero Slide',
      subtitle: item.subtitle || item.caption || '',
      cta_url: item.cta_url || item.cta_link || item.link || '/books',
      cta_text: item.cta_text || 'Browse Books',
      display_order: item.display_order ?? item.order ?? item.id,
      is_active: item.is_active ?? item.active ?? true,
    }));
  try {
    if (accessToken) {
      // Authenticated admin view must never be cached (may include inactive slides)
      const res = await fetch(`${API_BASE_URL}/api/slider/`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : data.results ?? [];
        apiSlides = normalize(raw);
      } else {
        // A desk that silently shows "no slides" on a 403 looks like an empty
        // database, so the failure is reported instead (SECURITY-QA-REPORT L-5).
        loadError = res.status === 401 || res.status === 403
          ? 'This account is not allowed to read the hero slider (staff sign-in required).'
          : `The slider could not be loaded (HTTP ${res.status}).`;
      }
    } else {
      // Public homepage hero: dedup + short TTL cache; slider mutations clear it
      const data = await cachedGet(
        'pub:slider',
        async (revalidate) => {
          const res = await fetch(`${API_BASE_URL}/api/slider/`, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
          });
          if (!res.ok) throw new Error(`Slider fetch failed: ${res.status}`);
          return res.json();
        },
        { ttlMs: 2_000, revalidate: 0 }
      );
      const raw = Array.isArray(data) ? data : data.results ?? [];
      apiSlides = normalize(raw);
    }
  } catch {
    // API offline: the public hero renders nothing rather than a stale local
    // snapshot of one (SECURITY-QA-REPORT L-5).
  }

  purgeLegacyCmsOverrides();
  if (loadError) throw new Error(loadError);
  return apiSlides;
}

export async function createAdminSlide(accessToken?: string, formData?: FormData): Promise<AdminSlide> {
  if (!accessToken || !formData) {
    throw new Error('Sign in as an administrator before editing the hero slider.');
  }
  // Ensure Django expected fields 'caption' and 'link' are set
  const sub = (formData.get('subtitle') as string) || (formData.get('caption') as string) || '';
  const linkUrl = (formData.get('cta_url') as string) || (formData.get('link') as string) || '/books';
  if (!formData.has('caption')) formData.append('caption', sub);
  if (!formData.has('link')) formData.append('link', linkUrl);

  // If image is not a File object, remove it so DRF ImageField doesn't reject string
  const imageVal = formData.get('image');
  if (imageVal && !(imageVal instanceof File)) {
    formData.delete('image');
  }

  // SECURITY-QA-REPORT L-5: the old code fell back to inventing a slide with a
  // `Date.now()` id and an object-URL image, stored only in this browser. The
  // operator saw a saved hero they had never published. Every write now either
  // lands on the server or raises.
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/slider/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
  } catch {
    savePending('admin_slide_form', formDraft(formData), 'the API could not be reached');
    throw new Error('Cannot reach the MMSR API. The slide was not created.');
  }
  if (!res.ok) {
    const reason = await parseCmsError(res);
    savePending('admin_slide_form', formDraft(formData), reason);
    throw new Error(`The slide was rejected (${reason}). Nothing was published.`);
  }

  const created = await res.json();
  clearCache('pub:slider');
  clearPending('admin_slide_form');
  return {
    ...created,
    title: created.title || 'Hero Slide',
    subtitle: created.subtitle || created.caption || '',
    cta_url: created.cta_url || created.cta_link || created.link || '/books',
    cta_text: created.cta_text || 'Browse Books',
    display_order: created.display_order ?? created.order ?? created.id,
    is_active: created.is_active ?? created.active ?? true,
  };
}

export async function updateAdminSlide(accessToken: string | undefined, id: number, formData: FormData): Promise<AdminSlide> {
  if (!accessToken) {
    throw new Error('Sign in as an administrator before editing the hero slider.');
  }
  const imageVal = formData.get('image');
  if (imageVal && !(imageVal instanceof File)) {
    formData.delete('image');
  }

  // No local-storage fallback: a slide that the API rejected (or that was never
  // sent because the token belongs to a non-staff account) must not keep looking
  // edited in this browser (SECURITY-QA-REPORT L-5 / H-1).
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/slider/${id}/`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
  } catch {
    throw new Error(`Cannot reach the MMSR API. Slide ${id} was not updated.`);
  }
  if (!res.ok) {
    throw new Error(`Slide ${id} was not updated (${await parseCmsError(res)}).`);
  }

  const updated = await res.json();
  clearCache('pub:slider');
  return {
    ...updated,
    title: updated.title || 'Hero Slide',
    subtitle: updated.subtitle || updated.caption || '',
    cta_url: updated.cta_url || updated.cta_link || updated.link || '/books',
    cta_text: updated.cta_text || 'Browse Books',
    display_order: updated.display_order ?? updated.order ?? updated.id,
    is_active: updated.is_active ?? updated.active ?? true,
  };
}

export async function deleteAdminSlide(accessToken: string | undefined, id: number): Promise<void> {
  if (!accessToken) {
    throw new Error('Sign in as an administrator before deleting a hero slide.');
  }
  const res = await fetch(`${API_BASE_URL}/api/slider/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);
  if (!res) {
    throw new Error(`Cannot reach the MMSR API. Slide ${id} still exists.`);
  }
  if (!res.ok && res.status !== 204) {
    throw new Error(`Slide ${id} was not deleted (${await parseCmsError(res)}).`);
  }
  clearCache('pub:slider');
}

export async function toggleAdminSlide(accessToken: string | undefined, id: number, currentStatus: boolean): Promise<AdminSlide> {
  const formData = new FormData();
  formData.append('is_active', (!currentStatus).toString());
  return await updateAdminSlide(accessToken, id, formData);
}

// ─── Testimonials API (real backend under /api/publications/) ────────────────

export interface AdminTestimonial {
  id: number;
  /** Standardized MMSR public ID (MMSR-TST-1931-NNNNNN). */
  public_id?: string | null;
  name?: string;
  designation?: string;
  institution?: string;
  country?: string;
  email?: string;
  content?: string;
  rating?: number;
  avatar?: string | null;
  source?: 'manual' | 'book' | 'journal';
  book?: number | null;
  journal?: number | null;
  book_title?: string | null;
  journal_title?: string | null;
  is_active?: boolean;
  created_at?: string;
  // Legacy aliases still read by some homepage components
  author_name?: string;
  role?: string;
  university?: string;
  quote?: string;
  testimonial_text?: string;
  text?: string;
  photo?: string;
  image?: string;
  active?: boolean;
}

export interface TestimonialSubmitPayload {
  name: string;
  email: string;
  designation?: string;
  institution?: string;
  rating: number;
  content: string;
  source: 'book' | 'journal';
  book_id?: number;
  journal_id?: number;
  /**
   * Bot trap (SECURITY-QA-REPORT M-4). Empty for every real reviewer; the
   * backend discards the submission — with a success-shaped answer — if it
   * arrives with a value.
   */
  website?: string;
}

// Public review submission from book / journal pages (no auth required, lands pending)
export async function submitTestimonial(payload: TestimonialSubmitPayload): Promise<string> {
  const res = await fetch(API_BASE_URL + '/api/publications/testimonials/submit/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, website: honeypotValue(payload.website) }),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  const data = await res.json().catch(() => null);
  return data?.detail || 'Thank you! Your review has been submitted.';
}

// With a token: all testimonials incl. pending user reviews (admin view). Without: approved public rows only.
export async function fetchAdminTestimonials(accessToken?: string): Promise<AdminTestimonial[]> {
  try {
    if (accessToken) {
      // Authenticated admin list — never cached
      const res = await fetch(API_BASE_URL + '/api/publications/admin/testimonials/', {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.results ?? [];
    }
    // Public testimonials: dedup + short TTL cache; mutations clear 'pub:testimonials'
    return await cachedGet(
      'pub:testimonials',
      async (revalidate) => {
        const res = await fetch(API_BASE_URL + '/api/publications/testimonials/', {
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Testimonials fetch failed: ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data) ? data : data.results ?? []) as AdminTestimonial[];
      },
      { ttlMs: 2_000, revalidate: 0 }
    );
  } catch {
    return [];
  }
}

export async function createAdminTestimonial(accessToken: string, payload: Partial<AdminTestimonial>): Promise<AdminTestimonial> {
  const res = await fetch(API_BASE_URL + '/api/publications/admin/testimonials/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  clearCache('pub:testimonials');
  return await res.json();
}

export async function updateAdminTestimonial(accessToken: string, id: number, payload: Partial<AdminTestimonial>): Promise<AdminTestimonial> {
  const res = await fetch(API_BASE_URL + '/api/publications/admin/testimonials/' + id + '/', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  clearCache('pub:testimonials');
  return await res.json();
}

export async function deleteAdminTestimonial(accessToken: string, id: number): Promise<void> {
  const res = await fetch(API_BASE_URL + '/api/publications/admin/testimonials/' + id + '/', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseCmsError(res));
  clearCache('pub:testimonials');
}

// ─── Public Fetchers for Homepage (Phase 8A) ──────────────────────────────────

export async function fetchPublicBooks(): Promise<AdminBook[]> {
  try {
    return await cachedGet(
      'pub:books:list:raw',
      async (revalidate) => {
        const res = await fetch(`${API_BASE_URL}/api/publications/books/`, {
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Books fetch failed: ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data) ? data : data.results ?? []) as AdminBook[];
      },
      { ttlMs: 2_000, revalidate: 0 }
    );
  } catch {
    return [];
  }
}

export async function fetchPublicJournals(): Promise<AdminJournal[]> {
  try {
    return await cachedGet(
      'pub:journals:list:raw',
      async (revalidate) => {
        const res = await fetch(`${API_BASE_URL}/api/publications/journals/`, {
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Journals fetch failed: ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data) ? data : data.results ?? []) as AdminJournal[];
      },
      { ttlMs: 2_000, revalidate: 0 }
    );
  } catch {
    return [];
  }
}

export async function fetchPublicSubmissions(accessToken?: string): Promise<AdminSubmission[]> {
  try {
    // /api/submissions/ is an authenticated endpoint (Phase 2/4 cache audit).
    // The landing-page stat counters call this without an explicit token, so
    // resolve the session token the same way AuthContext stores it — and skip
    // the request entirely when nobody is signed in instead of firing a call
    // that is guaranteed to 401 (the console error the Phase 4 browser audit
    // reproduced on every anonymous home-page load).
    const token =
      accessToken ||
      (typeof window !== 'undefined' ? window.sessionStorage.getItem('mmsr_v2_at') : null);
    if (!token) return [];
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const res = await fetch(`${API_BASE_URL}/api/submissions/`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results ?? [];
  } catch {
    return [];
  }
}

// ─── Site Metrics API ─────────────────────────────────────────────────────────

export interface SiteMetrics {
  id: number;
  books_count: string; books_label: string; books_sub: string;
  journals_count: string; journals_label: string; journals_sub: string;
  authors_count: string; authors_label: string; authors_sub: string;
  satisfaction_count: string; satisfaction_label: string; satisfaction_sub: string;
  partner_unis_count: string; partner_unis_label: string;
  countries_count: string; countries_label: string;
  certificates_count: string; certificates_label: string;
  articles_count: string; articles_label: string;
  conf_hosted_count?: string;
  conf_domains_count?: string;
  conf_papers_count?: string;
  conf_countries_count?: string;
  updated_at: string;
}

const DEFAULT_METRICS: SiteMetrics = {
  id: 1,
  books_count: '500+', books_label: 'Edited Books', books_sub: 'Assigned with ISBN & DOI',
  journals_count: '50+', journals_label: 'Peer-Reviewed Journals', journals_sub: 'Indexed & Open Access',
  authors_count: '10,000+', authors_label: 'Global Authors', authors_sub: 'Across 50+ Countries',
  satisfaction_count: '99.4%', satisfaction_label: 'Editorial Satisfaction', satisfaction_sub: 'Double-Blind Standards',
  partner_unis_count: '120+', partner_unis_label: 'Partner Universities',
  countries_count: '50+', countries_label: 'Countries Active',
  certificates_count: '15,000+', certificates_label: 'Digital Certificates Issued',
  articles_count: '500+', articles_label: 'Issues Published',
  conf_hosted_count: '25+',
  conf_domains_count: '10+',
  conf_papers_count: '2,000+',
  conf_countries_count: '40+',
  updated_at: new Date().toISOString(),
};

export async function fetchSiteMetrics(): Promise<SiteMetrics> {
  try {
    const data = await cachedGet(
      'pub:metrics',
      async (revalidate) => {
        const res = await fetch(`${API_BASE_URL}/api/publications/site-metrics/`, {
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Metrics fetch failed: ${res.status}`);
        return res.json();
      },
      { ttlMs: 60_000, revalidate: 300 }
    );
    const list = Array.isArray(data) ? data : data.results ?? [];
    if (list.length > 0) return { ...DEFAULT_METRICS, ...list[0] };
  } catch {
    // API offline
  }

  // The pre-fix code read a `mmsr_admin_site_metrics` localStorage copy here,
  // so numbers an operator had typed (and the server had never accepted) kept
  // showing on the public site (SECURITY-QA-REPORT L-5). Only the shipped
  // defaults remain as a fallback, and they are clearly static content.
  purgeLegacyCmsOverrides();
  return DEFAULT_METRICS;
}

export async function updateSiteMetrics(accessToken: string, patchData: Partial<SiteMetrics>): Promise<SiteMetrics> {
  // No silent local "merge and pretend it saved": the numbers are either on the
  // server or the caller gets an error they can act on.
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/publications/site-metrics/1/`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(patchData),
    });
  } catch {
    savePending('site_metrics', patchData, 'the API could not be reached');
    throw new Error('Cannot reach the MMSR API. The statistics were not saved.');
  }
  if (!res.ok) {
    const reason = await parseCmsError(res);
    savePending('site_metrics', patchData, reason);
    throw new Error(`The statistics were rejected (${reason}). Nothing was saved.`);
  }

  clearPending('site_metrics');
  clearCache('pub:metrics');
  try {
    return { ...DEFAULT_METRICS, ...(await res.json()) };
  } catch {
    // 204/empty body — re-read the authoritative row.
    return await fetchSiteMetrics();
  }
}

// ─── University Partners API ──────────────────────────────────────────────────

export interface UniversityPartner {
  id: number; name: string; location: string; partner_type: string;
  is_active: boolean; display_order: number; created_at?: string;
}

export async function fetchPublicUniversityPartners(): Promise<UniversityPartner[]> {
  try {
    return await cachedGet(
      'pub:partners',
      async (revalidate) => {
        const res = await fetch(`${API_BASE_URL}/api/publications/university-partners/`, {
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Partners fetch failed: ${res.status}`);
        const data = await res.json();
        return (Array.isArray(data) ? data : data.results ?? []) as UniversityPartner[];
      },
      { ttlMs: 60_000, revalidate: 300 }
    );
  } catch { return []; }
}

export async function fetchAdminUniversityPartners(accessToken: string): Promise<UniversityPartner[]> {
  const res = await fetch(`${API_BASE_URL}/api/publications/university-partners/`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createUniversityPartner(accessToken: string, data: Omit<UniversityPartner, 'id' | 'created_at'>): Promise<UniversityPartner> {
  const res = await fetch(`${API_BASE_URL}/api/publications/university-partners/`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  clearCache('pub:partners');
  return await res.json();
}

export async function updateUniversityPartner(accessToken: string, id: number, data: Partial<UniversityPartner>): Promise<UniversityPartner> {
  const res = await fetch(`${API_BASE_URL}/api/publications/university-partners/${id}/`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  clearCache('pub:partners');
  return await res.json();
}

export async function deleteUniversityPartner(accessToken: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/publications/university-partners/${id}/`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseCmsError(res));
  clearCache('pub:partners');
}

// ─── Newsletter API ───────────────────────────────────────────────────────────

export interface NewsletterSubscriber { id: number; email: string; subscribed_at: string; is_active: boolean; }
export interface NewsletterBroadcast { id: number; subject: string; message: string; is_sent: boolean; sent_at: string | null; recipients_count: number; created_at: string; }

export async function subscribeNewsletter(email: string, honeypot?: string): Promise<{ detail: string }> {
  const res = await fetch(`${API_BASE_URL}/api/publications/newsletter-subscribers/`, {
    method: 'POST',
    // The honeypot travels with the address so the endpoint's bot trap works
    // for scripted sign-ups (SECURITY-QA-REPORT M-4); humans always send ''.
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, website: honeypotValue(honeypot) }),
  });
  const data = await res.json();
  if (!res.ok && res.status !== 200) throw new Error(data.detail || 'Subscription failed.');
  return data;
}

export async function fetchNewsletterSubscribers(accessToken: string): Promise<NewsletterSubscriber[]> {
  const res = await fetch(`${API_BASE_URL}/api/publications/newsletter-subscribers/`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function fetchNewsletterBroadcasts(accessToken: string): Promise<NewsletterBroadcast[]> {
  const res = await fetch(`${API_BASE_URL}/api/publications/newsletter-broadcasts/`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createNewsletterBroadcast(accessToken: string, data: { subject: string; message: string }): Promise<NewsletterBroadcast> {
  const res = await fetch(`${API_BASE_URL}/api/publications/newsletter-broadcasts/`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}

export async function sendNewsletterBroadcast(accessToken: string, id: number): Promise<{ detail: string; recipients_count: number }> {
  const res = await fetch(`${API_BASE_URL}/api/publications/newsletter-broadcasts/${id}/send/`, {
    method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}


// ─── Chapter Admin API ─────────────────────────────────────────────────────────

export interface AdminChapterAuthor {
  id?: number;
  /** Standardized MMSR public ID (MMSR-CAU-1931-NNNNNN). */
  public_id?: string | null;
  name: string;
  affiliation?: string;
  designation?: string;
  bio?: string;
  photo?: string | null;
  created_at?: string;
}

export interface AdminChapterSection {
  id?: number;
  /** Standardized MMSR public ID (MMSR-SEC-1931-NNNNNN). */
  public_id?: string | null;
  display_order?: number;
  title: string;
  full_content?: string;
  preview_content?: string;
  status?: 'draft' | 'published' | 'archived';
}

export interface AdminChapter {
  id: number;
  /** Standardized MMSR public ID (MMSR-CHP-1931-NNNNNN). */
  public_id?: string | null;
  book: number;
  chapter_number: number;
  title: string;
  slug: string;
  description?: string;
  authors?: AdminChapterAuthor[];
  author_names_raw?: string;
  sections?: AdminChapterSection[];
  status: 'draft' | 'published' | 'archived';
  access_mode: 'paid' | 'open_access' | 'preview_only';
  sample_content?: string;
  file_pdf?: string | null;
  doi?: string;
  page_range?: string;
  publication_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchAdminChapters(accessToken: string, bookId?: number): Promise<AdminChapter[]> {
  const query = bookId ? `?book=${bookId}` : '';
  const url = API_BASE_URL + '/api/publications/admin/chapters/' + query;
  const res = await fetch(url, {
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createAdminChapter(accessToken: string, payload: Partial<AdminChapter>): Promise<AdminChapter> {
  const res = await fetch(API_BASE_URL + '/api/publications/admin/chapters/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  clearCache('pub:books');
  return await res.json();
}

export async function updateAdminChapter(accessToken: string, id: number, payload: Partial<AdminChapter>): Promise<AdminChapter> {
  const res = await fetch(API_BASE_URL + '/api/publications/admin/chapters/' + id + '/', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  clearCache('pub:books');
  clearCache('pub:journals:chapters');
  return await res.json();
}

// Multipart-only update for the chapter PDF (keeps the JSON save path untouched)
export async function uploadAdminChapterPdf(accessToken: string, id: number, file: File): Promise<AdminChapter> {
  const fd = new FormData();
  fd.append('file_pdf', file);
  const res = await fetch(API_BASE_URL + '/api/publications/admin/chapters/' + id + '/', {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + accessToken },
    body: fd,
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}

export async function deleteAdminChapter(accessToken: string, id: number): Promise<void> {
  const res = await fetch(API_BASE_URL + '/api/publications/admin/chapters/' + id + '/', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseCmsError(res));
  clearCache('pub:books');
}

export async function fetchChapterAuthors(accessToken: string): Promise<AdminChapterAuthor[]> {
  const res = await fetch(API_BASE_URL + '/api/publications/chapter-authors/', {
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createChapterAuthor(accessToken: string, payload: Partial<AdminChapterAuthor>): Promise<AdminChapterAuthor> {
  const res = await fetch(API_BASE_URL + '/api/publications/chapter-authors/', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}

// ─── Journal Articles Admin API ───────────────────────────────────────────────

export interface AdminArticle {
  id: number;
  /** Standardized MMSR public ID (MMSR-ART-1931-NNNNNN). */
  public_id?: string | null;
  journal: number | { id: number; title: string; slug: string };
  issue: number | null | { id: number; title: string };
  title: string;
  slug?: string;
  abstract?: string;
  authors?: Array<{ id: number; name: string; affiliation?: string | null }>;
  author_names_raw?: string | null;
  institution?: string | null;
  doi?: string | null;
  publication_date?: string | null;
  display_order?: number;
  status: 'draft' | 'published' | 'withdrawn';
  access_mode: 'paid' | 'open_access' | 'preview_only';
  file_pdf?: string | null;
  page_range?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function fetchAdminArticles(
  accessToken: string,
  params: { journal?: number | string; issue?: number | string; status?: string; access_mode?: string } = {}
): Promise<AdminArticle[]> {
  const qs = new URLSearchParams();
  if (params.journal) qs.set('journal', String(params.journal));
  if (params.issue) qs.set('issue', String(params.issue));
  if (params.status) qs.set('status', params.status);
  if (params.access_mode) qs.set('access_mode', params.access_mode);
  const query = qs.toString();
  const url = `${API_BASE_URL}/api/publications/articles/${query ? '?' + query : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function createAdminArticle(accessToken: string, formData: FormData): Promise<AdminArticle> {
  const res = await fetch(`${API_BASE_URL}/api/publications/articles/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}

export async function updateAdminArticle(accessToken: string, id: number, formData: FormData): Promise<AdminArticle> {
  const res = await fetch(`${API_BASE_URL}/api/publications/articles/${id}/`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}

export async function deleteAdminArticle(accessToken: string, id: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/publications/articles/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok && res.status !== 204) throw new Error(await parseCmsError(res));
}

// ─── Journal Access Admin API ─────────────────────────────────────────────────

export interface AdminJournalAccess {
  id: number;
  /** Standardized MMSR public ID (MMSR-JAC-1931-NNNNNN). */
  public_id?: string | null;
  user: number;
  // Resolved by the serializer so the audit table can name the account and its
  // MMSR reference without loading every user page.
  user_email?: string | null;
  user_public_id?: string | null;
  journal: number;
  journal_title?: string;
  journal_slug?: string;
  journal_public_id?: string | null;
  issue: number | null;
  issue_title?: string | null;
  issue_public_id?: string | null;
  article_public_id?: string | null;
  access_type: 'issue' | 'subscription' | 'manual_grant';
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  is_valid?: boolean;
  granted_at?: string;
  updated_at?: string;
}

export async function fetchAdminJournalAccess(
  accessToken: string,
  params: { journal?: number | string; access_type?: string; is_active?: boolean } = {}
): Promise<AdminJournalAccess[]> {
  const qs = new URLSearchParams();
  if (params.journal) qs.set('journal', String(params.journal));
  if (params.access_type) qs.set('access_type', params.access_type);
  if (params.is_active !== undefined) qs.set('is_active', params.is_active ? 'true' : 'false');
  const query = qs.toString();
  const url = `${API_BASE_URL}/api/publications/user-access/${query ? '?' + query : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function revokeJournalAccess(accessToken: string, id: number): Promise<AdminJournalAccess> {
  const res = await fetch(`${API_BASE_URL}/api/publications/user-access/${id}/`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: false }),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}

export async function grantJournalAccess(
  accessToken: string,
  payload: {
    user: number;
    journal: number;
    issue?: number | null;
    access_type: 'issue' | 'subscription' | 'manual_grant';
    start_date: string;
    end_date?: string | null;
  }
): Promise<AdminJournalAccess> {
  const body: Record<string, unknown> = {
    user: payload.user,
    journal: payload.journal,
    access_type: payload.access_type,
    start_date: payload.start_date,
    is_active: true,
  };
  if (payload.issue) body.issue = payload.issue;
  if (payload.end_date) body.end_date = payload.end_date;
  const res = await fetch(`${API_BASE_URL}/api/publications/user-access/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseCmsError(res));
  return await res.json();
}
