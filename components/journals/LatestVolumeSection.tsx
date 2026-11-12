'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  FileCheck,
  Sparkles,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { Journal, JournalIssue } from '@/lib/types/journal';
import { Button } from '@/components/ui/Button';

interface LatestVolumeSectionProps {
  journal: Journal;
}

/**
 * Returns the effective volume number for an issue.
 * Uses the authoritative DB field (volumeNumber) when non-null,
 * otherwise falls back to the parsed `volume` field.
 */
function effectiveVolume(iss: JournalIssue): number {
  return iss.volumeNumber != null ? iss.volumeNumber : iss.volume;
}

/**
 * Returns the effective issue number for an issue.
 * Uses the authoritative DB field (issueNumber) when non-null,
 * otherwise falls back to the parsed `issue` field.
 */
function effectiveIssueNum(iss: JournalIssue): number {
  return iss.issueNumber != null ? iss.issueNumber : iss.issue;
}

export const LatestVolumeSection: React.FC<LatestVolumeSectionProps> = ({ journal }) => {
  const router = useRouter();
  const allIssues: JournalIssue[] = journal.issues || [];

  // Determine the latest volume number using numeric sort (descending)
  const latestVolumeNumber = allIssues.reduce<number | null>((max, iss) => {
    const v = effectiveVolume(iss);
    return max === null ? v : Math.max(max, v);
  }, null);

  // Filter issues belonging to the latest volume, sorted newest issue first
  const latestVolumeIssues = latestVolumeNumber !== null
    ? allIssues
        .filter((iss) => effectiveVolume(iss) === latestVolumeNumber)
        .sort((a, b) => {
          const numDiff = effectiveIssueNum(b) - effectiveIssueNum(a);
          if (numDiff !== 0) return numDiff;
          // Secondary: by publication date descending
          return new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime();
        })
    : [];

  const handleIssueClick = (iss: JournalIssue) => {
    const vol = effectiveVolume(iss);
    const num = effectiveIssueNum(iss);
    if (vol && num) {
      router.push(`/journals/${journal.slug}/volume/${vol}/issue/${num}`);
    } else {
      // Safe fallback: navigate using the issue ID
      router.push(`/journals/${journal.slug}/volume/${vol || 1}/issue/${iss.id}`);
    }
  };

  return (
    <section className="py-12 font-manrope">
      <div className="flex flex-col gap-2 mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">
          Latest Published Papers
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-2xl font-bold font-playfair text-[#3A2312]">
            Featured Journal Articles
          </h3>
          {latestVolumeNumber !== null && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B8860B] bg-[#C99A2E]/15 px-3 py-1 rounded-full border border-[#D4AC54]">
              <Sparkles className="w-3.5 h-3.5" />
              Volume {latestVolumeNumber} — Latest Volume
            </span>
          )}
        </div>
        {latestVolumeNumber !== null && (
          <p className="text-xs text-[#6E5238] font-medium max-w-xl">
            Showing all published issues from Volume {latestVolumeNumber}.
            Click any issue to view its table of contents and articles.
          </p>
        )}
      </div>

      {/* Latest volume issue cards */}
      {latestVolumeIssues.length > 0 ? (
        <div className="flex flex-col gap-4 mb-8">
          {latestVolumeIssues.map((iss) => {
            const volNum = effectiveVolume(iss);
            const issNum = effectiveIssueNum(iss);
            // No issue-level price is shown: complete issues are covered by the
            // journal subscription and are never sold separately.
            const hasCover = Boolean(iss.coverWebp || iss.cover);
            const hasDigital = Boolean(iss.hasDigital || iss.samplePdfUrl);

            return (
              <div
                key={iss.id}
                role="button"
                tabIndex={0}
                onClick={() => handleIssueClick(iss)}
                onKeyDown={(e) => e.key === 'Enter' && handleIssueClick(iss)}
                className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#8C6B1B] shadow-glass hover:shadow-gold-glow flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all duration-300 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-[#D4AC54]"
                aria-label={`View ${iss.title || `Volume ${volNum}, Issue ${issNum}`}`}
              >
                <div className="flex items-center gap-4">
                  {hasCover ? (
                    <Image
                      src={(iss.coverWebp || iss.cover)!}
                      alt={iss.title || `Volume ${volNum}`}
                      width={56}
                      height={72}
                      loading="lazy"
                      className="w-14 h-18 object-cover rounded-lg border border-[#D4AC54] shrink-0 group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AC54] to-[#8C6B1B] p-0.5 shadow-gold-glow shrink-0 flex flex-col items-center justify-center text-white font-bold font-playfair group-hover:scale-105 transition-transform">
                      <span className="text-xs text-[#FFF9F1]/80 uppercase">Vol</span>
                      <span className="text-lg leading-none">{volNum}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-lg font-bold font-playfair text-[#3A2312] group-hover:text-[#B8860B] transition-colors">
                        {iss.title
                          ? iss.title
                          : `Volume ${volNum}, Issue ${issNum}`}
                      </h4>
                      {iss.publicationDate && (
                        <span className="text-[13px] font-mono font-bold text-[#2E6B34] bg-[#2E6B34]/10 px-2 py-0.5 rounded border border-[#2E6B34]/20 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {iss.publicationDate}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6E5238] font-medium">
                      {iss.articleCount > 0 && (
                        <span>{iss.articleCount} Peer-Reviewed Article{iss.articleCount !== 1 ? 's' : ''}</span>
                      )}
                      {iss.articleCount > 0 && <span>•</span>}
                      <span
                        className={
                          hasDigital
                            ? 'text-[#2E6B34] flex items-center gap-1 font-semibold'
                            : 'text-[#6E5238]'
                        }
                      >
                        <FileCheck className="w-3.5 h-3.5 text-[#2E6B34]" />
                        {hasDigital ? 'Digital PDF Available' : 'No PDF Yet'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleIssueClick(iss);
                    }}
                    rightIcon={<ChevronRight className="w-3.5 h-3.5 text-[#B8860B]" />}
                    className="border-[#D4AC54] text-[#3A2312] hover:bg-[#D4AC54]/10"
                  >
                    View Issue
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-center flex flex-col items-center justify-center gap-3 mb-8">
          <BookOpen className="w-8 h-8 text-[#B8860B] opacity-80" />
          <h4 className="text-base font-bold font-playfair text-[#3A2312]">
            No Published Issues Available
          </h4>
          <p className="text-xs text-[#6E5238] max-w-md font-medium">
            There are currently no published issues for this journal.
            Check back soon for upcoming volume releases.
          </p>
        </div>
      )}

      {/* Article previews — shown only when articles exist; empty article previews never hide issue cards */}
      {journal.articles && journal.articles.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">
              Article Previews
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {journal.articles.slice(0, 4).map((art) => (
              <div
                key={art.id}
                className="p-5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 flex flex-col gap-2"
              >
                <h5 className="text-sm font-bold font-playfair text-[#3A2312]">{art.title}</h5>
                {art.authors && (
                  <p className="text-xs text-[#6E5238] font-medium">{art.authors}</p>
                )}
                {art.abstract && (
                  <p className="text-xs text-[#5C4033] leading-relaxed italic line-clamp-2">
                    &ldquo;{art.abstract}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note when article previews are absent but issues exist */}
      {(!journal.articles || journal.articles.length === 0) && latestVolumeIssues.length > 0 && (
        <div className="mt-4 p-5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/30 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#B8860B] opacity-70 shrink-0" />
          <p className="text-xs text-[#6E5238] font-medium">
            Individual article previews are not yet indexed for this journal.
            Full paper archives are accessible through each issue above.
          </p>
        </div>
      )}
    </section>
  );
};
