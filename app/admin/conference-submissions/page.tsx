'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarCheck,
  Search,
  RefreshCw,
  Receipt,
  Trash2,
  Save,
  FileText,
  Users,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  downloadConferenceManuscript,
  type ConferenceSubmissionResult,
} from '@/lib/services/submissions';
import { downloadConferenceInvoice } from '@/lib/services/submissionServices';
import { displayReference, searchableRefs } from '@/lib/utils/publicId';

const getApiBase = () =>
  (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// Workflow statuses staff can assign (pending_payment is intentionally excluded)
const EDITABLE_STATUSES = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'revision_required', label: 'Revision Required' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'camera_ready', label: 'Camera Ready' },
  { value: 'published', label: 'Published' },
];

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: 'Pending Payment', cls: 'bg-amber-50 border border-amber-200 text-amber-700' },
  submitted: { label: 'Submitted', cls: 'bg-sky-50 border border-sky-200 text-sky-700' },
  under_review: { label: 'Under Review', cls: 'bg-blue-50 border border-blue-200 text-blue-700' },
  revision_required: { label: 'Revision Required', cls: 'bg-orange-50 border border-orange-200 text-orange-700' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-50 border border-emerald-200 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 border border-red-200 text-red-700' },
  camera_ready: { label: 'Camera Ready', cls: 'bg-teal-50 border border-teal-200 text-teal-700' },
  published: { label: 'Published', cls: 'bg-[#FFF2D9] border border-[#E9DFCF] text-[#A98042]' },
};

function statusStyle(status: string) {
  return STATUS_STYLE[status?.toLowerCase()] ?? {
    label: status || '—',
    cls: 'bg-[#FFF8EE] border border-[#E9DFCF] text-[#8B7B68]',
  };
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
}

interface ConferenceOption {
  id: number;
  title: string;
  acronym?: string;
}

