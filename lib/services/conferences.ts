import { cachedGet, clearCache } from '../utils/microCache';
/**
 * MMSR Publications V2 — Conference Service
 *
 * Connected directly to Django REST API endpoints:
 * GET /api/conferences/
 * GET /api/conferences/{slug}/
 */

import {
  Conference,
  ConferenceFilterOptions,
  ConferencesResponse,
  ConferenceMode,
  ConferenceStatus,
  RegistrationStatus,
} from '../types/conference';

export const CONFERENCE_DOMAINS = [
  'All Domains',
  'Engineering & Technology',
  'Life Sciences & Environment',
  'Management & Data Science',
  'Physics & Nanotechnology',
  'Computer Science & AI',
  'Medical & Health Sciences',
  'Social Sciences & Humanities',
  'Multidisciplinary',
];

export const CONFERENCE_YEARS = [2024, 2025, 2026, 2027];

function formatHumanDate(startDate?: string, endDate?: string): string {
  if (!startDate) return '';
  try {
    const s = new Date(startDate);
    if (isNaN(s.getTime())) return startDate;
    const startMonthStr = s.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    if (!endDate || endDate === startDate) return `${startMonthStr}, ${s.getFullYear()}`;
    const e = new Date(endDate);
    if (isNaN(e.getTime())) return `${startMonthStr}, ${s.getFullYear()}`;
    const endDayStr = e.getDate();
    return `${startMonthStr}–${endDayStr}, ${e.getFullYear()}`;
  } catch {
    return startDate;
  }
}

