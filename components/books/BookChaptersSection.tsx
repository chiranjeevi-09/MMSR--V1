'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Lock,
  Unlock,
  Eye,
  Users,
  FileText,
  Hash,
  Calendar,
  ChevronRight,
  GraduationCap,
  Sparkles,
  ExternalLink,
  BookMarked,
  ShieldCheck,
} from 'lucide-react';
import { BookChapter, ChapterAuthor, ChapterSection } from '@/lib/types/book';
import { PublicId } from '@/components/ui/PublicId';
import { fetchBookChapters } from '@/lib/services/books';
import { cn } from '@/lib/utils/cn';

// ─── Access mode badge ───────────────────────────────────────────────────────

function AccessBadge({ mode }: { mode: BookChapter['access_mode'] }) {
  if (mode === 'open_access') {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
        <Unlock className="w-3 h-3 text-emerald-600" />
        Open Access
      </span>
    );
  }
  if (mode === 'preview_only') {
    return (
      <span className="inline-flex items-center gap-1 text-[13px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
        <Eye className="w-3 h-3 text-amber-600" />
        Preview Only
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[13px] font-bold uppercase tracking-wider bg-[#C99A2E]/15 text-[#8C6239] border border-[#C99A2E]/30 px-2.5 py-0.5 rounded-full">
      <Lock className="w-3 h-3 text-[#C99A2E]" />
      Paid Content
    </span>
  );
}

// ─── Author Card Component ───────────────────────────────────────────────────

function CenteredAuthorCard({
  authors,
  rawNames,
}: {
  authors: ChapterAuthor[];
  rawNames?: string;
}) {
  // Determine effective authors list
  let effectiveAuthors: ChapterAuthor[] = authors && authors.length > 0 ? authors : [];

  if (effectiveAuthors.length === 0 && rawNames && rawNames.trim()) {
    try {
      const parsed = JSON.parse(rawNames);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        effectiveAuthors = parsed.map((item: any, idx: number) => ({
          id: item.id || idx + 1,
          name: item.name || '',
          designation: item.designation || '',
          affiliation: item.affiliation || '',
          bio: item.bio || '',
        }));
      }
    } catch {
      // Not a JSON string, fallback to comma-separated names
    }
  }

  // If structured authors array exists and is not empty
  if (effectiveAuthors.length > 0) {
    const count = effectiveAuthors.length;

    // Dynamic responsive grid sizing based on author count
    const gridClass =
      count === 1
        ? 'max-w-xl mx-auto grid-cols-1'
        : count === 2
        ? 'max-w-3xl mx-auto grid-cols-1 sm:grid-cols-2'
        : count === 3
        ? 'max-w-5xl mx-auto grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        : 'w-full grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-5 md:p-6 bg-[#FFF9F1] border border-[#D4AC54]/40 rounded-2xl text-center shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#C99A2E]">
          <GraduationCap className="w-4.5 h-4.5 text-[#C99A2E]" />
          <span>Chapter Author{count > 1 ? 's' : ''}</span>
        </div>

        <div className={`grid gap-4 md:gap-5 w-full ${gridClass}`}>
          {effectiveAuthors.map((author) => {
            const initials = author.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={author.id || author.name}
                className="flex items-start gap-4 bg-white border border-[#D4AC54]/30 rounded-2xl p-5 shadow-xs text-left h-full transition-all hover:border-[#C99A2E]/60"
              >
                {/* Enlarged Avatar */}
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-[#C99A2E] to-[#8C6239] flex items-center justify-center text-sm md:text-base font-extrabold text-white shrink-0 shadow-sm">
                  {initials}
                </div>

                {/* Author Info */}
                <div className="flex-1 min-w-0 break-words">
                  <h4 className="text-sm md:text-base font-bold font-playfair text-[#3A2312] leading-snug">
                    {author.name}
                  </h4>

                  {author.designation && (
                    <div className="text-xs font-semibold text-[#8C6239] mt-0.5">
                      {author.designation}
                    </div>
                  )}

                  {author.affiliation && (
                    <div className="text-xs text-[#8C6239]/90 mt-0.5">
                      {author.affiliation}
                    </div>
                  )}

                  {author.bio && (
                    <p className="text-xs text-[#5C4033] leading-relaxed mt-2.5 italic bg-[#FFF9F1] p-3 rounded-xl border border-[#D4AC54]/20">
                      {author.bio}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback if only plain comma-separated author string exists
  if (rawNames && rawNames.trim()) {
    const names = rawNames.split(/[,;]/).map((n) => n.trim()).filter(Boolean);
    const count = names.length;

    const gridClass =
      count === 1
        ? 'max-w-md mx-auto grid-cols-1'
        : count === 2
        ? 'max-w-2xl mx-auto grid-cols-1 sm:grid-cols-2'
        : count === 3
        ? 'max-w-4xl mx-auto grid-cols-1 sm:grid-cols-3'
        : 'w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-5 md:p-6 bg-[#FFF9F1] border border-[#D4AC54]/40 rounded-2xl text-center shadow-xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#C99A2E]">
          <Users className="w-4.5 h-4.5 text-[#C99A2E]" />
          <span>Chapter Author{count > 1 ? 's' : ''}</span>
        </div>

        <div className={`grid gap-4 w-full ${gridClass}`}>
          {names.map((name, idx) => {
            const initials = name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={idx}
                className="flex items-center gap-3.5 bg-white border border-[#D4AC54]/30 rounded-2xl p-4 shadow-xs text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#C99A2E] to-[#8C6239] flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-xs">
                  {initials}
                </div>
                <div className="text-xs md:text-sm font-bold text-[#3A2312] truncate">
                  {name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}


// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 rounded-xl bg-[#D4AC54]/20" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 h-64 rounded-2xl bg-[#D4AC54]/15" />
        <div className="lg:col-span-8 h-64 rounded-2xl bg-[#D4AC54]/15" />
      </div>
    </div>
  );
}

// ─── Main Exported Component ──────────────────────────────────────────────────

interface BookChaptersSectionProps {
  bookSlug: string;
}

export const BookChaptersSection: React.FC<BookChaptersSectionProps> = ({ bookSlug }) => {
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [loading, setLoading] = useState(true);

  // Active state handlers
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<number | string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchBookChapters(bookSlug).then((data) => {
      if (active) {
        setChapters(data);
        if (data.length > 0) {
          setSelectedChapterId(data[0].id);
        }
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [bookSlug]);

  // Selected Chapter object
  const selectedChapter = useMemo(() => {
    return chapters.find((c) => c.id === selectedChapterId) || chapters[0] || null;
  }, [chapters, selectedChapterId]);

  // Derived Title / Section Items for the selected chapter
  const sectionItems = useMemo(() => {
    if (!selectedChapter) return [];

    // If structured sections exist
    if (selectedChapter.sections && selectedChapter.sections.length > 0) {
      return selectedChapter.sections.map((sec) => ({
        id: sec.id,
        orderNumber: String(sec.display_order),
        title: sec.title,
        previewContent: sec.preview_content,
        fullContent: sec.full_content,
      }));
    }

    // Fallback: If no child section models exist, create a default overview title item
    return [
      {
        id: `chap-${selectedChapter.id}-overview`,
        orderNumber: '1',
        title: `${selectedChapter.title} — Overview & Contents`,
        previewContent: selectedChapter.sample_content || selectedChapter.description || '',
        fullContent: selectedChapter.sample_content || selectedChapter.description || '',
      },
    ];
  }, [selectedChapter]);

  // Auto-select first section item when chapter changes
  useEffect(() => {
    if (sectionItems.length > 0) {
      setSelectedSectionId(sectionItems[0].id);
    } else {
      setSelectedSectionId(null);
    }
  }, [selectedChapterId, sectionItems]);

  // Active section object
  const selectedSection = useMemo(() => {
    return sectionItems.find((s) => s.id === selectedSectionId) || sectionItems[0] || null;
  }, [sectionItems, selectedSectionId]);

  // Empty state — no chapters published yet
  if (!loading && chapters.length === 0) {
    return (
      <section className="py-6 font-manrope scroll-mt-24" id="book-chapters">
        <div className="flex flex-col items-center justify-center text-center gap-3 py-12 px-6 rounded-2xl bg-[#FFF9F1] border border-dashed border-[#D4AC54]/50">
          <div className="w-14 h-14 rounded-2xl bg-[#C99A2E]/10 border border-[#D4AC54]/40 flex items-center justify-center">
            <BookMarked className="w-7 h-7 text-[#C99A2E]" />
          </div>
          <h2 className="text-lg md:text-xl font-bold font-playfair text-[#3A2312]">No Chapters Published Yet</h2>
          <p className="text-xs text-[#8C6239] max-w-md leading-relaxed">
            This book does not have any chapters available right now. Please check back soon — new chapters will appear here once they are published.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 font-manrope scroll-mt-24" id="book-chapters">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-widest text-[#C99A2E] mb-1 flex items-center gap-1.5">
            <BookMarked className="w-3.5 h-3.5" />
            Publication Table of Contents
          </p>
          <h2 className="text-2xl md:text-3xl font-bold font-playfair text-[#3A2312]">
            Chapters &amp; Table of Contents
          </h2>
          <p className="text-xs text-[#8C6239] mt-1">
            Select any chapter below to explore its sections, authors, and available details.
          </p>
        </div>

        {!loading && chapters.length > 0 && (
          <span className="text-xs font-bold text-[#8C6239] bg-[#C99A2E]/10 border border-[#C99A2E]/30 rounded-full px-3.5 py-1.5 h-fit shadow-2xs">
            {chapters.length} Chapter{chapters.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <SectionSkeleton />
      ) : (
        <div className="space-y-6">
          {/* ─── TASK 1: HORIZONTAL CHAPTER TABS ────────────────────────────── */}
          <div className="relative">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-1 scrollbar-none border-b border-[#D4AC54]/30">
              {chapters.map((chap) => {
                const isSelected = chap.id === selectedChapterId;
                return (
                  <button
                    key={chap.id}
                    type="button"
                    onClick={() => setSelectedChapterId(chap.id)}
                    className={cn(
                      'shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer',
                      isSelected
                        ? 'bg-gradient-to-r from-[#C99A2E] to-[#8C6239] text-white shadow-md scale-[1.02]'
                        : 'bg-[#FFF9F1] text-[#8C6239] hover:bg-[#FFF2D9] border border-[#D4AC54]/40 hover:border-[#C99A2E]'
                    )}
                  >
                    <span
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[13px] font-extrabold',
                        isSelected ? 'bg-white/20 text-white' : 'bg-[#C99A2E]/15 text-[#8C6239]'
                      )}
                    >
                      {chap.chapter_number}
                    </span>
                    <span>Chapter {chap.chapter_number}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── SELECTED CHAPTER AREA ─────────────────────────────────────── */}
          {selectedChapter && (
            <div className="space-y-6">
              {/* ─── TASK 2: CENTERED AUTHOR AREA ABOVE COLUMNS ─────────────── */}
              <CenteredAuthorCard
                authors={selectedChapter.authors}
                rawNames={selectedChapter.author_names_raw}
              />

              {/* ─── TASK 2: TWO-COLUMN CHAPTER LAYOUT ───────────────────────── */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ─── LEFT COLUMN: CHAPTER TITLES / SECTIONS LIST ──────────── */}
                <div className="lg:col-span-4 bg-[#FFF9F1] border border-[#D4AC54]/40 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#D4AC54]/30">
                    <span className="text-[13px] font-bold uppercase tracking-wider text-[#C99A2E] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Chapter Sections
                    </span>
                    <span className="text-[13px] font-semibold text-[#8C6239]">
                      {sectionItems.length} Title{sectionItems.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {sectionItems.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#8C6239]">
                      No sections listed for this chapter.
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto pr-1 space-y-2 scrollbar-thin">
                      {sectionItems.map((sec, idx) => {
                        const isSecSelected = sec.id === selectedSectionId;

                        return (
                          <button
                            key={sec.id}
                            type="button"
                            onClick={() => setSelectedSectionId(sec.id)}
                            className={cn(
                              'w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer group',
                              isSecSelected
                                ? 'bg-[#C99A2E]/15 border-[#C99A2E] shadow-2xs'
                                : 'bg-white border-[#D4AC54]/30 hover:border-[#C99A2E]/60 hover:bg-[#FFF9F1]'
                            )}
                          >
                            <span
                              className={cn(
                                'shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[13px] font-bold mt-0.5',
                                isSecSelected
                                  ? 'bg-[#C99A2E] text-white'
                                  : 'bg-[#C99A2E]/10 text-[#8C6239] group-hover:bg-[#C99A2E]/20'
                              )}
                            >
                              {sec.orderNumber || idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div
                                className={cn(
                                  'text-xs leading-snug line-clamp-2',
                                  isSecSelected
                                    ? 'font-bold text-[#3A2312]'
                                    : 'font-semibold text-[#5C4033] group-hover:text-[#3A2312]'
                                )}
                              >
                                {sec.title}
                              </div>
                            </div>
                            <ChevronRight
                              className={cn(
                                'w-4 h-4 shrink-0 mt-1 transition-transform',
                                isSecSelected
                                  ? 'text-[#C99A2E] translate-x-0.5'
                                  : 'text-[#8C6239]/40 group-hover:text-[#8C6239]'
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ─── RIGHT COLUMN: SELECTED TITLE DETAILS READING PANEL ───── */}
                <div className="lg:col-span-8 bg-white border border-[#D4AC54]/40 rounded-2xl p-6 shadow-sm space-y-5">
                  {selectedSection ? (
                    <>
                      {/* Section Title & Metadata Header */}
                      <div className="space-y-3 pb-4 border-b border-[#D4AC54]/30">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[13px] font-bold uppercase tracking-wider text-[#C99A2E]">
                            Ch. {selectedChapter.chapter_number} — Section Details
                          </span>
                          <PublicId value={selectedChapter.public_id} tone="light" size="sm" />
                          <AccessBadge mode={selectedChapter.access_mode} />
                        </div>

                        <h3 className="text-xl font-bold font-playfair text-[#3A2312] leading-snug">
                          {selectedSection.title}
                        </h3>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-[#8C6239]">
                          {selectedChapter.page_range && (
                            <span className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-[#C99A2E]" />
                              Pages: <strong>{selectedChapter.page_range}</strong>
                            </span>
                          )}
                          {selectedChapter.doi && (
                            <span className="flex items-center gap-1.5 font-mono text-[13px]">
                              <Hash className="w-3.5 h-3.5 text-[#C99A2E]" />
                              DOI: <strong>{selectedChapter.doi}</strong>
                            </span>
                          )}
                          {selectedChapter.publication_date && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#C99A2E]" />
                              {new Date(selectedChapter.publication_date).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content Display Panel (Excludes Abstract & Keywords per prompt) */}
                      <div className="space-y-4">
                        {/* Sample / Preview Text */}
                        {(selectedSection.previewContent || selectedSection.fullContent) ? (
                          <div className="space-y-2">
                            <span className="text-[13px] font-bold uppercase tracking-widest text-[#C99A2E] flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              Section Content Preview
                            </span>
                            <div className="text-xs text-[#5C4033] leading-relaxed italic bg-[#FFF9F1] rounded-xl p-4 border border-[#D4AC54]/30 whitespace-pre-wrap">
                              {selectedSection.previewContent || selectedSection.fullContent}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/30 text-xs text-[#8C6239] italic">
                            Full section content is available for this title upon publication authorization.
                          </div>
                        )}

                        {/* Paid Content Restrictions Notice */}
                        {selectedChapter.access_mode === 'paid' && (
                          <div className="rounded-xl bg-[#C99A2E]/10 border border-[#C99A2E]/30 p-4 space-y-3">
                            <div className="flex items-start gap-3">
                              <Lock className="w-5 h-5 text-[#C99A2E] shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-xs font-bold text-[#3A2312]">
                                  Paid Access Requirement
                                </h4>
                                <p className="text-xs text-[#5C4033] mt-0.5 leading-relaxed">
                                  Full chapter and section text are accessible to verified purchasers. Purchase this book to unlock full reading access.
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-end pt-1">
                              <a
                                href="#book-purchase"
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#C99A2E] to-[#8C6239] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-opacity"
                              >
                                View Full Details &amp; Purchase
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Open Access Notice */}
                        {selectedChapter.access_mode === 'open_access' && (
                          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>This chapter is published under Open Access license terms.</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12 text-xs text-[#8C6239]">
                      Select a section from the left list to view details.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
