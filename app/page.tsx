import React from 'react';
import type { Metadata } from 'next';
import { BackgroundEffects } from '@/components/landing/BackgroundEffects';
import { Particles } from '@/components/landing/Particles';
import { LandingHero } from '@/components/landing/LandingHero';
import { FloatingBooks } from '@/components/landing/FloatingBooks';
import { BrandIntro } from '@/components/landing/BrandIntro';
import { QuoteSection } from '@/components/landing/QuoteSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';
import { IntroOverlay } from '@/components/landing/IntroOverlay';
import { IndexingShowcase } from '@/components/landing/IndexingShowcase';
import { AuthorBenefits } from '@/components/landing/AuthorBenefits';
import { ImpactMetrics } from '@/components/landing/ImpactMetrics';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Welcome to MMSR Publications | Luxury Academic & Scientific Gateway',
  description:
    'Experience MMSR Publications - Missile Man Scientific & Research Publications. High-impact peer-reviewed journals, academic edited books, and scientific research.',
};

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#F8EEDC] text-ivory-white overflow-x-hidden selection:bg-gold-500/30 selection:text-gold-400">
      {/* 2.5s First-Visit Luxury Intro Overlay */}
      <IntroOverlay />

      {/* Background Visual Effects & Floating Particles */}
      <BackgroundEffects />
      <Particles count={35} />

      {/* Main Content Layout */}
      <div className="relative z-10">
        {/* Section 1: Fullscreen Luxury Hero */}
        <LandingHero />

        {/* Section 2: Key Platform Impact Metrics */}
        <ImpactMetrics />

        {/* Section 3: Floating Publication Artifacts */}
        <FloatingBooks />

        {/* Section 4: Brand Core Values */}
        <BrandIntro />

        {/* Section 5: Global Citation & Indexing Standards */}
        <IndexingShowcase />

        {/* Section 6: Author Privileges & Publishing Benefits */}
        <AuthorBenefits />

        {/* Section 7: Academic Quote Section */}
        <QuoteSection />

        {/* Section 8: Final Enter Website CTA */}
        <FinalCTASection />
      </div>
    </div>
  );
}
