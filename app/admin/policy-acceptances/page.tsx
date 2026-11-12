'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  RefreshCw,
  Loader2,
  AlertCircle,
  Eye,
  X,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Eraser,
  CameraOff,
  Download,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { PolicyMarkdown } from '@/components/policies/PolicyMarkdown';
import {
  PolicyAcceptanceRecord,
  fetchPolicyAcceptances,
  downloadPolicyAcceptanceRecord,
} from '@/lib/services/policies';
import { displayId, isPublicId } from '@/lib/utils/publicId';

const POLICY_TYPE_OPTIONS = [
  { value: '', label: 'All policy types' },
  { value: 'terms', label: 'Terms and Conditions' },
  { value: 'privacy', label: 'Privacy Policy' },
  { value: 'publication_policies', label: 'Publication Policies and Ethics' },
];

const TYPE_LABELS: Record<string, string> = {
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
  publication_policies: 'Publication Policies and Ethics',
};

/** Server timestamp rendered explicitly in UTC (acceptance times are stored UTC). */
function fmtUtc(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${d.toLocaleString('en-GB', {
    timeZone: 'UTC',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })} UTC`;
}

interface Filters {
  search: string;
  submissionId: string;
  policyType: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY_FILTERS: Filters = {
  search: '',
  submissionId: '',
  policyType: '',
  dateFrom: '',
  dateTo: '',
};

const labelCls = 'text-[13px] font-bold uppercase tracking-wider block';
const labelStyle = { color: '#8B7B68' };
const inputCls = 'w-full min-h-[44px] rounded-xl px-3.5 py-2 text-xs outline-none bg-white focus:ring-2 focus:ring-[#C9A66B]';
const inputStyle = { border: '1px solid #E9DFCF', color: '#3E2E22' };

export default function AdminPolicyAcceptancesPage() {
  const { tokens } = useAuth();
  const accessToken = tokens?.access || '';

  const [records, setRecords] = useState<PolicyAcceptanceRecord[]>([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft filters are only sent to the backend when the admin applies them,
  // so typing never fires a request per keystroke.
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);

  // Record viewer modal
  const [viewing, setViewing] = useState<PolicyAcceptanceRecord | null>(null);
  const modalCloseRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Download feedback (per-record evidence file)
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const fallbackFilename = (r: PolicyAcceptanceRecord) =>
    `policy-acceptance-${r.public_id || 'record'}-${r.policy_type}-v${r.version_number || 'unknown'}.md`;

  const handleDownload = async (r: PolicyAcceptanceRecord) => {
    setDownloadingId(r.id);
    setFeedback(null);
    try {
      await downloadPolicyAcceptanceRecord(r.id, accessToken, fallbackFilename(r));
      setFeedback({ kind: 'ok', text: `Downloaded accepted ${TYPE_LABELS[r.policy_type] || r.policy_type} (v${r.version_number}) as submitted evidence.` });
    } catch (err: any) {
      setFeedback({ kind: 'err', text: err?.message || 'Download failed.' });
    } finally {
      setDownloadingId(null);
    }
  };

  const loadPage = useCallback(async (targetPage: number, filters: Filters) => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      // The submission box accepts either an internal number (exact foreign-key
      // filter) or a standardized MMSR reference, which the endpoint resolves
      // through its search parameter.
      const subFilter = filters.submissionId.trim();
      const subIsPublicRef = isPublicId(subFilter);
      const data = await fetchPolicyAcceptances(accessToken, {
        search: filters.search.trim() || (subIsPublicRef ? subFilter : undefined) || undefined,
        submission: !subIsPublicRef && /^\d+$/.test(subFilter) ? subFilter : undefined,
        policy_type: filters.policyType || undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
        page: targetPage > 1 ? targetPage : undefined,
      });
      setRecords(data.records);
      setCount(data.count);
      setHasMore(data.hasMore);
      setPage(targetPage);
    } catch (err: any) {
      setError(err?.message || 'Failed to load acceptance records.');
      setRecords([]);
      setCount(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadPage(1, applied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ── Modal keyboard behavior: Escape closes; Tab is trapped inside the dialog ──
  useEffect(() => {
    if (!viewing) return;
    modalCloseRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setViewing(null);
        returnFocusRef.current?.focus?.();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [viewing]);

  const openRecord = (record: PolicyAcceptanceRecord) => {
    returnFocusRef.current = (document.activeElement as HTMLElement) || null;
    setViewing(record);
  };

  const closeRecord = () => {
    setViewing(null);
    returnFocusRef.current?.focus?.();
  };

  const applyFilters = () => {
    setApplied(draft);
    loadPage(1, draft);
  };

  // Auto-apply: any change to a filter field re-queries automatically after a
  // short debounce, so there is no separate Search button. The first render is
  // skipped because the access-token effect already loads the initial page.
  const filterMountRef = useRef(true);
  useEffect(() => {
    if (filterMountRef.current) {
      filterMountRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      setApplied(draft);
      loadPage(1, draft);
    }, 400);
    return () => clearTimeout(t);
  }, [draft, loadPage]);

  const clearFilters = () => {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    loadPage(1, EMPTY_FILTERS);
  };

  const pageNumbers = () => {
    const totalPages = Math.max(1, Math.ceil(count / 20));
    return `Page ${page} of ${totalPages}`;
  };

  return (
    <AdminLayout
      title="Policy Acceptance Records"
      subtitle="View and verify the exact policies accepted by authors during manuscript submission."
    >
      {/* Search & filters */}
      <div className="rounded-2xl bg-white border p-4" style={{ borderColor: '#E9DFCF' }} role="search" aria-label="Acceptance record filters">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
          <div className="space-y-1.5 xl:col-span-2">
            <label htmlFor="acceptance-search" className={labelCls} style={labelStyle}>
              Search author or submission
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8B7B68' }} />
              <input
                id="acceptance-search"
                type="text"
                value={draft.search}
                onChange={(e) => setDraft((f) => ({ ...f, search: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilters(); } }}
                placeholder="Author name, email, submission ID or title…"
                className={`${inputCls} pl-9`}
                style={inputStyle}
                aria-label="Search by author name, email, submission ID or submission title"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="acceptance-submission" className={labelCls} style={labelStyle}>Submission reference</label>
            <input
              id="acceptance-submission"
              type="text"
              value={draft.submissionId}
              onChange={(e) => setDraft((f) => ({ ...f, submissionId: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyFilters(); } }}
              placeholder="MMSR-SUB-1931-000101 or 42"
              className={inputCls}
              style={inputStyle}
              aria-label="Filter by submission reference"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="acceptance-policy-type" className={labelCls} style={labelStyle}>Policy type</label>
            <select
              id="acceptance-policy-type"
              value={draft.policyType}
              onChange={(e) => setDraft((f) => ({ ...f, policyType: e.target.value }))}
              className={inputCls}
              style={inputStyle}
              aria-label="Filter by policy type"
            >
              {POLICY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="acceptance-date-from" className={labelCls} style={labelStyle}>Accepted from</label>
            <input
              id="acceptance-date-from"
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft((f) => ({ ...f, dateFrom: e.target.value }))}
              className={inputCls}
              style={inputStyle}
              aria-label="Filter acceptances from this date"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="acceptance-date-to" className={labelCls} style={labelStyle}>Accepted to</label>
            <input
              id="acceptance-date-to"
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft((f) => ({ ...f, dateTo: e.target.value }))}
              className={inputCls}
              style={inputStyle}
              aria-label="Filter acceptances up to this date"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={clearFilters} disabled={loading} className="min-h-[44px]">
            <Eraser className="w-4 h-4 mr-1.5" /> Clear filters
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => loadPage(page, applied)} disabled={loading} className="min-h-[44px]" aria-label="Refresh records">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <p className="text-[13px] ml-auto" style={{ color: '#8B7B68' }} aria-live="polite">
            {loading
              ? 'Querying audit records…'
              : `${count} record${count === 1 ? '' : 's'} found`}
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2" role="alert"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2" role="status" aria-live="polite"
          style={feedback.kind === 'ok'
            ? { background: 'rgba(22,163,74,0.07)', color: '#16a34a', border: '1px solid rgba(22,163,74,0.25)' }
            : { background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>
          {feedback.kind === 'ok' ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {feedback.text}
        </div>
      )}

      {/* Acceptance records table */}
      <div className="rounded-2xl bg-white border overflow-x-auto" style={{ borderColor: '#E9DFCF' }}>
        <table className="w-full text-left text-xs min-w-[960px]" aria-busy={loading}>
          <caption className="sr-only">Policy acceptance records — one row per accepted policy</caption>
          <thead>
            <tr style={{ borderBottom: '1px solid #E9DFCF', color: '#8B7B68' }}>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider">Acceptance ID</th>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider">Author Name</th>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider">Author Email</th>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider">Submission ID</th>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider">Policy</th>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider">Accepted Version</th>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider">Accepted At (UTC)</th>
              <th scope="col" className="px-4 py-3 font-bold uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-[#FFF8EE] transition-colors" style={{ borderBottom: '1px solid #F2EADC' }}>
                <td className="px-4 py-3 font-mono" style={{ color: '#5C4B3A' }} title={displayId(r)}>
                  {displayId(r)}
                </td>
                <td className="px-4 py-3 font-semibold" style={{ color: '#3E2E22' }}>{r.user_name || '—'}</td>
                <td className="px-4 py-3 text-[13px]" style={{ color: '#8B7B68' }}>{r.user_email || 'user removed'}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#5C4B3A' }}>
                  {r.submission_public_id || (r.submission_id ? `#${r.submission_id}` : <span style={{ color: '#8B7B68' }}>— (submission removed)</span>)}
                </td>
                <td className="px-4 py-3" style={{ color: '#5C4B3A' }}>
                  {TYPE_LABELS[r.policy_type] || r.policy_type_display}
                </td>
                <td className="px-4 py-3 font-mono" style={{ color: '#3E2E22' }}>v{r.version_number || '—'}</td>
                <td className="px-4 py-3 font-mono" style={{ color: '#5C4B3A' }}>{fmtUtc(r.accepted_at)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(r)}
                      disabled={downloadingId === r.id}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-bold disabled:opacity-50 focus:ring-2 focus:ring-[#C9A66B] outline-none"
                      style={{ background: 'rgba(62,74,58,0.06)', color: '#5C4B3A', border: '1px solid #E9DFCF' }}
                      aria-label={`Download accepted ${TYPE_LABELS[r.policy_type] || r.policy_type} v${r.version_number} for ${r.user_name || r.user_email} as Markdown`}
                    >
                      {downloadingId === r.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Download className="w-3.5 h-3.5" />}
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => openRecord(r)}
                      className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-bold focus:ring-2 focus:ring-[#C9A66B] outline-none"
                      style={{ background: 'rgba(201,166,107,0.12)', color: '#A98042', border: '1px solid rgba(201,166,107,0.35)' }}
                      aria-label={`View acceptance record ${displayId(r)} for ${r.user_name || r.user_email}`}
                    >
                      <Eye className="w-3.5 h-3.5" /> View Record
                    </button>
                  </span>
                </td>
              </tr>
            ))}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: '#8B7B68' }}>
                  {error
                    ? 'No records could be loaded.'
                    : 'No policy acceptances match the current filters. Records are created automatically when authors submit manuscripts or chapters.'}
                </td>
              </tr>
            )}
            {loading && records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: '#8B7B68' }}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading acceptance records…
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {(count > 0) && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px]" style={{ color: '#8B7B68' }}>{count} record{count === 1 ? '' : 's'} · {pageNumbers()}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadPage(page - 1, applied)}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-bold disabled:opacity-40 focus:ring-2 focus:ring-[#C9A66B] outline-none"
              style={{ border: '1px solid #E9DFCF', color: '#5C4B3A' }}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              type="button"
              onClick={() => loadPage(page + 1, applied)}
              disabled={loading || !hasMore}
              className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-bold disabled:opacity-40 focus:ring-2 focus:ring-[#C9A66B] outline-none"
              style={{ border: '1px solid #E9DFCF', color: '#5C4B3A' }}
              aria-label="Next page"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <p className="text-[13px] flex items-center gap-1.5" style={{ color: '#8B7B68' }}>
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" style={{ color: '#C9A66B' }} />
        Each record stores an immutable snapshot of the exact policy text the author accepted. Later policy edits or republishes never change these records.
      </p>

      {/* Record detail modal */}
      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="acceptance-detail-title">
          <div className="absolute inset-0 bg-black/50" onClick={closeRecord} aria-hidden="true" />
          <div
            ref={modalRef}
            className="relative z-10 w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-2xl bg-white border px-6 pb-6 space-y-5"
            style={{ borderColor: '#E9DFCF' }}
          >
            <div className="flex items-start justify-between gap-4 sticky top-0 -mx-6 px-6 pt-6 pb-3 bg-white z-20 rounded-t-2xl" style={{ borderBottom: '1px solid #E9DFCF' }}>
              <div>
                <h2 id="acceptance-detail-title" className="text-base font-bold" style={{ color: '#3E2E22' }}>
                  Policy Acceptance Details
                </h2>
                <p className="text-[13px] mt-0.5" style={{ color: '#8B7B68' }}>
                  {TYPE_LABELS[viewing.policy_type] || viewing.policy_type_display} · v{viewing.version_number || '—'}
                </p>
              </div>
              <button
                ref={modalCloseRef}
                type="button"
                onClick={closeRecord}
                className="p-2.5 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center focus:ring-2 focus:ring-[#C9A66B] outline-none"
                style={{ color: '#8B7B68', border: '1px solid #E9DFCF' }}
                aria-label="Close acceptance details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Record information */}
            <section aria-labelledby="acceptance-record-info">
              <h3 id="acceptance-record-info" className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: '#8B7B68' }}>
                Record Information
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-xl p-4 border" style={{ borderColor: '#E9DFCF', background: '#FFFDF8' }}>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Acceptance ID</dt>
                  <dd className="text-xs font-mono mt-0.5 break-all" style={{ color: '#3E2E22' }}>{displayId(viewing)}</dd>
                </div>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Author name</dt>
                  <dd className="text-xs font-semibold mt-0.5" style={{ color: '#3E2E22' }}>{viewing.user_name || '—'}</dd>
                </div>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Author email</dt>
                  <dd className="text-xs mt-0.5" style={{ color: '#3E2E22' }}>{viewing.user_email || '— (user removed)'}</dd>
                </div>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Author reference</dt>
                  <dd className="text-xs font-mono mt-0.5" style={{ color: '#3E2E22' }}>
                    {displayId({ public_id: viewing.user_public_id })}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Submission reference</dt>
                  <dd className="text-xs font-mono mt-0.5" style={{ color: '#3E2E22' }}>
                    {viewing.submission_public_id
                      || (viewing.submission_id ? `#${viewing.submission_id}` : '— (submission removed)')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Policy type</dt>
                  <dd className="text-xs mt-0.5" style={{ color: '#3E2E22' }}>{TYPE_LABELS[viewing.policy_type] || viewing.policy_type_display}</dd>
                </div>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Accepted policy version</dt>
                  <dd className="text-xs font-mono mt-0.5" style={{ color: '#3E2E22' }}>
                    v{viewing.version_number || '—'}
                    {viewing.policy_version_public_id
                      ? <span className="block text-[13px]" style={{ color: '#8B7B68' }}>version ref: {viewing.policy_version_public_id}</span>
                      : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-[13px] uppercase tracking-wider font-bold" style={{ color: '#8B7B68' }}>Accepted at (UTC)</dt>
                  <dd className="text-xs font-mono mt-0.5" style={{ color: '#3E2E22' }}>{fmtUtc(viewing.accepted_at)}</dd>
                </div>
              </dl>
            </section>

            {/* Agreement statement */}
            <section aria-labelledby="acceptance-agreement">
              <h3 id="acceptance-agreement" className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: '#8B7B68' }}>
                Agreement Statement
              </h3>
              {viewing.agreement_text ? (
                <blockquote className="rounded-xl p-3.5 text-[13px] italic leading-relaxed" style={{ background: 'rgba(201,166,107,0.08)', border: '1px solid rgba(201,166,107,0.25)', color: '#5C4B3A' }}>
                  “{viewing.agreement_text}”
                </blockquote>
              ) : (
                <p className="text-xs" style={{ color: '#8B7B68' }}>No agreement statement was stored for this record.</p>
              )}
            </section>

            {/* Accepted policy content (historical snapshot) */}
            <section aria-labelledby="acceptance-content">
              <h3 id="acceptance-content" className="text-[13px] font-bold uppercase tracking-wider mb-2" style={{ color: '#8B7B68' }}>
                Accepted Policy Content — as accepted at submission time
              </h3>
              {viewing.content_snapshot && viewing.content_snapshot.trim() ? (
                <>
                  <p className="text-[13px] mb-3 flex items-center gap-1.5" style={{ color: '#8B7B68' }}>
                    <ShieldCheck className="w-3 h-3" style={{ color: '#C9A66B' }} />
                    This is the stored historical snapshot from this record — it is never re-fetched from the current policy.
                  </p>
                  <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: '#E9DFCF', background: '#FFFDF8' }}>
                    <PolicyMarkdown content={viewing.content_snapshot} />
                  </div>
                </>
              ) : (
                <div className="rounded-xl p-4 text-xs flex items-start gap-2.5" role="status"
                  style={{ background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.3)', color: '#92400e' }}>
                  <CameraOff className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    The historical content snapshot is unavailable for this record
                    {viewing.policy_version ? ' — only the immutable version reference above remains.' : '.'}
                    {' '}Do not treat current policy text as the accepted text for this submission.
                  </span>
                </div>
              )}
            </section>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDownload(viewing)}
                disabled={downloadingId === viewing.id}
                className="min-h-[44px] px-5"
              >
                {downloadingId === viewing.id
                  ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  : <Download className="w-4 h-4 mr-1.5" />}
                Download (.md)
              </Button>
              <Button type="button" variant="gold" size="sm" onClick={closeRecord} className="min-h-[44px] px-5">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
