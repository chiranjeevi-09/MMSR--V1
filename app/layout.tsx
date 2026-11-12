import type { Metadata, Viewport } from "next";
// Self-hosted variable fonts (no Google Fonts network fetch at build/dev time,
// which was stalling every route compile and page navigation locally).
import "@fontsource-variable/playfair-display";
import "@fontsource-variable/manrope";
import "@fontsource-variable/inter";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { ClientProviders } from "@/components/providers/ClientProviders";
import { RouteGuard } from "@/components/auth/RouteGuard";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { AnalyticsProvider } from "@/components/ui/Analytics";
import { SITE_URL } from "@/lib/config/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MMSR Publications | Premium Academic & Scientific Publishing",
    template: "%s | MMSR Publications",
  },
  description:
    "Missile Man Scientific & Research Publications - High-impact peer-reviewed academic journals, edited books, and scientific research publications.",
  keywords: [
    "MMSR Publications",
    "Academic Publishing",
    "Scientific Journals",
    "Edited Books",
    "Research Papers",
    "Missile Man Publications",
    "Book Chapters",
    "Peer-Reviewed Journals",
    "Open Access Research",
    "DOI Registration",
  ],
  authors: [{ name: "MMSR Publications Editorial Board", url: SITE_URL }],
  creator: "MMSR Publications",
  publisher: "MMSR Publications",
  applicationName: "MMSR Publications",
  referrer: "origin-when-cross-origin",
  category: "Academic & Scientific Research Publishing",
  alternates: {
    canonical: './',
  },
  // The GA4 measurement id is published as a plain meta tag rather than an
  // inline bootstrap script: the site now ships a Content-Security-Policy
  // without 'unsafe-inline' in script-src (SECURITY-QA-REPORT M-5), and
  // /public/scripts/ga-bootstrap.js reads this value.
  other: process.env.NEXT_PUBLIC_GA_ID
    ? { "google-analytics-id": process.env.NEXT_PUBLIC_GA_ID }
    : {},
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/logos/mmsr-logo.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    shortcut: '/logos/mmsr-logo.png',
    apple: '/logos/mmsr-logo.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "MMSR Publications | Premium Academic & Scientific Publishing",
    description:
      "High-impact peer-reviewed academic journals, edited books, and scientific research publications.",
    url: SITE_URL,
    siteName: "MMSR Publications",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MMSR Publications | Premium Academic & Scientific Publishing",
    description:
      "High-impact peer-reviewed academic journals, edited books, and scientific research publications.",
  },
};

export const viewport: Viewport = {
  themeColor: "#F8F5EE",
  // The public experience is a light cream theme (themeColor above). Declaring
  // "dark" here conflicted with it (audit a11y finding), causing some browsers
  // to render dark form controls / scrollbars against the cream surfaces.
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MMSR Publications',
    alternateName: 'Missile Man Scientific & Research Publications',
    url: SITE_URL,
    description: 'High-impact peer-reviewed academic journals, edited books, and scientific research publications.',
  };

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'MMSR Publications',
    url: SITE_URL,
  };

  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-navy-midnight text-ivory-white font-manrope">
        <ClientProviders>
          <RouteGuard>
            <AppLayout>{children}</AppLayout>
          </RouteGuard>
          <CookieConsent />
          <AnalyticsProvider />
        </ClientProviders>
      </body>
    </html>
  );
}
