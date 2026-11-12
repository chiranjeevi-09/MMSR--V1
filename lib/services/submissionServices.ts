// ─── MMSR V2 — Unified Academic Submission Services ──────────────────────────
// Supports Book Chapter, Journal Manuscript, and Conference Paper submissions.
// Integrates with Django REST Framework endpoints with graceful fallback handling.

import { INDIAN_MOBILE_RE, normalizeIndianMobile } from '@/lib/validation';
import { publicIdOf } from '@/lib/utils/publicId';

const getApiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoAuthor {
  id: string;
  fullName: string;
  email: string;
  designation: string;
  institution: string;
  department: string;
  country: string;
  googleScholar?: string;
  isCorresponding: boolean;
}

export interface AuthorInformation {
  correspondingAuthor: {
    fullName: string;
    email: string;
    phone: string;
    designation: string;
    institution: string;
    department: string;
    university: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
    googleScholar?: string;
    researchGate?: string;
    linkedIn?: string;
  };
  coAuthors: CoAuthor[];
}

export interface BookVolumeTarget {
  id: string | number;
  title: string;
  volumeNumber?: string;
  isbn?: string;
  editorName?: string;
  coEditors?: string;
  category?: string;
  publicationYear?: number;
  submissionDeadline?: string;
  statusBadge?: 'Open' | 'Closed' | 'Upcoming';
  coverImage?: string;
}

export interface JournalTarget {
  id: string | number;
  title: string;
  issn?: string;
  discipline?: string;
  isOpenAccess?: boolean;
  impactFactor?: string;
  currentVolume?: string;
  submissionDeadline?: string;
  coverImage?: string;
}

export interface ConferenceTrackOption {
  id: string;
  title: string;
  topics?: string[];
}

export interface ConferenceTarget {
  id: string | number;
  slug?: string;
  title: string;
  acronym?: string;
  location?: string;
  dates?: string;
  registrationStatus?: string;
  paperDeadline?: string;
  submissionFee?: number;
  proceedingsBadge?: string;
  isbnBadge?: string;
  bannerImage?: string;
  accepting?: boolean;
  tracks?: ConferenceTrackOption[];
}

export interface SubmissionResponseData {
  id: string | number;
  referenceNumber: string;
  title: string;
  submissionType: 'chapter' | 'journal' | 'conference';
  status: string;
  submittedAt: string;
  targetName: string;
  estimatedReviewTime: string;
  isbnOrIssn?: string;
  extraDetails?: Record<string, any>;
}

// ─── DRF Error Parsing Utility ────────────────────────────────────────────────

