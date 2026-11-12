/**
 * MMSR Publications V2 — Contact Service
 *
 * Contact enquiries are stored server-side in the Django
 * `publications.ContactInquiry` model and served from
 * /api/publications/contact-inquiries/. The public form POSTs new enquiries
 * (AllowAny); the admin desk lists/updates them with a staff bearer token.
 */

import {
  ContactInfo,
  ContactFormData,
  ContactSubmissionResult,
  ContactFAQ,
  ContactSubmission,
} from '../types/contact';
import { displayReference } from '@/lib/utils/publicId';
import { honeypotValue } from '@/lib/utils/spamGuard';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export const CONTACT_INFO: ContactInfo[] = [
  {
    id: 'ci-1',
    title: 'General Enquiries',
    description: 'For general information about MMSR Publications and our catalogue.',
    email: 'info@mmsr-publications.example',
    icon: 'Mail',
    responseTime: 'Within 2–3 business days',
  },
  {
    id: 'ci-2',
    title: 'Editorial Enquiries',
    description: 'For questions related to manuscript submissions, review status, or editorial decisions.',
    email: 'editorial@mmsr-publications.example',
    icon: 'Edit3',
    responseTime: 'Within 2 business days',
  },
  {
    id: 'ci-3',
    title: 'Author Support',
    description: 'Technical assistance for authors navigating our submission and publication systems.',
    email: 'authorsupport@mmsr-publications.example',
    icon: 'UserCheck',
    responseTime: 'Within 1–2 business days',
  },
  {
    id: 'ci-4',
    title: 'Publishing Enquiries',
    description: 'For institutions, departments, or first-time authors exploring publishing services.',
    email: 'publishing@mmsr-publications.example',
    icon: 'BookOpen',
    responseTime: 'Within 2–3 business days',
  },
  {
    id: 'ci-5',
    title: 'Conference Enquiries',
    description: 'For conference proceedings publication, partnerships, and academic event collaboration.',
    email: 'conference@mmsr-publications.example',
    icon: 'Presentation',
    responseTime: 'Within 2 business days',
  },
];

export const CONTACT_FAQS: ContactFAQ[] = [
  {
    id: 'cf-1',
    question: 'How do I submit a manuscript for publication?',
    answer: 'Visit our publishing services page and select the appropriate publication type (Book, Book Chapter, Journal Article, or Conference Paper). You can contact our editorial team directly via the editorial enquiries address to begin the submission process.',
    category: 'Editorial Enquiry',
    pageTarget: 'Contact',
  },
  {
    id: 'cf-2',
    question: 'What is the typical response time for editorial enquiries?',
    answer: 'Our editorial team aims to respond to all enquiries within 2 business days. Complex review status queries may take slightly longer depending on the stage of your manuscript.',
    category: 'Editorial Enquiry',
    pageTarget: 'Contact',
  },
  {
    id: 'cf-3',
    question: 'How can I check the status of my submitted manuscript?',
    answer: 'Once your submission is registered, you will receive an acknowledgement email with a reference number. Use this reference number when enquiring about your submission status with our author support team.',
    category: 'Author Support',
    pageTarget: 'Contact',
  },
  {
    id: 'cf-4',
    question: 'Can institutions partner with MMSR for publishing services?',
    answer: 'Yes. MMSR welcomes institutional partnerships for bulk publishing, conference proceedings, and research publication support programmes. Contact our publishing enquiries team to discuss institutional arrangements.',
    category: 'Publishing Enquiry',
    pageTarget: 'Publishing Services',
  },
  {
    id: 'cf-5',
    question: 'How do I organize a conference with MMSR Publications?',
    answer: 'Conference organizers interested in MMSR proceedings publication should contact our conference enquiries team at least 4–6 months before the event date to allow sufficient time for editorial planning.',
    category: 'Conference Enquiry',
    pageTarget: 'Publishing Services',
  },
  {
    id: 'cf-6',
    question: 'Is there support available for international authors?',
    answer: 'Yes. MMSR Publications supports international authors globally. All communications are conducted in English, and our editorial team is experienced in working with authors from diverse academic backgrounds.',
    category: 'General Enquiry',
    pageTarget: 'Contact',
  },
];

const STORAGE_KEY_DEPARTMENTS = 'mmsr_dynamic_contact_departments';
const STORAGE_KEY_FAQS = 'mmsr_dynamic_contact_faqs';

export function getContactDepartments(): ContactInfo[] {
  if (typeof window === 'undefined') return CONTACT_INFO;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEPARTMENTS);
    if (!raw) return CONTACT_INFO;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : CONTACT_INFO;
  } catch {
    return CONTACT_INFO;
  }
}

export function saveContactDepartments(departments: ContactInfo[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_DEPARTMENTS, JSON.stringify(departments));
}

// FAQs can only target one of two pages. Legacy/stale records may still carry
// other values (e.g. 'Conferences', 'General'); remap them so the admin list,
// filters, and the public pages only ever use Contact or Publishing Services.
const ALLOWED_FAQ_PAGES = new Set(['Contact', 'Publishing Services']);

function normalizeFaqPageTarget(value?: string): string {
  if (!value) return 'Contact';
  if (ALLOWED_FAQ_PAGES.has(value)) return value;
  const v = value.toLowerCase();
  // Conference/publishing-related FAQs belong on the Publishing Services page.
  if (v.includes('conference') || v.includes('publish')) return 'Publishing Services';
  // Everything else (General and unknown targets) falls back to the Contact page.
  return 'Contact';
}

