'use client';

import React from 'react';
import { SITE_URL, SITE_DOMAIN } from '@/lib/config/site';

interface JsonLdProps {
  data: Record<string, any>;
}

export const JsonLd: React.FC<JsonLdProps> = ({ data }) => {
  // JSON.stringify does NOT escape `<`, `/` or `&`, so a value containing
  // `</script><script>…` (e.g. a CMS-authored book/journal/conference title or
  // description) would break out of this <script> block and inject executable
  // markup. Escaping those characters to their \uXXXX forms keeps the payload
  // valid JSON yet neutralises the tag breakout — important now that the CSP
  // permits script-src 'unsafe-inline' (required for Next's own inline scripts).
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
};

export function getOrganizationSchema() {
  const baseUrl = SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MMSR Publications',
    alternateName: 'Missile Man Scientific & Research Publications',
    url: baseUrl,
    logo: `${baseUrl}/logos/mmsr-logo.png`,
    description: 'High-impact peer-reviewed academic journals, edited books, and scientific research publications.',
    foundingDate: '2020',
    sameAs: [
      'https://twitter.com/mmsrpublications',
      'https://linkedin.com/company/mmsrpublications',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-9876543210',
      contactType: 'editorial support',
      email: `contact@${SITE_DOMAIN}`,
      availableLanguage: ['English', 'Hindi'],
    },
  };
}

export function getWebSiteSchema() {
  const baseUrl = SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MMSR Publications',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/books?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function getBookSchema(book: {
  title: string;
  author_name?: string;
  isbn?: string;
  description?: string;
  cover_image?: string;
  published_date?: string;
  price?: string;
  id: string | number;
}) {
  const baseUrl = SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: {
      '@type': 'Person',
      name: book.author_name || 'MMSR Editorial Board',
    },
    isbn: book.isbn || undefined,
    image: book.cover_image || `${baseUrl}/images/book-placeholder.jpg`,
    description: book.description || `Academic publication: ${book.title}`,
    datePublished: book.published_date || undefined,
    publisher: {
      '@type': 'Organization',
      name: 'MMSR Publications',
    },
    offers: book.price
      ? {
          '@type': 'Offer',
          price: book.price,
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          url: `${baseUrl}/books/${book.id}`,
        }
      : undefined,
  };
}

export function getJournalSchema(journal: {
  title: string;
  issn?: string;
  description?: string;
  slug?: string;
  id?: string | number;
}) {
  const baseUrl = SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'Periodical',
    name: journal.title,
    issn: journal.issn || undefined,
    description: journal.description || `Peer-reviewed scientific journal: ${journal.title}`,
    publisher: {
      '@type': 'Organization',
      name: 'MMSR Publications',
    },
    url: `${baseUrl}/journals/${journal.slug || journal.id}`,
  };
}

export function getEventSchema(conf: {
  title: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  description?: string;
  slug?: string;
  id?: string | number;
}) {
  const baseUrl = SITE_URL;
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationEvent',
    name: conf.title,
    startDate: conf.start_date || undefined,
    endDate: conf.end_date || undefined,
    eventAttendanceMode: 'https://schema.org/MixedEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: conf.location || 'MMSR Conference Center & Online Hybrid',
    },
    description: conf.description || `International academic conference: ${conf.title}`,
    organizer: {
      '@type': 'Organization',
      name: 'MMSR Publications',
      url: baseUrl,
    },
    url: `${baseUrl}/conference/${conf.slug || conf.id}`,
  };
}