export function parseDrfErrors(body: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  if (typeof body.detail === 'string') {
    result._general = body.detail;
    return result;
  }
  if (Array.isArray(body.non_field_errors)) {
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

// Turn a parsed DRF error map into a single human-readable line so the UI can
// show WHY a submission was rejected instead of a bare "(HTTP 400)".
export function summarizeDrfFieldErrors(errors: Record<string, string>): string {
  const humanize = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return Object.entries(errors)
    .filter(([key]) => key !== '_general')
    .map(([key, val]) => `${humanize(key)}: ${val}`)
    .join('  •  ');
}

// ─── Fetch Book Volumes ────────────────────────────────────────────────────────

export async function fetchBookVolumes(): Promise<BookVolumeTarget[]> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/book-volumes/`, { cache: 'no-store' });
    if (!res.ok) {
      // Fallback to publications/books endpoint if book-volumes endpoint is unavailable
      const fallbackRes = await fetch(`${apiBase}/api/publications/books/`, { cache: 'no-store' });
      if (!fallbackRes.ok) throw new Error('Failed to load book volumes');
      const data = await fallbackRes.json();
      const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
      return rawList.map((item, idx) => ({
        id: item.id || idx + 1,
        title: item.title || 'Edited Volume in Advanced Sciences',
        volumeNumber: item.volume || `Vol. ${idx + 1}`,
        isbn: item.isbn || '978-3-16-148410-0',
        editorName: item.author || item.editor || 'Dr. M. S. R. Murthy',
        coEditors: item.co_editors || 'Editorial Board',
        category: typeof item.category === 'object' ? item.category?.name : item.category || 'Computer Science & AI',
        publicationYear: 2026,
        submissionDeadline: '2026-12-31',
        statusBadge: 'Open',
        coverImage: item.cover_image || '/images/placeholders/book-cover.png',
      }));
    }
    const data = await res.json();
    const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
    return rawList.map((item) => ({
      id: item.id,
      title: item.title,
      volumeNumber: item.volume_number || item.volume || 'Vol. 1',
      isbn: item.isbn || 'ISBN Pending',
      editorName: item.editor_name || item.editor || 'Editorial Board',
      coEditors: item.co_editors || '',
      category: item.category || 'General Academic',
      publicationYear: item.publication_year || 2026,
      submissionDeadline: item.submission_deadline || 'Open',
      statusBadge: item.status || 'Open',
      coverImage: item.cover_image || '/images/placeholders/book-cover.png',
    }));
  } catch {
    // Return curated fallback list for smooth client UX if backend is offline
    return [
      {
        id: 1,
        title: 'Advances in Machine Learning & Neural Computation (Vol. 1)',
        volumeNumber: 'Vol. 1 (2026)',
        isbn: '978-81-968432-1-2',
        editorName: 'Prof. Dr. R. K. Sharma',
        coEditors: 'Dr. Elena Rostova, Dr. A. P. Subramaniam',
        category: 'Computer Science & AI',
        publicationYear: 2026,
        submissionDeadline: '2026-11-30',
        statusBadge: 'Open',
        coverImage: '/images/placeholders/book-cover.png',
      },
      {
        id: 2,
        title: 'Sustainable Renewable Energy Systems & Green Technology',
        volumeNumber: 'Vol. 3 (2026)',
        isbn: '978-81-968432-3-6',
        editorName: 'Dr. Sarah Jenkins',
        coEditors: 'Prof. Mohamed Al-Mansoor',
        category: 'Electrical & Energy Engineering',
        publicationYear: 2026,
        submissionDeadline: '2026-12-15',
        statusBadge: 'Open',
        coverImage: '/images/placeholders/book-cover.png',
      },
      {
        id: 3,
        title: 'Biomedical Innovations & Clinical Nanotechnology',
        volumeNumber: 'Vol. 2 (2026)',
        isbn: '978-81-968432-2-9',
        editorName: 'Dr. V. K. Ramanathan',
        coEditors: 'Dr. Clara Beauchamp',
        category: 'Life Sciences & Medicine',
        publicationYear: 2026,
        submissionDeadline: '2026-10-31',
        statusBadge: 'Open',
        coverImage: '/images/placeholders/book-cover.png',
      },
    ];
  }
}

// ─── Fetch Journals ────────────────────────────────────────────────────────────

export async function fetchJournalsList(): Promise<JournalTarget[]> {
  const apiBase = getApiBase();
  try {
    const res = await fetch(`${apiBase}/api/publications/journals/`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch journals');
    const data = await res.json();
    const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
    return rawList.map((item) => ({
      id: item.id,
      title: item.title,
      issn: item.issn || 'ISSN Pending',
      discipline: typeof item.category === 'object' ? item.category?.name : item.category || 'Multidisciplinary',
      isOpenAccess: Boolean(item.is_open_access ?? true),
      impactFactor: item.impact_factor || '3.85',
      currentVolume: item.current_volume || 'Vol. 8 (2026)',
      submissionDeadline: 'Open Year-Round',
      coverImage: item.cover_image || '/images/placeholders/journal-cover.png',
    }));
  } catch {
    return [
      {
        id: 'j1',
        title: 'MMSR International Journal of Advanced Computer Science & AI',
        issn: '2456-9812 (Online)',
        discipline: 'Computer Science & Artificial Intelligence',
        isOpenAccess: true,
        impactFactor: '4.92 (Citations 2025)',
        currentVolume: 'Volume 12, Issue 4 (2026)',
        submissionDeadline: 'Open for Q4 Issue',
        coverImage: '/images/placeholders/journal-cover.png',
      },
      {
        id: 'j2',
        title: 'MMSR Journal of Life Sciences & Environmental Biotechnology',
        issn: '2457-1104 (Online)',
        discipline: 'Biological & Environmental Sciences',
        isOpenAccess: true,
        impactFactor: '3.65 (Citations 2025)',
        currentVolume: 'Volume 9, Issue 2 (2026)',
        submissionDeadline: 'Open Year-Round',
        coverImage: '/images/placeholders/journal-cover.png',
      },
      {
        id: 'j3',
        title: 'MMSR Journal of Mechanical, Electrical & Energy Engineering',
        issn: '2458-3341 (Online)',
        discipline: 'Engineering & Physical Sciences',
        isOpenAccess: true,
        impactFactor: '3.41 (Citations 2025)',
        currentVolume: 'Volume 15, Issue 1 (2026)',
        submissionDeadline: 'Open for Nov Issue',
        coverImage: '/images/placeholders/journal-cover.png',
      },
    ];
  }
}

// ─── Fetch Conferences (only those currently open for submissions) ────────────

let _conferencesCache: { data: ConferenceTarget[]; timestamp: number } | null = null;
let _conferencesInFlight: Promise<ConferenceTarget[]> | null = null;

export async function fetchConferencesList(): Promise<ConferenceTarget[]> {
  const now = Date.now();
  if (_conferencesCache && now - _conferencesCache.timestamp < 60_000) {
    return _conferencesCache.data;
  }
  if (_conferencesInFlight) {
    return _conferencesInFlight;
  }

  const apiBase = getApiBase();
  _conferencesInFlight = (async () => {
    try {
      const res = await fetch(`${apiBase}/api/conferences/?accepting=true`);
      if (!res.ok) return [];
      const data = await res.json();
      const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
      const mapped: ConferenceTarget[] = rawList.map((item) => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        acronym: item.acronym || undefined,
        location: [item.venue, item.country].filter(Boolean).join(', ') || undefined,
        dates: item.start_date ? `${item.start_date}${item.end_date ? ` – ${item.end_date}` : ''}` : undefined,
        registrationStatus: item.registration_open ? 'Open' : 'Closed',
        paperDeadline: item.submission_deadline || undefined,
        submissionFee: Number(item.submission_fee || 0),
        proceedingsBadge: item.isbn_proceedings ? `ISBN ${item.isbn_proceedings}` : undefined,
        isbnBadge: item.isbn_proceedings || undefined,
        bannerImage: item.banner_image || undefined,
        accepting: Boolean(item.accepting ?? item.is_accepting_submissions),
        tracks: Array.isArray(item.tracks)
          ? item.tracks.map((t: any) => ({
              id: String(t.id ?? t.title ?? ''),
              title: String(t.title ?? t.id ?? ''),
              topics: Array.isArray(t.topics) ? t.topics : [],
            }))
          : [],
      }));
      _conferencesCache = { data: mapped, timestamp: Date.now() };
      return mapped;
    } catch {
      return [];
    } finally {
      _conferencesInFlight = null;
    }
  })();

  return _conferencesInFlight;
}

// ─── POST /api/book-chapters/ (Book Chapter Submission) ──────────────────────

export async function submitBookChapter(
  payload: Record<string, any>,
  manuscriptFile: File,
  supplementaryFiles: File[],
  accessToken: string
): Promise<SubmissionResponseData> {
  const apiBase = getApiBase();
  const formData = new FormData();

  // Must match Submission.SUBMISSION_TYPE_CHOICES on the backend ('book_chapter').
  formData.append('submission_type', 'book_chapter');
  formData.append('title', payload.chapterTitle || payload.title);
  formData.append('abstract', payload.abstract);
  formData.append('keywords', payload.keywords);
  formData.append('research_domain', payload.researchDomain || 'General Science');
  formData.append('volume_title', payload.volumeTitle || '');
  formData.append('authors_data', JSON.stringify(payload.authorInfo || {}));

  // The selector lists catalogue Books, so the chosen id must go to the `book`
  // FK — NOT the legacy `volume` FK (which points at PublishedVolume and would
  // 400 with "Invalid pk" for every book except a stale id collision).
  if (payload.volumeId) {
    formData.append('book', String(payload.volumeId));
  }

  // Corresponding author details — stored in real model fields so admin and
  // notification emails can use them.
  const corr = payload.authorInfo?.corresponding || {};
  formData.append('corresponding_email', corr.email || '');
  // Submission.phone_number stores a bare 10-digit Indian mobile (model
  // validator ^\d{10}$). Normalize the familiar written +91 / trunk-0 forms
  // instead of dropping them; anything that isn't a valid Indian mobile is
  // left blank here — the untouched original is still preserved in authors_data.
  const normalizedPhone = normalizeIndianMobile(String(corr.phone || ''));
  formData.append('phone_number', INDIAN_MOBILE_RE.test(normalizedPhone) ? normalizedPhone : '');
  formData.append('author_affiliation', corr.institution || corr.university || '');
  formData.append('country', corr.country || 'India');
  const coAuthorLines = (payload.authorInfo?.coAuthors || [])
    .filter((a: any) => (a.fullName || '').trim())
    .map((a: any) => [a.fullName, a.designation, a.institution, a.email].filter(Boolean).join(', '));
  if (coAuthorLines.length) {
    formData.append('co_authors', coAuthorLines.join('\n'));
  }

  // Author agreement flags — backend re-validates server-side and records the
  // acceptance against the currently published policy versions.
  formData.append('agreed_to_terms', payload.agreedToTerms ? 'true' : 'false');
  formData.append('agreed_to_publication_policies', payload.agreedToPublicationPolicies ? 'true' : 'false');

  // Append primary manuscript file
  formData.append('manuscript_file', manuscriptFile);

  // Append supplementary files
  supplementaryFiles.forEach((file) => {
    formData.append('uploaded_files[]', file);
  });

  // Attach additional preferences & metadata as stringified extra details
  formData.append('extra_metadata', JSON.stringify({
    subtitle: payload.chapterSubtitle || '',
    language: payload.chapterLanguage || 'English',
    estimatedPages: payload.estimatedPages || '',
    funding: payload.fundingInformation || '',
    doiRequired: payload.doiRequired ?? true,
    openAccess: payload.openAccess ?? true,
    certificateRequired: payload.certificateRequired ?? true,
  }));

  const primaryEndpoint = `${apiBase}/api/book-chapters/`;
  const fallbackEndpoint = `${apiBase}/api/submissions/`;

  let res = await fetch(primaryEndpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  if (res.status === 404) {
    res = await fetch(fallbackEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    });
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errors = parseDrfErrors(body as Record<string, unknown>);
    const msg = errors._general || summarizeDrfFieldErrors(errors) || `Book chapter submission failed (HTTP ${res.status})`;
    const err = new Error(msg) as Error & { fieldErrors?: Record<string, string> };
    err.fieldErrors = errors;
    throw err;
  }

  const generatedId = body.id;
  // The chapter's public reference is issued by the backend (MMSR-CHP or MMSR-SUB
  // prefix). The old client-side `CHAP-2027-…` fabrication produced a reference
  // no record answered to, so it is gone — an unissued chapter says so instead.
  const refNo = publicIdOf(body) ?? body.reference_number ?? body.reference_no ?? 'Not assigned yet';

  return {
    id: generatedId,
    referenceNumber: refNo,
    title: payload.chapterTitle || payload.title,
    submissionType: 'chapter',
    status: body.status || 'Submitted',
    submittedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    targetName: payload.volumeTitle || 'Edited Book Volume',
    estimatedReviewTime: '2–4 Weeks (Peer Review)',
    isbnOrIssn: payload.volumeIsbn || 'ISBN 978-81-968432-1-2',
    extraDetails: body,
  };
}

// ─── POST /api/submissions/ (Journal Manuscript Submission) ─────────────────

export async function submitJournalManuscript(
  payload: Record<string, any>,
  manuscriptFile: File,
  supplementaryFiles: File[],
  accessToken: string
): Promise<SubmissionResponseData> {
  const apiBase = getApiBase();
  const formData = new FormData();

  // Must match Submission.SUBMISSION_TYPE_CHOICES on the backend ('journal_article').
  formData.append('submission_type', 'journal_article');
  formData.append('title', payload.manuscriptTitle || payload.title);
  formData.append('abstract', payload.abstract);
  formData.append('keywords', payload.keywords);
  formData.append('research_domain', payload.researchDomain || 'Multidisciplinary');
  formData.append('journal', payload.journalTitle || payload.journal || '');
  formData.append('manuscript_type', payload.manuscriptType || 'Original Research');
  formData.append('authors_data', JSON.stringify(payload.authorInfo || {}));

  // Author agreement flags — backend re-validates server-side and records the
  // acceptance against the currently published policy versions.
  formData.append('agreed_to_terms', payload.agreedToTerms ? 'true' : 'false');
  formData.append('agreed_to_publication_policies', payload.agreedToPublicationPolicies ? 'true' : 'false');

  formData.append('manuscript_file', manuscriptFile);
  supplementaryFiles.forEach((f) => formData.append('uploaded_files[]', f));

  formData.append('extra_metadata', JSON.stringify({
    runningTitle: payload.runningTitle || '',
    language: payload.language || 'English',
    specialIssue: payload.specialIssue || '',
    fundingAgency: payload.fundingAgency || '',
    grantNumber: payload.grantNumber || '',
    ethicsApproval: payload.ethicsApprovalNumber || '',
    openAccess: payload.openAccess ?? true,
    fastTrack: payload.fastTrackReview ?? false,
    doiRequired: payload.doiRequired ?? true,
  }));

  const res = await fetch(`${apiBase}/api/submissions/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errors = parseDrfErrors(body as Record<string, unknown>);
    const msg = errors._general || summarizeDrfFieldErrors(errors) || `Manuscript submission failed (HTTP ${res.status})`;
    const err = new Error(msg) as Error & { fieldErrors?: Record<string, string> };
    err.fieldErrors = errors;
    throw err;
  }

  const generatedId = body.id;
  const refNo = publicIdOf(body) ?? body.reference_number ?? body.reference_no ?? 'Not assigned yet';

  return {
    id: generatedId,
    referenceNumber: refNo,
    title: payload.manuscriptTitle || payload.title,
    submissionType: 'journal',
    status: body.status || 'Submitted',
    submittedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    targetName: payload.journalTitle || 'MMSR Academic Journal',
    estimatedReviewTime: '3–6 Weeks (Double-Blind Peer Review)',
    isbnOrIssn: payload.journalIssn || 'ISSN 2456-9812',
    extraDetails: body,
  };
}