export function transformBackendConference(raw: any): Conference {
  if (!raw) return {} as Conference;

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const formatMediaUrl = (url?: string | null): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const id = raw.id ? String(raw.id) : raw.slug || 'conf';
  const slug = raw.slug || String(raw.id) || id;
  const title = raw.title || raw.name || 'Untitled Conference';
  const acronym = raw.acronym || raw.short_title || raw.shortTitle || '';
  const shortTitle = acronym || title;
  const description = raw.description || raw.abstract || '';
  const fullDescription = raw.full_description || raw.fullDescription || raw.about || description;
  const startDate = raw.start_date || raw.startDate || raw.date || '';
  const endDate = raw.end_date || raw.endDate || startDate;
  const humanDate = raw.date || formatHumanDate(startDate, endDate);

  const venue = raw.venue || raw.address || '';
  const country = raw.country || 'International';
  const location = raw.location || (venue && country ? `${venue}, ${country}` : venue || country);

  let mode: ConferenceMode = 'Hybrid';
  if (raw.mode) {
    const m = String(raw.mode).toLowerCase();
    if (m.includes('online') || m.includes('virtual')) mode = 'Online';
    else if (m.includes('offline') || m.includes('in-person') || m.includes('in person')) mode = 'Offline';
    else mode = 'Hybrid';
  } else if (raw.is_online) mode = 'Online';
  else if (raw.is_hybrid) mode = 'Hybrid';
  else if (raw.is_offline) mode = 'Offline';

  let status: ConferenceStatus = 'Upcoming';
  if (raw.status) {
    const st = String(raw.status).toLowerCase();
    if (st.includes('ongoing')) status = 'Ongoing';
    else if (st.includes('past') || st.includes('completed')) status = 'Completed';
    else if (st.includes('cancelled')) status = 'Cancelled';
    else status = 'Upcoming';
  } else {
    const now = new Date();
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (end && now > end) status = 'Completed';
    else if (start && end && now >= start && now <= end) status = 'Ongoing';
    else status = 'Upcoming';
  }

  const domain = raw.domain || raw.category_name || (typeof raw.category === 'object' ? raw.category?.name : raw.category) || 'Multidisciplinary';
  const domains = Array.isArray(raw.domains)
    ? raw.domains
    : Array.isArray(raw.categories)
    ? raw.categories.map((c: any) => typeof c === 'string' ? c : c.name)
    : [domain];

  const submissionDeadline = raw.submission_deadline || raw.submissionDeadline || raw.paper_deadline || '';
  const registrationDeadline = raw.registration_deadline || raw.registrationDeadline || '';
  const registrationOpen = typeof raw.registration_open === 'boolean'
    ? raw.registration_open
    : raw.registration_status === 'Open' || status === 'Upcoming';

  let registrationStatus: RegistrationStatus = 'Closed';
  if (raw.registration_status) {
    registrationStatus = raw.registration_status as RegistrationStatus;
  } else if (registrationOpen) {
    registrationStatus = 'Open';
  }

  // Whether papers can currently be submitted. The backend exposes an `accepting`
  // boolean (is_accepting_submissions AND deadline not passed). Fall back to a
  // client-side deadline check when the flag isn't present (e.g. stored/local data).
  let submissionOpen: boolean;
  if (typeof raw.accepting === 'boolean') {
    submissionOpen = raw.accepting;
  } else if (raw.is_accepting_submissions === false) {
    submissionOpen = false;
  } else if (submissionDeadline) {
    const dl = new Date(submissionDeadline);
    if (isNaN(dl.getTime())) {
      submissionOpen = true;
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dl.setHours(0, 0, 0, 0);
      submissionOpen = dl >= today;
    }
  } else {
    submissionOpen = true;
  }
  const submissionStatus: 'Open' | 'Closed' = submissionOpen ? 'Open' : 'Closed';

  const organizer = raw.organizer || raw.organization || 'MMSR Publications';
  const organizerWebsite = raw.organizer_website || raw.organizerWebsite;
  const proceedings = raw.proceedings || raw.proceedings_title;
  const proceedingsAvailable = typeof raw.proceedings_available === 'boolean'
    ? raw.proceedings_available
    : Boolean(raw.proceedings_file || raw.proceedingsFile);

  const registrationFee = typeof raw.registration_fee === 'object'
    ? raw.registration_fee
    : typeof raw.registrationFee === 'object'
    ? raw.registrationFee
    : raw.fee
    ? { regular: String(raw.fee) }
    : undefined;

  const importantDates = Array.isArray(raw.important_dates)
    ? raw.important_dates.map((d: any) => ({
        label: d.label || d.title || 'Date',
        date: d.date || d.deadline || '',
        isPast: typeof d.is_past === 'boolean' ? d.is_past : d.date ? new Date(d.date) < new Date() : false,
        isHighlighted: Boolean(d.is_highlighted || d.highlighted),
      }))
    : Array.isArray(raw.importantDates)
    ? raw.importantDates
    : [];

  const tracks = Array.isArray(raw.tracks)
    ? raw.tracks.map((t: any, idx: number) => ({
        id: t.id ? String(t.id) : `tr-${idx}`,
        title: t.title || t.name || 'Track',
        description: t.description || '',
        topics: Array.isArray(t.topics) ? t.topics : typeof t.topics === 'string' ? t.topics.split(',').map((s: string) => s.trim()) : [],
      }))
    : [];

  const speakers = Array.isArray(raw.speakers)
    ? raw.speakers.map((sp: any, idx: number) => ({
        id: sp.id ? String(sp.id) : `sp-${idx}`,
        name: sp.name || 'Speaker',
        title: sp.title || sp.designation || '',
        institution: sp.institution || sp.organization || '',
        country: sp.country || '',
        topic: sp.topic || sp.keynote_topic || '',
        photo: formatMediaUrl(sp.photo || sp.image),
        bio: sp.bio || '',
      }))
    : [];

  const committee = Array.isArray(raw.committee)
    ? raw.committee.map((cm: any, idx: number) => ({
        id: cm.id ? String(cm.id) : `cm-${idx}`,
        name: cm.name || 'Committee Member',
        role: cm.role || cm.designation || 'Member',
        institution: cm.institution || cm.organization || '',
        country: cm.country || '',
      }))
    : [];

  const schedule = Array.isArray(raw.schedule)
    ? raw.schedule.map((day: any) => ({
        day: day.day || day.title || 'Day',
        date: day.date || '',
        items: Array.isArray(day.items)
          ? day.items.map((item: any) => ({
              time: item.time || '',
              title: item.title || '',
              speaker: item.speaker || '',
              type: item.type || 'Paper Presentation',
            }))
          : [],
      }))
    : [];

  const faqs = Array.isArray(raw.faqs)
    ? raw.faqs.map((f: any, idx: number) => ({
        id: f.id ? String(f.id) : `fq-${idx}`,
        question: f.question || '',
        answer: f.answer || '',
      }))
    : Array.isArray(raw.faq)
    ? raw.faq.map((f: any, idx: number) => ({
        id: f.id ? String(f.id) : `fq-${idx}`,
        question: f.question || '',
        answer: f.answer || '',
      }))
    : [];

  return {
    id,
    slug,
    title,
    acronym,
    shortTitle,
    description,
    fullDescription,
    date: humanDate,
    startDate,
    endDate,
    publicationDate: raw.publication_date || raw.publicationDate,
    submissionDeadline,
    registrationDeadline,
    location,
    venue,
    country,
    mode,
    domain,
    category: raw.category?.name || (typeof raw.category === 'string' ? raw.category : domain),
    domains,
    registrationStatus,
    registrationOpen,
    submissionOpen,
    submissionStatus,
    status,
    organizer,
    organizerWebsite,
    proceedings,
    proceedingsAvailable,
    proceedingsFile: formatMediaUrl(raw.proceedings_file || raw.proceedingsFile),
    brochureFile: formatMediaUrl(raw.brochure || raw.brochure_file || raw.brochureFile),
    doiPrefix: raw.doi_prefix || raw.doiPrefix,
    isbnProceedings: raw.isbn_proceedings || raw.isbnProceedings,
    callForPapers: raw.call_for_papers || raw.callForPapers,
    submissionGuidelines: raw.submission_guidelines || raw.submissionGuidelines,
    registrationFee,
    importantDates,
    tracks,
    speakers,
    committee,
    schedule,
    faqs,
    coverImage: formatMediaUrl(raw.cover_image_webp || raw.cover_image || raw.coverImage || raw.image),
    coverImageWebp: formatMediaUrl(raw.cover_image_webp),
    banner: formatMediaUrl(raw.banner_image_webp || raw.banner || raw.banner_image || raw.bannerImage),
    bannerWebp: formatMediaUrl(raw.banner_image_webp),
    bannerColor: raw.banner_color || raw.bannerColor,
  };
}

