/**
 * MMSR Publications V2 — Publishing Services Data
 *
 * All content below is structured placeholder content.
 * Connect to Django REST API in a future phase without UI changes.
 */

import { PublishingService, ProcessStep, ServiceFAQ } from '../types/service';

export const PUBLISHING_SERVICES: PublishingService[] = [
  {
    id: 'svc-1',
    title: 'Book Publishing',
    shortDescription: 'Full-service academic book publishing with ISBN registration and DOI assignment.',
    fullDescription: 'We provide end-to-end academic book publishing services for research scholars, faculty members, and institutions. Services include manuscript evaluation, peer review coordination, typesetting, and global digital distribution.',
    icon: 'BookOpen',
    category: 'Publication',
    benefits: ['ISBN & DOI registration', 'Peer-reviewed quality assurance', 'Digital and print formats', 'Global catalogue listing'],
    turnaround: '8–12 weeks',
    tags: ['ISBN', 'DOI', 'Peer Review'],
  },
  {
    id: 'svc-2',
    title: 'Book Chapter Publishing',
    shortDescription: 'Publish individual research chapters in MMSR edited volumes.',
    fullDescription: 'Researchers may submit single book chapters for inclusion in MMSR edited thematic volumes. Each accepted chapter undergoes editorial review, receives a unique DOI, and is published in a multi-authored volume with ISBN.',
    icon: 'FileText',
    category: 'Publication',
    benefits: ['Individual chapter DOI', 'Included in edited volume', 'Academic credibility', 'Certificate of publication'],
    turnaround: '4–8 weeks',
    tags: ['Chapter', 'DOI', 'Edited Volume'],
  },
  {
    id: 'svc-3',
    title: 'Journal Publishing',
    shortDescription: 'Submit and publish research articles in MMSR peer-reviewed scientific journals.',
    fullDescription: 'MMSR hosts a portfolio of peer-reviewed scientific journals across STEM and social science disciplines. Authors may submit original research for editorial evaluation, double-blind peer review, and indexed publication.',
    icon: 'Layers',
    category: 'Publication',
    benefits: ['Double-blind peer review', 'Crossref DOI', 'Open Access options', 'ISSN-registered journals'],
    turnaround: '3–6 weeks after review',
    tags: ['ISSN', 'DOI', 'Open Access'],
  },
  {
    id: 'svc-4',
    title: 'Conference Proceedings',
    shortDescription: 'Publish full conference proceedings with ISBN and DOI for all accepted papers.',
    fullDescription: 'Conference organizers may partner with MMSR Publications to publish official proceedings volumes. Each accepted paper receives a DOI, and the proceedings volume receives a unique ISBN with a professional editorial layout.',
    icon: 'Presentation',
    category: 'Publication',
    benefits: ['Proceedings ISBN', 'Individual paper DOI', 'Rapid publication', 'Archival indexing'],
    turnaround: '3–5 weeks',
    tags: ['Proceedings', 'ISBN', 'DOI'],
  },
  {
    id: 'svc-5',
    title: 'DOI Registration',
    shortDescription: 'Register Digital Object Identifiers for your academic publications via Crossref.',
    fullDescription: 'We provide DOI registration services for academic authors and institutions through our Crossref membership. Each DOI permanently links to the published version of your work, ensuring long-term citeability and discoverability.',
    icon: 'Link',
    category: 'Technical',
    benefits: ['Permanent citation link', 'Crossref metadata registration', 'Works with existing publications', 'Scholarly discoverability'],
    turnaround: '3–5 business days',
    tags: ['DOI', 'Crossref', 'Identifier'],
  },
  {
    id: 'svc-6',
    title: 'ISBN Assignment',
    shortDescription: 'Assign International Standard Book Numbers to eligible research volumes.',
    fullDescription: 'Authors and institutions can request ISBN assignment for academic books, edited volumes, and conference proceedings published through MMSR Publications. ISBN registration enables library cataloguing and distribution.',
    icon: 'Hash',
    category: 'Technical',
    benefits: ['Legitimate ISBN block', 'Library-catalogue eligibility', 'Required for print distribution', 'International recognition'],
    turnaround: '5–7 business days',
    tags: ['ISBN', 'Publishing Identifier'],
  },
  {
    id: 'svc-7',
    title: 'Manuscript Formatting',
    shortDescription: 'Professional formatting and typesetting to meet academic publishing standards.',
    fullDescription: 'Our editorial team formats your manuscript according to publisher-specified or discipline-specific standards. Services include figure formatting, reference styling, table design, and production-ready PDF generation.',
    icon: 'PenTool',
    category: 'Editorial',
    benefits: ['Meets publisher standards', 'LaTeX and Word support', 'Figure/table formatting', 'Production-ready output'],
    turnaround: '3–7 business days',
    tags: ['Formatting', 'Typesetting', 'Editorial'],
  },
  {
    id: 'svc-8',
    title: 'Academic Editing',
    shortDescription: 'Language editing and structural review for research manuscripts.',
    fullDescription: 'Our academic editors review your manuscript for clarity, grammatical accuracy, logical structure, and alignment with scholarly writing conventions. Available for full manuscripts, journal articles, and thesis chapters.',
    icon: 'Edit3',
    category: 'Editorial',
    benefits: ['Native English editing', 'Structural feedback', 'Citation consistency', 'Track changes report'],
    turnaround: '5–10 business days',
    tags: ['Editing', 'Proofreading', 'Language'],
  },
  {
    id: 'svc-9',
    title: 'Plagiarism Screening',
    shortDescription: 'Academic integrity check using industry-standard detection software.',
    fullDescription: 'Manuscripts submitted for MMSR publication undergo plagiarism screening using standard academic tools. We provide a similarity report and editorial guidance if revision is required before the peer review process begins.',
    icon: 'ShieldCheck',
    category: 'Editorial',
    benefits: ['Similarity report', 'Pre-submission check', 'Editorial guidance', 'Academic integrity compliance'],
    turnaround: '1–2 business days',
    tags: ['Integrity', 'Similarity Check'],
  },
  {
    id: 'svc-10',
    title: 'Peer Review Support',
    shortDescription: 'Coordinating double-blind peer review for submitted manuscripts.',
    fullDescription: 'MMSR coordinates subject-matter expert peer review for all submissions. Our editorial team manages reviewer assignment, reviewer correspondence, decision recommendations, and author revision cycles.',
    icon: 'Users',
    category: 'Editorial',
    benefits: ['Double-blind review', 'Expert reviewer matching', 'Structured review criteria', 'Revision tracking'],
    turnaround: '3–6 weeks',
    tags: ['Peer Review', 'Double-Blind'],
  },
  {
    id: 'svc-11',
    title: 'Publication Certificate',
    shortDescription: 'Official publication certificates for authors of MMSR-published works.',
    fullDescription: 'Corresponding authors and co-authors may request official publication certificates for MMSR publications. Certificates include title, DOI, ISSN/ISBN, author names, and publication date on MMSR letterhead.',
    icon: 'Award',
    category: 'Certification',
    benefits: ['Official MMSR letterhead', 'Digitally verifiable', 'DOI & ISSN included', 'Available for co-authors'],
    turnaround: '2–3 business days',
    tags: ['Certificate', 'Verification'],
  },
  {
    id: 'svc-12',
    title: 'Research Publication Support',
    shortDescription: 'Guided support for first-time academic authors through the publication journey.',
    fullDescription: 'We offer a guided publication support service for researchers who are new to the academic publishing process. Our editorial consultants assist with journal selection, manuscript preparation, submission, and correspondence.',
    icon: 'Lightbulb',
    category: 'Research Support',
    benefits: ['One-on-one editorial consultation', 'Journal-selection guidance', 'Submission assistance', 'Revision support'],
    turnaround: 'Ongoing support',
    tags: ['First-time Authors', 'Guidance', 'Consultation'],
  },
];

