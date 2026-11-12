'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Search, RefreshCw, PlusCircle, MapPin, Globe, Award, Trash2, Eye } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { displayId, searchableRefs } from '@/lib/utils/publicId';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { validateDate, validateDateRange, lettersOnly } from '@/lib/validation';
import { clearPending, readPending, savePending } from '@/lib/utils/pendingSync';
import {
  adminCreateConference,
  adminUpdateConference,
  adminDeleteConference,
  CONFERENCE_DOMAINS,
} from '@/lib/services/conferences';

/**
 * SECURITY-QA-REPORT L-5: this desk used to write every save into
 * `localStorage` under `mmsr_admin_conferences` and then read that copy back as
 * though it were the catalogue. A rejected (or non-staff) write therefore looked
 * like a published conference, and a stale local snapshot could mask the real
 * server rows indefinitely — including three fabricated conferences on the
 * public listing. The API is now the only source of truth; local storage keeps
 * nothing but an unsent draft so typing survives a failed request.
 */
const PENDING_CONFERENCE = 'admin_conference_form';

/** Best-effort message from a DRF error body, for the operator-facing banner. */
function describeFailure(err: unknown): string {
  const detail = (err as { message?: string } | null)?.message || '';
  return detail || 'The server rejected the request.';
}

export default function AdminConferencesPage() {
  const { tokens } = useAuth();
  const [conferences, setConferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [listError, setListError] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [title, setTitle] = useState('');
  const [acronym, setAcronym] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [venue, setVenue] = useState('');
  const [country, setCountry] = useState('');
  const [mode, setMode] = useState<'Hybrid' | 'Online' | 'Offline'>('Hybrid');
  const [domain, setDomain] = useState('Computer Science & AI');
  const [description, setDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [keyHighlights, setKeyHighlights] = useState('');
  const [importantDatesText, setImportantDatesText] = useState('');
  const [submissionGuidelines, setSubmissionGuidelines] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [submissionFee, setSubmissionFee] = useState('');
  const [doiPrefix, setDoiPrefix] = useState('10.5555/conf');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchConferencesData = useCallback(async () => {
    setLoading(true);
    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (tokens?.access) headers['Authorization'] = `Bearer ${tokens.access}`;

      const res = await fetch(`${apiBase}/api/conferences/`, { headers });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.results ?? [];
      // Server rows only — an empty catalogue is shown as empty, never backfilled
      // from a local snapshot.
      setConferences(items);
      setListError(null);
    } catch (err: any) {
      setConferences([]);
      setListError(
        err?.name === 'TypeError'
          ? 'Cannot reach the MMSR API. The list below is empty because no server data could be loaded.'
          : `The conference list could not be loaded (${describeFailure(err)}). Nothing shown is necessarily deleted — reload after checking the API.`,
      );
    } finally {
      setLoading(false);
    }
  }, [tokens?.access]);

  useEffect(() => {
    fetchConferencesData();
  }, [fetchConferencesData]);

  const handleOpenAdd = () => {
    setEditingId(null);
    // A draft only exists when a previous send failed, so re-offering it here
    // cannot resurrect anything the server already accepted.
    const draft = readPending<Record<string, any>>(PENDING_CONFERENCE);
    const d = draft?.data || {};
    if (draft) {
      setFormError(
        `Unsent conference draft from ${new Date(draft.savedAt).toLocaleString()} is loaded — the server rejected it (${draft.reason}). Press Save to retry.`,
      );
    }
    setTitle(d.title || '');
    setAcronym(d.acronym || '');
    setStartDate(d.start_date || '');
    setEndDate(d.end_date || '');
    setVenue(d.venue || '');
    setCountry(d.country || '');
    setMode(d.mode || 'Hybrid');
    setDomain(d.domain || 'Computer Science & AI');
    setDescription(d.description || '');
    setFullDescription(d.full_description || '');
    setKeyHighlights(d.key_highlights || '');
    setImportantDatesText(d.important_dates_text || '');
    setSubmissionGuidelines(d.submission_guidelines || '');
    setSubmissionDeadline(d.submission_deadline || '');
    setSubmissionFee(d.submission_fee != null && d.submission_fee !== 0 ? String(d.submission_fee) : '');
    setDoiPrefix(d.doi_prefix || '10.5555/conf');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (conf: any) => {
    setEditingId(conf.id);
    setTitle(conf.title || conf.name || '');
    setAcronym(conf.acronym || conf.short_title || '');
    setStartDate(conf.start_date || conf.date || '');
    setEndDate(conf.end_date || '');
    setVenue(conf.venue || conf.location || '');
    setCountry(conf.country || '');
    setMode(conf.mode || 'Hybrid');
    setDomain(conf.domain || 'Computer Science & AI');
    setDescription(conf.description || '');
    setFullDescription(conf.full_description || conf.fullDescription || conf.description || '');
    setKeyHighlights(conf.key_highlights || (Array.isArray(conf.highlights) ? conf.highlights.join('\n') : '') || '');
    setImportantDatesText(conf.important_dates_text || conf.submissionDeadline || '');
    setSubmissionGuidelines(conf.submission_guidelines || conf.guidelines || '');
    setSubmissionDeadline(conf.submission_deadline || conf.submissionDeadline || '');
    setSubmissionFee(conf.submission_fee != null ? String(conf.submission_fee) : '');
    setIsAddModalOpen(true);
  };

  const handleSaveConference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Cross-field date ordering — mirrors the backend ConferenceSerializer.
    setFormError(null);
    const startErr = validateDate(startDate, 'Start date');
    if (startErr) { setFormError(startErr); return; }
    const rangeErr = validateDateRange(startDate, endDate, 'Start date', 'End date');
    if (rangeErr) { setFormError(rangeErr); return; }
    const deadlineErr = validateDateRange(submissionDeadline, startDate, 'Submission deadline', 'Start date');
    if (deadlineErr) { setFormError('Submission deadline cannot be after the conference start date.'); return; }

    setSaving(true);
    const data: Record<string, any> = {
      id: editingId || undefined,
      title: title.trim(),
      acronym: acronym.trim() || title.slice(0, 8).toUpperCase(),
      start_date: startDate,
      end_date: endDate || startDate,
      venue: venue.trim() || 'Academic Conference Hall',
      country: country.trim() || 'International',
      mode,
      domain,
      description: description.trim() || 'International scientific research conference.',
      full_description: fullDescription.trim() || description.trim() || 'International scientific research conference.',
      key_highlights: keyHighlights.trim(),
      important_dates_text: importantDatesText.trim(),
      submission_guidelines: submissionGuidelines.trim(),
      submission_deadline: submissionDeadline || startDate,
      submission_fee: submissionFee.trim() === '' ? 0 : Number(submissionFee),
      registration_open: true,
      is_accepting_submissions: true,
      status: 'Upcoming',
      doi_prefix: doiPrefix,
    };

    const token = tokens?.access || '';
    try {
      if (editingId) {
        await adminUpdateConference(editingId, data, token);
      } else {
        await adminCreateConference(data, token);
      }
      // Confirmed write: drop any buffered draft so it cannot be re-submitted.
      clearPending(PENDING_CONFERENCE);
      setFormError(null);
      setSaving(false);
      setIsAddModalOpen(false);
      await fetchConferencesData();
    } catch (err: any) {
      // No local "published conference" fallback: the row does not exist until
      // the API says it does. Keep the modal open and buffer the typing instead.
      if (!editingId) savePending(PENDING_CONFERENCE, data, describeFailure(err));
      setFormError(
        `${describeFailure(err)} Nothing was written to the server, so this conference is not live. Your typing is kept in this browser so you can fix it and press Save again.`,
      );
      setSaving(false);
    }
  };

  const confirmDeleteConference = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const token = tokens?.access || '';
    try {
      await adminDeleteConference(deleteTarget.id, token);
      setListError(null);
      await fetchConferencesData();
    } catch (err: any) {
      // The row is still on the server — say so rather than hiding it locally.
      setListError(`That conference could not be deleted (${describeFailure(err)}). It is still published.`);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filteredConferences = conferences.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const t = (c.title || c.name || '').toLowerCase();
    const ac = (c.acronym || c.short_title || '').toLowerCase();
    const d = (c.domain || '').toLowerCase();
    // Operators quote the printed MMSR conference reference in support threads.
    const ref = searchableRefs(c.public_id);
    return t.includes(q) || ac.includes(q) || d.includes(q) || ref.includes(q);
  });

  return (
    <AdminLayout
      title="Conferences & Academic Events CMS"
      subtitle="Schedule, manage, and publish academic international conferences and proceedings."
    >
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-xs text-[#8B7B68]">
            Registered Conferences: <strong className="text-[#5C4B3A]">{conferences.length}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchConferencesData}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            + Add New Conference
          </Button>
        </div>
      </div>

      {/* Load/delete failures are stated out loud — an empty list must never be
          papered over with a cached copy (SECURITY-QA-REPORT L-5). */}
      {listError && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-[13px] font-semibold text-red-700 flex items-start justify-between gap-4"
        >
          <span>{listError}</span>
          <Button type="button" variant="outline" size="sm" onClick={fetchConferencesData} leftIcon={<RefreshCw className="w-4 h-4" />}>
            Reload
          </Button>
        </div>
      )}

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#E9DFCF]">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, acronym, domain or MMSR ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FFFBF7] border border-[#E9DFCF] rounded-xl pl-10 pr-4 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
          />
        </div>
      </div>

      {/* Conference Grid */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#8B7B68]">Loading conferences...</div>
      ) : filteredConferences.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <Calendar className="w-10 h-10 text-[#C9A66B] mx-auto" />
          <p className="text-base font-bold text-[#5C4B3A] font-playfair">{listError ? 'Conferences Unavailable' : 'No Conferences Registered'}</p>
          <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
            {listError
              ? 'Reload once the API is reachable. This desk never shows conferences that are not on the server.'
              : 'Click "+ Add New Conference" above to publish new conference proceedings to the user side.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredConferences.map((conf) => {
            const acronymStr = conf.acronym || conf.short_title || 'CONF';
            const titleStr = conf.title || conf.name || 'Untitled Conference';
            const locationStr = conf.venue || conf.location || conf.country || 'International';
            const modeStr = conf.mode || 'Hybrid';
            const domainStr = conf.domain || 'Multidisciplinary';
            const deadlineStr = conf.submission_deadline || '';
            const isOpenNow = Boolean(conf.accepting ?? conf.is_accepting_submissions);
            const deadlineLabel = deadlineStr
              ? new Date(deadlineStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'Not set';
            const feeLabel = Number(conf.submission_fee || 0) > 0
              ? `₹${Number(conf.submission_fee).toLocaleString('en-IN')}`
              : 'Free';

            return (
              <div
                key={conf.id}
                className="p-6 rounded-2xl bg-white border border-[#E9DFCF] shadow-sm hover:border-[#C9A66B] transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[#C9A66B] bg-[#C9A66B]/10 px-2.5 py-0.5 rounded border border-[#C9A66B]/30">
                      {acronymStr}
                    </span>
                    <span className="text-[13px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {modeStr}
                    </span>
                  </div>

                  <h4 className="text-base font-bold font-playfair text-[#5C4B3A] leading-snug line-clamp-2">
                    {titleStr}
                  </h4>

                  <p className="text-xs text-[#8B7B68] line-clamp-3 leading-relaxed">
                    {conf.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-[#E9DFCF] flex items-end justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5C4B3A]">
                      <MapPin className="w-3.5 h-3.5 text-[#C9A66B] shrink-0" />
                      <span className="truncate">{locationStr}</span>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-1 text-[13px]">
                      <dt className="text-[#8B7B68]">Domain</dt>
                      <dd className="text-left font-semibold text-[#5C4B3A] truncate">{domainStr}</dd>

                      <dt className="text-[#8B7B68]">Deadline</dt>
                      <dd className="text-left font-semibold text-[#5C4B3A]">{deadlineLabel}</dd>

                      <dt className="text-[#8B7B68]">Fee</dt>
                      <dd className="text-left font-semibold text-[#5C4B3A]">{feeLabel}</dd>

                      <dt className="text-[#8B7B68]">Collected</dt>
                      <dd className="text-left font-semibold text-emerald-700">
                        ₹{Number(conf.total_collected || 0).toLocaleString('en-IN')} • {Number(conf.submissions_count || 0)} paid
                      </dd>

                      <dt className="text-[#8B7B68]">Reference</dt>
                      <dd className="text-left font-mono text-[13px] text-[#5C4B3A]">{displayId(conf)}</dd>
                    </dl>
                    <div className="pt-1">
                      <span className={`inline-flex items-center gap-1.5 text-[13px] font-bold px-2 py-0.5 rounded-full border ${isOpenNow ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isOpenNow ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {isOpenNow ? 'Submissions Open' : 'Submissions Closed'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(conf)}
                      className="p-2 rounded-xl bg-white border border-[#E9DFCF] text-[#5C4B3A] hover:bg-[#FFF8EE] transition-colors cursor-pointer"
                      title="Edit Conference"
                    >
                      <Eye className="w-4 h-4 text-[#C9A66B]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(conf)}
                      className="p-2 rounded-xl bg-white border border-[#DC2626]/25 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Conference"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Conference Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingId ? 'Edit Academic Conference' : 'Add New Academic Conference'}
        subtitle="Changes will reflect immediately on the frontend conference detail & listing pages."
        size="lg"
      >
        <form onSubmit={handleSaveConference} className="space-y-4 font-manrope">
          <div>
            <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
              Conference Title <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. International Conference on Robotics & Automation (ICRA-2026)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Acronym / Code</label>
              <input
                type="text"
                placeholder="e.g. ICRA-2026"
                value={acronym}
                onChange={(e) => setAcronym(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Research Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] font-bold"
              >
                {CONFERENCE_DOMAINS.filter((d) => d !== 'All Domains').map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                Start Date <span className="text-red-600">*</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] font-bold"
              >
                <option value="Hybrid">Hybrid</option>
                <option value="Online">Online</option>
                <option value="Offline">Offline</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Venue / Institution</label>
              <input
                type="text"
                placeholder="e.g. Imperial College London"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Country</label>
              <input
                type="text"
                placeholder="e.g. United Kingdom"
                value={country}
                onChange={(e) => setCountry(lettersOnly(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                Submission Deadline
              </label>
              <input
                type="date"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Submission Fee (₹)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0 = free"
                value={submissionFee}
                onChange={(e) => setSubmissionFee(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">DOI Prefix</label>
              <input
                type="text"
                value={doiPrefix}
                onChange={(e) => setDoiPrefix(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Short Summary / Abstract</label>
            <textarea
              rows={2}
              placeholder="Brief summary of conference themes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Details Section (Full Description)</label>
            <textarea
              rows={3}
              placeholder="Full detailed conference objectives, themes, and scope..."
              value={fullDescription}
              onChange={(e) => setFullDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Key Highlights</label>
              <textarea
                rows={3}
                placeholder="e.g. Keynote by IEEE Fellows&#10;SCOPUS Indexed Proceedings&#10;Best Paper Awards"
                value={keyHighlights}
                onChange={(e) => setKeyHighlights(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Important Dates Section</label>
              <textarea
                rows={3}
                placeholder="e.g. Full Paper Submission: Oct 15, 2026&#10;Acceptance Notice: Nov 01, 2026"
                value={importantDatesText}
                onChange={(e) => setImportantDatesText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Submission Guidelines Section</label>
            <textarea
              rows={3}
              placeholder="Paper template requirements, max length, formatting rules..."
              value={submissionGuidelines}
              onChange={(e) => setSubmissionGuidelines(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {formError && (
              <p className="mr-auto text-[13px] font-semibold text-red-600" role="alert">{formError}</p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={saving}>
              {editingId ? 'Save & Update Conference' : 'Save & Publish Conference'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Conference"
        message={
          <>
            Are you sure you want to delete{' '}
            <strong>{deleteTarget?.acronym || deleteTarget?.title || 'this conference'}</strong>?
            This action cannot be undone.
          </>
        }
        confirmLabel="Delete"
        isBusy={deleting}
        onConfirm={confirmDeleteConference}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminLayout>
  );
}