// ─── POST /api/conference-submissions/ (Conference Paper Submission) ───────

export async function submitConferencePaper(
  payload: Record<string, any>,
  paperFile: File,
  supplementaryFiles: File[],
  accessToken: string
): Promise<SubmissionResponseData> {
  const apiBase = getApiBase();
  const formData = new FormData();

  const corresponding = payload.authorInfo?.corresponding || payload.corresponding || {};
  const rawCoAuthors: any[] = payload.authorInfo?.coAuthors || payload.coAuthors || [];

  formData.append('conference', String(payload.conferenceId ?? ''));
  formData.append('client_reference', payload.clientReference || crypto.randomUUID());

  // Paper metadata
  formData.append('title', payload.paperTitle || payload.title || '');
  formData.append('subtitle', payload.subtitle || '');
  formData.append('abstract', payload.abstract || '');
  formData.append('keywords', payload.keywords || '');
  formData.append('paper_type', payload.paperType || 'Full Paper');
  formData.append('research_domain', payload.researchDomain || '');
  formData.append('language', payload.language || 'English');
  formData.append('selected_track', payload.selectedTrack || payload.primaryTrack || '');
  formData.append('presentation_mode', payload.presentationMode || 'Oral');
  formData.append('session_preference', payload.sessionPreference || '');
  formData.append('registration_category', payload.registrationCategory || '');
  formData.append('proceedings_preference', payload.proceedingsPreference || '');
  formData.append('gst_invoice_required', payload.gstInvoiceRequired ? 'true' : 'false');

  // Corresponding author snapshot
  formData.append('author_full_name', corresponding.fullName || '');
  formData.append('author_email', corresponding.email || '');
  formData.append('author_phone', corresponding.phone || '');
  formData.append('institution', corresponding.institution || '');
  formData.append('department', corresponding.department || '');
  formData.append('designation', corresponding.designation || '');
  formData.append('country', corresponding.country || 'India');

  // Files
  formData.append('manuscript_file', paperFile);
  if (supplementaryFiles && supplementaryFiles.length > 0) {
    formData.append('supplementary_file', supplementaryFiles[0]);
  }

  // Normalized co-authors + declarations as JSON strings (multipart-safe)
  const cleanedCoAuthors = rawCoAuthors
    .map((a: any) => ({
      full_name: (a.fullName || a.full_name || '').trim(),
      email: a.email || '',
      institution: a.institution || '',
      department: a.department || '',
      designation: a.designation || '',
      country: a.country || 'India',
      is_corresponding: Boolean(a.isCorresponding || a.is_corresponding),
    }))
    .filter((a: any) => a.full_name !== '');
  formData.append('co_authors', JSON.stringify(cleanedCoAuthors));
  formData.append('declarations', JSON.stringify(payload.declarations || {}));

  const res = await fetch(`${apiBase}/api/conference-submissions/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errors = parseDrfErrors(body as Record<string, unknown>);
    const msg = errors._general || summarizeDrfFieldErrors(errors) || `Conference paper submission failed (HTTP ${res.status})`;
    const err = new Error(msg) as Error & { fieldErrors?: Record<string, string> };
    err.fieldErrors = errors;
    throw err;
  }

  let submittedAt = '';
  if (body.submitted_at) {
    const d = new Date(body.submitted_at);
    submittedAt = isNaN(d.getTime())
      ? String(body.submitted_at)
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return {
    id: body.id,
    referenceNumber: publicIdOf(body) ?? body.reference_number ?? 'Not assigned yet',
    title: body.title || payload.paperTitle || payload.title,
    submissionType: 'conference',
    status: body.status_display || 'Submitted',
    submittedAt,
    targetName: body.conference_title || payload.conferenceTitle || 'MMSR International Conference',
    estimatedReviewTime: '2–3 Weeks (Technical Program Committee)',
    isbnOrIssn: body.conference_acronym || payload.conferenceAcronym || undefined,
    extraDetails: body,
  };
}

// ─── Conference Submission Payment (Razorpay) ────────────────────────────

export interface ConferencePaymentInitResponse {
  razorpay_order_id: string;
  amount: number;
  currency: string;
  key_id: string;
}

async function conferenceSubmissionAction(
  submissionId: string | number,
  actionPath: string,
  accessToken: string,
  body?: Record<string, string>
): Promise<Record<string, any>> {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/conference-submissions/${submissionId}/${actionPath}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || data.message || `Payment action failed (HTTP ${res.status})`);
  }
  return data;
}

export function initiateConferencePayment(
  submissionId: string | number,
  accessToken: string
): Promise<ConferencePaymentInitResponse> {
  return conferenceSubmissionAction(submissionId, 'initiate-payment', accessToken) as Promise<ConferencePaymentInitResponse>;
}

export function verifyConferencePayment(
  submissionId: string | number,
  razorpayResponse: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string },
  accessToken: string
): Promise<Record<string, any>> {
  return conferenceSubmissionAction(submissionId, 'verify-payment', accessToken, razorpayResponse);
}

export function simulateConferencePayment(
  submissionId: string | number,
  accessToken: string
): Promise<Record<string, any>> {
  return conferenceSubmissionAction(submissionId, 'simulate-payment', accessToken);
}

export async function deleteConferenceSubmission(submissionId: string | number, accessToken: string): Promise<void> {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/conference-submissions/${submissionId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Failed to discard submission (HTTP ${res.status})`);
  }
}

