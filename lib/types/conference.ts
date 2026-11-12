/**
 * MMSR Publications V2 — Conference Module Type Definitions
 */

export type ConferenceMode = 'Online' | 'Offline' | 'Hybrid';
export type ConferenceStatus = 'Upcoming' | 'Ongoing' | 'Completed' | 'Past' | 'Cancelled';
export type RegistrationStatus = 'Open' | 'Closed' | 'Coming Soon';

export interface ConferenceSpeaker {
  id: string;
  name: string;
  title: string;
  institution: string;
  country: string;
  topic?: string;
  photo?: string;
  bio?: string;
}

export interface ConferenceCommitteeMember {
  id: string;
  name: string;
  role: string;
  institution: string;
  country: string;
}

export interface ConferenceTrack {
  id: string;
  title: string;
  description: string;
  topics: string[];
}

export interface ConferenceScheduleItem {
  time: string;
  title: string;
  speaker?: string;
  type: 'Keynote' | 'Paper Presentation' | 'Workshop' | 'Break' | 'Panel' | 'Opening' | 'Closing';
}

export interface ConferenceScheduleDay {
  day: string;
  date: string;
  items: ConferenceScheduleItem[];
}

export interface ConferenceFAQ {
  id: string;
  question: string;
  answer: string;
}

export interface ImportantDate {
  label: string;
  date: string;
  isPast?: boolean;
  isHighlighted?: boolean;
}

export interface Conference {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  acronym?: string;
  description: string;
  fullDescription?: string;
  date: string;            // human-readable, e.g. "March 14–16, 2025"
  startDate: string;       // ISO date string for sorting
  endDate: string;
  publicationDate?: string;
  submissionDeadline: string;
  registrationDeadline?: string;
  location: string;
  venue?: string;
  country: string;
  mode: ConferenceMode;
  domain: string;
  category?: string;
  domains: string[];
  registrationStatus: RegistrationStatus;
  registrationOpen?: boolean;
  submissionStatus: 'Open' | 'Closed';
  submissionOpen: boolean;
  status: ConferenceStatus;
  organizer: string;
  organizerWebsite?: string;
  proceedings?: string;
  proceedingsAvailable?: boolean;
  proceedingsFile?: string;
  brochureFile?: string;
  doiPrefix?: string;
  isbnProceedings?: string;
  callForPapers?: string;
  submissionGuidelines?: string;
  registrationFee?: {
    earlyBird?: string;
    regular?: string;
    student?: string;
    professional?: string;
  };
  importantDates: ImportantDate[];
  tracks: ConferenceTrack[];
  speakers: ConferenceSpeaker[];
  committee: ConferenceCommitteeMember[];
  schedule: ConferenceScheduleDay[];
  faqs: ConferenceFAQ[];
  coverImage?: string;
  coverImageWebp?: string;
  banner?: string;
  bannerWebp?: string;
  bannerColor?: string;
}

export interface ConferenceFilterOptions {
  search?: string;
  status?: ConferenceStatus | 'all';
  mode?: ConferenceMode | 'all';
  domain?: string;
  country?: string;
  year?: number | 'all';
  registrationOpen?: boolean;
  sortBy?: 'newest' | 'date_asc' | 'date_desc' | 'title_asc' | 'upcoming_deadline' | 'year_desc';
  page?: number;
  limit?: number;
}

export interface ConferencesResponse {
  conferences: Conference[];
  total: number;
  page: number;
  totalPages: number;
}
