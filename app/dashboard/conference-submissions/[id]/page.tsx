'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileText,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpenCheck,
  ArrowLeft,
  RefreshCw,
  User,
  Users,
  Mail,
  Download,
  CalendarCheck,
  Camera,
  Send,
  ShieldCheck,
  Tags,
  Info,
  CreditCard,
  Receipt,
  MessageSquare,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { displayReference, isPublicId } from '@/lib/utils/publicId';
import {
  fetchConferenceSubmissionDetail,
  downloadConferenceManuscript,
  type ConferenceSubmissionResult,
} from '@/lib/services/submissions';
import {
  payConferenceSubmission,
  downloadConferenceInvoice,
} from '@/lib/services/submissionServices';

// ─── Status Workflow Config (ConferenceSubmission lifecycle) ─────────────────

const STATUS_WORKFLOW = [
  { key: 'submitted', label: '1. Submitted', icon: Send, stepNum: 1 },
  { key: 'under_review', label: '2. Under Peer Review', icon: Search, stepNum: 2 },
  { key: 'revision_required', label: '3. Revision Requested', icon: AlertTriangle, stepNum: 3 },
  { key: 'accepted', label: '4. Accepted', icon: CheckCircle2, stepNum: 4 },
  { key: 'camera_ready', label: '5. Camera Ready', icon: Camera, stepNum: 5 },
  { key: 'published', label: '6. Published', icon: BookOpenCheck, stepNum: 6 },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode; stepNum: number }
> = {
  submitted: {
    label: 'Submitted',
    color: 'text-[#A97917]',
    bg: 'bg-[#C99A2E]/10 border-[#C99A2E]/30',
    icon: <Send className="w-4 h-4" />,
    stepNum: 1,
  },
  under_review: {
    label: 'Under Peer Review',
    color: 'text-[#5C4033]',
    bg: 'bg-[#5C4033]/10 border-[#5C4033]/30',
    icon: <Search className="w-4 h-4" />,
    stepNum: 2,
  },
  revision_required: {
    label: 'Revision Required',
    color: 'text-[#B45309]',
    bg: 'bg-[#D97706]/10 border-[#D97706]/30',
    icon: <AlertTriangle className="w-4 h-4" />,
    stepNum: 3,
  },
  accepted: {
    label: 'Accepted',
    color: 'text-[#1B4332]',
    bg: 'bg-[#2F6B4F]/10 border-[#2F6B4F]/30',
    icon: <CheckCircle2 className="w-4 h-4" />,
    stepNum: 4,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-[#DC2626]',
    bg: 'bg-[#DC2626]/10 border-[#DC2626]/30',
    icon: <XCircle className="w-4 h-4" />,
    stepNum: 0,
  },
  camera_ready: {
    label: 'Camera Ready',
    color: 'text-[#6B7280]',
    bg: 'bg-[#6B7280]/10 border-[#6B7280]/30',
    icon: <Camera className="w-4 h-4" />,
    stepNum: 5,
  },
  published: {
    label: 'Published',
    color: 'text-[#8A6A1B]',
    bg: 'bg-[#D4AC54]/15 border-[#D4AC54]/60',
    icon: <BookOpenCheck className="w-4 h-4" />,
    stepNum: 6,
  },
  pending_payment: {
    label: 'Pending Payment',
    color: 'text-[#A97917]',
    bg: 'bg-[#C99A2E]/10 border-[#C99A2E]/30',
    icon: <CreditCard className="w-4 h-4" />,
    stepNum: 0,
  },
};

function getStatusConfig(status: string) {
  return (
    STATUS_CONFIG[status?.toLowerCase()] ?? {
      label: status || 'Submitted',
      color: 'text-[#8C6239]',
      bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',
      icon: <Clock className="w-4 h-4" />,
      stepNum: 0,
    }
  );
}

function formatDate(iso?: string) {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Small display row ────────────────────────────────────────────────────────

function MetaRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value?: React.ReactNode;
}) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex items-start gap-3">
      <span className="w-4 h-4 text-gold-400 shrink-0 mt-0.5">{icon ?? <Info className="w-4 h-4" />}</span>
      <div>
        <span className="text-text-muted block text-[10px]">{label}</span>
        <span className="font-semibold text-ivory-white">{value}</span>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type FetchState = 'idle' | 'loading' | 'success' | 'error' | 'not_found' | 'unauthorized';

