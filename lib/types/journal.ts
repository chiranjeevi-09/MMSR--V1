/**
 * MMSR Publications V2 — Journal Module Type Definitions
 */

export interface JournalArticle {
  id: string;
  slug?: string;
  /** Standardized MMSR public ID (MMSR-ART-1931-NNNNNN), issued by the backend. */
  publicId?: string | null;
  journalId?: string;
  issueId?: string;
  title: string;
  authors: string;
  authorNamesRaw?: string;
  institution?: string;
  doi: string;
  publicationDate: string;
  abstract: string;
  pageRange?: string;
  status?: string;
  accessMode?: string;
  pdfUrl?: string;
  price?: number | null;
  hasFullText?: boolean;
}

export interface ArticleAccessState {
  articleId: number;
  articleSlug: string;
  isOpenAccess: boolean;
  hasActiveSubscription: boolean;
  hasArticlePurchase: boolean;
  canAccessFullText: boolean;
  canAccessPdf: boolean;
  accessReason: string;
  requiresLogin: boolean;
  articlePdfAvailable: boolean;
  articlePrice: number | null;
  hasFullText: boolean;
}

export interface UserJournalAccess {
  id: string;
  /** Standardized entitlement reference (MMSR-JAC-1931-NNNNNN). */
  publicId?: string | null;
  user?: number;
  journal: number;
  journalTitle?: string;
  journalSlug?: string;
  journalPublicId?: string | null;
  issue?: number | null;
  issueTitle?: string | null;
  issuePublicId?: string | null;
  issueVolume?: number | null;
  issueNumber?: number | null;
  article?: number | null;
  articleTitle?: string | null;
  articleSlug?: string | null;
  articlePublicId?: string | null;
  accessType: 'issue' | 'subscription' | 'manual_grant' | 'article';
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  isValid?: boolean;
  grantedAt?: string;
}

export interface JournalIssueFormat {
  format: 'digital' | 'print' | 'bundle';
  name: string;
  price: number;
  available: boolean;
  description?: string;
}

export interface JournalIssue {
  id: string;
  /** Standardized MMSR public ID (MMSR-ISS-1931-NNNNNN), issued by the backend. */
  publicId?: string | null;
  /** Parsed volume number. Prefer volumeNumber (from DB) over this when both exist. */
  volume: number;
  /** Parsed issue number. Prefer issueNumber (from DB) over this when both exist. */
  issue: number;
  year: number;
  publicationDate: string;
  cover?: string;
  coverWebp?: string;
  coverThumb?: string;
  articleCount: number;
  doi: string;
  samplePdfUrl?: string;
  /** Persisted complete-issue PDF filename (from the backend record), when present. */
  digitalFileName?: string | null;
  price?: number;
  pricePrint?: number;
  priceBundle?: number;
  stock?: number;
  hasDigital?: boolean;
  supportedFormats?: JournalIssueFormat[];
  title?: string;
  /** volume_number from backend DB (authoritative when non-null). */
  volumeNumber?: number | null;
  /** issue_number from backend DB (authoritative when non-null). */
  issueNumber?: number | null;
  articles?: JournalArticle[];
}

export interface EditorialMember {
  id: string;
  name: string;
  role: string;
  institution: string;
  country: string;
  researchAreas: string[];
  photo?: string;
}

export interface Journal {
  id: string;
  slug: string;
  /** Standardized MMSR public ID (MMSR-JRN-1931-NNNNNN), issued by the backend. */
  publicId?: string | null;
  title: string;
  shortTitle: string;
  description: string;
  aims: string;
  scope: string[];
  cover?: string;
  coverWebp?: string;
  coverThumb?: string;
  issn: string;
  eissn: string;
  doiPrefix: string;
  discipline: string;
  category?: string;
  categorySlug?: string;
  editor: string;
  publisher: string;
  frequency: 'Monthly' | 'Bi-Monthly' | 'Quarterly' | 'Bi-Annual' | string;
  volume: number;
  issue: number;
  year: number;
  openAccess: boolean;
  isFeatured?: boolean;
  subscriptionPriceAnnual?: number;
  indexedIn: string[];
  impactMetric?: string;
  reviewTime?: string;
  acceptanceRate?: string;
  articlesPublished?: number;
  totalIssues?: number;
  totalVolumes?: number;
  accessType?: string;
  issues?: JournalIssue[];
  articles?: JournalArticle[];
  editorialBoard?: EditorialMember[];
}

export interface JournalFilterOptions {
  search?: string;
  discipline?: string;
  openAccess?: boolean;
  indexed?: string;
  frequency?: string;
  year?: number;
  sortBy?: 'newest' | 'title_asc' | 'popular' | 'impact' | 'recent_issue';
  page?: number;
  limit?: number;
}

export interface JournalDiscipline {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface JournalsResponse {
  journals: Journal[];
  total: number;
  page: number;
  totalPages: number;
}

