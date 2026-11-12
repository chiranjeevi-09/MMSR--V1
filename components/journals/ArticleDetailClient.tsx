'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  Download,
  Lock,
  FileCheck,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  ShoppingCart,
  ShieldCheck,
  LogIn,
  BookOpen,
  Loader2,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import {
  fetchJournalBySlug,
  fetchArticleBySlug,
  downloadArticlePdf,
  fetchArticleAccessState,
  fetchArticleFullText,
} from '@/lib/services/journals';
import { Journal, JournalArticle, ArticleAccessState } from '@/lib/types/journal';
import { Button } from '@/components/ui/Button';
import { PublicId } from '@/components/ui/PublicId';
import { useCart } from '@/lib/context/CartContext';
import { useAuth } from '@/lib/context/AuthContext';

interface ArticleDetailClientProps {
  articleSlug: string;
  /** Optional journal slug hint (legacy journal-scoped route). */
  journalHintSlug?: string;
}

const DEFAULT_ARTICLE_PRICE = 149;

export default function ArticleDetailClient({ articleSlug, journalHintSlug }: ArticleDetailClientProps) {
  const { addItem } = useCart();
  const { tokens, isAuthenticated } = useAuth();
  const router = useRouter();

  const [journal, setJournal] = useState<Journal | null>(null);
  const [article, setArticle] = useState<JournalArticle | null>(null);
  const [access, setAccess] = useState<ArticleAccessState | null>(null);
  const [fullText, setFullText] = useState<string | null>(null);
  const [fullTextError, setFullTextError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // ── Load article, parent journal, and server-computed access state ──
  useEffect(() => {
    async function loadData() {
      if (!articleSlug) {
        setLoading(false);
        setError('Invalid article reference.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const articleData = await fetchArticleBySlug(articleSlug);
        if (!articleData) {
          setError(`Article "${articleSlug}" could not be found.`);
          setLoading(false);
          return;
        }
        setArticle(articleData);

        // Resolve parent journal — hint first, then article's journal id
        let journalData: Journal | null = null;
        if (journalHintSlug) {
          journalData = await fetchJournalBySlug(journalHintSlug);
        }
        if (!journalData && articleData.journalId) {
          journalData = await fetchJournalBySlug(String(articleData.journalId));
        }
        setJournal(journalData);

        // Centralized, server-side access decision (never trust client state)
        const state = await fetchArticleAccessState(articleData.id, tokens?.access);
        setAccess(state);

        // Fetch protected full text only when the server says it is allowed
        if (state?.canAccessFullText && state?.hasFullText) {
          const result = await fetchArticleFullText(articleData.id, tokens?.access);
          if (result.fullText) setFullText(result.fullText);
          else if (result.error) setFullTextError(result.error);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load article details.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleSlug, journalHintSlug, tokens?.access]);

  const refreshAccessAndContent = useCallback(async () => {
    if (!article) return;
    const state = await fetchArticleAccessState(article.id, tokens?.access);
    setAccess(state);
    if (state?.canAccessFullText && state?.hasFullText && !fullText) {
      const result = await fetchArticleFullText(article.id, tokens?.access);
      if (result.fullText) setFullText(result.fullText);
    }
  }, [article, tokens?.access, fullText]);

  const handleDownloadPdf = async () => {
    if (!article) return;
    setDownloadingPdf(true);
    setPdfError(null);

    // Resolve by the article's standardized public reference when present; the
    // endpoint accepts either form, and the fallback filename then never
    // carries the internal key.
    const pdfRef = article.publicId || article.id;
    const res = await downloadArticlePdf(pdfRef, tokens?.access);
    setDownloadingPdf(false);

    if (res.error) {
      setPdfError(res.error);
    } else if (res.blob) {
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename || `article_${pdfRef}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }
  };

  const handleBuyArticle = () => {
    if (!article) return;
    const price = access?.articlePrice ?? article.price ?? DEFAULT_ARTICLE_PRICE;
    addItem({
      id: `art-${article.id}`,
      itemType: 'article',
      targetId: parseInt(article.id, 10) || Number(article.id),
      title: `Article PDF: ${article.title}`,
      price: Number(price) || DEFAULT_ARTICLE_PRICE,
      cover: journal?.cover,
      journalSlug: journal?.slug,
      format: 'digital',
    });
    // Proceed straight to checkout — download unlocks only after payment succeeds.
    router.push('/checkout');
  };

  const handleAddSubscriptionToCart = () => {
    if (!journal) return;
    addItem({
      id: `sub-${journal.id}`,
      itemType: 'journal_subscription',
      targetId: parseInt(journal.id, 10) || 1,
      title: `Annual Subscription: ${journal.title}`,
      price: journal.subscriptionPriceAnnual || 2999,
      cover: journal.cover,
      journalSlug: journal.slug,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5EE] flex flex-col items-center justify-center font-manrope">
        <div className="w-12 h-12 border-2 border-[#C99A2E] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-[#73614C] font-semibold">Loading Journal Article Details...</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-[#F8F5EE] font-manrope py-16 px-4">
        <div className="max-w-2xl mx-auto bg-[#FFF9F1] border border-[#D4AC54] rounded-2xl p-8 text-center shadow-md space-y-4">
          <AlertCircle className="w-12 h-12 text-[#B8860B] mx-auto" />
          <h2 className="text-2xl font-bold font-playfair text-[#3A2312]">Article Not Found</h2>
          <p className="text-xs text-[#6E5238] font-medium leading-relaxed">
            {error || 'The requested article could not be found.'}
          </p>
          <div className="pt-4 flex justify-center gap-4">
            <Link href="/journals">
              <Button variant="primary" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Browse All Journals
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Protected content (full text + PDF) is gated strictly by the server's
  // authoritative access decision. Never derive entitlement from client-side
  // journal/article flags — a "paid" article must stay locked until the server
  // confirms an open-access grant, active subscription, or article purchase.
  const isOpenAccess = Boolean(access?.isOpenAccess);
  const canAccessFullText = Boolean(access?.canAccessFullText);
  const canAccessPdf = Boolean(access?.canAccessPdf);
  const articlePrice = access?.articlePrice ?? article.price ?? null;
  // Derive up to two author initials for the avatar chip.
  const authorInitials = (article.authors || '')
    .split(',')
    .map((name) => name.trim().split(/\s+/).map((w) => w[0] || '').join(''))
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'MMSR';
  const displayPrice = Number(articlePrice) > 0 ? Number(articlePrice) : DEFAULT_ARTICLE_PRICE;
  const journalBase = journal ? `/journals/${journal.slug}` : '/journals';

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#2F241A] font-manrope py-8 sm:py-12">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-[#6E5238] overflow-x-auto pb-1" aria-label="Breadcrumb">
          <Link href="/home" className="hover:text-[#B8860B] transition-colors shrink-0">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#D4AC54] shrink-0" />
          <Link href="/journals" className="hover:text-[#B8860B] transition-colors shrink-0">Journals</Link>
          {journal && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-[#D4AC54] shrink-0" />
              <Link href={journalBase} className="hover:text-[#B8860B] transition-colors shrink-0 truncate max-w-[180px]">
                {journal.title}
              </Link>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-[#D4AC54] shrink-0" />
          <span className="font-semibold text-[#B8860B] shrink-0 truncate max-w-[200px]">
            {article.title}
          </span>
        </nav>

        {/* Article Meta Header Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-glass space-y-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#B8860B] bg-[#C99A2E]/10 px-2.5 py-0.5 rounded border border-[#D4AC54] max-w-full">
              {journal?.title || 'MMSR Research Journal'}
            </span>
            {isOpenAccess ? (
              <span className="text-xs font-bold text-[#2E6B34] bg-[#2E6B34]/10 px-2.5 py-0.5 rounded border border-[#2E6B34]/20 flex items-center gap-1">
                <FileCheck className="w-3.5 h-3.5 text-[#2E6B34]" /> Open Access Full Text
              </span>
            ) : canAccessFullText ? (
              <span className="text-xs font-bold text-[#2E6B34] bg-[#2E6B34]/10 px-2.5 py-0.5 rounded border border-[#2E6B34]/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2E6B34]" /> Access Active
              </span>
            ) : (
              <span className="text-xs font-bold text-[#B8860B] bg-[#C99A2E]/10 px-2.5 py-0.5 rounded border border-[#D4AC54] flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-[#B8860B]" /> Protected Access
              </span>
            )}
            <span className="text-xs font-mono font-bold text-[#6E5238] bg-[#6E5238]/10 px-2.5 py-0.5 rounded border border-[#6E5238]/20">
              DOI: {article.doi}
            </span>
            <PublicId value={article.publicId} tone="light" size="sm" className="w-fit" />
            {journal?.issn && (
              <span className="text-xs font-mono font-bold text-[#8C6B1B] bg-[#C99A2E]/10 px-2.5 py-0.5 rounded border border-[#D4AC54]">
                Journal ID: {journal.issn}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold font-playfair text-[#3A2312] leading-tight">
            {article.title}
          </h1>

          {/* Authors & Institutional Info */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F8F5EE] to-[#FFF9F1] border border-[#D4AC54]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#D4AC54] to-[#8C6B1B] text-white flex items-center justify-center font-playfair font-bold text-sm shadow-[0_2px_8px_rgba(184,134,11,0.35)] shrink-0">
                {authorInitials}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] uppercase tracking-wider text-[#8C6B1B] font-bold">Author</p>
                <p className="text-sm font-bold font-playfair text-[#3A2312] leading-snug">{article.authors || 'MMSR Research Authors'}</p>
                {article.institution && (
                  <p className="text-xs text-[#6E5238] font-medium flex items-center gap-1 mt-0.5">
                    <GraduationCap className="w-3.5 h-3.5 text-[#B8860B]" /> {article.institution}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-stretch gap-2 shrink-0">
              <div className="px-3 py-2 rounded-xl bg-white/70 border border-[#D4AC54]/40 text-center min-w-[86px]">
                <span className="block text-[12px] uppercase tracking-wider text-[#6E5238] font-bold">Published</span>
                <span className="text-xs font-mono font-bold text-[#8C6B1B]">{article.publicationDate}</span>
              </div>
              {article.pageRange && (
                <div className="px-3 py-2 rounded-xl bg-white/70 border border-[#D4AC54]/40 text-center min-w-[86px]">
                  <span className="block text-[12px] uppercase tracking-wider text-[#6E5238] font-bold">Pages</span>
                  <span className="text-xs font-mono font-bold text-[#8C6B1B]">{article.pageRange}</span>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            {/* Abstract — always public metadata */}
            <div className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm space-y-4 font-manrope">
              <div className="flex items-center gap-2 border-b border-[#D4AC54]/40 pb-3">
                <BookOpen className="w-5 h-5 text-[#B8860B]" />
                <h2 className="text-xl font-bold font-playfair text-[#3A2312]">Abstract</h2>
              </div>

              <p className="text-sm text-[#3A2312] leading-relaxed italic border-l-4 border-[#B8860B] pl-4 py-2 bg-amber-50/50 rounded-r-lg font-medium">
                {article.abstract || 'No abstract text available for this paper.'}
              </p>

              <div className="pt-4 border-t border-[#D4AC54]/30 flex items-center justify-between text-xs text-[#6E5238]">
                <span>Indexed in MMSR Open Research Portal</span>
                <span className="font-mono text-[#8C6B1B]">DOI: {article.doi}</span>
              </div>
            </div>

            {/* Full Text — protected body, rendered only when server grants access */}
            {canAccessFullText && (
              <div className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm space-y-4">
                <div className="flex items-center gap-2 border-b border-[#D4AC54]/40 pb-3">
                  <FileCheck className="w-5 h-5 text-[#2E6B34]" />
                  <h2 className="text-xl font-bold font-playfair text-[#3A2312]">Full Text Article</h2>
                </div>

                {fullText ? (
                  <div className="prose prose-neutral max-w-none text-sm text-[#3A2312] leading-relaxed whitespace-pre-line font-medium">
                    {fullText}
                  </div>
                ) : access?.hasFullText ? (
                  <p className="text-xs text-[#6E5238] font-medium italic">
                    {fullTextError || 'Loading full text…'}
                  </p>
                ) : (
                  <p className="text-xs text-[#6E5238] font-medium italic">
                    No full-text body has been indexed for this article. The PDF download below is the authoritative record.
                  </p>
                )}
              </div>
            )}

            {/* Paywall — server denied access; metadata & abstract stay public */}
            {!canAccessFullText && (
              <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-b from-[#FFF9F1] to-[#F8EEDC] border border-[#D4AC54] shadow-sm space-y-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#C99A2E]/15 border border-[#D4AC54] flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-[#B8860B]" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold font-playfair text-[#3A2312]">
                      This Is a Paid Version
                    </h2>
                    <p className="text-xs text-[#6E5238] font-medium leading-relaxed">
                      The abstract above is free for everyone. The full text and PDF are locked and
                      available only after you purchase this article or hold an active journal subscription.
                    </p>
                    {access?.accessReason && (
                      <p className="text-[13px] font-mono text-[#8C6B1B]">
                        Access check: {access.accessReason}
                      </p>
                    )}
                  </div>
                </div>

                {access?.requiresLogin || !isAuthenticated ? (
                  <div className="pt-1 flex flex-col sm:flex-row gap-3">
                    <Link href={`/login?redirect=/articles/${articleSlug}`}>
                      <Button variant="gold" size="md" leftIcon={<LogIn className="w-4 h-4" />}>
                        Sign In to Continue
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="pt-1 flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="gold"
                      size="md"
                      onClick={handleBuyArticle}
                      leftIcon={<ShoppingCart className="w-4 h-4" />}
                    >
                      Pay to Download This Article (₹{displayPrice.toLocaleString('en-IN')})
                    </Button>
                    {journal && (
                      <Button
                        variant="outline"
                        size="md"
                        onClick={handleAddSubscriptionToCart}
                        className="border-[#D4AC54] text-[#3A2312] hover:bg-[#D4AC54]/10"
                        leftIcon={<Sparkles className="w-4 h-4 text-[#B8860B]" />}
                      >
                        Subscribe to This Full Journal (₹{(journal.subscriptionPriceAnnual || 2999).toLocaleString('en-IN')}/yr)
                      </Button>
                    )}
                  </div>
                )}

                {pdfError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-[#DC2626]/25 text-xs font-semibold text-red-800">
                    {pdfError}
                  </div>
                )}
              </div>
            )}

            {/* PDF Delivery — visible only when entitled (or open access) */}
            {canAccessPdf && !fullText && (
              <div className="p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-[#2E6B34]" />
                    <h3 className="text-lg font-bold font-playfair text-[#3A2312]">
                      Full Paper PDF Delivery
                    </h3>
                  </div>
                  {isOpenAccess && (
                    <span className="text-xs font-bold text-[#2E6B34] bg-[#2E6B34]/10 px-2.5 py-1 rounded border border-[#2E6B34]/20">
                      Free Download
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#6E5238] leading-relaxed">
                  {isOpenAccess
                    ? 'This paper is published under Open Access terms. Click below to retrieve the verified digital PDF.'
                    : 'Your entitlement is active. Click below to retrieve the verified digital PDF.'}
                </p>

                <div className="pt-2">
                  <Button
                    variant="gold"
                    size="md"
                    onClick={handleDownloadPdf}
                    isLoading={downloadingPdf}
                    disabled={access?.articlePdfAvailable === false}
                    leftIcon={downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  >
                    Download Article PDF
                  </Button>
                </div>

                {pdfError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-[#DC2626]/25 text-xs font-semibold text-red-800">
                    {pdfError}
                  </div>
                )}
              </div>
            )}

            {canAccessPdf && fullText && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  isLoading={downloadingPdf}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                  className="border-[#D4AC54] text-[#3A2312] hover:bg-[#D4AC54]/10"
                >
                  Download PDF Copy
                </Button>
                {pdfError && <p className="text-xs font-semibold text-red-700">{pdfError}</p>}
              </div>
            )}
          </div>

          {/* Sidebar CTA & Journal Details */}
          <aside className="lg:col-span-4 space-y-6">
            {journal && (
              <div className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm space-y-4 font-manrope">
                <span className="text-xs font-bold uppercase tracking-wider text-[#B8860B] block">
                  Journal Overview
                </span>
                <h3 className="text-lg font-bold font-playfair text-[#3A2312]">
                  {journal.title}
                </h3>
                <p className="text-xs text-[#6E5238] leading-relaxed">
                  {journal.description}
                </p>

                <div className="space-y-2 pt-2 text-xs border-t border-[#D4AC54]/40">
                  <div className="flex justify-between text-[#6E5238]">
                    <span>ISSN:</span>
                    <span className="font-mono font-bold text-[#3A2312]">{journal.issn}</span>
                  </div>
                  {!isOpenAccess && (
                    <div className="flex justify-between text-[#6E5238]">
                      <span>Article PDF:</span>
                      <span className="font-bold text-[#B8860B]">₹{displayPrice.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#6E5238]">
                    <span>Annual Subscription:</span>
                    <span className="font-bold text-[#B8860B]">₹{(journal.subscriptionPriceAnnual || 2999).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-[#6E5238]">
                    <span>Frequency:</span>
                    <span className="font-bold text-[#3A2312]">{journal.frequency}</span>
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  {!canAccessFullText && isAuthenticated && (
                    <Button
                      variant="gold"
                      size="sm"
                      fullWidth
                      onClick={handleBuyArticle}
                      leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
                    >
                      Pay to Download This Article (₹{displayPrice.toLocaleString('en-IN')})
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={handleAddSubscriptionToCart}
                    leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
                  >
                    Subscribe to Journal (₹{(journal.subscriptionPriceAnnual || 2999).toLocaleString('en-IN')}/yr)
                  </Button>

                  <Link href={journalBase}>
                    <Button variant="outline" size="sm" fullWidth className="border-[#D4AC54] text-[#3A2312]">
                      View All Journal Issues
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {access?.hasArticlePurchase && (
              <div className="p-5 rounded-2xl bg-[#2E6B34]/5 border border-[#2E6B34]/25 space-y-2">
                <p className="text-xs font-bold text-[#2E6B34] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Article Purchase Detected
                </p>
                <p className="text-[13px] text-[#6E5238] font-medium">
                  You own this article. Full content is unlocked above — no additional payment needed.
                </p>
              </div>
            )}

            {access?.hasActiveSubscription && !access?.hasArticlePurchase && (
              <div className="p-5 rounded-2xl bg-[#2E6B34]/5 border border-[#2E6B34]/25 space-y-2">
                <p className="text-xs font-bold text-[#2E6B34] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Active Subscription
                </p>
                <p className="text-[13px] text-[#6E5238] font-medium">
                  Your annual subscription to this journal covers this article in full.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
