/**
 * MMSR Publications V2 — Contact Module Type Definitions
 */

export type EnquiryType =
  | 'General Enquiry'
  | 'Editorial Enquiry'
  | 'Author Support'
  | 'Publishing Enquiry'
  | 'Conference Enquiry'
  | 'Technical Support'
  | 'Other';

export interface ContactFormData {
  fullName: string;
  email: string;
  organization?: string;
  subject: string;
  enquiryType: EnquiryType;
  message: string;
  /**
   * Hidden bot trap (SECURITY-QA-REPORT M-4). Never rendered as a visible
   * field, so real visitors leave it empty; the API discards any submission
   * that arrives with a value here.
   */
  honeypot?: string;
}

export interface ContactInfo {
  id: string;
  title: string;
  description: string;
  email: string;
  icon: string;
  responseTime?: string;
}

export interface ContactFAQ {
  id: string;
  question: string;
  answer: string;
  category?: EnquiryType;
  pageTarget?: string; // 'General' | 'Contact' | 'Publishing Services' | 'Books' | 'Journals' | 'Conferences'
}

export interface ContactSubmission {
  id: string;
  referenceId: string;
  fullName: string;
  email: string;
  organization?: string;
  subject: string;
  enquiryType: EnquiryType;
  message: string;
  status: 'New' | 'In Progress' | 'Replied' | 'Resolved';
  createdAt: string;
  adminNotes?: string;
  adminReply?: string;
  repliedAt?: string;
}

/**
 * Result of a live enquiry POST to /api/publications/contact-inquiries/.
 */
export interface ContactSubmissionResult {
  success: boolean;
  message: string;
  referenceId?: string;
}