export default function AdminConferenceSubmissionsPage() {
  const { tokens } = useAuth();

  const [rows, setRows] = useState<ConferenceSubmissionResult[]>([]);
  const [conferences, setConferences] = useState<ConferenceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [conferenceFilter, setConferenceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail modal
  const [selected, setSelected] = useState<ConferenceSubmissionResult | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<'success' | 'error'>('success');

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<ConferenceSubmissionResult | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setNotice(message);
    setNoticeType(type);
  };

  const authHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tokens?.access || ''}` }),
    [tokens?.access]
  );

  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [subRes, confRes] = await Promise.all([
        fetch(`${getApiBase()}/api/conference-submissions/`, { headers: { Authorization: `Bearer ${tokens.access}` } }),
        fetch(`${getApiBase()}/api/conferences/`, { headers: { Authorization: `Bearer ${tokens.access}` } }),
      ]);
      if (!subRes.ok) throw new Error(`Failed to load submissions (HTTP ${subRes.status})`);
      const subData = await subRes.json();
      setRows(Array.isArray(subData) ? subData : subData.results ?? []);

      if (confRes.ok) {
        const confData = await confRes.json();
        const list = Array.isArray(confData) ? confData : confData.results ?? [];
        setConferences(list.map((c: any) => ({ id: c.id, title: c.title, acronym: c.acronym })));
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to load conference submissions.');
    } finally {
      setLoading(false);
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDetail = async (sub: ConferenceSubmissionResult) => {
    setSelected(sub);
    setNotice(null);
    setEditStatus(sub.status);
    setAdminNotes(sub.admin_notes || '');
    setDecisionNotes(sub.decision_notes || '');
    setModalLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/api/conference-submissions/${sub.id}/`, {
        headers: { Authorization: `Bearer ${tokens?.access || ''}` },
      });
      if (res.ok) {
        const full = await res.json();
        setSelected(full);
        setEditStatus(full.status);
        setAdminNotes(full.admin_notes || '');
        setDecisionNotes(full.decision_notes || '');
      }
    } catch {
      /* keep list data */
    } finally {
      setModalLoading(false);
    }
  };

  const saveAdminUpdate = async (regenerate = false) => {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    try {
      const payload: Record<string, any> = {
        status: editStatus,
        admin_notes: adminNotes,
        decision_notes: decisionNotes,
      };
      if (regenerate) payload.regenerate_invoice = true;
      const res = await fetch(`${getApiBase()}/api/conference-submissions/${selected.id}/admin-update/`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || data.status || `Update failed (HTTP ${res.status})`);
      setSelected(data);
      setRows((prev) => prev.map((r) => (r.id === data.id ? data : r)));
      showNotice(regenerate ? 'Invoice regenerated.' : 'Saved successfully.', 'success');
    } catch (err: any) {
      showNotice(err?.message || 'Failed to update submission.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      const res = await fetch(`${getApiBase()}/api/conference-submissions/${deleteTarget.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${tokens?.access || ''}` },
      });
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Delete failed (HTTP ${res.status})`);
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setSelected((cur) => (cur && cur.id === deleteTarget.id ? null : cur));
    } catch (err: any) {
      showNotice(err?.message || 'Failed to delete submission.', 'error');
    } finally {
      setDeleteBusy(false);
      setDeleteTarget(null);
    }
  };

  const handleDownloadManuscript = async (id: number) => {
    setBusyAction(`ms-${id}`);
    try {
      await downloadConferenceManuscript(id, tokens?.access || '');
    } catch (err: any) {
      showNotice(err?.message || 'Manuscript download failed.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadInvoice = async (id: number) => {
    setBusyAction(`inv-${id}`);
    try {
      await downloadConferenceInvoice(id, tokens?.access || '');
    } catch (err: any) {
      showNotice(err?.message || 'Invoice download failed.', 'error');
    } finally {
      setBusyAction(null);
    }
  };

  const filtered = rows.filter((r) => {
    // Admin only reviews confirmed submissions (payment complete or a free conference);
    // rows still awaiting payment are hidden from this list.
    if (r.status?.toLowerCase() === 'pending_payment') return false;
    if (conferenceFilter !== 'all' && String(r.conference) !== conferenceFilter) return false;
    if (statusFilter !== 'all' && r.status?.toLowerCase() !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = `${r.title} ${searchableRefs(r.public_id, r.reference_number)} ${r.author_full_name || ''} ${r.conference_acronym || ''} ${r.conference_title || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
  );

  return (
    <AdminLayout
      title="Conference Submissions CMS"
      subtitle="Review submitted papers, manage workflow status, and handle submission-fee payments & invoices."
    >
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <p className="text-xs text-[#8B7B68]">
          Total: <strong className="text-[#5C4B3A]">{rows.filter((r) => r.status?.toLowerCase() !== 'pending_payment').length}</strong> · Showing:{' '}
          <strong className="text-[#5C4B3A]">{sorted.length}</strong>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadData}
          isLoading={loading}
          leftIcon={!loading ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-2xl bg-white border border-[#E9DFCF] grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8B7B68] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search title, reference, applicant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FFFBF7] border border-[#E9DFCF] rounded-xl pl-9 pr-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
          />
        </div>
        <select
          value={conferenceFilter}
          onChange={(e) => setConferenceFilter(e.target.value)}
          className="bg-[#FFFBF7] border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
        >
          <option value="all">All Conferences</option>
          {conferences.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.acronym || c.title}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#FFFBF7] border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
        >
          <option value="all">All Statuses</option>
          {EDITABLE_STATUSES.map((s) => s.value).map((s) => (
            <option key={s} value={s}>
              {statusStyle(s).label}
            </option>
          ))}
        </select>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {errorMsg}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#8B7B68]">Loading conference submissions...</div>
      ) : sorted.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <CalendarCheck className="w-10 h-10 text-[#C9A66B] mx-auto" />
          <p className="text-base font-bold text-[#5C4B3A] font-playfair">No Conference Submissions</p>
          <p className="text-xs text-[#8B7B68]">No papers match the current filters.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead>
              <tr className="bg-[#FFFBF7] border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                <th className="px-4 py-3 font-bold">Reference</th>
                <th className="px-4 py-3 font-bold">Paper Title</th>
                <th className="px-4 py-3 font-bold">Applicant</th>
                <th className="px-4 py-3 font-bold">Conference</th>
                <th className="px-4 py-3 font-bold">Fee</th>
                <th className="px-4 py-3 font-bold">Payment</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Submitted</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const st = statusStyle(r.status);
                const isFree = Number(r.submission_fee || 0) <= 0;
                const paid = r.status?.toLowerCase() !== 'pending_payment';
                return (
                  <tr key={r.id} className="border-b border-[#E9DFCF]/60 hover:bg-[#FFFBF7] transition-colors">
                    <td className="px-4 py-3 font-mono text-[#8C6239] whitespace-nowrap">
                      {displayReference(r, r.reference_number)}
                    </td>
                    <td className="px-4 py-3 font-bold text-[#5C4B3A] line-clamp-1 max-w-[280px]">{r.title}</td>
                    <td className="px-4 py-3 text-[13px] text-[#8B7B68]">{r.author_full_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#5C4B3A]">
                      {r.conference_acronym || r.conference_title || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-[#5C4B3A]">
                      {Number(r.submission_fee || 0) > 0 ? `₹${Number(r.submission_fee).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {isFree ? (
                        <span className="text-[#8B7B68]">—</span>
                      ) : paid ? (
                        <span className="text-emerald-700 font-semibold">Paid</span>
                      ) : (
                        <span className="text-amber-700 font-semibold">Awaiting</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[13px] font-bold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#8B7B68]">{formatDate(r.submitted_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(r)}
                          className="p-2 rounded-xl bg-white border border-[#E9DFCF] text-[#5C4B3A] hover:bg-[#FFF8EE] cursor-pointer"
                          title="Open details"
                        >
                          <Eye className="w-4 h-4 text-[#C9A66B]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          className="p-2 rounded-xl bg-white border border-[#DC2626]/25 text-red-600 hover:bg-red-50 cursor-pointer"
                          title="Delete submission"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      <Modal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${displayReference(selected, selected.reference_number)} — ${selected.title}` : 'Submission'}
        subtitle="Full paper details, payment record, and workflow management."
        size="lg"
      >
        {selected && (
          <div className="space-y-5 font-manrope">
            {modalLoading && (
              <p className="text-[13px] text-[#8B7B68] italic">Loading latest details…</p>
            )}

            {notice && (
              noticeType === 'success' ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {notice}
                </div>
              )
            )}

            {/* Payment & invoice section */}
            <div className="p-4 rounded-xl bg-[#FFFBF7] border border-[#E9DFCF] space-y-3">
              <h4 className="text-xs font-bold text-[#5C4B3A] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#C9A66B]" /> Payment & Invoice
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Field label="Submission Fee" value={`₹${Number(selected.submission_fee || 0).toLocaleString('en-IN')}`} />
                <Field
                  label="Payment Status"
                  value={
                    Number(selected.submission_fee || 0) <= 0
                      ? '—'
                      : selected.status?.toLowerCase() === 'pending_payment'
                      ? 'Awaiting payment'
                      : 'Paid'
                  }
                />
                <Field label="Razorpay Order ID" value={selected.razorpay_order_id || '—'} mono />
                <Field label="Razorpay Payment ID" value={selected.razorpay_payment_id || '—'} mono />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadManuscript(selected.id)}
                  isLoading={busyAction === `ms-${selected.id}`}
                  leftIcon={<FileText className="w-3.5 h-3.5" />}
                >
                  Download Manuscript
                </Button>
                {selected.has_invoice ? (
                  <Button
                    type="button"
                    variant="gold"
                    size="sm"
                    onClick={() => handleDownloadInvoice(selected.id)}
                    isLoading={busyAction === `inv-${selected.id}`}
                    leftIcon={<Receipt className="w-3.5 h-3.5" />}
                  >
                    Download Invoice
                  </Button>
                ) : (
                  <span className="inline-flex items-center text-[13px] text-[#8B7B68] italic self-center">
                    Invoice available once payment completes.
                  </span>
                )}
                {selected.has_invoice && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => saveAdminUpdate(true)}
                    isLoading={saving}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    Regenerate Invoice
                  </Button>
                )}
              </div>
            </div>

            {/* Paper metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <Field label="Conference" value={selected.conference_title || '—'} />
              <Field label="Acronym" value={selected.conference_acronym || '—'} />
              <Field label="Track" value={selected.selected_track || '—'} />
              <Field label="Paper Type" value={selected.paper_type_display || selected.paper_type || '—'} />
              <Field label="Keywords" value={selected.keywords || '—'} />
              <Field label="Applicant" value={selected.author_full_name || '—'} />
              <Field label="Email" value={selected.author_email || '—'} />
              <Field label="Phone" value={selected.author_phone || '—'} />
              <Field label="Institution" value={selected.institution || '—'} />
            </div>

            {selected.abstract && (
              <div>
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1">Abstract</span>
                <p className="text-xs text-[#5C4B3A] leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                  {selected.abstract}
                </p>
              </div>
            )}

            {/* Authors */}
            {Array.isArray(selected.authors) && selected.authors.length > 0 && (
              <div>
                <span className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] flex items-center gap-1 mb-2">
                  <Users className="w-3.5 h-3.5" /> Authors ({selected.authors.length})
                </span>
                <div className="space-y-1.5">
                  {[...selected.authors]
                    .sort((a, b) => a.order - b.order)
                    .map((a) => (
                      <div key={a.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-[#FFFBF7] border border-[#E9DFCF]">
                        <span className="w-5 h-5 rounded-full bg-[#C9A66B] text-white text-[13px] font-bold flex items-center justify-center shrink-0">
                          {a.order}
                        </span>
                        <span className="font-semibold text-[#5C4B3A]">{a.full_name}</span>
                        {a.is_corresponding && (
                          <span className="text-[12px] px-1.5 py-0.5 rounded bg-[#C9A66B]/15 text-[#8C6239] border border-[#C9A66B]/30">
                            Corresponding
                          </span>
                        )}
                        {a.email && <span className="text-[#8B7B68] ml-auto truncate max-w-[180px]">{a.email}</span>}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Workflow management */}
            <div className="p-4 rounded-xl bg-[#FFFBF7] border border-[#E9DFCF] space-y-3">
              <h4 className="text-xs font-bold text-[#5C4B3A]">Workflow Management</h4>
              {selected.status?.toLowerCase() === 'pending_payment' ? (
                <p className="text-[13px] text-amber-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" /> This submission is awaiting payment and cannot be reviewed yet.
                </p>
              ) : (
                <>
                  <div>
                    <label className="block text-[13px] font-bold text-[#8B7B68] mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    >
                      {EDITABLE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] font-bold text-[#8B7B68] mb-1">Decision Notes (shared with author)</label>
                    <textarea
                      rows={2}
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => saveAdminUpdate(false)}
                      isLoading={saving}
                      leftIcon={<Save className="w-3.5 h-3.5" />}
                    >
                      Save Changes
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Submission"
        message={
          <>
            Are you sure you want to delete{' '}
            <strong>
              {deleteTarget
                ? displayReference(deleteTarget, deleteTarget.reference_number, deleteTarget.title || 'this submission')
                : 'this submission'}
            </strong>?
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        isBusy={deleteBusy}
        onConfirm={performDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <span className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block">{label}</span>
      <span className={`text-[#5C4B3A] font-semibold break-words ${mono ? 'font-mono text-[13px]' : ''}`}>{value}</span>
    </div>
  );
}
