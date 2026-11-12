'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchJournalBySlug, fetchJournals } from '@/lib/services/journals';
import { Journal } from '@/lib/types/journal';
import { JournalBreadcrumb } from '@/components/journals/JournalBreadcrumb';
import { JournalDetailsHero } from '@/components/journals/JournalDetailsHero';
import { JournalInformation } from '@/components/journals/JournalInformation';
import { JournalMetrics } from '@/components/journals/JournalMetrics';
import { EditorialBoard } from '@/components/journals/EditorialBoard';
import { AllVolumesArchive } from '@/components/journals/AllVolumesArchive';
import { RelatedJournals } from '@/components/journals/RelatedJournals';
import { ReviewSection } from '@/components/reviews/ReviewSection';
import { JournalQuickView } from '@/components/journals/JournalQuickView';
import { JournalDetailsSkeleton } from '@/components/journals/JournalSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookOpen } from 'lucide-react';

interface JournalDetailClientProps {
  slug: string;
}

export const JournalDetailClient: React.FC<JournalDetailClientProps> = ({ slug }) => {
  const router = useRouter();

  const [journal, setJournal] = useState<Journal | null>(null);
  const [relatedJournals, setRelatedJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quickViewJournal, setQuickViewJournal] = useState<Journal | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadJournalData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await fetchJournalBySlug(slug);
        if (!isMounted) return;

        if (!data) {
          setLoadError('Journal not found.');
          setLoading(false);
          return;
        }

        setJournal(data);

        if (data) {
          const relRes = await fetchJournals({
            discipline: data.categorySlug || data.discipline,
            limit: 6,
          });

          if (isMounted) {
            const filtered = relRes.journals
              .filter((j) => j.id !== data.id && j.slug !== data.slug)
              .slice(0, 4);
            setRelatedJournals(filtered);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setLoadError(err?.message || 'Failed to load journal data.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (slug) {
      loadJournalData();
    }

    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return <JournalDetailsSkeleton />;
  }

  if (!journal) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <EmptyState
          icon={<BookOpen className="w-12 h-12 text-[#C9962A]" />}
          title="Journal Not Found"
          description="The requested scientific journal could not be found or may have been updated in our catalog."
          primaryActionLabel="Back to Journals Catalogue"
          onPrimaryAction={() => router.push('/journals')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#5C4033] font-manrope pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-6">
        {/* Breadcrumb */}
        <JournalBreadcrumb currentJournal={journal} />

        {/* SECTION 1 — Journal Hero & Information */}
        <JournalDetailsHero journal={journal} />

        {/* Tabbed / Detailed Information */}
        <JournalInformation journal={journal} />

        {/* SECTION 2 — All Volumes & Issues (complete archive)
            API errors produce an error state; genuinely empty journals produce an empty state. */}
        <AllVolumesArchive journal={journal} loadError={loadError} />

        {/* SECTION 3 — Academic Leadership with Core Journal Metrics on its right (both boxes equal height via fixed min-h) */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <EditorialBoard journal={journal} />
          <JournalMetrics journal={journal} />
        </section>

        {/* Related Scientific Journals */}
        {relatedJournals.length > 0 && (
          <RelatedJournals
            currentJournal={journal}
            relatedJournals={relatedJournals}
            onQuickView={(j) => setQuickViewJournal(j)}
          />
        )}

        {/* Write a Review — user reviews go to admin testimonials moderation */}
        <ReviewSection targetType="journal" targetId={Number(journal.id)} targetTitle={journal.title} />
      </div>

      {/* Quick View Modal for Related Journals */}
      {quickViewJournal && (
        <JournalQuickView
          journal={quickViewJournal}
          isOpen={!!quickViewJournal}
          onClose={() => setQuickViewJournal(null)}
        />
      )}
    </div>
  );
};