// SECURITY-QA-REPORT L-5: the fabricated `INITIAL_CONFERENCES_DATA` demo rows
// (ICAI/ICEST/ICAMS with invented ISBNs, DOIs and venues) and the
// `mmsr_admin_conferences` localStorage mirror used to be served whenever the
// API returned nothing — so visitors could read conferences that do not exist in
// the database, and an operator could "delete" or "publish" a conference purely
// client-side. The conference list is server data or nothing at all now.

// ─── Admin CRUD against the live backend (requires staff JWT) ─────────────────

function apiBaseForConf(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
}

function authHeaders(token?: string): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Build a JSON payload for POST/PATCH /api/conferences/ from the admin form data. */
function toConferenceApiPayload(conf: any): Record<string, any> {
  return {
    title: conf.title,
    acronym: conf.acronym || '',
    description: conf.description || '',
    full_description: conf.full_description || conf.description || '',
    start_date: conf.start_date || null,
    end_date: conf.end_date || null,
    venue: conf.venue || '',
    country: conf.country || '',
    mode: conf.mode || 'Hybrid',
    domain: conf.domain || 'Multidisciplinary',
    status: conf.status || 'Upcoming',
    organizer: conf.organizer || 'MMSR Publications',
    submission_deadline: conf.submission_deadline || null,
    registration_deadline: conf.registration_deadline || null,
    registration_open: conf.registration_open ?? true,
    is_accepting_submissions: conf.is_accepting_submissions ?? true,
    doi_prefix: conf.doi_prefix || '',
    isbn_proceedings: conf.isbn_proceedings || '',
    submission_guidelines: conf.submission_guidelines || '',
    call_for_papers: conf.call_for_papers || '',
    tracks: Array.isArray(conf.tracks) ? conf.tracks : [],
    important_dates: Array.isArray(conf.important_dates) ? conf.important_dates : [],
  };
}