export default function ConferenceSubmissionDetailPage() {
  const params = useParams();
  const { tokens } = useAuth();
  const submissionIdParam = params?.id as string;

  const [submission, setSubmission] = useState<ConferenceSubmissionResult | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!tokens?.access || !submissionIdParam) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const data = await fetchConferenceSubmissionDetail(submissionIdParam, tokens.access);
      setSubmission(data);
      setFetchState('success');
    } catch (err: unknown) {
      const anyErr = err as Error & { status?: number };
      if (anyErr.status === 404) { setFetchState('not_found'); return; }
      if (anyErr.status === 401 || anyErr.status === 403) { setFetchState('unauthorized'); return; }
      setErrorMessage(anyErr?.message || 'Failed to fetch conference submission details.');
      setFetchState('error');
    }
  }, [tokens?.access, submissionIdParam]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleDownload = async () => {
    if (!tokens?.access || !submission) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadConferenceManuscript(submission.id, tokens.access);
    } catch (err: unknown) {
      setDownloadError((err as Error)?.message || 'Failed to download manuscript.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCompletePayment = async () => {
    if (!tokens?.access || !submission) return;
    setPaying(true);
    setPaymentMessage(null);
    try {
      await payConferenceSubmission(submission.id, tokens.access, {
        name: submission.author_full_name || '',
        email: submission.author_email || '',
        phone: submission.author_phone || '',
        title: submission.title,
        conferenceTitle: submission.conference_title || '',
      });
      await fetchDetails();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || '';
      setPaymentMessage(
        msg === 'PAYMENT_CANCELLED'
          ? 'Payment was cancelled. This paper is still awaiting payment — complete it any time.'
          : `Payment failed: ${msg || 'please try again.'}`
      );
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!tokens?.access || !submission) return;
    setDownloadingInvoice(true);
    setPaymentMessage(null);
    try {
      await downloadConferenceInvoice(submission.id, tokens.access);
    } catch (err: unknown) {
      setPaymentMessage((err as Error)?.message || 'Failed to download invoice.');
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const refId = displayReference(submission, submission?.reference_number);
  const statusConfig = submission ? getStatusConfig(submission.status) : null;
  const authors = submission?.authors ? [...submission.authors].sort((a, b) => a.order - b.order) : [];
  const declarationCount = submission?.declarations
    ? Object.values(submission.declarations).filter(Boolean).length
    : 0;
  const fee = Number(submission?.submission_fee || 0);
  const isPendingPayment = submission?.status?.toLowerCase() === 'pending_payment';

  return (
    <DashboardLayout
      title={`Conference Paper ${refId}`}
      subtitle="Track peer review progress, view author details, and access your submitted manuscript."
    >
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2">
        <Link
          href="/dashboard/submissions"
          className="inline-flex items-center gap-2 text-xs font-semibold text-gold-400 hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Submissions</span>
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchDetails}
          isLoading={fetchState === 'loading'}
          leftIcon={fetchState !== 'loading' ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
        >
          Refresh Status
        </Button>
      </div>

      {/* Loading Skeleton */}
      {fetchState === 'loading' && (
        <div className="space-y-6 animate-pulse">
          <div className="h-32 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
          <div className="h-40 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-48 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
            <div className="h-48 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60" />
          </div>
        </div>
      )}

      {/* 404 Not Found */}
      {fetchState === 'not_found' && (
        <div className="p-10 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 text-center space-y-4">
          <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/20 w-fit mx-auto">
            <FileText className="w-8 h-8 text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-playfair text-ivory-white">Conference Submission Not Found</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              {isPublicId(submissionIdParam)
                ? `Conference submission ${submissionIdParam} could not be located in your account records.`
                : 'This conference submission could not be located in your account records.'}
            </p>
          </div>
          <Link href="/dashboard/submissions">
            <Button type="button" variant="gold" size="sm">
              Return to Submissions List
            </Button>
          </Link>
        </div>
      )}

      {/* 403 Unauthorized */}
      {fetchState === 'unauthorized' && (
        <div className="p-10 rounded-2xl bg-[#F8EEDC] border border-red-500/20 text-center space-y-4">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/20 w-fit mx-auto">
            <ShieldCheck className="w-8 h-8 text-[#DC2626]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold font-playfair text-ivory-white">Access Restricted</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              You do not have authorization to view this conference submission.
            </p>
          </div>
          <Link href="/dashboard/submissions">
            <Button type="button" variant="outline" size="sm">
              Back to My Submissions
            </Button>
          </Link>
        </div>
      )}

      {/* Error */}
      {fetchState === 'error' && (
        <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
          <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-ivory-white">Could Not Load Submission</p>
          <p className="text-xs text-text-muted">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={fetchDetails}>
            Retry Request
          </Button>
        </div>
      )}

      {/* Main Details */}
      {fetchState === 'success' && submission && statusConfig && (
        <div className="space-y-6">
          {/* Hero Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] relative overflow-hidden space-y-4">
            <div className="absolute top-0 right-0 w-72 h-72 bg-gold-500/5 rounded-full blur-[90px] pointer-events-none" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-ivory-white bg-white/5 border border-[#D4AC54]/60 px-3 py-1 rounded-lg">
                  {refId}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.color}`}
                >
                  {statusConfig.icon}
                  {submission.status_display || statusConfig.label}
                </span>
                {submission.conference_acronym && (
                  <span className="text-xs font-semibold text-text-muted px-2.5 py-1 rounded-full bg-white/5 border border-[#D4AC54]/60 uppercase">
                    {submission.conference_acronym}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] text-text-muted uppercase tracking-wider">Submitted</span>
                <span className="text-xs font-semibold text-ivory-white">{formatDate(submission.submitted_at)}</span>
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold font-playfair text-ivory-white leading-snug">
              {submission.title}
            </h2>
            {submission.subtitle && (
              <p className="text-sm text-text-muted font-playfair italic">{submission.subtitle}</p>
            )}

            {submission.conference_title && (
              <Link
                href={`/conference/${submission.conference_slug || submission.conference}`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-gold-400 hover:underline"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                Target: {submission.conference_title}
              </Link>
            )}
          </div>

          {/* Payment & Invoice */}
          {(fee > 0 || isPendingPayment || submission.has_invoice) && (
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <Receipt className="w-4 h-4" /> Payment &amp; Invoice
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <MetaRow label="Submission Fee" value={`₹${fee.toLocaleString('en-IN')}`} />
                <MetaRow
                  label="Payment Status"
                  value={isPendingPayment ? 'Awaiting payment' : 'Paid'}
                />
                {!isPendingPayment && submission.razorpay_order_id ? (
                  <MetaRow label="Razorpay Order ID" value={<span className="font-mono text-[10px]">{submission.razorpay_order_id}</span>} />
                ) : null}
                {!isPendingPayment && submission.razorpay_payment_id ? (
                  <MetaRow label="Razorpay Payment ID" value={<span className="font-mono text-[10px]">{submission.razorpay_payment_id}</span>} />
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                {isPendingPayment && (
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    onClick={handleCompletePayment}
                    isLoading={paying}
                    leftIcon={!paying ? <CreditCard className="w-3.5 h-3.5" /> : undefined}
                  >
                    Complete Payment
                  </Button>
                )}
                {submission.has_invoice && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadInvoice}
                    isLoading={downloadingInvoice}
                    leftIcon={!downloadingInvoice ? <Download className="w-3.5 h-3.5" /> : undefined}
                  >
                    Download Invoice
                  </Button>
                )}
              </div>

              {paymentMessage && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>{paymentMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* Review Workflow Timeline */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Review & Decision Timeline
            </h3>

            {submission.status.toLowerCase() === 'pending_payment' ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-3">
                <CreditCard className="w-5 h-5 shrink-0 text-amber-400" />
                <span>
                  Peer review begins once the submission fee payment is completed. Use
                  “Complete Payment” above to finish your submission.
                </span>
              </div>
            ) : submission.status.toLowerCase() === 'rejected' ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[#DC2626] text-xs flex items-center gap-3">
                <XCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
                <span>
                  This paper was reviewed and not accepted for the proceedings. You may submit the revised
                  work to a future conference.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                {STATUS_WORKFLOW.map((wf) => {
                  const currentStep = statusConfig.stepNum;
                  const isCompleted = currentStep >= wf.stepNum;
                  const isCurrent = currentStep === wf.stepNum;
                  const IconComp = wf.icon;

                  return (
                    <div
                      key={wf.key}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isCurrent
                          ? 'bg-gold-500/15 border-gold-500/40 text-gold-400 shadow-gold-glow'
                          : isCompleted
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 border-[#D4AC54]/60 text-text-muted opacity-50'
                      }`}
                    >
                      <IconComp className="w-4 h-4 mx-auto mb-1.5" />
                      <p className="text-[11px] font-semibold leading-tight">{wf.label}</p>
                      <span className="text-[9px] block mt-1 opacity-80">
                        {isCurrent ? 'Current' : isCompleted ? 'Passed' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-[11px] text-text-muted">
              <span>Submitted: {formatDate(submission.submitted_at)}</span>
              <span>Last updated: {formatDate(submission.updated_at)}</span>
            </div>
          </div>

          {/* Editorial & Peer Review Notes */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Editorial &amp; Peer Review Notes
            </h3>

            {submission.decision_notes ? (
              <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-xs text-ivory-white leading-relaxed whitespace-pre-line">
                {submission.decision_notes}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center text-xs text-text-muted">
                No editorial comments available yet.
              </div>
            )}
          </div>

          {/* Grid: Authors & Paper Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Authors Card (ordered, normalized) */}
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <Users className="w-4 h-4" /> Authors ({authors.length})
              </h3>

              <div className="space-y-3">
                {authors.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60">
                    <span className="w-6 h-6 rounded-full bg-[#C99A2E] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {a.order}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ivory-white flex items-center gap-2 flex-wrap">
                        {a.full_name}
                        {a.is_corresponding && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gold-500/10 border border-[#D4AC54] text-gold-400">
                            Corresponding
                          </span>
                        )}
                      </p>
                      {a.email && (
                        <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3" /> {a.email}
                        </p>
                      )}
                      {(a.institution || a.designation) && (
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {[a.designation, a.institution, a.department].filter(Boolean).join(' — ')}
                        </p>
                      )}
                      {a.country && (
                        <p className="text-[10px] text-text-muted mt-0.5">
                          {a.country}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {authors.length === 0 && (
                  <MetaRow icon={<User className="w-4 h-4" />} label="Corresponding Author" value={submission.author_full_name} />
                )}
              </div>
            </div>

            {/* Paper Metadata Card (only real backend fields) */}
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Paper Details
              </h3>

              <div className="space-y-3 text-xs">
                <MetaRow label="Paper Type" value={submission.paper_type_display || submission.paper_type} />
                <MetaRow label="Research Track" value={submission.selected_track} />
                <MetaRow label="Research Domain" value={submission.research_domain} />
                <MetaRow label="Language" value={submission.language} />
                <MetaRow label="Registration Category" value={submission.registration_category} />
                <MetaRow label="Proceedings Preference" value={submission.proceedings_preference} />
                <MetaRow icon={<Tags className="w-4 h-4" />} label="Keywords" value={submission.keywords} />
                <MetaRow
                  label="Declarations Accepted"
                  value={declarationCount > 0 ? `${declarationCount} confirmed` : undefined}
                />
              </div>
            </div>
          </div>

          {/* Abstract */}
          {submission.abstract && (
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-3">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Abstract
              </h3>
              <p className="text-xs text-text-muted leading-relaxed whitespace-pre-line">
                {submission.abstract}
              </p>
            </div>
          )}

          {/* Manuscript — authorized download only (protected storage, never a public URL) */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Download className="w-4 h-4" /> Submitted Manuscript
            </h3>

            <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gold-500/10 border border-[#D4AC54] text-gold-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-ivory-white">Manuscript File</p>
                  <p className="text-[10px] text-text-muted">
                    Served securely from protected storage — visible only to you and the editorial team.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="gold"
                size="sm"
                onClick={handleDownload}
                isLoading={downloading}
                leftIcon={!downloading ? <Download className="w-3.5 h-3.5" /> : undefined}
              >
                Download
              </Button>
            </div>

            {downloadError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[#DC2626] text-xs flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>{downloadError}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
