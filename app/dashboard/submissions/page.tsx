'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BookOpenCheck,
  Search,
  Plus,
  RefreshCw,
  ChevronRight,
  Award,
  FileCheck,
  Send,
  TrendingUp,
  CalendarCheck,
  Camera,
  CreditCard,
  Trash2,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { displayId, displayReference, routeIdOf } from '@/lib/utils/publicId';
import {
  fetchUserSubmissions,
  fetchUserConferenceSubmissions,
  type SubmissionResult,
  type ConferenceSubmissionResult,
} from '@/lib/services/submissions';
import {
  payConferenceSubmission,
  deleteConferenceSubmission,
} from '@/lib/services/submissionServices';

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  submitted: {
    label: 'Submitted',
    color: 'text-[#A97917]',
    bg: 'bg-[#C99A2E]/10 border-[#C99A2E]/30',
    icon: <Send className="w-3.5 h-3.5" />,
  },
  pending: {
    label: 'Pending Review',
    color: 'text-[#8C6239]',
    bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  editorial_screening: {
    label: 'Editorial Screening',
    color: 'text-[#7F6000]',
    bg: 'bg-[#D4AC54]/15 border-[#D4AC54]/50',
    icon: <FileCheck className="w-3.5 h-3.5" />,
  },
  under_review: {
    label: 'Under Review',
    color: 'text-[#5C4033]',
    bg: 'bg-[#5C4033]/10 border-[#5C4033]/30',
    icon: <Search className="w-3.5 h-3.5" />,
  },
  revision_required: {
    label: 'Revision Required',
    color: 'text-[#B45309]',
    bg: 'bg-[#D97706]/10 border-[#D97706]/30',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  revision_requested: {
    label: 'Revision Requested',
    color: 'text-[#B45309]',
    bg: 'bg-[#D97706]/10 border-[#D97706]/30',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  accepted: {
    label: 'Accepted',
    color: 'text-[#1B4332]',
    bg: 'bg-[#2F6B4F]/10 border-[#2F6B4F]/30',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-[#DC2626]',
    bg: 'bg-[#DC2626]/10 border-[#DC2626]/30',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  camera_ready: {
    label: 'Camera Ready',
    color: 'text-[#6B7280]',
    bg: 'bg-[#6B7280]/10 border-[#6B7280]/30',
    icon: <Camera className="w-3.5 h-3.5" />,
  },
  published: {
    label: 'Published',
    color: 'text-[#8A6A1B]',
    bg: 'bg-[#D4AC54]/15 border-[#D4AC54]/60',
    icon: <BookOpenCheck className="w-3.5 h-3.5" />,
  },
  pending_payment: {
    label: 'Pending Payment',
    color: 'text-[#A97917]',
    bg: 'bg-[#C99A2E]/10 border-[#C99A2E]/30',
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status?.toLowerCase()] ?? {
      label: status || 'Submitted',
      color: 'text-[#8C6239]',
      bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',
      icon: <Clock className="w-3.5 h-3.5" />,
    }
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

// ─── Publication Activity Widget ─────────────────────────────────────────────

function PublicationActivityWidget({ submissions }: { submissions: SubmissionResult[] }) {
  const total = submissions.length;
  const underReview = submissions.filter((s) =>
    ['editorial_screening', 'under_review'].includes(s.status?.toLowerCase())
  ).length;
  const accepted = submissions.filter((s) => s.status?.toLowerCase() === 'accepted').length;
  const published = submissions.filter((s) => s.status?.toLowerCase() === 'published').length;
  const revisionsRequired = submissions.filter((s) =>
    ['revision_required', 'revision_requested'].includes(s.status?.toLowerCase())
  ).length;
  const pending = submissions.filter((s) => s.status?.toLowerCase() === 'pending').length;

  const stats = [
    { label: 'Total Manuscripts', value: total, color: 'text-[#2F241A]', border: 'border-[#D4AC54]/60' },
    { label: 'Under Review', value: underReview, color: 'text-[#5C4033]', border: 'border-[#5C4033]/30' },
    { label: 'Accepted', value: accepted, color: 'text-[#1B4332]', border: 'border-[#2F6B4F]/30' },
    { label: 'Published', value: published, color: 'text-[#8A6A1B]', border: 'border-[#D4AC54]/60' },
    { label: 'Revisions Required', value: revisionsRequired, color: 'text-[#B45309]', border: 'border-[#D97706]/30' },
    { label: 'Pending Review', value: pending, color: 'text-[#8C6239]', border: 'border-[#8C6239]/30' },
  ];

  const recent = [...submissions]
    .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
    .slice(0, 5);

  return (
    <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-5">
      <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        Publication Activity
      </h3>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {stats.map((s) => (
          <div key={s.label} className={`p-3 rounded-xl bg-[#F8EEDC] border ${s.border} text-center`}>
            <p className={`text-xl font-bold font-playfair ${s.color}`}>{s.value}</p>
            <p className="text-[13px] text-text-muted mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent timeline */}
      {recent.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[#D4AC54]/60">
          <p className="text-[13px] font-semibold text-text-muted uppercase tracking-wider">Recent Submissions</p>
          {recent.map((sub) => {
            const sc = getStatusConfig(sub.status);
            return (
              <Link
                key={sub.id}
                href={`/dashboard/submissions/${routeIdOf(sub)}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 hover:border-[#D4AC54] hover:bg-navy-800 transition-all group"
              >
                <Send className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ivory-white font-semibold truncate group-hover:text-gold-400 transition-colors">
                    {sub.title}
                  </p>
                  <p className="text-[13px] text-text-muted">
                    {sub.submitted_at ? formatDate(sub.submitted_at) : '—'}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] font-bold border ${sc.bg} ${sc.color} shrink-0`}>
                  {sc.icon}
                  <span className="hidden sm:inline">{sc.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

function SubmissionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-white/5 rounded w-24" />
              <div className="h-4 bg-white/5 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardSubmissionsPage() {
  const { tokens } = useAuth();
  const [activeTab, setActiveTab] = useState<'manuscripts' | 'conferences'>('manuscripts');
  const [submissions, setSubmissions] = useState<SubmissionResult[]>([]);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confSubmissions, setConfSubmissions] = useState<ConferenceSubmissionResult[]>([]);
  const [confFetchState, setConfFetchState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [confErrorMessage, setConfErrorMessage] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | number | null>(null);
  const [discardingId, setDiscardingId] = useState<string | number | null>(null);

  const loadSubmissions = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const { submissions: list } = await fetchUserSubmissions(tokens.access);
      // Sort newest first
      list.sort((a, b) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
      );
      setSubmissions(list);
      setFetchState('success');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to load submissions.';
      setErrorMessage(msg);
      setFetchState('error');
    }
  }, [tokens?.access]);

  const loadConferenceSubmissions = useCallback(async () => {
    if (!tokens?.access) return;
    setConfFetchState('loading');
    setConfErrorMessage(null);

    try {
      const { submissions: list } = await fetchUserConferenceSubmissions(tokens.access);
      list.sort((a, b) =>
        new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
      );
      setConfSubmissions(list);
      setConfFetchState('success');
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Failed to load conference submissions.';
      setConfErrorMessage(msg);
      setConfFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadSubmissions();
    loadConferenceSubmissions();
  }, [loadSubmissions, loadConferenceSubmissions]);

  const refreshAll = () => {
    loadSubmissions();
    loadConferenceSubmissions();
  };

  // Complete an abandoned pending_payment conference submission via Razorpay.
  const completeConferencePayment = async (sub: ConferenceSubmissionResult) => {
    if (!tokens?.access) return;
    setPayingId(sub.id);
    setConfErrorMessage(null);
    try {
      await payConferenceSubmission(sub.id, tokens.access, {
        name: sub.author_full_name || '',
        email: sub.author_email || '',
        phone: sub.author_phone || '',
        title: sub.title,
        conferenceTitle: sub.conference_title || '',
      });
      await loadConferenceSubmissions();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      if (msg === 'PAYMENT_CANCELLED') {
        setConfErrorMessage('Payment was cancelled. This paper is still awaiting payment — you can complete it any time.');
      } else {
        setConfErrorMessage(`Payment failed: ${msg || 'please try again.'}`);
      }
    } finally {
      setPayingId(null);
    }
  };

  // Discard (delete) an unpaid conference submission.
  const discardConferenceSubmission = async (sub: ConferenceSubmissionResult) => {
    if (!tokens?.access) return;
    if (typeof window !== 'undefined' && !window.confirm(`Discard "${sub.title}"? This cannot be undone.`)) return;
    setDiscardingId(sub.id);
    setConfErrorMessage(null);
    try {
      await deleteConferenceSubmission(sub.id, tokens.access);
      setConfSubmissions((prev) => prev.filter((s) => s.id !== sub.id));
    } catch (err: unknown) {
      setConfErrorMessage((err as Error)?.message || 'Failed to discard submission.');
    } finally {
      setDiscardingId(null);
    }
  };

  // Papers still awaiting payment are not yet real submissions, so they are
  // hidden from the dashboard list — only submitted/confirmed papers appear here.
  const visibleConfSubmissions = confSubmissions.filter(
    (s) => s.status?.toLowerCase() !== 'pending_payment'
  );

  return (
    <DashboardLayout
      title="My Submissions"
      subtitle="Track the status of your manuscript submissions to MMSR Publications."
    >
      {/* Header Actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-text-muted">
          {activeTab === 'manuscripts'
            ? fetchState === 'success'
              ? `${submissions.length} manuscript submission${submissions.length !== 1 ? 's' : ''} found`
              : ''
            : confFetchState === 'success'
              ? `${confSubmissions.length} conference paper submission${confSubmissions.length !== 1 ? 's' : ''} found`
              : ''}
        </p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshAll}
            isLoading={fetchState === 'loading' || confFetchState === 'loading'}
            leftIcon={fetchState !== 'loading' ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
          >
            Refresh
          </Button>
          <Link href={activeTab === 'manuscripts' ? '/submit-manuscript' : '/submit-conference-paper'}>
            <Button type="button" variant="gold" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              {activeTab === 'manuscripts' ? 'New Submission' : 'Submit Conference Paper'}
            </Button>
          </Link>
        </div>
      </div>

      {/* Tab Switch */}
      <div className="flex items-center gap-2" role="tablist" aria-label="Submission types">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'manuscripts'}
          onClick={() => setActiveTab('manuscripts')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
            activeTab === 'manuscripts'
              ? 'bg-[#F8EEDC] border-[#D4AC54] text-[#5C4033] shadow-soft'
              : 'bg-transparent border-[#D4AC54]/40 text-text-muted hover:border-[#D4AC54]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Book & Journal Submissions
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'conferences'}
          onClick={() => setActiveTab('conferences')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
            activeTab === 'conferences'
              ? 'bg-[#F8EEDC] border-[#D4AC54] text-[#5C4033] shadow-soft'
              : 'bg-transparent border-[#D4AC54]/40 text-text-muted hover:border-[#D4AC54]'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5" />
          Conference Papers
          {confFetchState === 'success' && visibleConfSubmissions.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gold-500/10 border border-[#D4AC54] text-[13px]">
              {visibleConfSubmissions.length}
            </span>
          )}
        </button>
      </div>

      {/* ─── Manuscripts Tab ─── */}
      {activeTab === 'manuscripts' && (
        <>
      {/* Publication Activity Widget — shown when data available */}
      {fetchState === 'success' && submissions.length > 0 && (
        <PublicationActivityWidget submissions={submissions} />
      )}

      {/* Loading Skeleton */}
      {fetchState === 'loading' && <SubmissionSkeleton />}

      {/* Error */}
      {fetchState === 'error' && (
        <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
          <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-ivory-white">Could Not Load Submissions</p>
          <p className="text-xs text-text-muted">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadSubmissions}>
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {fetchState === 'success' && submissions.length === 0 && (
        <div className="p-10 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-center space-y-4">
          <div className="p-4 rounded-full bg-gold-500/8 border border-[#D4AC54] w-fit mx-auto">
            <FileText className="w-8 h-8 text-gold-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold font-playfair text-ivory-white">No Submissions Yet</p>
            <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
              Your manuscript submissions will appear here once you submit a paper or book chapter to MMSR Publications.
            </p>
          </div>
          <Link href="/submit-manuscript">
            <Button type="button" variant="gold" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Submit Your First Manuscript
            </Button>
          </Link>
        </div>
      )}

      {/* Submissions List */}
      {fetchState === 'success' && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const status = getStatusConfig(sub.status);
            return (
              <div
                key={sub.id}
                className="group p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-all hover:bg-navy-800"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  {/* Icon */}
                  <div className="p-2.5 rounded-xl bg-gold-500/10 border border-[#D4AC54] shrink-0 w-fit">
                    <FileText className="w-5 h-5 text-gold-400" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-bold border ${status.bg} ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                      <span className="text-[13px] font-semibold text-text-muted px-2 py-1 rounded-full bg-white/5 border border-[#D4AC54]/60 capitalize">
                        {sub.submission_type_display || sub.submission_type}
                      </span>
                      {sub.certificate_issued && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-bold bg-gold-500/10 border-[#D4AC54] border text-gold-400">
                          <Award className="w-3 h-3" />
                          Publication Notice Issued
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-ivory-white font-playfair leading-snug line-clamp-2">
                      {sub.title}
                    </h4>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted">
                      {sub.submitted_at && <span>Submitted: {formatDate(sub.submitted_at)}</span>}
                      {sub.updated_at && <span>Updated: {formatDate(sub.updated_at)}</span>}
                      {sub.volume_title && <span className="text-gold-400/70">Volume: {sub.volume_title}</span>}
                      {sub.research_domain && <span>Domain: {sub.research_domain}</span>}
                    </div>
                  </div>

                  {/* Ref ID & View Button */}
                  <div className="shrink-0 flex sm:flex-col items-end justify-between gap-2">
                    <span className="font-mono text-[13px] text-text-muted">
                      {displayId(sub)}
                    </span>
                    <Link
                      href={`/dashboard/submissions/${routeIdOf(sub)}`}
                      className="p-1.5 px-3 rounded-xl bg-gold-500/10 border border-[#D4AC54] hover:border-gold-500/40 text-gold-400 hover:text-gold-300 transition-all text-xs font-semibold flex items-center gap-1"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Status Legend */}
      {fetchState === 'success' && submissions.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60">
          <p className="text-[13px] font-semibold text-text-muted mb-2">Status Reference</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_CONFIG)
              .filter(([key]) => !['revision_requested'].includes(key)) // dedupe alias
              .map(([key, val]) => (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[13px] font-semibold border ${val.bg} ${val.color}`}
                >
                  {val.icon}
                  {val.label}
                </span>
              ))}
          </div>
        </div>
      )}
        </>
      )}

      {/* ─── Conference Papers Tab ─── */}
      {activeTab === 'conferences' && (
        <>
          {confFetchState === 'loading' && <SubmissionSkeleton />}

          {confFetchState === 'error' && (
            <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
              <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
              <p className="text-sm font-semibold text-ivory-white">Could Not Load Conference Submissions</p>
              <p className="text-xs text-text-muted">{confErrorMessage}</p>
              <Button type="button" variant="outline" size="sm" onClick={loadConferenceSubmissions}>
                Try Again
              </Button>
            </div>
          )}

          {confFetchState === 'success' && visibleConfSubmissions.length === 0 && (
            <div className="p-10 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-center space-y-4">
              <div className="p-4 rounded-full bg-gold-500/8 border border-[#D4AC54] w-fit mx-auto">
                <CalendarCheck className="w-8 h-8 text-gold-400" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold font-playfair text-ivory-white">No Conference Papers Yet</p>
                <p className="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                  Papers you submit to MMSR conferences will appear here with their reference number and review status.
                </p>
              </div>
              <Link href="/submit-conference-paper">
                <Button type="button" variant="gold" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Submit a Conference Paper
                </Button>
              </Link>
            </div>
          )}

          {confFetchState === 'success' && visibleConfSubmissions.length > 0 && (
            <div className="space-y-3">
              {visibleConfSubmissions.map((sub) => {
                const status = getStatusConfig(sub.status);
                return (
                  <div
                    key={sub.id}
                    className="group p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-all hover:bg-navy-800"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-gold-500/10 border border-[#D4AC54] shrink-0 w-fit">
                        <CalendarCheck className="w-5 h-5 text-gold-400" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-bold border ${status.bg} ${status.color}`}>
                            {status.icon}
                            {status.label}
                          </span>
                          {sub.conference_acronym && (
                            <span className="text-[13px] font-semibold text-text-muted px-2 py-1 rounded-full bg-white/5 border border-[#D4AC54]/60 uppercase">
                              {sub.conference_acronym}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-ivory-white font-playfair leading-snug line-clamp-2">
                          {sub.title}
                        </h4>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted">
                          {sub.conference_title && <span className="text-gold-400/70">{sub.conference_title}</span>}
                          {sub.submitted_at && <span>Submitted: {formatDate(sub.submitted_at)}</span>}
                          {sub.updated_at && <span>Updated: {formatDate(sub.updated_at)}</span>}
                          {sub.selected_track && <span>Track: {sub.selected_track}</span>}
                          {Number(sub.submission_fee || 0) > 0 && (
                            <span className="text-[#8C6B1B] font-semibold">Fee: ₹{Number(sub.submission_fee).toLocaleString('en-IN')}</span>
                          )}
                        </div>

                        {sub.status?.toLowerCase() === 'pending_payment' && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button
                              type="button"
                              variant="gold"
                              size="sm"
                              isLoading={payingId === sub.id}
                              disabled={payingId === sub.id || discardingId === sub.id}
                              onClick={() => completeConferencePayment(sub)}
                              leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                            >
                              Complete Payment
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              isLoading={discardingId === sub.id}
                              disabled={payingId === sub.id || discardingId === sub.id}
                              onClick={() => discardConferenceSubmission(sub)}
                              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                            >
                              Discard
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex sm:flex-col items-end justify-between gap-2">
                        <span className="font-mono text-[13px] text-text-muted">
                          {displayReference(sub, sub.reference_number)}
                        </span>
                        <Link
                          href={`/dashboard/conference-submissions/${routeIdOf(sub)}`}
                          className="p-1.5 px-3 rounded-xl bg-gold-500/10 border border-[#D4AC54] hover:border-gold-500/40 text-gold-400 hover:text-gold-300 transition-all text-xs font-semibold flex items-center gap-1"
                        >
                          <span>Details</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