export const PUBLISHING_PROCESS_STEPS: ProcessStep[] = [
  { step: 1, title: 'Enquiry & Manuscript Submission', description: 'Submit your manuscript through our online portal or contact our editorial team to discuss your publication requirements.', icon: 'Send' },
  { step: 2, title: 'Editorial Evaluation', description: 'Our editorial team performs an initial assessment for scope, quality, and formatting compliance before advancing to review.', icon: 'ClipboardCheck' },
  { step: 3, title: 'Peer Review', description: 'Manuscripts undergo rigorous double-blind peer review by domain experts. Authors receive structured reviewer feedback.', icon: 'Users' },
  { step: 4, title: 'Revision & Acceptance', description: 'Authors revise manuscripts based on reviewer feedback. Accepted papers proceed to the production stage.', icon: 'CheckCircle2' },
  { step: 5, title: 'Production & Publishing', description: 'The manuscript is typeset, formatted, and assigned a DOI/ISBN. The final version is published in the MMSR catalogue.', icon: 'Layers' },
  { step: 6, title: 'Certification & Distribution', description: 'Publication certificates are issued. The work is distributed globally through the MMSR digital platform and partner networks.', icon: 'Globe' },
];

export const SERVICES_FAQS: ServiceFAQ[] = [
  { id: 'sf-1', question: 'What types of manuscripts does MMSR accept?', answer: 'MMSR accepts original research articles, review papers, book chapters, edited volumes, and conference paper submissions across STEM and social science disciplines.' },
  { id: 'sf-2', question: 'How long does the peer review process take?', answer: 'Peer review typically takes 3–6 weeks depending on manuscript complexity and reviewer availability. Expedited review options may be available.' },
  { id: 'sf-3', question: 'Is open access publishing available?', answer: 'Yes. MMSR offers open access publishing options for selected journals and proceedings. Open access papers are freely available globally upon publication.' },
  { id: 'sf-4', question: 'How are DOIs assigned?', answer: 'MMSR is a Crossref member publisher. DOIs are assigned through Crossref and permanently linked to the published version of each work.' },
  { id: 'sf-5', question: 'What manuscript formats are supported?', answer: 'MMSR accepts manuscripts in Microsoft Word (.docx) and LaTeX (.tex) formats. Our editorial team handles typesetting and production formatting.' },
  { id: 'sf-6', question: 'Are publication certificates provided to all authors?', answer: 'Yes. Official publication certificates are available to all listed authors upon request following final publication.' },
];

const STORAGE_KEY_SERVICES = 'mmsr_dynamic_publishing_services';

export function getPublishingServices(): PublishingService[] {
  if (typeof window === 'undefined') return PUBLISHING_SERVICES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SERVICES);
    if (!raw) return PUBLISHING_SERVICES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : PUBLISHING_SERVICES;
  } catch {
    return PUBLISHING_SERVICES;
  }
}

export function savePublishingServices(services: PublishingService[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_SERVICES, JSON.stringify(services));
}
