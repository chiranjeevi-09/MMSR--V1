'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileCheck, Loader2, Lock, AlertCircle } from 'lucide-react';
import { JournalArticle } from '@/lib/types/journal';
import { fetchArticlesForIssue } from '@/lib/services/journals';

interface IssueArticlesInlineProps {
  journalSlug: string;
  issueId: string;
  /** Articles already embedded in the journal payload (avoids a network round-trip). */
  initialArticles?: JournalArticle[];
  /**
   * Kept for caller compatibility but intentionally NOT used for access gating:
   * an article's own access_mode is authoritative. A journal-level Open Access
   * flag must not mark an explicitly-paid article as free.
   */
  openAccessJournal?: boolean;
}

/**
 * Inline article listing shown under a selected issue on the journal homepage.
 * Filters articles for the issue entirely in client state — no navigation to
 * the separate issue page occurs.
 */
export const IssueArticlesInline: React.FC<IssueArticlesInlineProps> = ({
  journalSlug,
  issueId,
  initialArticles,
}) => {
  const preloaded = Array.isArray(initialArticles) && initialArticles.length > 0;
  const [articles, setArticles] = useState<JournalArticle[]>(preloaded ? initialArticles! : []);
  const [loading, setLoading] = useState(!preloaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preloaded) return;
    let cancelled = false;

    (async () => {
      try {
        const fetched = await fetchArticlesForIssue(issueId);
        if (!cancelled) setArticles(fetched);
      } catch {
        if (!cancelled) setError('Failed to load articles for this issue.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [issueId, preloaded]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-5 text-xs font-medium text-[#6E5238]">
        <Loader2 className="w-4 h-4 animate-spin text-[#B8860B]" />
        Loading articles for this issue…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-5 text-xs font-medium text-red-700">
        <AlertCircle className="w-4 h-4" />
        {error}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="p-5 text-xs text-[#6E5238] font-medium italic">
        No articles have been indexed for this issue yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-3 sm:p-4">
      {articles.map((art, idx) => {
        // Per-article authoritative: only freely open when the article itself
        // is marked open_access. Paid / preview-only articles show Protected.
        const isOpenAccess = art.accessMode === 'open_access';
        const href = `/articles/${art.slug || art.id}`;
        return (
          <article
            key={art.id || idx}
            className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 overflow-hidden rounded-xl border border-[#D4AC54]/25 bg-white p-4 sm:p-5 shadow-[0_2px_10px_rgba(139,107,27,0.05)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D4AC54]/60 hover:shadow-[0_12px_30px_rgba(184,134,11,0.16)]"
          >
            {/* Animated left accent bar */}
            <span className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[#D4AC54] to-[#8C6B1B] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-[#D4AC54] to-[#8C6B1B] text-white font-bold text-xs font-mono flex items-center justify-center shadow-[0_2px_8px_rgba(184,134,11,0.35)]">
                {idx + 1}
              </span>
              <Link href={href} className="min-w-0">
                <h6 className="text-sm sm:text-[15px] font-bold font-playfair text-[#3A2312] leading-snug transition-colors group-hover:text-[#B8860B]">
                  {art.title}
                </h6>
              </Link>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 sm:pl-4">
              {isOpenAccess ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#2E6B34]/25 bg-[#2E6B34]/10 px-2.5 py-1 text-[13px] font-mono font-bold text-[#2E6B34]">
                  <FileCheck className="w-3 h-3" /> Open Access
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AC54] bg-[#C99A2E]/10 px-2.5 py-1 text-[13px] font-mono font-bold text-[#B8860B]">
                  <Lock className="w-3 h-3" /> Protected
                </span>
              )}
              <Link
                href={href}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#C99A2E] px-3 py-1.5 text-[13px] font-bold text-white shadow-sm transition-all duration-300 hover:bg-[#A97917] hover:shadow-md"
              >
                Read Paper <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
};
