'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  FileText,
  XCircle,
  ExternalLink,
  LogIn,
  Lock,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  fetchUserJournalAccess,
  downloadArticlePdf,
  fetchArticlesForJournal,
} from '@/lib/services/journals';
import { UserJournalAccess, JournalArticle } from '@/lib/types/journal';
import { PublicId } from '@/components/ui/PublicId';

type FilterTab = 'all' | 'subscriptions' | 'articles' | 'issues' | 'expired';

export default function UserJournalLibraryPage() {
  const { tokens, isAuthenticated } = useAuth();
  const [accessList, setAccessList] = useState<UserJournalAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [downloadingArticleId, setDownloadingArticleId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // Articles reachable through active journal subscriptions (journalId -> articles)
  const [subscriptionArticles, setSubscriptionArticles] = useState<Record<string, JournalArticle[]>>({});
  const [loadingSubscriptionArticles, setLoadingSubscriptionArticles] = useState(false);

  const loadAccessData = useCallback(async () => {
    if (!tokens?.access) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchUserJournalAccess(tokens.access);
      setAccessList(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load journal access records.');
    } finally {
      setLoading(false);
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadAccessData();
  }, [loadAccessData]);

  // Callers pass the article's public reference when it exists; the endpoint
  // resolves either form, and the fallback filename never leaks the internal key.
  const handleDownloadArticle = async (articleRef: string | number) => {
    setDownloadingArticleId(String(articleRef));
    setPdfError(null);

    const res = await downloadArticlePdf(String(articleRef), tokens?.access);
    setDownloadingArticleId(null);

    if (res.error) {
      setPdfError(res.error);
    } else if (res.blob) {
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `article_${articleRef}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculateDaysRemaining = (endDateStr?: string | null): number | null => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  /**
   * Authoritative backend validation:
   * Rely on backend is_valid flag first. Fallback to client logic only if absent.
   */
  const isEntitlementValid = useCallback((a: UserJournalAccess): boolean => {
    if (a.isValid !== undefined) return Boolean(a.isValid);
    if (!a.isActive) return false;
    const days = calculateDaysRemaining(a.endDate);
    return days === null || days > 0;
  }, []);

  const activeSubscriptions = useMemo(
    () => accessList.filter((a) => a.accessType === 'subscription' && isEntitlementValid(a)),
    [accessList, isEntitlementValid]
  );

  const expiredSubscriptions = useMemo(
    () => accessList.filter((a) => a.accessType === 'subscription' && !isEntitlementValid(a)),
    [accessList, isEntitlementValid]
  );

  const issueEntitlements = useMemo(
    () => accessList.filter((a) => a.accessType === 'issue' || a.accessType === 'manual_grant'),
    [accessList]
  );

  // Individually purchased articles (paid article → unlocked after payment)
  const purchasedArticles = useMemo(
    () => accessList.filter((a) => a.accessType === 'article' && a.article != null && isEntitlementValid(a)),
    [accessList, isEntitlementValid]
  );

  // Unique journal ids covered by active subscriptions
  const subscriptionJournalIds = useMemo(() => {
    const ids = new Set<string>();
    activeSubscriptions.forEach((s) => s.journal != null && ids.add(String(s.journal)));
    return Array.from(ids);
  }, [activeSubscriptions]);

  // Load the published articles of every subscribed journal so the user can
  // view/download them directly from the library (server grants access).
  useEffect(() => {
    if (subscriptionJournalIds.length === 0) {
      setSubscriptionArticles({});
      return;
    }
    let cancelled = false;
    setLoadingSubscriptionArticles(true);
    Promise.all(
      subscriptionJournalIds.map((jid) =>
        fetchArticlesForJournal(jid).then((arts) => [jid, arts] as const)
      )
    )
      .then((pairs) => {
        if (cancelled) return;
        const map: Record<string, JournalArticle[]> = {};
        pairs.forEach(([jid, arts]) => { map[jid] = arts; });
        setSubscriptionArticles(map);
      })
      .finally(() => { if (!cancelled) setLoadingSubscriptionArticles(false); });
    return () => { cancelled = true; };
  }, [subscriptionJournalIds]);

  // All articles reachable through subscriptions (flattened, de-duplicated)
  const subscriptionArticleList = useMemo(() => {
    const seen = new Set<string>();
    const list: JournalArticle[] = [];
    Object.values(subscriptionArticles).forEach((arts) => {
      arts.forEach((art) => {
        if (!seen.has(String(art.id))) {
          seen.add(String(art.id));
          list.push(art);
        }
      });
    });
    return list;
  }, [subscriptionArticles]);

  const purchasedArticleCount = purchasedArticles.length;
  const totalActive = activeSubscriptions.length + issueEntitlements.length + purchasedArticles.length;

  return (
    <DashboardLayout
      title="My Subscribed Library"
      subtitle="Everything you've paid for in one place — active journal subscriptions, purchased single articles, and digital issues, ready to view and download."
    >
      <div className="space-y-8 font-manrope">
        {/* Header Stats & Refresh Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C99A2E] bg-[#FFF2D9] px-3 py-1 rounded-full border border-[#D4AC54]">
              {totalActive} Active Entitlement{totalActive !== 1 ? 's' : ''}
            </span>
            {expiredSubscriptions.length > 0 && (
              <span className="text-xs font-bold uppercase tracking-wider text-red-700 bg-red-50 px-3 py-1 rounded-full border border-[#DC2626]/25">
                {expiredSubscriptions.length} Expired
              </span>
            )}
          </div>
          {isAuthenticated && (
            <Button
              variant="outline"
              size="sm"
              onClick={loadAccessData}
              isLoading={loading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5 text-[#C99A2E]" />}
              className="border-[#D4AC54] text-[#2F241A] shrink-0 self-start sm:self-auto"
            >
              Refresh Access
            </Button>
          )}
        </div>

        {/* PDF Error Notification */}
        {pdfError && (
          <div className="p-4 rounded-xl bg-red-50 border border-[#DC2626]/25 text-xs font-semibold text-red-800 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{pdfError}</span>
            </div>
            <button
              onClick={() => setPdfError(null)}
              className="text-red-700 underline text-[13px] ml-4 hover:text-red-900"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Unauthenticated State */}
        {!isAuthenticated && !tokens?.access && !loading ? (
          <div className="p-12 text-center bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl space-y-4 shadow-sm">
            <LogIn className="w-12 h-12 text-[#C99A2E] mx-auto opacity-80" />
            <div className="space-y-1">
              <h3 className="text-xl font-bold font-playfair text-[#2F241A]">Authentication Required</h3>
              <p className="text-xs text-[#73614C] max-w-md mx-auto leading-relaxed">
                Please sign in with your MMSR account to access your active journal subscriptions, digital issue entitlements, and research archive downloads.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/login?redirect=/dashboard/journals">
                <Button variant="gold" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Sign In to Access Library
                </Button>
              </Link>
            </div>
          </div>
        ) : loading ? (
          /* Loading State */
          <div className="p-12 text-center bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl shadow-sm">
            <div className="w-10 h-10 border-2 border-[#C99A2E] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-semibold text-[#73614C]">Loading your verified journal entitlements...</p>
          </div>
        ) : error ? (
          /* Error State */
          <div className="p-8 text-center bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl space-y-4 shadow-sm">
            <AlertCircle className="w-10 h-10 text-[#C99A2E] mx-auto" />
            <div className="space-y-1">
              <h4 className="text-base font-bold font-playfair text-[#2F241A]">Unable to Load Library</h4>
              <p className="text-xs font-semibold text-[#73614C] max-w-md mx-auto">{error}</p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={loadAccessData} className="border-[#D4AC54]">
                Try Again
              </Button>
              {error.toLowerCase().includes('session') && (
                <Link href="/login?redirect=/dashboard/journals">
                  <Button variant="gold" size="sm" rightIcon={<LogIn className="w-3.5 h-3.5" />}>
                    Sign In Again
                  </Button>
                </Link>
              )}
            </div>
          </div>
        ) : accessList.length === 0 ? (
          /* Empty Library State */
          <div className="p-12 text-center bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl space-y-4 shadow-sm">
            <BookOpen className="w-12 h-12 text-[#C99A2E] mx-auto opacity-80" />
            <div className="space-y-1">
              <h3 className="text-xl font-bold font-playfair text-[#2F241A]">No Journal Entitlements Found</h3>
              <p className="text-xs text-[#73614C] max-w-md mx-auto leading-relaxed">
                You do not have any active annual journal subscriptions or purchased digital issues yet. Once you complete a publication purchase, your entitlements will appear here immediately.
              </p>
            </div>
            <div className="pt-2">
              <Link href="/journals">
                <Button variant="gold" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Explore Peer-Reviewed Journals
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Library Content with Filter Tabs */
          <div className="space-y-8">
            {/* Filter Tabs Navigation */}
            <div className="flex items-center gap-2 border-b border-[#D4AC54]/40 overflow-x-auto pb-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-[#FFF2D9] text-[#2F241A] border-b-2 border-[#C99A2E]'
                    : 'text-[#73614C] hover:text-[#2F241A] hover:bg-[#FFF9F1]'
                }`}
              >
                <span>All Entitlements</span>
                <span className="text-[13px] font-mono px-1.5 py-0.2 rounded-full bg-[#C99A2E]/20 text-[#2F241A]">
                  {accessList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('subscriptions')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'subscriptions'
                    ? 'bg-[#FFF2D9] text-[#2F241A] border-b-2 border-[#C99A2E]'
                    : 'text-[#73614C] hover:text-[#2F241A] hover:bg-[#FFF9F1]'
                }`}
              >
                <span>Active Subscriptions</span>
                <span className="text-[13px] font-mono px-1.5 py-0.2 rounded-full bg-[#2E6B34]/20 text-[#2E6B34]">
                  {activeSubscriptions.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('articles')}
                className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                  activeTab === 'articles'
                    ? 'bg-[#FFF2D9] text-[#2F241A] border-b-2 border-[#C99A2E]'
                    : 'text-[#73614C] hover:text-[#2F241A] hover:bg-[#FFF9F1]'
                }`}
              >
                <span>My Articles</span>
                <span className="text-[13px] font-mono px-1.5 py-0.2 rounded-full bg-[#2E6B34]/20 text-[#2E6B34]">
                  {purchasedArticleCount + subscriptionArticleList.length}
                </span>
              </button>

              {expiredSubscriptions.length > 0 && (
                <button
                  onClick={() => setActiveTab('expired')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeTab === 'expired'
                      ? 'bg-red-50 text-red-800 border-b-2 border-red-500'
                      : 'text-red-700 hover:text-red-900 hover:bg-red-50/50'
                  }`}
                >
                  <span>Expired / Renew</span>
                  <span className="text-[13px] font-mono px-1.5 py-0.2 rounded-full bg-[#DC2626]/15 text-[#DC2626]">
                    {expiredSubscriptions.length}
                  </span>
                </button>
              )}
            </div>

            {/* Section 1: Active Annual Subscriptions */}
            {(activeTab === 'all' || activeTab === 'subscriptions') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#D4AC54]/50 pb-2">
                  <Sparkles className="w-5 h-5 text-[#C99A2E]" />
                  <h3 className="text-lg font-bold font-playfair text-[#2F241A]">
                    Active Annual Subscriptions ({activeSubscriptions.length})
                  </h3>
                </div>

                {activeSubscriptions.length === 0 ? (
                  <div className="p-6 bg-[#FFF9F1] border border-[#D4AC54]/60 rounded-xl text-xs text-[#73614C] text-center">
                    No active annual subscriptions. Subscribing grants 1-year unlimited access to all journal issues.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeSubscriptions.map((sub) => {
                      const days = calculateDaysRemaining(sub.endDate);
                      const isUrgent = days !== null && days < 30;
                      const journalHref = sub.journalSlug ? `/journals/${sub.journalSlug}` : '/journals';

                      return (
                        <div
                          key={sub.id}
                          className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#C99A2E] bg-[#FFF2D9] px-2.5 py-0.5 rounded border border-[#D4AC54]">
                                Annual Subscription
                              </span>
                              <span className="text-[13px] font-bold text-[#2E6B34] bg-[#2E6B34]/10 px-2.5 py-0.5 rounded border border-[#2E6B34]/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#2E6B34]" /> Active
                              </span>
                            </div>

                            <h4 className="text-lg font-bold font-playfair text-[#2F241A]">
                              {sub.journalTitle || sub.journalPublicId || 'Journal subscription'}
                            </h4>

                            {/* Standardized entitlement reference (copyable). */}
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              <PublicId value={sub.publicId} label="Entitlement" tone="light" size="sm" />
                            </div>

                            <div className="space-y-1 text-xs text-[#73614C]">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-[#C99A2E]" />
                                <span>Started: {formatDate(sub.startDate)}</span>
                              </div>
                              {sub.endDate && (
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-[#C99A2E]" />
                                  <span>Expires: {formatDate(sub.endDate)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {days !== null && (
                            <div
                              className={`p-3 rounded-xl border text-xs flex items-center justify-between font-semibold ${
                                isUrgent
                                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                                  : 'bg-[#FFF2D9]/80 border-[#D4AC54] text-[#2F241A]'
                              }`}
                            >
                              <span>{isUrgent ? 'Expiring Soon:' : 'Remaining Validity:'}</span>
                              <span
                                className={`font-mono font-bold ${
                                  isUrgent ? 'text-amber-700' : 'text-[#C99A2E]'
                                }`}
                              >
                                {days} Day{days !== 1 ? 's' : ''}
                              </span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-[#D4AC54]/30 flex flex-col sm:flex-row gap-2">
                            <Link href={journalHref} className="flex-1">
                              <Button
                                variant="outline"
                                size="sm"
                                fullWidth
                                rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                                className="border-[#D4AC54] text-[#2F241A]"
                              >
                                Browse Issues
                              </Button>
                            </Link>
                            {isUrgent && (
                              <Link href={journalHref} className="flex-1">
                                <Button
                                  variant="gold"
                                  size="sm"
                                  fullWidth
                                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                                >
                                  Renew Early
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Section: My Articles (purchased + subscription-accessible) */}
            {(activeTab === 'all' || activeTab === 'articles') && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-[#D4AC54]/50 pb-2">
                  <FileText className="w-5 h-5 text-[#2E6B34]" />
                  <h3 className="text-lg font-bold font-playfair text-[#2F241A]">
                    My Articles ({purchasedArticleCount + subscriptionArticleList.length})
                  </h3>
                </div>

                {purchasedArticleCount === 0 && subscriptionArticleList.length === 0 && (
                  <div className="p-6 bg-[#FFF9F1] border border-[#D4AC54]/60 rounded-xl text-xs text-[#73614C] text-center">
                    No article access yet. Buy an individual article PDF or subscribe to a journal and its articles will appear here for instant viewing and download.
                  </div>
                )}

                {/* Purchased single articles */}
                {purchasedArticleCount > 0 && (
                  <div className="space-y-3">
                    <p className="text-[13px] font-bold uppercase tracking-wider text-[#C99A2E]">
                      Purchased Single Articles
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {purchasedArticles.map((acc) => {
                        // Public reference first: the article route and the PDF endpoint
                        // both resolve MMSR IDs, so the internal key stays out of
                        // customer-facing URLs and download filenames.
                        const articleRef = acc.articlePublicId ?? String(acc.article ?? '');
                        const href = `/articles/${acc.articleSlug || articleRef}`;
                        return (
                          <div
                            key={acc.id}
                            className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[13px] font-mono font-bold uppercase tracking-wider text-[#2E6B34] bg-[#2E6B34]/10 px-2 py-0.5 rounded border border-[#2E6B34]/20">
                                  Purchased Article
                                </span>
                                <span className="text-[13px] font-bold text-[#2E6B34] flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" /> Lifetime
                                </span>
                              </div>
                              <h4 className="text-sm font-bold font-playfair text-[#2F241A] line-clamp-2">
                                {acc.articleTitle || acc.articlePublicId || 'Purchased article'}
                              </h4>
                              <p className="text-[13px] text-[#73614C]">{acc.journalTitle}</p>
                              <div className="flex flex-wrap gap-2 pt-0.5">
                                <PublicId value={acc.publicId} label="Entitlement" tone="light" size="sm" />
                              </div>
                            </div>
                            <div className="pt-2 border-t border-[#D4AC54]/30 flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="gold"
                                size="sm"
                                fullWidth
                                onClick={() => handleDownloadArticle(articleRef)}
                                isLoading={downloadingArticleId === articleRef}
                                leftIcon={<Download className="w-3.5 h-3.5" />}
                              >
                                Download PDF
                              </Button>
                              <Link href={href} className="w-full">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  fullWidth
                                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                                  className="border-[#D4AC54] text-[#2F241A]"
                                >
                                  View Article
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Articles covered by active subscriptions */}
                {subscriptionArticleList.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[13px] font-bold uppercase tracking-wider text-[#C99A2E]">
                      Included With Your Subscriptions
                      {loadingSubscriptionArticles && <span className="ml-2 text-[#73614C] normal-case">· loading…</span>}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subscriptionArticleList.map((art) => {
                        const articleRef = art.publicId || art.id;
                        const href = `/articles/${art.slug || articleRef}`;
                        return (
                          <div
                            key={art.id}
                            className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1.5">
                              <span className="text-[13px] font-mono font-bold uppercase tracking-wider text-[#2E6B34] bg-[#2E6B34]/10 px-2 py-0.5 rounded border border-[#2E6B34]/20">
                                Subscription Access
                              </span>
                              <h4 className="text-sm font-bold font-playfair text-[#2F241A] line-clamp-2">
                                {art.title}
                              </h4>
                              {art.authors && <p className="text-[13px] text-[#73614C] line-clamp-1">{art.authors}</p>}
                            </div>
                            <div className="pt-2 border-t border-[#D4AC54]/30 flex flex-col sm:flex-row gap-2">
                              <Button
                                variant="gold"
                                size="sm"
                                fullWidth
                                onClick={() => handleDownloadArticle(articleRef)}
                                isLoading={downloadingArticleId === articleRef}
                                leftIcon={<Download className="w-3.5 h-3.5" />}
                              >
                                Download PDF
                              </Button>
                              <Link href={href} className="w-full">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  fullWidth
                                  rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                                  className="border-[#D4AC54] text-[#2F241A]"
                                >
                                  View Article
                                </Button>
                              </Link>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Expired Subscriptions */}
            {expiredSubscriptions.length > 0 && (activeTab === 'all' || activeTab === 'expired') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-[#DC2626]/25 pb-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-bold font-playfair text-[#2F241A]">
                    Expired Subscriptions ({expiredSubscriptions.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {expiredSubscriptions.map((sub) => {
                    const journalHref = sub.journalSlug ? `/journals/${sub.journalSlug}` : '/journals';

                    return (
                      <div
                        key={sub.id}
                        className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#DC2626]/25 shadow-sm flex flex-col justify-between gap-4 opacity-90"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#C99A2E] bg-[#FFF2D9] px-2.5 py-0.5 rounded border border-[#D4AC54]">
                              Annual Subscription
                            </span>
                            <span className="text-[13px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded border border-[#DC2626]/25">
                              Expired
                            </span>
                          </div>

                          <h4 className="text-lg font-bold font-playfair text-[#2F241A]">
                            {sub.journalTitle || sub.journalPublicId || 'Journal subscription'}
                          </h4>

                          <div className="flex flex-wrap gap-2 pt-0.5">
                            <PublicId value={sub.publicId} label="Entitlement" tone="light" size="sm" />
                          </div>

                          <div className="space-y-1 text-xs text-[#73614C]">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-[#C99A2E]" />
                              <span>Started: {formatDate(sub.startDate)}</span>
                            </div>
                            {sub.endDate && (
                              <div className="flex items-center gap-2 text-red-600">
                                <Clock className="w-3.5 h-3.5 text-red-500" />
                                <span>Expired: {formatDate(sub.endDate)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-red-50 border border-[#DC2626]/25 text-xs text-red-700">
                          <strong>Access Revoked</strong> — Restricted issue PDFs and articles are no longer accessible. Renew your annual subscription to restore access.
                        </div>

                        <div className="pt-2 border-t border-[#D4AC54]/30">
                          <Link href={journalHref}>
                            <Button
                              variant="gold"
                              size="sm"
                              fullWidth
                              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                            >
                              Renew Subscription
                            </Button>
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
