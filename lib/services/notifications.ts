import { displayReference, routeIdOf } from '@/lib/utils/publicId';

export type NotificationCategory =
  | 'manuscript_submitted'
  | 'editorial_screening'
  | 'under_review'
  | 'revision_requested'
  | 'accepted'
  | 'published'
  | 'order_paid'
  | 'order_delivered'
  | 'invoice_generated';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  category: NotificationCategory;
  isRead: boolean;
  linkUrl?: string;
  linkText?: string;
  relatedId?: string | number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'submission_received',
    name: 'Submission Received',
    category: 'Manuscript Acknowledgement',
    subject: 'Acknowledge Submission: {{paper_title}} (Ref: {{submission_id}})',
    body: `Dear {{author_name}},

Thank you for submitting your manuscript titled "{{paper_title}}" to MMSR Publications.

Your submission has been assigned reference ID: {{submission_id}}. It has passed preliminary checks and is currently undergoing initial editorial screening.

You can monitor the real-time status of your manuscript, reviewer communications, and decision letters via your MMSR Author Dashboard.

Best regards,
Editorial Office
MMSR Publications`,
  },
  {
    id: 'under_review',
    name: 'Under Review',
    category: 'Peer Review',
    subject: 'Manuscript Status Update: Under Review (Ref: {{submission_id}})',
    body: `Dear {{author_name}},

We are pleased to inform you that your manuscript "{{paper_title}}" (Ref: {{submission_id}}) has successfully passed initial screening and has been sent for expert peer review.

Our domain section editors have assigned peer reviewers. We will notify you as soon as review evaluations and recommendations are finalized.

Warm regards,
Peer Review Operations
MMSR Publications`,
  },
  {
    id: 'revision_requested',
    name: 'Revision Requested',
    category: 'Peer Review Decision',
    subject: 'Decision on {{submission_id}}: Revisions Required',
    body: `Dear {{author_name}},

The peer review process for your manuscript "{{paper_title}}" (Ref: {{submission_id}}) is complete.

The reviewers have recommended that minor/major revisions are required prior to final acceptance consideration. Please inspect the detailed referee comments in your author portal and submit your revised manuscript along with a point-by-point response letter.

Sincerely,
Managing Editor
MMSR Publications`,
  },
  {
    id: 'accepted',
    name: 'Accepted',
    category: 'Editorial Decision',
    subject: 'Acceptance Notification: {{paper_title}} (Ref: {{submission_id}})',
    body: `Dear {{author_name}},

Congratulations! We are delighted to inform you that your manuscript "{{paper_title}}" (Ref: {{submission_id}}) has been formally accepted for publication by MMSR Publications.

Our copyediting and production team will prepare the final proofs for your review. Detailed galey proofing instructions and licensing information will follow shortly.

Heartiest congratulations,
Executive Managing Editor
MMSR Publications`,
  },
  {
    id: 'rejected',
    name: 'Rejected',
    category: 'Editorial Decision',
    subject: 'Editorial Decision on {{submission_id}}',
    body: `Dear {{author_name}},

Thank you for submitting your manuscript "{{paper_title}}" (Ref: {{submission_id}}) to MMSR Publications.

After careful review by the editorial board, we regret to inform you that we are unable to accept your manuscript for publication in this journal. We receive many high-quality manuscripts and must make selective decisions based on scope, novelty, and reviewer feedback.

We wish you every success in placing your work elsewhere.

Sincerely,
Editorial Board
MMSR Publications`,
  },
  {
    id: 'published',
    name: 'Published',
    category: 'Publication Notice',
    subject: 'Official Publication Notice: {{paper_title}} (Ref: {{submission_id}})',
    body: `Dear {{author_name}},

We are thrilled to announce that your article "{{paper_title}}" (Ref: {{submission_id}}) is now officially published online at MMSR Publications!

Your article has been assigned a permanent digital identifier (DOI) and is fully indexed in open-access scientific repositories. You can view, download, and share your published article directly from our catalogue.

Thank you for publishing with MMSR.

Warm regards,
Production & Indexing Team
MMSR Publications`,
  },
];

const NOTIFICATIONS_STORAGE_KEY = 'mmsr_v2_notifications_read_state';

export function getReadNotificationIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNotificationAsRead(id: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const existing = getReadNotificationIds();
    if (!existing.includes(id)) {
      const updated = [...existing, id];
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    }
    return existing;
  } catch {
    return [];
  }
}

export function markAllNotificationsAsRead(allIds: string[]): string[] {
  if (typeof window === 'undefined') return allIds;
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(allIds));
    return allIds;
  } catch {
    return allIds;
  }
}