export function getContactFAQs(): ContactFAQ[] {
  if (typeof window === 'undefined') return CONTACT_FAQS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FAQS);
    if (!raw) return CONTACT_FAQS;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) && parsed.length > 0 ? parsed : CONTACT_FAQS;
    // Normalize target pages, persisting the cleaned set only when it changes.
    let changed = false;
    const normalized = list.map((f: ContactFAQ) => {
      const pageTarget = normalizeFaqPageTarget(f.pageTarget);
      if (pageTarget !== f.pageTarget) {
        changed = true;
        return { ...f, pageTarget };
      }
      return f;
    });
    if (changed) localStorage.setItem(STORAGE_KEY_FAQS, JSON.stringify(normalized));
    return normalized;
  } catch {
    return CONTACT_FAQS;
  }
}

export function saveContactFAQs(faqs: ContactFAQ[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_FAQS, JSON.stringify(faqs));
}

// ─── Contact Submissions Management (server-backed) ──────────────────────────

// Raw shape returned by the DRF ContactInquirySerializer (fields='__all__').
interface ContactInquiryApi {
  id: number;
  /** Standardized MMSR public ID (MMSR-ENQ-1931-NNNNNN). */
  public_id?: string | null;
  reference_number?: string;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  inquiry_type: string;
  subject: string;
  message: string;
  status: ContactSubmission['status'];
  admin_reply?: string;
  admin_notes?: string;
  replied_at?: string | null;
  is_resolved?: boolean;
  created_at: string;
}

function mapContactInquiry(raw: ContactInquiryApi): ContactSubmission {
  return {
    id: String(raw.id),
    // Public ID first; historical rows still carry their legacy MMSR-ENQ-…
    // reference_number and stay readable. Never derived from the PK.
    referenceId: displayReference(raw, raw.reference_number),
    fullName: raw.name,
    email: raw.email,
    organization: raw.organization || undefined,
    subject: raw.subject,
    enquiryType: raw.inquiry_type as ContactSubmission['enquiryType'],
    message: raw.message,
    status: raw.status || 'New',
    createdAt: raw.created_at,
    adminNotes: raw.admin_notes || undefined,
    adminReply: raw.admin_reply || undefined,
    repliedAt: raw.replied_at || undefined,
  };
}

export async function fetchContactSubmissions(accessToken: string): Promise<ContactSubmission[]> {
  const res = await fetch(`${API_BASE_URL}/api/publications/contact-inquiries/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to load enquiries (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const rows: ContactInquiryApi[] = Array.isArray(data) ? data : data.results ?? [];
  return rows.map(mapContactInquiry);
}

export async function updateContactSubmission(
  accessToken: string,
  id: string,
  payload: {
    status?: ContactSubmission['status'];
    adminReply?: string;
    adminNotes?: string;
  }
): Promise<ContactSubmission> {
  const body: Record<string, unknown> = {};
  if (payload.status !== undefined) {
    body.status = payload.status;
    // Stamp a reply time when the enquiry moves to a responded state.
    if (payload.status === 'Replied' || payload.status === 'Resolved') {
      body.replied_at = new Date().toISOString();
    }
  }
  if (payload.adminReply !== undefined) body.admin_reply = payload.adminReply;
  if (payload.adminNotes !== undefined) body.admin_notes = payload.adminNotes;

  const res = await fetch(`${API_BASE_URL}/api/publications/contact-inquiries/${id}/`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.detail || err?.status?.[0] || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`Failed to update enquiry: ${detail}`);
  }

  return mapContactInquiry(await res.json());
}

export async function submitContactForm(
  data: ContactFormData
): Promise<ContactSubmissionResult> {
  if (!data.email || !data.fullName || !data.message) {
    return {
      success: false,
      message: 'Please fill in all required fields.',
    };
  }

  const payload = {
    name: data.fullName.trim(),
    email: data.email.trim(),
    organization: data.organization?.trim() || '',
    inquiry_type: data.enquiryType,
    subject: data.subject.trim(),
    message: data.message.trim(),
    // Bot trap (SECURITY-QA-REPORT M-4): empty for every human submission.
    // The serializer ignores unknown fields, so this is invisible to the model
    // and only inspected by core.spam_guard.is_automated().
    website: honeypotValue(data.honeypot),
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/publications/contact-inquiries/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = 'Something went wrong. Please try again later.';
      try {
        const err = await res.json();
        const firstFieldErr = Object.values(err).find((v) => typeof v === 'string') as string | undefined;
        const firstArrErr = Object.values(err).find((v) => Array.isArray(v)) as string[] | undefined;
        detail = err?.detail || firstFieldErr || firstArrErr?.[0] || detail;
      } catch {
        /* non-JSON error body */
      }
      return { success: false, message: detail };
    }

    const created: ContactInquiryApi = await res.json();
    const referenceId = displayReference(created, created.reference_number);

    return {
      success: true,
      message:
        'Thank you for contacting MMSR Publications. Your enquiry has been received and our team will respond within 2–3 business days.',
      referenceId,
    };
  } catch {
    return {
      success: false,
      message: 'Network error. Please check your connection and try again.',
    };
  }
}
