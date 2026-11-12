'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  Calendar,
  User,
  ArrowRight,
  Download,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Lock,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import {
  fetchJournalBySlug,
  fetchJournalIssues,
  fetchArticlesForIssue,
  downloadIssuePdf,
  fetchUserJournalAccess,
} from '@/lib/services/journals';
import { Journal, JournalIssue, JournalArticle } from '@/lib/types/journal';
import { Button } from '@/components/ui/Button';
import { PublicId } from '@/components/ui/PublicId';
import { useAuth } from '@/lib/context/AuthContext';

export default function DedicatedIssuePage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const volParam = String(params?.vol || '');
  const issueParam = String(params?.issue || '');

  const { tokens, user } = useAuth();

  const [journal, setJournal] = useState<Journal | null>(null);
  const [currentIssue, setCurrentIssue] = useState<JournalIssue | null>(null);
  const [articles, setArticles] = useState<JournalArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // Mirrors the server-side rule: the complete issue PDF needs an active journal
  // subscription. Never trusted for authorization - only for what the UI offers.
  const [hasSubscription, setHasSubscription] = useState(false);
  // Articles the current user purchased individually. Used ONLY to label a paper
  // as "Purchased" in the table of contents; access is enforced server-side.
  const [purchasedArticleIds, setPurchasedArticleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      if (!slug || !volParam || !issueParam) {
        setLoading(false);
        setError('Invalid URL parameters.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const journalData = await fetchJournalBySlug(slug);
        if (!journalData) {
          setError(`Journal "${slug}" not found.`);
          setLoading(false);
          return;
        }

        setJournal(journalData);

        // Resolve issues
        let issuesList = journalData.issues || [];
        if (issuesList.length === 0) {
          issuesList = await fetchJournalIssues(journalData.id || slug);
        }

        const match = issuesList.find(
          (iss) => String(iss.volume) === volParam && String(iss.issue) === issueParam
        ) || issuesList.find((iss) => String(iss.id) === issueParam);

        if (!match) {
          setError(`Volume ${volParam}, Issue ${issueParam} not found for ${journalData.title}.`);
          setLoading(false);
          return;
        }

        setCurrentIssue(match);

        // Resolve articles — strictly scoped to THIS issue. Never fall back to
        // journal-wide articles here, or unrelated issues' papers leak in.
        const embedded = Array.isArray(match.articles) ? match.articles : [];
        if (embedded.length > 0) {
          setArticles(embedded);
        } else {
          const fetchedArticles = await fetchArticlesForIssue(match.id);
          setArticles(fetchedArticles && fetchedArticles.length > 0 ? fetchedArticles : []);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load issue details.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [slug, volParam, issueParam]);

  // Issue-level purchasing has been removed. Access to the complete issue PDF is
  // granted exclusively through an active journal subscription (enforced server-side
  // by check_journal_issue_access). No per-issue format selector or cart item is built here.

  // Reflect the caller's subscription + individual article purchases so the UI can
  // offer the complete-issue PDF and label purchased papers. Never trusted for
  // authorization - the backend remains the sole gate.
  useEffect(() => {
    let cancelled = false;

    async function loadAccessState() {
      if (!tokens?.access || !journal?.id) {
        setHasSubscription(false);
        setPurchasedArticleIds(new Set());
        return;
      }
      try {
        const records = await fetchUserJournalAccess(tokens.access);
        const journalId = Number(journal.id);
        const now = Date.now();
        const withinWindow = (r: (typeof records)[number]) =>
          r.isActive &&
          new Date(r.startDate).getTime() <= now &&
          (r.endDate === null || r.endDate === undefined || new Date(r.endDate).getTime() >= now);

        const subscribed = records.some((r) =>
          Number(r.journal) === journalId &&
          withinWindow(r) &&
          (r.issue === null || r.issue === undefined) &&
          (r.article === null || r.article === undefined)
        );

        // Only individually-purchased articles are tagged "Purchased" here.
        const purchased = new Set<string>();
        records.forEach((r) => {
          if (
            r.article !== null &&
            r.article !== undefined &&
            withinWindow(r) &&
            Number(r.journal) === journalId
          ) {
            purchased.add(String(r.article));
          }
        });

        if (!cancelled) {
          setHasSubscription(subscribed);
          setPurchasedArticleIds(purchased);
        }
      } catch {
        // Backend remains the authority; on any doubt the UI stays locked.
        if (!cancelled) {
          setHasSubscription(false);
          setPurchasedArticleIds(new Set());
        }
      }
    }

    loadAccessState();
    return () => { cancelled = true; };
  }, [tokens?.access, journal?.id, journal?.slug]);

  const isStaffUser = Boolean(user?.is_staff || user?.is_superuser);
  const canAccessIssue = isStaffUser || hasSubscription;

  const handleDownloadIssuePdf = async () => {
    if (!currentIssue || !canAccessIssue) return;
    setDownloadingPdf(true);
    setPdfError(null);

    const res = await downloadIssuePdf(currentIssue.id, tokens?.access);
    setDownloadingPdf(false);

    if (res.error) {
      setPdfError(res.error);
    } else if (res.blob) {
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `issue_v${currentIssue.volume}_i${currentIssue.issue}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5EE] flex flex-col items-center justify-center font-manrope">
        <div className="w-12 h-12 border-2 border-[#C99A2E] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-[#73614C] font-semibold">Loading Journal Volume & Issue Details...</p>
      </div>
    );
  }

  if (error || !journal || !currentIssue) {
    return (
      <div className="min-h-screen bg-[#F8F5EE] font-manrope py-16 px-4">
        <div className="max-w-2xl mx-auto bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl p-8 text-center shadow-md space-y-4">
          <AlertCircle className="w-12 h-12 text-[#B8860B] mx-auto" />
          <h2 className="text-2xl font-bold font-playfair text-[#3A2312]">Issue Not Found</h2>
          <p className="text-xs text-[#6E5238] font-medium leading-relaxed">
            {error || 'The requested volume or issue could not be found.'}
          </p>
          <div className="pt-4 flex justify-center gap-4">
            <Link href={`/journals/${slug}`}>
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Journal
              </Button>
            </Link>
            <Link href="/journals">
              <Button variant="primary" size="sm">
                Browse All Journals
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#2F241A] font-manrope py-8 sm:py-12">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-[#6E5238] overflow-x-auto pb-1" aria-label="Breadcrumb">
          <Link href="/home" className="hover:text-[#B8860B] transition-colors shrink-0">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#D4AC54] shrink-0" />
          <Link href="/journals" className="hover:text-[#B8860B] transition-colors shrink-0">Journals</Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#D4AC54] shrink-0" />
          <Link href={`/journals/${journal.slug}`} className="hover:text-[#B8860B] transition-colors shrink-0 truncate max-w-[200px]">
            {journal.title}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#D4AC54] shrink-0" />
          <span className="font-semibold text-[#B8860B] shrink-0">
            Vol. {currentIssue.volume}, Issue {currentIssue.issue}
          </span>
        </nav>

        {/* Issue Header Hero */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-glass relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-6">
            {currentIssue.cover ? (
              <Image
                src={currentIssue.cover}
                alt={currentIssue.title || `Volume ${currentIssue.volume}`}
                width={96}
                height={128}
                priority
                className="w-24 h-32 object-cover rounded-xl border border-[#D4AC54] shadow-md shrink-0"
              />
            ) : (
              <div className="w-24 h-28 rounded-xl bg-gradient-to-br from-[#D4AC54] to-[#8C6B1B] p-1 shadow-gold-glow shrink-0 flex flex-col items-center justify-center text-white font-bold font-playfair text-center">
                <span className="text-xs text-[#FFF9F1]/80 uppercase">Volume</span>
                <span className="text-3xl leading-none">{currentIssue.volume}</span>
                <span className="text-[10px] text-[#FFF9F1]/90 uppercase mt-1">Issue {currentIssue.issue}</span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#B8860B] bg-[#C99A2E]/10 px-2.5 py-0.5 rounded border border-[#D4AC54]">
                  {journal.title} Archive
                </span>
                <span className="text-xs font-mono font-bold text-[#2E6B34] bg-[#2E6B34]/10 px-2.5 py-0.5 rounded border border-[#2E6B34]/20">
                  Published: {currentIssue.publicationDate}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold font-playfair text-[#3A2312]">
                {currentIssue.title || `Volume ${currentIssue.volume}, Issue ${currentIssue.issue} (${currentIssue.year})`}
              </h1>

              <p className="text-xs font-semibold text-[#6E5238]">
                Journal: <Link href={`/journals/${journal.slug}`} className="text-[#B8860B] hover:underline">{journal.title}</Link>
              </p>

              <div className="flex items-center gap-4 text-xs font-mono text-[#8C6B1B] pt-1 flex-wrap">
                <span>DOI: {currentIssue.doi}</span>
                <span>•</span>
                <span>ISSN: {journal.issn}</span>
                <span>•</span>
                <span>{articles.length} Peer-Reviewed Papers</span>
                <PublicId value={currentIssue.publicId} tone="light" size="sm" className="w-fit" />
              </div>
            </div>
          </div>

          {/* Access CTA - no issue-level purchase; complete-issue access comes from a journal subscription.
              Once entitled (active subscription or staff) this shows the Subscribed state instead of a CTA. */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-[#D4AC54]/40">
            {canAccessIssue ? (
              <div className="flex items-center justify-center gap-2 shrink-0 w-full px-4 py-2 rounded-lg bg-[#2E6B34]/10 border border-[#2E6B34]/30 text-[#2E6B34] text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{isStaffUser && !hasSubscription ? 'Staff Access' : 'Subscribed'}</span>
              </div>
            ) : (
              <Link href={`/journals/${journal.slug}`} className="shrink-0">
                <Button variant="gold" size="md" fullWidth>
                  Subscribe to This Journal
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Complete Issue PDF — the single full-issue document uploaded by the editor. */}
        {currentIssue.hasDigital && (
          <section className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-glass space-y-5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#C99A2E]/15 border border-[#D4AC54] flex items-center justify-center text-[#B8860B] shrink-0">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">Complete Issue PDF</span>
                <h2 className="text-lg sm:text-xl font-bold font-playfair text-[#3A2312] leading-tight">
                  Full Issue Document
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-[#6E5238]">
              <div className="flex gap-1 min-w-0">
                <span className="font-bold text-[#3A2312] shrink-0">Journal:</span>
                <span className="truncate">{journal.title}</span>
              </div>
              <div className="flex gap-1">
                <span className="font-bold text-[#3A2312] shrink-0">Volume:</span>
                <span>{currentIssue.volume}</span>
              </div>
              <div className="flex gap-1">
                <span className="font-bold text-[#3A2312] shrink-0">Issue:</span>
                <span>{currentIssue.issue}</span>
              </div>
              <div className="flex gap-1">
                <span className="font-bold text-[#3A2312] shrink-0">Year:</span>
                <span>{currentIssue.year}</span>
              </div>
              <div className="sm:col-span-2 flex gap-1">
                <span className="font-bold text-[#3A2312] shrink-0">Document:</span>
                <span className="break-all">{currentIssue.digitalFileName || 'complete-issue.pdf'}</span>
              </div>
            </div>

            {canAccessIssue ? (
              <>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="gold"
                    size="md"
                    fullWidth
                    onClick={handleDownloadIssuePdf}
                    isLoading={downloadingPdf}
                    leftIcon={<Download className="w-4 h-4 text-[#FFF9F1]" />}
                  >
                    Download Complete Issue PDF
                  </Button>
                </div>
                <p className="text-[11px] text-[#2E6B34] flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {isStaffUser && !hasSubscription
                      ? 'Visible with staff access. Subscribers reach this through an active journal subscription.'
                      : 'Included with your active subscription to this journal.'}
                  </span>
                </p>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-[#C99A2E]/5 border border-[#D4AC54] text-xs text-[#6E5238] space-y-3">
                <p className="flex items-start gap-1.5">
                  <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#B8860B]" />
                  <span>
                    {tokens?.access
                      ? 'The complete issue PDF is included only with an active subscription to this journal. An individual article purchase does not unlock the full issue. Subscribe to open or download the complete document.'
                      : 'Sign in with an account that holds an active subscription to this journal to open or download the complete issue PDF.'}
                  </span>
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link href={`/journals/${journal.slug}`} className="shrink-0">
                    <Button variant="gold" size="sm">
                      Subscribe to This Journal
                    </Button>
                  </Link>
                  {!tokens?.access && (
                    <Link
                      href={`/login?redirect=/journals/${slug}/volume/${volParam}/issue/${issueParam}`}
                      className="shrink-0"
                    >
                      <Button variant="outline" size="sm" className="border-[#D4AC54] text-[#3A2312] hover:bg-[#D4AC54]/10">
                        Sign In
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {pdfError && (
              <div className="p-4 rounded-xl bg-red-50 border border-[#DC2626]/25 text-xs font-semibold text-red-800 space-y-2 text-center">
                <p>{pdfError}</p>
                {!tokens?.access ? (
                  <p className="text-[11px] text-red-700">
                    Please{' '}
                    <Link
                      href={`/login?redirect=/journals/${slug}/volume/${volParam}/issue/${issueParam}`}
                      className="underline font-bold hover:text-red-950"
                    >
                      sign in
                    </Link>{' '}
                    with your subscriber or purchaser account to access this issue.
                  </p>
                ) : (
                  <p className="text-[11px] text-red-700">
                    An active subscription to this journal is required. See the subscription options below.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Access Info — shown only when the viewer lacks a subscription/staff entitlement */}
        {!canAccessIssue && (
          <section className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-glass flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-[#B8860B] mt-0.5 shrink-0" />
              <div>
                <h2 className="text-base sm:text-lg font-bold font-playfair text-[#3A2312]">
                  Access with a Journal Subscription
                </h2>
                <p className="text-xs text-[#6E5238] mt-1 max-w-xl">
                  The complete issue PDF is included with an active subscription to{' '}
                  <span className="font-semibold text-[#3A2312]">{journal.title}</span>. There is no
                  separate charge to buy an individual issue. Need just one paper? Purchase that
                  article directly from its details page.
                </p>
              </div>
            </div>
            <Link href={`/journals/${journal.slug}`} className="shrink-0">
              <Button variant="gold" size="md">
                View Subscription Options
              </Button>
            </Link>
          </section>
        )}

        {/* Table of Contents & Article Listing */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D4AC54] pb-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">
                Table of Contents
              </span>
              <h2 className="text-2xl font-bold font-playfair text-[#3A2312]">
                Peer-Reviewed Articles in this Issue
              </h2>
            </div>
            <span className="text-xs font-bold text-[#6E5238] bg-[#FFF9F1] px-3.5 py-1.5 rounded-full border border-[#D4AC54] self-start sm:self-auto">
              Showing {articles.length} Published Articles
            </span>
          </div>

          {articles.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-[#B8860B] mx-auto opacity-80" />
              <h3 className="text-lg font-bold font-playfair text-[#3A2312]">No Articles Indexed</h3>
              <p className="text-xs text-[#6E5238] max-w-md mx-auto">
                No individual paper previews are currently indexed for this specific issue.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {articles.map((art, idx) => (
                <div
                  key={art.id || idx}
                  className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#8C6B1B] shadow-glass hover:shadow-gold-glow flex flex-col gap-4 transition-all duration-300 group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-full bg-[#B8860B]/15 text-[#B8860B] font-bold text-xs flex items-center justify-center font-mono shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#B8860B]">
                        DOI: {art.doi}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {purchasedArticleIds.has(String(art.id)) && (
                        <span className="text-[10px] font-mono font-bold text-[#2E6B34] bg-[#2E6B34]/10 px-2.5 py-0.5 rounded border border-[#2E6B34]/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#2E6B34]" /> Purchased
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Link href={`/journals/${journal.slug}/article/${art.slug || art.id}`}>
                      <h3 className="text-xl font-bold font-playfair text-[#3A2312] group-hover:text-[#B8860B] transition-colors leading-snug">
                        {art.title}
                      </h3>
                    </Link>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[#6E5238] flex-wrap font-medium">
                    <span className="flex items-center gap-1.5 font-bold text-[#3A2312]">
                      <User className="w-3.5 h-3.5 text-[#B8860B]" />
                      {art.authors}
                    </span>
                    <span>•</span>
                    <span>{art.institution}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {art.publicationDate}
                    </span>
                  </div>

                  {art.abstract && (
                    <p className="text-xs text-[#5C4033] leading-relaxed italic border-l-2 border-[#D4AC54] pl-4 py-1 font-medium bg-amber-50/40 rounded-r-lg">
                      "{art.abstract}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#D4AC54]/30">
                    <Link
                      href={`/journals/${journal.slug}/article/${art.slug || art.id}`}
                      className="text-xs font-bold text-[#B8860B] hover:underline flex items-center gap-1"
                    >
                      <span>View Article Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <Link href={`/journals/${journal.slug}/article/${art.slug || art.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5 text-[#B8860B]" />}
                        className="border-[#D4AC54] text-[#3A2312] hover:bg-[#D4AC54]/10 text-xs"
                      >
                        Read Full Paper
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