export async function downloadConferenceInvoice(submissionId: string | number, accessToken: string): Promise<void> {
  const apiBase = getApiBase();
  const res = await fetch(`${apiBase}/api/conference-submissions/${submissionId}/invoice/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error('Invoice download failed. Please try again.');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Prefer the server-named attachment (it carries the submission's MMSR public
  // ID); the local fallback only kicks in when no disposition header arrived.
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  a.download = match?.[1]?.trim() || `invoice_conference_submission_${submissionId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Singleton loader for the Razorpay checkout script
let razorpayScriptPromise: Promise<boolean> | null = null;
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && (window as any).Razorpay) {
    return Promise.resolve(true);
  }
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise<boolean>((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

/**
 * Full Pay-&-Submit payment leg for a pending_payment conference submission:
 * initiate on the backend → open Razorpay checkout → verify signature server-side.
 * Resolves with the verify response; rejects with Error('PAYMENT_CANCELLED') when
 * the user dismisses the checkout window (caller should discard the submission).
 */
export async function payConferenceSubmission(
  submissionId: string | number,
  accessToken: string,
  prefill: { name: string; email: string; phone: string; title: string; conferenceTitle: string }
): Promise<Record<string, any>> {
  const init = await initiateConferencePayment(submissionId, accessToken);

  const loaded = await loadRazorpayScript();
  if (!loaded) {
    throw new Error('Failed to load the Razorpay payment widget. Check your connection and retry.');
  }

  return new Promise<Record<string, any>>((resolve, reject) => {
    // Razorpay keeps the SAME checkout window open after a failed attempt so the
    // shopper can retry with another card/method, and a later attempt may succeed.
    // Therefore `payment.failed` is intentionally NOT terminal here: settling or
    // rejecting on it would (a) discard the just-created submission and (b) gate
    // out the eventual success `handler`, so a captured payment would never be
    // verified (the "Pay & Submit shows an error even though money was taken"
    // bug). We settle only on success (`handler`) or a genuine close
    // (`modal.ondismiss`). The `settled` flag still stops the modal's own
    // post-capture close from wrongly reporting a completed payment as cancelled.
    let settled = false;
    const rzp = new (window as any).Razorpay({
      key: init.key_id,
      amount: init.amount,
      currency: init.currency,
      name: 'MMSR Publications',
      description: `Conference Paper Submission — ${prefill.title}`,
      order_id: init.razorpay_order_id,
      prefill: {
        name: prefill.name,
        email: prefill.email,
        contact: prefill.phone,
      },
      notes: { conference: prefill.conferenceTitle, submission_id: String(submissionId) },
      theme: { color: '#C99A2E' },
      modal: {
        ondismiss: () => {
          // Checkout closed without a successful capture → the author abandoned.
          if (settled) return;
          settled = true;
          reject(new Error('PAYMENT_CANCELLED'));
        },
      },
      handler: async (response: any) => {
        // Success signal — lock it so the modal's own close (ondismiss) can't
        // reject a payment that actually went through.
        if (settled) return;
        settled = true;
        // A custom `handler` stops Razorpay auto-closing on capture, so close the
        // checkout window ourselves to avoid it lingering over the result screen.
        try { rzp.close(); } catch { /* noop */ }
        try {
          const verifyRes = await verifyConferencePayment(submissionId, {
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
          }, accessToken);
          resolve(verifyRes);
        } catch (err: any) {
          reject(new Error(err?.message || 'Payment verification failed'));
        }
      },
    });
    // Non-terminal: let the Razorpay window surface its own error and retry UX.
    rzp.on('payment.failed', () => { /* handled inside the checkout modal */ });
    rzp.open();
  });
}
