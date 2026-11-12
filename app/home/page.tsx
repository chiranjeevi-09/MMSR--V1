import React from 'react';
import type { Metadata } from 'next';
import { HomeHero } from '@/components/home/HomeHero';
import { TrustStats } from '@/components/home/TrustStats';
import { FeaturedBooksPreview } from '@/components/home/FeaturedBooksPreview';
import { FeaturedJournalsPreview } from '@/components/home/FeaturedJournalsPreview';
import { WhyChooseMMSR } from '@/components/home/WhyChooseMMSR';
import { PublishingServices } from '@/components/home/PublishingServices';
import { ResearchDomains } from '@/components/home/ResearchDomains';
import { PublicationProcess } from '@/components/home/PublicationProcess';
import { UniversityPartners } from '@/components/home/UniversityPartners';
import { TestimonialsPreview } from '@/components/home/TestimonialsPreview';
import { NewsletterSection } from '@/components/home/NewsletterSection';
import { CTASection } from '@/components/home/CTASection';

export const metadata: Metadata = {
  title: 'International Academic & Scientific Publisher',
  description:
    'Missile Man Scientific & Research Publications. Browse peer-reviewed journals, edited academic books with ISBN & DOI, author submission guidelines, and research services.',
};

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 bg-[#F8EEDC] text-ivory-white font-manrope">
      {/* 1. Hero Banner */}
      <HomeHero />

      {/* 2. Trust Statistics */}
      <TrustStats />

      {/* 3. Featured Books Preview */}
      <FeaturedBooksPreview />

      {/* 4. Featured Journals Preview */}
      <FeaturedJournalsPreview />

      {/* 5. Why Choose MMSR */}
      <WhyChooseMMSR />

      {/* 6. Publishing Services */}
      <PublishingServices />

      {/* 7. Research Domains */}
      <ResearchDomains />

      {/* 8. Publication Process Workflow */}
      <PublicationProcess />

      {/* 9. University & Research Partners Marquee */}
      <UniversityPartners />

      {/* 10. Testimonials Preview */}
      <TestimonialsPreview />

      {/* 11. Final CTA Banner */}
      <CTASection />
    </div>
  );
}
