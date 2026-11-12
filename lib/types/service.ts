/**
 * MMSR Publications V2 — Publishing Services Type Definitions
 */

export interface ServiceBenefit {
  label: string;
  icon?: string;
}

export interface PublishingService {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  icon: string;          // lucide icon name as string for mapping
  category: ServiceCategory;
  benefits: string[];
  process?: string[];
  turnaround?: string;
  tags?: string[];
}

export type ServiceCategory =
  | 'Publication'
  | 'Editorial'
  | 'Certification'
  | 'Technical'
  | 'Research Support';

export interface ProcessStep {
  step: number;
  title: string;
  description: string;
  icon: string;
}

export interface ServiceFAQ {
  id: string;
  question: string;
  answer: string;
  category?: string;
}