export async function adminCreateConference(conf: any, token: string): Promise<any> {
  const res = await fetch(`${apiBaseForConf()}/api/conferences/`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(toConferenceApiPayload(conf)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.detail || body?.non_field_errors?.[0] || `Failed to create conference (HTTP ${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : 'Failed to create conference.');
  }
  return body;
}

export async function adminUpdateConference(id: number | string, conf: any, token: string): Promise<any> {
  const res = await fetch(`${apiBaseForConf()}/api/conferences/${id}/`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(toConferenceApiPayload(conf)),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.detail || `Failed to update conference (HTTP ${res.status})`;
    throw new Error(typeof msg === 'string' ? msg : 'Failed to update conference.');
  }
  return body;
}

export async function adminDeleteConference(id: number | string, token: string): Promise<void> {
  const res = await fetch(`${apiBaseForConf()}/api/conferences/${id}/`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (res.status === 204 || res.ok) return;
  const body = await res.json().catch(() => ({}));
  const msg = body?.detail || `Failed to delete conference (HTTP ${res.status})`;
  throw new Error(typeof msg === 'string' ? msg : 'Failed to delete conference.');
}

/**
 * Fetch all conferences from backend GET /api/conferences/
 */
export async function fetchConferences(
  options: ConferenceFilterOptions = {}
): Promise<ConferencesResponse> {
  const {
    search = '',
    status = 'all',
    mode = 'all',
    domain,
    country,
    year = 'all',
    registrationOpen,
    sortBy = 'date_desc',
    page = 1,
    limit = 12,
  } = options;

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  let rawItems: any[] = [];

  try {
    rawItems = await cachedGet('pub:conferences:raw', async () => {
      const res = await fetch(`${apiBase}/api/conferences/`, {
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.results || data.conferences || [];
      } else {
        const resPub = await fetch(`${apiBase}/api/publications/conferences/`, {
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (resPub.ok) {
          const dataPub = await resPub.json();
          return Array.isArray(dataPub) ? dataPub : dataPub.results || dataPub.conferences || [];
        }
      }
      return [];
    }, { ttlMs: 2_000, revalidate: 0 });
  } catch {
    rawItems = [];
  }

  // No local backfill (SECURITY-QA-REPORT L-5): an unreachable API or an empty
  // table renders as empty. Fabricated demo conferences must never be published
  // to visitors as if they were real events.

  let transformed = rawItems.map(transformBackendConference);

  // Client-side filtering & sorting fallback to guarantee search, filters, sorting & pagination work seamlessly
  if (search.trim()) {
    const q = search.toLowerCase();
    transformed = transformed.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.acronym && c.acronym.toLowerCase().includes(q)) ||
        c.shortTitle.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.organizer.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.domains.some((d) => d.toLowerCase().includes(q))
    );
  }

  if (status && status !== 'all') {
    transformed = transformed.filter(
      (c) => c.status.toLowerCase() === status.toLowerCase()
    );
  }

  if (mode && mode !== 'all') {
    transformed = transformed.filter(
      (c) => c.mode.toLowerCase() === mode.toLowerCase()
    );
  }

  if (domain && domain !== 'All Domains') {
    transformed = transformed.filter(
      (c) => c.domain === domain || c.domains.includes(domain) || c.category === domain
    );
  }

  if (country) {
    transformed = transformed.filter(
      (c) => c.country.toLowerCase().includes(country.toLowerCase())
    );
  }

  if (year && year !== 'all') {
    const yrNum = Number(year);
    transformed = transformed.filter(
      (c) => (c.startDate ? new Date(c.startDate).getFullYear() === yrNum : false)
    );
  }

  if (registrationOpen === true) {
    transformed = transformed.filter(
      (c) => c.registrationOpen === true || c.registrationStatus === 'Open'
    );
  }

  switch (sortBy) {
    case 'date_asc':
      transformed.sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
      break;
    case 'upcoming_deadline':
      transformed.sort((a, b) => new Date(a.submissionDeadline || 0).getTime() - new Date(b.submissionDeadline || 0).getTime());
      break;
    case 'title_asc':
      transformed.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'year_desc':
      transformed.sort((a, b) => new Date(b.startDate || 0).getFullYear() - new Date(a.startDate || 0).getFullYear());
      break;
    case 'newest':
    case 'date_desc':
    default:
      transformed.sort((a, b) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime());
      break;
  }

  const total = transformed.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIndex = (page - 1) * limit;
  const paginated = transformed.slice(startIndex, startIndex + limit);

  return { conferences: paginated, total, page, totalPages };
}

/**
 * Fetch a single conference by slug from GET /api/conferences/{slug}/
 */
export async function fetchConferenceBySlug(slug: string): Promise<Conference | null> {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  try {
    const res = await fetch(`${apiBase}/api/conferences/${slug}/`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = await res.json();
      return transformBackendConference(data);
    }
  } catch (err) {
    console.warn(`Error fetching conference by slug '${slug}':`, err);
  }

  // Fallback check: fetch all conferences and find matching slug or ID
  const allRes = await fetchConferences({ limit: 100 });
  const found = allRes.conferences.find((c) => c.slug === slug || c.id === slug);
  return found || null;
}

export async function fetchConferenceDomains(): Promise<string[]> {
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

  try {
    return await cachedGet('pub:conferences:domains', async () => {
      const res = await fetch(`${apiBase}/api/publications/categories/`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const rawList: any[] = Array.isArray(data) ? data : data.results ?? [];
        const confCats = rawList.filter((c: any) => !c.category_type || c.category_type === 'conferences' || c.category_type === 'all');
        if (confCats.length > 0) {
          return ['All Domains', ...confCats.map((c: any) => c.name)];
        }
      }
      return CONFERENCE_DOMAINS;
    }, { ttlMs: 60_000, revalidate: 60 });
  } catch (err) {
    console.warn('Error fetching dynamic conference domains:', err);
  }

  return CONFERENCE_DOMAINS;
}
