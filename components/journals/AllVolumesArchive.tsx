'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Calendar,
  FileCheck,
  AlertCircle,
  Archive,
} from 'lucide-react';
import { Journal, JournalIssue } from '@/lib/types/journal';
import { Button } from '@/components/ui/Button';

interface AllVolumesArchiveProps {
  journal: Journal;
  /** Whether the archive API failed. When true, shows an error state instead of an empty-list state. */
  loadError?: string | null;
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

interface VolumeGroup {
  volumeNumber: number;
  issues: JournalIssue[];
}

export const AllVolumesArchive: React.FC<AllVolumesArchiveProps> = ({ journal, loadError }) => {
  const allIssues: JournalIssue[] = journal.issues || [];

  // Group issues by volume using numeric keys. Deduplicate by issue ID.
  const volumeMap = new Map<number, JournalIssue[]>();
  const seenIds = new Set<string>();

  allIssues.forEach((iss) => {
    if (seenIds.has(iss.id)) return;
    seenIds.add(iss.id);
    const vol = effectiveVolume(iss);
    if (!volumeMap.has(vol)) {
      volumeMap.set(vol, []);
    }
    volumeMap.get(vol)!.push(iss);
  });

  // Sort volumes descending (newest first)
  const sortedVolumeGroups: VolumeGroup[] = Array.from(volumeMap.entries())
    .sort(([a], [b]) => b - a)
    .map(([volumeNumber, issues]) => ({
      volumeNumber,
      issues: issues.sort((a, b) => {
        // Sort issues within a volume: newest first by issue number, then publication date
        const numDiff = effectiveIssueNum(b) - effectiveIssueNum(a);
        if (numDiff !== 0) return numDiff;
        return new Date(b.publicationDate).getTime() - new Date(a.publicationDate).getTime();
      }),
    }));

  // Track which volumes are expanded (all expanded by default for accessibility)
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(() =>
    new Set(sortedVolumeGroups.map((g) => g.volumeNumber))
  );

  const toggleVolume = (vol: number) => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(vol)) {
        next.delete(vol);
      } else {
        next.add(vol);
      }
      return next;
    });
  };

  return (
    <section id="all-volumes-archive" className="py-12 font-manrope">
      <div className="flex flex-col gap-2 mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">
          Complete Journal Archive
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-2xl font-bold font-playfair text-[#3A2312]">
            All Volumes &amp; Issues
          </h3>
          {sortedVolumeGroups.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6E5238] bg-[#F8EEDC] px-3 py-1 rounded-full border border-[#D4AC54]">
              <Archive className="w-3.5 h-3.5" />
              {sortedVolumeGroups.length} Volume{sortedVolumeGroups.length !== 1 ? 's' : ''} &bull;{' '}
              {allIssues.length} Issue{allIssues.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <p className="text-xs text-[#6E5238] font-medium max-w-xl">
          Every published volume and issue of {journal.title}, from the latest release to the first edition.
          Open any issue to view its contents, complete issue PDF and access options.
        </p>
      </div>

      {/* Error state */}
      {loadError && (
        <div className="p-8 rounded-2xl bg-[#FFF9F1] border border-[#DC2626]/25 text-center flex flex-col items-center justify-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-500 opacity-80" />
          <h4 className="text-base font-bold font-playfair text-[#3A2312]">
            Failed to Load Archive
          </h4>
          <p className="text-xs text-[#6E5238] max-w-md font-medium">
            {loadError} Please refresh the page to try again.
          </p>
        </div>
      )}

      {/* Empty state — only when no error */}
      {!loadError && sortedVolumeGroups.length === 0 && (
        <div className="p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-center flex flex-col items-center justify-center gap-3">
          <BookOpen className="w-8 h-8 text-[#B8860B] opacity-80" />
          <h4 className="text-base font-bold font-playfair text-[#3A2312]">
            No Published Volumes Yet
          </h4>
          <p className="text-xs text-[#6E5238] max-w-md font-medium">
            This journal does not yet have any published volumes. Future issues will appear here when published.
          </p>
        </div>
      )}

      {/* Volume groups */}
      {!loadError && sortedVolumeGroups.length > 0 && (
        <div className="flex flex-col gap-4">
          {sortedVolumeGroups.map((group) => {
            const isExpanded = expandedVolumes.has(group.volumeNumber);

            return (
              <div
                key={group.volumeNumber}
                className="rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] overflow-hidden shadow-glass"
              >
                {/* Volume header — clickable to collapse/expand */}
                <button
                  type="button"
                  onClick={() => toggleVolume(group.volumeNumber)}
                  className="w-full flex items-center justify-between gap-4 p-5 hover:bg-[#F8EEDC] transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#D4AC54] text-left"
                  aria-expanded={isExpanded}
                  aria-controls={`volume-${group.volumeNumber}-issues`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AC54] to-[#8C6B1B] flex flex-col items-center justify-center text-white font-bold font-playfair shrink-0">
                      <span className="text-[13px] text-[#FFF9F1]/80 uppercase leading-none">Vol</span>
                      <span className="text-sm leading-none">{group.volumeNumber}</span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold font-playfair text-[#3A2312]">
                        Volume {group.volumeNumber}
                      </h4>
                      <p className="text-xs text-[#6E5238] font-medium">
                        {group.issues.length} published issue{group.issues.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-[#B8860B] shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#B8860B] shrink-0" />
                  )}
                </button>

                {/* Issue list within the volume */}
                {isExpanded && (
                  <div
                    id={`volume-${group.volumeNumber}-issues`}
                    className="border-t border-[#D4AC54]/40"
                  >
                    {group.issues.map((iss, idx) => {
                      const volNum = effectiveVolume(iss);
                      const issNum = effectiveIssueNum(iss);
                      // No issue-level price is shown: complete issues are not sold
                      // separately, they are covered by the journal subscription.
                      const hasDigital = Boolean(iss.hasDigital || iss.samplePdfUrl);
                      const hasCover = Boolean(iss.cover);
                      const isLast = idx === group.issues.length - 1;

                      return (
                        <div
                          key={iss.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 hover:bg-[#F8EEDC] transition-colors group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#D4AC54] ${
                            !isLast ? 'border-b border-[#D4AC54]/30' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {hasCover ? (
                              <Image
                                src={iss.cover!}
                                alt={iss.title || `Volume ${volNum}`}
                                width={40}
                                height={48}
                                loading="lazy"
                                className="w-10 h-12 object-cover rounded border border-[#D4AC54] shrink-0 group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-[#F8EEDC] border border-[#D4AC54]/60 flex items-center justify-center shrink-0">
                                <BookOpen className="w-4 h-4 text-[#B8860B]" />
                              </div>
                            )}

                            <div className="flex flex-col gap-0.5">
                              <h5 className="text-sm font-bold font-playfair text-[#3A2312] group-hover:text-[#B8860B] transition-colors">
                                Issue {issNum}
                              </h5>
                              <div className="flex items-center gap-2 flex-wrap">
                                {iss.publicationDate && (
                                  <span className="text-[13px] font-mono text-[#6E5238] flex items-center gap-0.5">
                                    <Calendar className="w-3 h-3" />
                                    {iss.publicationDate}
                                  </span>
                                )}
                                <span
                                  className={`text-[13px] flex items-center gap-0.5 ${
                                    hasDigital
                                      ? 'text-[#2E6B34] font-semibold'
                                      : 'text-[#6E5238]'
                                  }`}
                                >
                                  <FileCheck className="w-3 h-3" />
                                  {hasDigital ? 'Digital PDF' : 'No PDF Yet'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Link
                            href={`/journals/${journal.slug}/volume/${volNum}/issue/${issNum}`}
                            className="shrink-0"
                            aria-label={`View Issue ${issNum} of Volume ${volNum}`}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              rightIcon={<ChevronRight className="w-3 h-3 text-[#B8860B]" />}
                              className="border-[#D4AC54] text-[#3A2312] hover:bg-[#D4AC54]/10 text-xs py-1 w-full"
                            >
                              View Issue
                            </Button>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
