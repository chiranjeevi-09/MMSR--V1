'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchConferenceBySlug } from '@/lib/services/conferences';
import { Conference } from '@/lib/types/conference';
import { ConferenceDetailsHero } from '@/components/conference/ConferenceDetailsHero';
import { ConferenceImportantDates } from '@/components/conference/ConferenceImportantDates';
import { ConferenceTracks } from '@/components/conference/ConferenceTracks';
import { ConferenceSpeakers } from '@/components/conference/ConferenceSpeakers';
import { ConferenceCommittee } from '@/components/conference/ConferenceCommittee';
import { ConferenceSchedule } from '@/components/conference/ConferenceSchedule';
import { ConferenceFAQs } from '@/components/conference/ConferenceFAQs';
import { EmptyState } from '@/components/ui/EmptyState';
import { CalendarDays, BookOpen, FileText } from 'lucide-react';

function ConferenceDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-[#F8EEDC] p-8 space-y-6 max-w-[1400px] mx-auto">
      <div className="h-8 w-48 bg-[#FFF9F1] rounded-lg animate-pulse" />
      <div className="h-64 bg-[#FFF9F1] rounded-3xl animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-[#FFF9F1] rounded-xl animate-pulse" />)}
      </div>
    </div>
  );
}

interface ConferenceDetailClientProps {
  slug: string;
}

export const ConferenceDetailClient: React.FC<ConferenceDetailClientProps> = ({ slug }) => {
  const router = useRouter();

  const [conference, setConference] = useState<Conference | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConference = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchConferenceBySlug(slug);
      setConference(data);
    } catch (err) {
      setError('Failed to fetch conference details. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConference();
  }, [slug]);

  if (loading) return <ConferenceDetailsSkeleton />;

  if (error) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="p-8 rounded-2xl bg-[#FFF9F1] border border-red-500/30 text-center space-y-4">
          <p className="text-sm text-ruby-red font-semibold">{error}</p>
          <button
            onClick={loadConference}
            className="px-5 py-2.5 rounded-xl bg-gold-500/20 text-gold-400 font-bold text-xs hover:bg-gold-500/30 border border-gold-500/40 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!conference) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <EmptyState
          icon={<CalendarDays className="w-12 h-12 text-gold-400" />}
          title="Conference Not Found"
          description="The requested academic conference could not be found. It may have been updated or removed."
          primaryActionLabel="Back to Conferences"
          onPrimaryAction={() => router.push('/conference')}
        />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12 pt-6">
        {/* Hero */}
        <ConferenceDetailsHero conference={conference} />

        {/* About / Full Description */}
        {conference.fullDescription && (
          <section className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 space-y-3">
            <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
                <BookOpen className="w-4 h-4" />
              </span>
              About the Conference
            </h2>
            <p className="text-text-muted leading-relaxed text-sm sm:text-base max-w-4xl">
              {conference.fullDescription}
            </p>
          </section>
        )}

        {/* Two column: Important Dates + Submission Guidelines */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ConferenceImportantDates conference={conference} />

          {/* Submission Information Panel */}
          <section id="submission-guidelines-section" className="space-y-4">
            <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
                <FileText className="w-4 h-4" />
              </span>
              Submission Guidelines
            </h2>

            <div className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-ivory-white">Paper Submission Instructions</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Authors are invited to submit original research papers in standard IEEE or MMSR template format. All accepted and presented papers will be published in SCOPUS / Web of Science indexed conference proceedings or partner MMSR journals.
                </p>
              </div>

              {conference.registrationFee && (
                <div className="p-4 rounded-xl bg-gold-500/10 border border-[#D4AC54] space-y-1">
                  <span className="text-[13px] font-bold text-gold-400 uppercase tracking-wider block">Fee</span>
                  <p className="text-sm font-bold text-ivory-white">
                    {typeof conference.registrationFee === 'string'
                      ? conference.registrationFee
                      : conference.registrationFee.regular || 'See Guidelines'}
                  </p>
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                {conference.submissionOpen ? (
                  <button
                    onClick={() => router.push(`/submit-conference-paper?conf=${encodeURIComponent(conference.slug)}`)}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#C9962A] hover:bg-[#b88a1e] text-[#2F241A] border-2 border-[#D4AC54] font-bold text-xs transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Submit Conference Paper
                  </button>
                ) : (
                  <>
                    <button
                      disabled
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#E9DFCF] text-[#8B7B68] font-bold text-xs cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Submissions Closed
                    </button>
                    <span className="text-xs text-red-700 font-semibold">
                      The submission deadline for this conference has passed.
                    </span>
                  </>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Tracks / Topics */}
        {conference.tracks && conference.tracks.length > 0 && (
          <ConferenceTracks conference={conference} />
        )}

        {/* Keynote Speakers */}
        {conference.speakers && conference.speakers.length > 0 && (
          <ConferenceSpeakers conference={conference} />
        )}

        {/* Organizing Committee */}
        {conference.committee && conference.committee.length > 0 && (
          <ConferenceCommittee conference={conference} />
        )}

        {/* Schedule / Timetable */}
        {conference.schedule && conference.schedule.length > 0 && (
          <ConferenceSchedule conference={conference} />
        )}

        {/* FAQs */}
        {conference.faqs && conference.faqs.length > 0 && (
          <ConferenceFAQs faqs={conference.faqs} />
        )}
      </div>
    </main>
  );
};
