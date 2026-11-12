// ─── MMSR V2 — Submission Service ─────────────────────────────────────────────
// Connects to Django REST API: POST/GET /api/submissions/
// All requests use Bearer JWT from AuthContext — no fake IDs, no mock data.

const getApiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmissionPayload {
  submission_type: string;       // 'journal' | 'chapter' | 'conference'
  title: string;
  abstract: string;
  category?: string;
  keywords: string;
  research_domain: string;
  journal?: string;
  conference?: string;
  volume_title?: string;
}

export interface SubmissionResult {
  id: number;
  /** Standardized MMSR public ID (MMSR-SUB-1931-NNNNNN). */
  public_id?: string | null;
  title: string;
  submission_type: string;
  submission_type_display?: string;
  status: string;
  status_display?: string;
  submitted_at?: string;
  updated_at?: string;
  volume_title?: string | null;
  certificate_issued?: boolean;
  certificate_file?: string | null;
  journal?: string | null;
  conference?: string | null;
  research_domain?: string | null;
  keywords?: string | null;
  doi?: string | null;
  abstract?: string | null;
  author_name?: string | null;
  author_email?: string | null;
  manuscript_file?: string | null;
  uploaded_files?: Array<{
    id?: number;
    file_name?: string;
    file_url?: string;
    file_type?: string;
    uploaded_at?: string;
  }> | null;
  editorial_notes?: string | Array<{ id?: number; author?: string; note?: string; text?: string; created_at?: string }> | null;
  version?: string | number | null;
  volume?: string | number | null;
  issue?: string | number | null;
  category?: string | null;
}

export interface SubmissionListResult {
  submissions: SubmissionResult[];
  count: number;
}

export interface SubmissionCreateResult {
  success: true;
  data: SubmissionResult;
}

// ─── Error Parser (DRF style) ─────────────────────────────────────────────────

export function parseDrfErrors(
  body: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};

  if (typeof body.detail === 'string') {
    result._general = body.detail;
    return result;
  }

  if (typeof body.non_field_errors === 'object' && Array.isArray(body.non_field_errors)) {
    result._general = body.non_field_errors.join(' ');
  }

  for (const [key, val] of Object.entries(body)) {
    if (key === 'non_field_errors') continue;
    if (Array.isArray(val)) {
      result[key] = (val as string[]).join(' ');
    } else if (typeof val === 'string') {
      result[key] = val;
    }
  }

  return result;
}

// ─── POST /api/submissions/ — Create a new submission ─────────────────────────

