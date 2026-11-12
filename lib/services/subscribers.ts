/**
 * MMSR Publications V2 — Newsletter Subscribers Service
 * Handles email subscriptions from the user side and retrieval/management from the admin side.
 */

import { EMAIL_RE } from '@/lib/validation';

export interface Subscriber {
  id: string;
  email: string;
  subscribedAt: string;
  source?: string;
  status: 'active' | 'unsubscribed';
}

const STORAGE_KEY_SUBSCRIBERS = 'mmsr_newsletter_subscribers';

const DEFAULT_SUBSCRIBERS: Subscriber[] = [
  { id: 'sub-1', email: 'editor.research@cambridge.edu', subscribedAt: '2026-09-28T10:15:00Z', source: 'Home Footer', status: 'active' },
  { id: 'sub-2', email: 'prof.sharma@iitd.ac.in', subscribedAt: '2026-09-29T14:22:00Z', source: 'Home Footer', status: 'active' },
  { id: 'sub-3', email: 'dr.kumar@nit.ac.in', subscribedAt: '2026-09-30T08:05:00Z', source: 'Call For Papers', status: 'active' },
];

export function getSubscribers(): Subscriber[] {
  if (typeof window === 'undefined') return DEFAULT_SUBSCRIBERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUBSCRIBERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_SUBSCRIBERS, JSON.stringify(DEFAULT_SUBSCRIBERS));
      return DEFAULT_SUBSCRIBERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_SUBSCRIBERS;
  } catch {
    return DEFAULT_SUBSCRIBERS;
  }
}

export function subscribeEmail(email: string, source: string = 'Home Footer'): { success: boolean; message: string } {
  const candidate = (email || '').trim();
  if (!candidate || !EMAIL_RE.test(candidate)) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  const cleanEmail = candidate.toLowerCase();
  const current = getSubscribers();
  const exists = current.find((s) => s.email.toLowerCase() === cleanEmail);

  if (exists) {
    return { success: true, message: 'This email is already subscribed to MMSR Publications digest!' };
  }

  const newSubscriber: Subscriber = {
    id: `sub-${Date.now()}`,
    email: cleanEmail,
    subscribedAt: new Date().toISOString(),
    source,
    status: 'active',
  };

  const updated = [newSubscriber, ...current];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SUBSCRIBERS, JSON.stringify(updated));
  }

  return { success: true, message: 'Thank you! Your email has been registered for academic updates.' };
}

export function removeSubscriber(id: string): void {
  const current = getSubscribers();
  const filtered = current.filter((s) => s.id !== id);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_SUBSCRIBERS, JSON.stringify(filtered));
  }
}
