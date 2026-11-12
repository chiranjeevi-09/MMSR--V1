/**
 * MMSR Publications V2 — Site Dynamic Settings & Metrics Service
 * Manages admin-controlled dynamic values for User-side Landing Page, Home Page, and Academic Alliances.
 */

export interface ImpactMetricsConfig {
  booksCount: number;
  journalsCount: number;
  authorsCount: number;
  satisfactionRate: string;
  publishedArticles: number;
  partnerUnisCount: number;
  countriesCount: number;
  certificatesCount: number;

  // Books Hero Card Metrics
  editedBooksText: string;
  peerReviewStandard: string;
  digitalObjectId: string;

  // Journals Hero Card Metrics
  activeJournalsText: string;
  disciplinesText: string;
  issuesPublishedText: string;
  countriesText: string;

  // Conferences Hero Card Metrics
  confHostedText: string;
  confDomainsText: string;
  confPapersText: string;
  confCountriesText: string;

  // Publishing Services Hero Card Metrics
  servicesTotalText: string;
  servicesWorksText: string;
  servicesReviewText: string;
  servicesIdText: string;
}

export interface UniversityPartnerConfig {
  id: string;
  name: string;
  location: string;
  type: string;
}

const STORAGE_KEY_METRICS = 'mmsr_dynamic_impact_metrics';
const STORAGE_KEY_PARTNERS = 'mmsr_dynamic_university_partners';

export const DEFAULT_METRICS: ImpactMetricsConfig = {
  booksCount: 500,
  journalsCount: 120,
  authorsCount: 15000,
  satisfactionRate: '98.4%',
  publishedArticles: 2500,
  partnerUnisCount: 150,
  countriesCount: 50,
  certificatesCount: 10000,

  // Default Books Hero Values
  editedBooksText: '500+',
  peerReviewStandard: 'Double-Blind',
  digitalObjectId: 'Crossref Registered',

  // Default Journals Hero Values
  activeJournalsText: '50+',
  disciplinesText: '12+',
  issuesPublishedText: '500+',
  countriesText: '50+',

  // Default Conferences Hero Values
  confHostedText: '25+',
  confDomainsText: '10+',
  confPapersText: '2,000+',
  confCountriesText: '40+',

  // Default Publishing Services Hero Values
  servicesTotalText: '12+',
  servicesWorksText: '500+',
  servicesReviewText: 'Double-Blind',
  servicesIdText: 'Crossref DOI',
};

export const DEFAULT_UNIVERSITY_PARTNERS: UniversityPartnerConfig[] = [
  { id: '1', name: 'Indian Institute of Technology (IIT)', location: 'India', type: 'Premier Technical Institute' },
  { id: '2', name: 'National Institute of Technology (NIT)', location: 'India', type: 'Institute of National Importance' },
  { id: '3', name: 'University of Cambridge Research Network', location: 'UK', type: 'Global Academic Partner' },
  { id: '4', name: 'National University of Singapore (NUS)', location: 'Singapore', type: 'Research Collaboration' },
  { id: '5', name: 'Stanford Research Exchange', location: 'USA', type: 'Academic Affiliate' },
  { id: '6', name: 'Central University Research Board', location: 'India', type: 'Institutional Partner' },
  { id: '7', name: 'Global Science Foundation', location: 'Switzerland', type: 'Indexing Alliance' },
];

export function getImpactMetrics(): ImpactMetricsConfig {
  if (typeof window === 'undefined') return DEFAULT_METRICS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_METRICS);
    if (!raw) return DEFAULT_METRICS;
    return { ...DEFAULT_METRICS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_METRICS;
  }
}

export function saveImpactMetrics(metrics: ImpactMetricsConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(metrics));
}

export function getUniversityPartners(): UniversityPartnerConfig[] {
  if (typeof window === 'undefined') return DEFAULT_UNIVERSITY_PARTNERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PARTNERS);
    if (!raw) return DEFAULT_UNIVERSITY_PARTNERS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_UNIVERSITY_PARTNERS;
  } catch {
    return DEFAULT_UNIVERSITY_PARTNERS;
  }
}

export function saveUniversityPartners(partners: UniversityPartnerConfig[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_PARTNERS, JSON.stringify(partners));
  window.dispatchEvent(new CustomEvent('mmsr_partners_updated'));
}