export function generateUserNotifications(
  submissions: any[] = [],
  orders: any[] = []
): NotificationItem[] {
  const readIds = getReadNotificationIds();

  const generated: NotificationItem[] = [];

  // Generate from submissions
  submissions.forEach((sub) => {
    const titleText = sub.title || 'Untitled Manuscript';
    // Public reference only — the old `SUB-${sub.id}` form leaked the internal
    // primary key into a customer-facing message.
    const subIdStr = displayReference(sub, sub.submission_reference);
    const dateStr = sub.updated_at || sub.submitted_at || new Date().toISOString();

    if (sub.status === 'pending') {
      generated.push({
        id: `notif-sub-${sub.id}-submitted`,
        title: 'Manuscript Submitted Successfully',
        message: `Your paper "${titleText}" (${subIdStr}) has been received and is queued for screening.`,
        timestamp: dateStr,
        category: 'manuscript_submitted',
        isRead: readIds.includes(`notif-sub-${sub.id}-submitted`),
        linkUrl: `/dashboard/submissions/${routeIdOf(sub)}`,
        linkText: 'View Submission',
        relatedId: sub.id,
      });
    } else if (sub.status === 'editorial_screening') {
      generated.push({
        id: `notif-sub-${sub.id}-screening`,
        title: 'Editorial Screening in Progress',
        message: `An associate editor has been assigned to conduct initial screening for "${titleText}".`,
        timestamp: dateStr,
        category: 'editorial_screening',
        isRead: readIds.includes(`notif-sub-${sub.id}-screening`),
        linkUrl: `/dashboard/submissions/${routeIdOf(sub)}`,
        linkText: 'Track Status',
        relatedId: sub.id,
      });
    } else if (sub.status === 'under_review') {
      generated.push({
        id: `notif-sub-${sub.id}-review`,
        title: 'Manuscript Under Peer Review',
        message: `Referees have accepted the review invitation for "${titleText}" (${subIdStr}).`,
        timestamp: dateStr,
        category: 'under_review',
        isRead: readIds.includes(`notif-sub-${sub.id}-review`),
        linkUrl: `/dashboard/submissions/${routeIdOf(sub)}`,
        linkText: 'Review Details',
        relatedId: sub.id,
      });
    } else if (sub.status === 'revision_requested' || sub.status === 'revision_required') {
      generated.push({
        id: `notif-sub-${sub.id}-revision`,
        title: 'Revision Requested by Editors',
        message: `Reviewer feedback is available for "${titleText}". Please submit your revised draft.`,
        timestamp: dateStr,
        category: 'revision_requested',
        isRead: readIds.includes(`notif-sub-${sub.id}-revision`),
        linkUrl: `/dashboard/submissions/${routeIdOf(sub)}`,
        linkText: 'Upload Revision',
        relatedId: sub.id,
      });
    } else if (sub.status === 'accepted') {
      generated.push({
        id: `notif-sub-${sub.id}-accepted`,
        title: 'Manuscript Formally Accepted!',
        message: `Congratulations! "${titleText}" (${subIdStr}) has been accepted for publication.`,
        timestamp: dateStr,
        category: 'accepted',
        isRead: readIds.includes(`notif-sub-${sub.id}-accepted`),
        linkUrl: `/dashboard/submissions/${routeIdOf(sub)}`,
        linkText: 'View Acceptance Letter',
        relatedId: sub.id,
      });
    } else if (sub.status === 'published') {
      generated.push({
        id: `notif-sub-${sub.id}-published`,
        title: 'Article Published & DOI Issued',
        message: `Your article "${titleText}" has been assigned a DOI and published online.`,
        timestamp: dateStr,
        category: 'published',
        isRead: readIds.includes(`notif-sub-${sub.id}-published`),
        linkUrl: `/dashboard/submissions/${routeIdOf(sub)}`,
        linkText: 'View Article',
        relatedId: sub.id,
      });
    }
  });

  // Generate from orders
  orders.forEach((ord) => {
    // Notification de-dup keys below intentionally keep using `ord.id`: they
    // are localStorage bookkeeping, not a displayed identifier (spec §10).
    const ordId = displayReference(ord, ord.order_number ?? ord.custom_order_id);
    const ordLink = `/dashboard/orders/${routeIdOf(ord)}`;
    const dateStr = ord.created_at || new Date().toISOString();

    if (ord.payment_status === 'completed' || ord.status === 'completed' || ord.status === 'paid') {
      generated.push({
        id: `notif-ord-${ord.id}-paid`,
        title: 'Order Payment Received',
        message: `Payment for Order ${ordId} was verified. Your access/items are ready.`,
        timestamp: dateStr,
        category: 'order_paid',
        isRead: readIds.includes(`notif-ord-${ord.id}-paid`),
        linkUrl: ordLink,
        linkText: 'View Order',
        relatedId: ord.id,
      });
      generated.push({
        id: `notif-ord-${ord.id}-invoice`,
        title: 'Tax Invoice Generated',
        message: `Official invoice for Order ${ordId} is now available for download.`,
        timestamp: dateStr,
        category: 'invoice_generated',
        isRead: readIds.includes(`notif-ord-${ord.id}-invoice`),
        linkUrl: ordLink,
        linkText: 'Download Invoice',
        relatedId: ord.id,
      });
    } else if (ord.status === 'delivered') {
      generated.push({
        id: `notif-ord-${ord.id}-delivered`,
        title: 'Order Delivered',
        message: `Shipment for Order ${ordId} has been successfully delivered.`,
        timestamp: dateStr,
        category: 'order_delivered',
        isRead: readIds.includes(`notif-ord-${ord.id}-delivered`),
        linkUrl: ordLink,
        linkText: 'View Delivery Details',
        relatedId: ord.id,
      });
    }
  });

  // Add standard default notifications if list is sparse
  if (generated.length < 3) {
    const defaultDate = new Date().toISOString();
    const defaults: NotificationItem[] = [
      {
        id: 'notif-def-welcome',
        title: 'Welcome to MMSR Publications',
        message: 'Your author and reader portal is active. You can submit manuscripts, track peer review, and manage publication orders.',
        timestamp: defaultDate,
        category: 'editorial_screening',
        isRead: readIds.includes('notif-def-welcome'),
        linkUrl: '/submit-manuscript',
        linkText: 'Submit Manuscript',
      },
      {
        id: 'notif-def-guidelines',
        title: '2026 Author Submission Guidelines Updated',
        message: 'Review our latest editorial policies, ethics guidelines, and open-access publishing standards.',
        timestamp: defaultDate,
        category: 'editorial_screening',
        isRead: readIds.includes('notif-def-guidelines'),
        linkUrl: '/journals',
        linkText: 'Explore Journals',
      }
    ];

    defaults.forEach(d => {
      if (!generated.some(g => g.id === d.id)) {
        generated.push(d);
      }
    });
  }

  // Sort newest first
  return generated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