export async function createSubmission(
  payload: SubmissionPayload,
  manuscriptFile: File,
  supplementaryFiles: File[],
  accessToken: string
): Promise<SubmissionCreateResult> {
  const apiBase = getApiBase();

  const formData = new FormData();

  // Required fields
  formData.append('submission_type', payload.submission_type);
  formData.append('title', payload.title);
  formData.append('abstract', payload.abstract);
  formData.append('keywords', payload.keywords);
  formData.append('research_domain', payload.research_domain);

  // Optional fields — only if provided
  if (payload.category) formData.append('category', payload.category);
  if (payload.journal) formData.append('journal', payload.journal);
  if (payload.conference) formData.append('conference', payload.conference);
  if (payload.volume_title) formData.append('volume_title', payload.volume_title);

  // Files
  formData.append('manuscript_file', manuscriptFile);
  supplementaryFiles.forEach((f) => formData.append('uploaded_files[]', f));

  const res = await fetch(`${apiBase}/api/submissions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Do NOT set Content-Type — browser sets multipart boundary automatically
    },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const fieldErrors = parseDrfErrors(body as Record<string, unknown>);
    const message =
      fieldErrors._general || `Submission failed (HTTP ${res.status})`;
    const err = new Error(message) as Error & { fieldErrors?: Record<string, string> };
    err.fieldErrors = fieldErrors;
    throw err;
  }

  return { success: true, data: body as SubmissionResult };
}

// ─── GET /api/submissions/ — List user's submissions ─────────────────────────

export async function fetchUserSubmissions(
  accessToken: string
): Promise<SubmissionListResult> {
  const apiBase = getApiBase();

  const res = await fetch(`${apiBase}/api/submissions/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as any)?.detail || (body as any)?.error || `Error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Failed to fetch submissions.');
  }

  const body = await res.json();
  const list: SubmissionResult[] = Array.isArray(body) ? body : body.results ?? [];

  return { submissions: list, count: list.length };
}

// ─── GET /api/submissions/{id}/ — Fetch single submission ────────────────────

export async function fetchSubmissionById(
  id: string | number,
  accessToken: string
): Promise<SubmissionResult> {
  const apiBase = getApiBase();

  const res = await fetch(`${apiBase}/api/submissions/${id}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    throw Object.assign(new Error('Submission not found.'), { status: 404 });
  }
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('Unauthorized'), { status: res.status });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as any)?.detail || `Error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Failed to load submission.');
  }

  return res.json();
}

// ─── Conference Submissions — GET /api/conference-submissions/ ────────────────
// Separate endpoint (dedicated ConferenceSubmission model). Books/Journals
// submissions above are untouched.

export interface ConferenceSubmissionAuthorResult {
  id: number;
  full_name: string;
  email?: string | null;
  institution?: string | null;
  department?: string | null;
  designation?: string | null;
  country?: string | null;
  order: number;
  is_corresponding: boolean;
}

export interface ConferenceSubmissionResult {
  id: number;
  /** Standardized MMSR public ID (MMSR-CPS-1931-NNNNNN). */
  public_id?: string | null;
  reference_number?: string | null;
  title: string;
  subtitle?: string | null;
  abstract?: string | null;
  keywords?: string | null;
  paper_type?: string | null;
  paper_type_display?: string | null;
  research_domain?: string | null;
  language?: string | null;
  selected_track?: string | null;
  presentation_mode?: string | null;
  session_preference?: string | null;
  registration_category?: string | null;
  proceedings_preference?: string | null;
  gst_invoice_required?: boolean;
  author_full_name?: string | null;
  author_email?: string | null;
  author_phone?: string | null;
  institution?: string | null;
  department?: string | null;
  designation?: string | null;
  country?: string | null;
  conference: number;
  conference_title?: string | null;
  conference_acronym?: string | null;
  conference_slug?: string | null;
  authors?: ConferenceSubmissionAuthorResult[];
  status: string;
  status_display?: string | null;
  declarations?: Record<string, boolean> | null;
  // Submission fee snapshot + Razorpay payment trail + invoice availability
  submission_fee?: number | string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  has_invoice?: boolean;
  admin_notes?: string | null;
  decision_notes?: string | null;
  submitted_at?: string;
  updated_at?: string;
}

export interface ConferenceSubmissionListResult {
  submissions: ConferenceSubmissionResult[];
  count: number;
}

// GET /api/conference-submissions/ — list the requester's own submissions
export async function fetchUserConferenceSubmissions(
  accessToken: string
): Promise<ConferenceSubmissionListResult> {
  const apiBase = getApiBase();

  const res = await fetch(`${apiBase}/api/conference-submissions/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as any)?.detail || (body as any)?.error || `Error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Failed to fetch conference submissions.');
  }

  const body = await res.json();
  const list: ConferenceSubmissionResult[] = Array.isArray(body) ? body : body.results ?? [];

  return { submissions: list, count: list.length };
}

// GET /api/conference-submissions/{id}/ — single submission (owner or staff only)
export async function fetchConferenceSubmissionDetail(
  id: string | number,
  accessToken: string
): Promise<ConferenceSubmissionResult> {
  const apiBase = getApiBase();

  const res = await fetch(`${apiBase}/api/conference-submissions/${id}/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) {
    throw Object.assign(new Error('Conference submission not found.'), { status: 404 });
  }
  if (res.status === 401 || res.status === 403) {
    throw Object.assign(new Error('Unauthorized'), { status: res.status });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as any)?.detail || `Error ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : 'Failed to load conference submission.');
  }

  return res.json();
}

// GET /api/conference-submissions/{id}/manuscript/ — authorized blob download.
// The manuscript is stored in protected media; it is never a public URL.
export async function downloadConferenceManuscript(
  id: string | number,
  accessToken: string
): Promise<void> {
  const apiBase = getApiBase();

  const res = await fetch(`${apiBase}/api/conference-submissions/${id}/manuscript/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    let msg = `Download failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') msg = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1]?.trim() || `conference-submission-${id}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
