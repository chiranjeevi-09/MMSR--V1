'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  Clock,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpenCheck,
  Award,
  ArrowLeft,
  RefreshCw,
  User,
  Mail,
  Download,
  ExternalLink,
  BookOpen,
  Tag,
  Tags,
  Layers,
  MessageSquare,
  ShieldCheck,
  FileCheck,
  Info,
  Check,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { fetchSubmissionById } from '@/lib/services/submissions';
import { downloadSubmissionDocument, openProtectedFile } from '@/lib/services/protectedFiles';
import { isPublicId, publicIdOf } from '@/lib/utils/publicId';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface UploadedFile {
  id?: number;
  file_name?: string;
  file_url?: string;
  file_type?: string;
  uploaded_at?: string;
}

interface EditorialNote {
  id?: number;
  author?: string;
  note?: string;
  text?: string;
  created_at?: string;
}

interface SubmissionDetail {
  id: number;
  /** Standardized MMSR public ID (MMSR-SUB-1931-NNNNNN). */
  public_id?: string | null;
  title: string;
  submission_type?: string;
  submission_type_display?: string;
  status: string;
  status_display?: string;
  category?: string;
  submitted_at?: string;
  updated_at?: string;
  created_at?: string;
  volume_title?: string | null;
  certificate_issued?: boolean;
  certificate_file?: string | null;
  journal?: string | null;
  conference?: string | null;
  research_domain?: string | null;
  keywords?: string | null;
  version?: string | number | null;
  doi?: string | null;
  volume?: string | number | null;
  issue?: string | number | null;
  abstract?: string | null;
  author_name?: string | null;
  author_email?: string | null;
  manuscript_file?: string | null;
  uploaded_files?: UploadedFile[] | null;
  editorial_notes?: string | EditorialNote[] | null;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error' | 'not_found' | 'unauthorized';

// ─── Status Workflow Config ───────────────────────────────────────────────────

const STATUS_WORKFLOW = [
  { key: 'pending', label: '1. Submitted', icon: Clock, stepNum: 1 },
  { key: 'editorial_screening', label: '2. Editorial Screening', icon: FileCheck, stepNum: 2 },
  { key: 'under_review', label: '3. Under Peer Review', icon: Search, stepNum: 3 },
  { key: 'revision_required', label: '4. Revision Requested', icon: AlertTriangle, stepNum: 4 },
  { key: 'accepted', label: '5. Accepted', icon: CheckCircle2, stepNum: 5 },
  { key: 'published', label: '6. Published', icon: BookOpenCheck, stepNum: 6 },
];

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode; stepNum: number }
> = {
  pending: {
    label: 'Pending Review',
    color: 'text-[#8C6239]',
    bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',
    icon: <Clock className="w-4 h-4" />,
    stepNum: 1,
  },
  editorial_screening: {
    label: 'Editorial Screening',
    color: 'text-[#A97917]',
    bg: 'bg-[#C99A2E]/10 border-[#C99A2E]/30',
    icon: <FileCheck className="w-4 h-4" />,
    stepNum: 2,
  },
  under_review: {
    label: 'Under Peer Review',
    color: 'text-[#5C4033]',
    bg: 'bg-[#5C4033]/10 border-[#5C4033]/30',
    icon: <Search className="w-4 h-4" />,
    stepNum: 3,
  },
  revision_required: {
    label: 'Revision Required',
    color: 'text-[#B45309]',
    bg: 'bg-[#D97706]/10 border-[#D97706]/30',
    icon: <AlertTriangle className="w-4 h-4" />,
    stepNum: 4,
  },
  accepted: {
    label: 'Accepted',
    color: 'text-[#1B4332]',
    bg: 'bg-[#2F6B4F]/10 border-[#2F6B4F]/30',
    icon: <CheckCircle2 className="w-4 h-4" />,
    stepNum: 5,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-[#DC2626]',
    bg: 'bg-[#DC2626]/10 border-[#DC2626]/30',
    icon: <XCircle className="w-4 h-4" />,
    stepNum: 0,
  },
  published: {
    label: 'Published',
    color: 'text-[#8A6A1B]',
    bg: 'bg-[#D4AC54]/15 border-[#D4AC54]/60',
    icon: <BookOpenCheck className="w-4 h-4" />,
    stepNum: 6,
  },
};

function getStatusConfig(status?: string) {
  if (!status) {
    return {
      label: 'Submitted',
      color: 'text-[#8C6239]',
      bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',
      icon: <Clock className="w-4 h-4" />,
      stepNum: 1,
    };
  }
  return (
    STATUS_CONFIG[status.toLowerCase()] ?? {
      label: status,
      color: 'text-[#8C6239]',
      bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',
      icon: <Clock className="w-4 h-4" />,
      stepNum: 1,
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

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubmissionDetailsPage() {
  const params = useParams();
  const { tokens, user } = useAuth();
  const submissionIdParam = params?.id as string;

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // The manuscript and the publication notice are no longer public /media
  // files: they are streamed by an authorised endpoint that re-checks ownership
  // on every request, so the browser must fetch them with the author's bearer
  // token and open the resulting blob (SECURITY-QA-REPORT C-1 / H-2).
  const [documentBusy, setDocumentBusy] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);

  const handleDocument = async (kind: 'certificate' | 'manuscript', mode: 'view' | 'download') => {
    const path = kind === 'certificate' ? submission?.certificate_file : submission?.manuscript_file;
    const fallbackName = kind === 'certificate'
      ? `publication_notice_${submissionIdParam}.pdf`
      : `manuscript_${submissionIdParam}`;
    setDocumentBusy(kind);
    setDocumentError(null);
    try {
      if (mode === 'view') {
        await openProtectedFile(path, tokens?.access || '');
      } else {
        await downloadSubmissionDocument(path, tokens?.access || '', fallbackName);
      }
    } catch (err: any) {
      setDocumentError(err?.message || 'This document could not be opened. Please try again.');
    } finally {
      setDocumentBusy(null);
    }
  };

  const fetchSubmissionDetails = useCallback(async () => {
    if (!tokens?.access || !submissionIdParam) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const data = await fetchSubmissionById(submissionIdParam, tokens.access);
      setSubmission(data as SubmissionDetail);
      setFetchState('success');
    } catch (err: unknown) {
      const anyErr = err as Error & { status?: number };
      if (anyErr.status === 404) { setFetchState('not_found'); return; }
      if (anyErr.status === 401 || anyErr.status === 403) { setFetchState('unauthorized'); return; }
      setErrorMessage(anyErr?.message || 'Failed to fetch manuscript submission details.');
      setFetchState('error');
    }
  }, [tokens?.access, submissionIdParam]);

  useEffect(() => {
    fetchSubmissionDetails();
  }, [fetchSubmissionDetails]);

  // Reference comes from the API record. The URL segment is echoed only when it
  // is itself a public ID — an internal primary key is never displayed.
  const refId =
    publicIdOf(submission) ??
    (isPublicId(submissionIdParam) ? submissionIdParam : 'Not assigned yet');
  const statusConfig = submission ? getStatusConfig(submission.status) : null;

  return (
    <DashboardLayout
      title={`Submission ${refId}`}
      subtitle="Track peer review progress, view author details, and access editorial decisions."
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
          onClick={fetchSubmissionDetails}
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
            <h3 className="text-base font-bold font-playfair text-ivory-white">Submission Not Found</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto leading-relaxed">
              {isPublicId(refId)
                ? `Manuscript ${refId} could not be located in your account records.`
                : 'This manuscript could not be located in your account records.'}
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
              You do not have authorization to view this manuscript submission.
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
          <Button type="button" variant="outline" size="sm" onClick={fetchSubmissionDetails}>
            Retry Request
          </Button>
        </div>
      )}

      {/* Main Submission Details */}
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
                {submission.submission_type_display && (
                  <span className="text-xs font-semibold text-text-muted px-2.5 py-1 rounded-full bg-white/5 border border-[#D4AC54]/60">
                    {submission.submission_type_display}
                  </span>
                )}
                {submission.certificate_issued && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gold-500/10 border border-[#D4AC54] text-gold-400">
                    <Award className="w-3.5 h-3.5" />
                    Publication Notice Issued
                  </span>
                )}
                {submission.certificate_issued && submission.certificate_file && (
                  <button
                    type="button"
                    onClick={() => handleDocument('certificate', 'view')}
                    disabled={documentBusy !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#C99A2E] text-[#FFF9F1] border border-[#C99A2E] hover:bg-[#A97917] transition-colors disabled:opacity-60"
                  >
                    <Download className="w-3.5 h-3.5" />
                    View Publication Notice
                  </button>
                )}
              </div>

              {documentError && (
                <p className="text-xs text-red-600">{documentError}</p>
              )}

              {submission.submitted_at && (
                <span className="text-xs text-text-muted">
                  Submitted: <strong className="text-ivory-white">{formatDate(submission.submitted_at)}</strong>
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-bold font-playfair text-ivory-white leading-snug">
              {submission.title}
            </h2>
          </div>

          {/* Submission Workflow Progress Timeline */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Editorial & Review Workflow Timeline
            </h3>

            {submission.status.toLowerCase() === 'rejected' ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[#DC2626] text-xs flex items-center gap-3">
                <XCircle className="w-5 h-5 shrink-0 text-[#DC2626]" />
                <span>
                  This manuscript was reviewed and not accepted for publication in this volume. Please refer to editorial notes below.
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
          </div>

          {/* Grid: Author Information & Manuscript Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Author Information Card */}
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <User className="w-4 h-4" /> Author & Ownership Information
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-text-muted block text-[10px]">Corresponding Author</span>
                    <span className="font-semibold text-ivory-white">
                      {submission.author_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Authenticated Author'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-text-muted block text-[10px]">Author Email</span>
                    <span className="text-ivory-white">
                      {submission.author_email || user?.email || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Manuscript Metadata Card (Only existing backend fields) */}
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Manuscript Metadata
              </h3>

              <div className="space-y-3 text-xs">
                {submission.journal && (
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted block text-[10px]">Target Journal</span>
                      <span className="font-semibold text-ivory-white">{submission.journal}</span>
                    </div>
                  </div>
                )}

                {submission.conference && (
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted block text-[10px]">Conference Proceeding</span>
                      <span className="font-semibold text-ivory-white">{submission.conference}</span>
                    </div>
                  </div>
                )}

                {(submission.category || submission.research_domain) && (
                  <div className="flex items-start gap-3">
                    <Tag className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted block text-[10px]">Research Domain / Category</span>
                      <span className="text-ivory-white">
                        {submission.category || submission.research_domain}
                      </span>
                    </div>
                  </div>
                )}

                {submission.keywords && (
                  <div className="flex items-start gap-3">
                    <Tags className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted block text-[10px]">Keywords</span>
                      <span className="text-ivory-white">{submission.keywords}</span>
                    </div>
                  </div>
                )}

                {(submission.volume_title || submission.volume || submission.issue) && (
                  <div className="flex items-start gap-3">
                    <Layers className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-text-muted block text-[10px]">Volume & Issue Details</span>
                      <span className="text-ivory-white">
                        {submission.volume_title || `Vol. ${submission.volume || '?'} Issue ${submission.issue || '?'}`}
                      </span>
                    </div>
                  </div>
                )}

                {/* DOI — show real value if available, otherwise placeholder */}
                <div className="flex items-start gap-3">
                  {submission.doi ? (
                    <ExternalLink className="w-4 h-4 text-gold-400 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="text-text-muted block text-[10px]">DOI</span>
                    {submission.doi ? (
                      <a
                        href={`https://doi.org/${submission.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gold-400 hover:underline font-mono text-xs"
                      >
                        {submission.doi}
                      </a>
                    ) : (
                      <span className="text-text-muted italic text-xs">
                        Will be assigned after publication.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Abstract Section (if available) */}
          {submission.abstract && (
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-3">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Abstract Summary
              </h3>
              <p className="text-xs text-text-muted leading-relaxed whitespace-pre-line">
                {submission.abstract}
              </p>
            </div>
          )}

          {/* Uploaded Files Section */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <Download className="w-4 h-4" /> Submitted Manuscript & Documents
            </h3>

            {submission.manuscript_file || (submission.uploaded_files && submission.uploaded_files.length > 0) ? (
              <div className="space-y-3">
                {submission.certificate_issued && (
                  <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gold-500/10 border border-[#D4AC54] text-gold-400">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ivory-white">Publication Notice</p>
                        <p className="text-[10px] text-text-muted">
                          {submission.certificate_file
                            ? 'Official publication notice issued by the editorial office'
                            : 'Issued — the notice PDF is being attached by the editorial office'}
                        </p>
                      </div>
                    </div>
                    {submission.certificate_file ? (
                      <button
                        type="button"
                        onClick={() => handleDocument('certificate', 'download')}
                        disabled={documentBusy !== null}
                        className="px-4 py-2 rounded-xl bg-gold-500/10 border border-[#D4AC54] hover:border-gold-500/40 text-gold-400 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-60"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {documentBusy === 'certificate' ? 'Preparing…' : 'Download'}
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl bg-[#C99A2E]/10 border border-[#D4AC54]/40 text-[#8C6B1B] text-[11px] font-semibold">
                        Coming soon
                      </span>
                    )}
                  </div>
                )}

                {submission.manuscript_file && (
                  <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-gold-500/10 border border-[#D4AC54] text-gold-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ivory-white">Main Manuscript PDF / File</p>
                        <p className="text-[10px] text-text-muted">Primary submission file</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDocument('manuscript', 'download')}
                      disabled={documentBusy !== null}
                      className="px-4 py-2 rounded-xl bg-gold-500/10 border border-[#D4AC54] hover:border-gold-500/40 text-gold-400 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {documentBusy === 'manuscript' ? 'Preparing…' : 'Download'}
                    </button>
                  </div>
                )}

                {submission.uploaded_files?.map((uf, idx) => (
                  <div key={uf.id || idx} className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ivory-white">{uf.file_name || `Supplementary File ${idx + 1}`}</p>
                        <p className="text-[10px] text-text-muted">{uf.file_type || 'Attachment'}</p>
                      </div>
                    </div>
                    {uf.file_url && (
                      <a
                        href={uf.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-white/5 border border-[#D4AC54]/60 hover:border-[#D4AC54] text-gold-400 text-xs font-bold flex items-center gap-2 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center space-y-1">
                <p className="text-xs text-text-muted">No uploaded manuscript files are directly attached to this record.</p>
              </div>
            )}
          </div>

          {/* Editorial Notes Section */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Editorial & Peer Review Notes
            </h3>

            {submission.editorial_notes ? (
              typeof submission.editorial_notes === 'string' ? (
                <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-xs text-ivory-white leading-relaxed whitespace-pre-line">
                  {submission.editorial_notes}
                </div>
              ) : Array.isArray(submission.editorial_notes) && submission.editorial_notes.length > 0 ? (
                <div className="space-y-3">
                  {submission.editorial_notes.map((note, idx) => (
                    <div key={note.id || idx} className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-gold-400">
                        <span className="font-semibold">{note.author || 'Editorial Board'}</span>
                        <span>{formatDate(note.created_at)}</span>
                      </div>
                      <p className="text-xs text-ivory-white leading-relaxed">{note.note || note.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center text-xs text-text-muted">
                  No editorial comments available yet.
                </div>
              )
            ) : (
              <div className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center text-xs text-text-muted">
                No editorial comments available yet.
              </div>
            )}
          </div>

          {/* TASK 5 — Author Communication Timeline */}
          <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] space-y-5">
            <div className="flex items-center justify-between border-b border-[#D4AC54]/60 pb-3">
              <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Author Communication History & Dispatches
              </h3>
              <span className="text-[10px] text-text-muted font-mono uppercase">Official Audit Trail</span>
            </div>

            {(() => {
              const timelineEvents = [
                {
                  id: 'event-sub',
                  title: 'Submission Confirmation Dispatched',
                  type: 'Submission Confirmation',
                  date: submission.submitted_at || submission.created_at,
                  active: true,
                  message: `Official submission receipt assigned Ref: ${refId}. Acknowledgment email dispatched to ${submission.author_email || 'author'}.`,
                },
                {
                  id: 'event-scr',
                  title: 'Editorial Screening Initiated',
                  type: 'Editorial Messages',
                  date: submission.updated_at,
                  active: ['editorial_screening', 'under_review', 'revision_required', 'revision_requested', 'accepted', 'published'].includes(submission.status),
                  message: 'Associate Editor assigned. Technical screening and plagiarism check performed.',
                },
                {
                  id: 'event-rev',
                  title: 'Peer Review & Revision Decision',
                  type: 'Revision Request',
                  date: submission.updated_at,
                  active: ['revision_required', 'revision_requested', 'accepted', 'published'].includes(submission.status),
                  message: submission.status.includes('revision')
                    ? 'Peer review feedback released. Revision requested from author.'
                    : 'Peer review comments evaluated by domain editor.',
                },
                {
                  id: 'event-acc',
                  title: 'Formal Acceptance Letter Issued',
                  type: 'Acceptance Letter',
                  date: submission.updated_at,
                  active: ['accepted', 'published'].includes(submission.status),
                  message: `Manuscript accepted for publication in ${submission.journal || 'MMSR Publications'}. Certificate of Acceptance available.`,
                },
                {
                  id: 'event-pub',
                  title: 'Final Article Publication & DOI Assignment',
                  type: 'Publication Notice',
                  date: submission.updated_at,
                  active: submission.status === 'published',
                  message: submission.doi ? `Published online with DOI: ${submission.doi}. Indexed in open access catalog.` : 'Article publication queued.',
                },
              ];

              const activeEvents = timelineEvents.filter((e) => e.active);

              if (activeEvents.length === 0) {
                return (
                  <div className="p-6 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center space-y-1">
                    <Mail className="w-8 h-8 text-text-muted/40 mx-auto" />
                    <p className="text-xs font-semibold text-ivory-white">No Communication Records Found</p>
                    <p className="text-[11px] text-text-muted">
                      Official email communications and decision dispatches will be recorded here as your manuscript progresses.
                    </p>
                  </div>
                );
              }

              return (
                <div className="relative pl-7 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-gold-500/30">
                  {activeEvents.map((evt) => (
                    <div key={evt.id} className="relative group">
                      <div className="absolute -left-7 top-0.5 w-5 h-5 rounded-full bg-[#C99A2E] border-2 border-[#C99A2E] flex items-center justify-center shadow-md">
                        <Check className="w-3 h-3 text-white stroke-[3]" />
                      </div>
                      <div className="p-4 rounded-xl bg-navy-950 border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-all space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="text-xs font-bold text-ivory-white">{evt.title}</span>
                          <span className="text-[10px] text-gold-400 font-mono bg-gold-500/10 px-2 py-0.5 rounded border border-[#D4AC54]">
                            {evt.type}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">{evt.message}</p>
                        {evt.date && (
                          <div className="text-[10px] text-text-muted/60 font-mono pt-1">
                            Dispatched: {formatDate(evt.date)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
