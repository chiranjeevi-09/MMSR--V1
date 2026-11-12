'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldOff,
  Search,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  PlusCircle,
  UserCheck,
  Clock,
  Ban,
  Key,
  Newspaper,
  Layers,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  AdminJournalAccess,
  AdminJournal,
  AdminIssue,
  AdminUser,
  fetchAdminJournalAccess,
  fetchAdminJournals,
  fetchAdminIssues,
  fetchAdminUsers,
  revokeJournalAccess,
  grantJournalAccess,
} from '@/lib/services/cms';
import { displayId, publicIdOf } from '@/lib/utils/publicId';

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const ACCESS_TYPE_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  subscription: {
    label: 'Annual Subscription',
    color: 'bg-[#FFF2D9] text-[#C9A66B] border-[#C9A66B]/40',
    icon: <Newspaper className="w-2.5 h-2.5" />,
  },
  issue: {
    label: 'Single Issue',
    color: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    icon: <Layers className="w-2.5 h-2.5" />,
  },
  manual_grant: {
    label: 'Manual Grant',
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: <Key className="w-2.5 h-2.5" />,
  },
};

function getAccessStatus(row: AdminJournalAccess): { label: string; color: string; icon: React.ReactNode } {
  if (!row.is_active) return { label: 'Revoked', color: 'bg-red-500/10 text-[#DC2626] border-red-500/30', icon: <Ban className="w-2.5 h-2.5" /> };
  const now = new Date();
  if (row.end_date && new Date(row.end_date) < now) return { label: 'Expired', color: 'bg-[#8B7B68]/10 text-[#8B7B68] border-[#8B7B68]/30', icon: <Clock className="w-2.5 h-2.5" /> };
  return { label: 'Active', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: <ShieldCheck className="w-2.5 h-2.5" /> };
}

function daysRemaining(endDate?: string | null): string {
  if (!endDate) return 'Lifetime';
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (diff < 0) return `Expired ${Math.abs(diff)}d ago`;
  if (diff === 0) return 'Expires today';
  return `${diff}d remaining`;
}

const emptyGrant = () => ({
  userId: '',
  journal: '',
  issue: '',
  access_type: 'manual_grant' as 'issue' | 'subscription' | 'manual_grant',
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
});

export default function AdminJournalAccessPage() {
  const { tokens } = useAuth();

  const [records, setRecords] = useState<AdminJournalAccess[]>([]);
  const [journals, setJournals] = useState<AdminJournal[]>([]);
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filterJournal, setFilterJournal] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Revoke state ─────────────────────────────────────────────────────────────
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  // ── Grant drawer ─────────────────────────────────────────────────────────────
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState(emptyGrant());
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);

  // Directory map: the internal user key carried by an access record → the
  // displayable identity (email plus the standardized MMSR reference). Access
  // rows only hold the key, so the public ID is resolved here instead of
  // printing the raw database ID (spec §11).
  const userDirectory = useMemo<Record<number, { label: string; publicId: string | null }>>(() => {
    const map: Record<number, { label: string; publicId: string | null }> = {};
    users.forEach((u) => {
      map[u.id] = { label: u.email || displayId(u), publicId: publicIdOf(u) };
    });
    return map;
  }, [users]);

  // Journal key → title, for records whose serializer omitted the title.
  const journalTitleMap = useMemo<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    journals.forEach((j) => { map[j.id] = j.title; });
    return map;
  }, [journals]);

  // ── Load data ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMessage(null);
    try {
      const params: Parameters<typeof fetchAdminJournalAccess>[1] = {};
      if (filterJournal) params.journal = filterJournal;
      if (filterType) params.access_type = filterType;
      if (filterActive === 'true') params.is_active = true;
      if (filterActive === 'false') params.is_active = false;

      const [recs, jnls, iss, usrs] = await Promise.all([
        fetchAdminJournalAccess(tokens.access, params),
        fetchAdminJournals(tokens.access).catch(() => [] as AdminJournal[]),
        fetchAdminIssues(tokens.access).catch(() => [] as AdminIssue[]),
        fetchAdminUsers(tokens.access).catch(() => [] as AdminUser[]),
      ]);
      setRecords(recs);
      setJournals(jnls);
      setIssues(iss);
      setUsers(usrs);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load access records. Ensure you are authenticated as staff.');
      setFetchState('error');
    }
  }, [tokens?.access, filterJournal, filterType, filterActive]);

  useEffect(() => { loadData(); }, [loadData]);

  // Client-side email search (user email is resolved locally from users list)
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter((r) => {
      const email = (userDirectory[r.user]?.label || r.user_email || '').toLowerCase();
      const jTitle = (r.journal_title || '').toLowerCase();
      const iTitle = (r.issue_title || '').toLowerCase();
      return email.includes(q) || jTitle.includes(q) || iTitle.includes(q);
    });
  }, [records, searchQuery, userDirectory]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const active = records.filter((r) => r.is_active && (!r.end_date || new Date(r.end_date) >= new Date())).length;
    const expired = records.filter((r) => r.is_active && r.end_date && new Date(r.end_date) < new Date()).length;
    const revoked = records.filter((r) => !r.is_active).length;
    return { total, active, expired, revoked };
  }, [records]);

  // Issues for grant form filtered by selected journal
  const grantIssueOptions = useMemo(() => {
    if (!grantForm.journal) return issues;
    return issues.filter((i) => {
      const jId = typeof i.journal === 'object' ? String(i.journal.id) : String(i.journal);
      return jId === grantForm.journal;
    });
  }, [issues, grantForm.journal]);

  // ── Revoke ─────────────────────────────────────────────────────────────────────
  const handleRevoke = async () => {
    if (!revokingId || !tokens?.access) return;
    setRevokeLoading(true);
    setRevokeError(null);
    try {
      await revokeJournalAccess(tokens.access, revokingId);
      setRevokingId(null);
      await loadData();
    } catch (err: any) {
      setRevokeError(err?.message || 'Failed to revoke access.');
    } finally {
      setRevokeLoading(false);
    }
  };

  // ── Grant ──────────────────────────────────────────────────────────────────────
  const handleGrantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access) return;
    const userId = parseInt(grantForm.userId, 10);
    if (!userId || isNaN(userId)) { setGrantError('User ID is required.'); return; }
    if (!grantForm.journal) { setGrantError('Journal is required.'); return; }
    if (!grantForm.start_date) { setGrantError('Start date is required.'); return; }
    if (grantForm.access_type === 'issue' && !grantForm.issue) {
      setGrantError('Issue is required for single-issue access type.'); return;
    }

    setGrantSubmitting(true);
    setGrantError(null);
    setGrantSuccess(null);

    try {
      await grantJournalAccess(tokens.access, {
        user: userId,
        journal: parseInt(grantForm.journal, 10),
        issue: grantForm.issue ? parseInt(grantForm.issue, 10) : null,
        access_type: grantForm.access_type,
        start_date: grantForm.start_date,
        end_date: grantForm.end_date || null,
      });
      setGrantSuccess('Access granted successfully. The entitlement is now active for the user.');
      await loadData();
      setTimeout(() => setIsGrantOpen(false), 1200);
    } catch (err: any) {
      setGrantError(err?.message || 'Failed to grant access.');
    } finally {
      setGrantSubmitting(false);
    }
  };

  const openGrant = () => {
    setGrantForm({ ...emptyGrant(), journal: filterJournal || (journals[0] ? String(journals[0].id) : '') });
    setGrantError(null);
    setGrantSuccess(null);
    setIsGrantOpen(true);
  };

  return (
    <AdminLayout
      title="Journal Access Audit"
      subtitle="Read-only audit view of all UserJournalAccess entitlement records. Staff may safely revoke active grants or create manual_grant entitlements. All operations are server-side validated."
    >
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[#8B7B68] mb-1 -mt-1">
        <Link href="/admin" className="hover:text-[#C9A66B] transition-colors">Admin</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/journals" className="hover:text-[#C9A66B] transition-colors">Journals & Issues</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[#5C4B3A] font-semibold">Access Audit</span>
      </nav>

      <div className="space-y-5">
        {/* ── Stats Row ── */}
        {fetchState === 'success' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Records', value: stats.total, color: 'text-[#5C4B3A]' },
              { label: 'Active', value: stats.active, color: 'text-emerald-400' },
              { label: 'Expired', value: stats.expired, color: 'text-[#8B7B68]' },
              { label: 'Revoked', value: stats.revoked, color: 'text-[#DC2626]' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-[#E9DFCF] rounded-2xl p-4 text-center">
                <span className={`text-2xl font-bold font-playfair ${color}`}>{value}</span>
                <p className="text-[13px] text-[#8B7B68] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter & Action Bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Journal filter */}
          <select
            value={filterJournal}
            onChange={(e) => setFilterJournal(e.target.value)}
            className="bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
          >
            <option value="">All Journals</option>
            {journals.map((j) => <option key={j.id} value={String(j.id)}>{j.title}</option>)}
          </select>

          {/* Access type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
          >
            <option value="">All Types</option>
            <option value="subscription">Annual Subscription</option>
            <option value="issue">Single Issue</option>
            <option value="manual_grant">Manual Grant</option>
          </select>

          {/* Active filter */}
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
            className="bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
          >
            <option value="">Active & Inactive</option>
            <option value="true">Active Only</option>
            <option value="false">Revoked Only</option>
          </select>

          {/* Email / journal search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-[#8B7B68] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search email, journal, issue…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E9DFCF] rounded-xl pl-9 pr-3 py-2 text-xs text-[#5C4B3A] placeholder:text-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={fetchState === 'loading'}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <button
            type="button"
            onClick={openGrant}
            className="px-4 py-2 rounded-xl bg-[#C9A66B] text-white font-bold text-xs shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            Grant Access
          </button>
        </div>

        {/* ── Security Notice ── */}
        <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-[13px] text-[#8B7B68] flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
          <span>
            <strong className="text-[#5C4B3A]">Read-Only Audit View.</strong>{' '}
            Entitlements are created automatically by the payment verification webhook (Phase 3). Revoke removes backend
            access immediately — it does not issue a refund. Grant creates a{' '}
            <code className="font-mono">manual_grant</code> record; the backend enforces{' '}
            <code className="font-mono">is_staff</code> server-side via <code className="font-mono">perform_create</code>.
          </span>
        </div>

        {/* ── Loading ── */}
        {fetchState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-[#C9A66B] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#8B7B68]">Loading access records from Django REST API…</p>
          </div>
        )}

        {/* ── Error ── */}
        {fetchState === 'error' && (
          <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#DC2626] mx-auto" />
            <p className="text-sm font-semibold text-[#5C4B3A]">Failed to Load Access Records</p>
            <p className="text-xs text-[#8B7B68]">{errorMessage}</p>
            <Button type="button" variant="outline" size="sm" onClick={loadData}>Retry</Button>
          </div>
        )}

        {/* ── Empty ── */}
        {fetchState === 'success' && filteredRecords.length === 0 && (
          <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
            <ShieldCheck className="w-8 h-8 text-[#C9A66B] mx-auto" />
            <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Access Records Found</p>
            <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
              {searchQuery || filterJournal || filterType || filterActive
                ? 'No records match the active filters.'
                : 'No journal access entitlements have been granted yet. Purchases via the payment flow will appear here automatically.'}
            </p>
          </div>
        )}

        {/* ── Table ── */}
        {fetchState === 'success' && filteredRecords.length > 0 && (
          <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                    <th className="py-3 px-4 font-bold">Email</th>
                    <th className="py-3 px-4 font-bold">User ID</th>
                    <th className="py-3 px-4 font-bold">Journal</th>
                    <th className="py-3 px-4 font-bold">Type</th>
                    <th className="py-3 px-4 font-bold">Issue</th>
                    <th className="py-3 px-4 font-bold">Reference</th>
                    <th className="py-3 px-4 font-bold">Granted</th>
                    <th className="py-3 px-4 font-bold">Expiry</th>
                    <th className="py-3 px-4 font-bold">Days Left</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE4]">
                  {filteredRecords.map((r) => {
                    const typeMeta = ACCESS_TYPE_META[r.access_type] ?? ACCESS_TYPE_META.manual_grant;
                    const statusMeta = getAccessStatus(r);
                    // Identity comes from the record itself when the serializer
                    // supplied it, else from the locally loaded directory —
                    // never from the raw user key (spec §11).
                    const userEntry = userDirectory[r.user];
                    const userEmail = r.user_email || userEntry?.label || 'Account not in loaded list';
                    const userRef = r.user_public_id || userEntry?.publicId || null;
                    const journalLabel =
                      r.journal_title || journalTitleMap[r.journal] || r.journal_public_id || 'Journal not listed';
                    const canRevoke = r.is_active;

                    return (
                      <tr key={r.id} className="hover:bg-[#FFF8EE] transition-colors">
                        {/* Email */}
                        <td className="py-3 px-4 font-medium text-[#5C4B3A]">{userEmail}</td>

                        {/* User ID */}
                        <td className="py-3 px-4 text-[13px] font-mono text-[#8B7B68]">{userRef || '—'}</td>

                        {/* Journal */}
                        <td className="py-3 px-4">
                          {r.journal_slug ? (
                            <Link href={`/journals/${r.journal_slug}`} target="_blank" className="font-medium text-[#5C4B3A] hover:text-[#C9A66B] transition-colors line-clamp-2">
                              {journalLabel}
                            </Link>
                          ) : (
                            <span className="font-medium text-[#5C4B3A] line-clamp-2">{journalLabel}</span>
                          )}
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] font-bold border ${typeMeta.color}`}>
                            {typeMeta.label}
                          </span>
                        </td>

                        {/* Issue */}
                        <td className="py-3 px-4 text-[13px] text-[#8B7B68] line-clamp-1">{r.issue_title || '—'}</td>

                        {/* Reference */}
                        <td className="py-3 px-4 text-[13px] font-mono text-[#8B7B68]">{r.public_id || '—'}</td>

                        {/* Granted date */}
                        <td className="py-3 px-4 text-[#8B7B68]">
                          {r.granted_at ? new Date(r.granted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>

                        {/* Expiry */}
                        <td className="py-3 px-4 font-medium text-[#5C4B3A]">
                          {r.end_date
                            ? new Date(r.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                            : 'Lifetime'}
                        </td>

                        {/* Days Left */}
                        <td className="py-3 px-4 text-[13px] text-[#8B7B68]">{daysRemaining(r.end_date)}</td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] font-bold border ${statusMeta.color}`}>
                            {statusMeta.icon}
                            {statusMeta.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {canRevoke ? (
                            <button
                              type="button"
                              onClick={() => setRevokingId(r.id)}
                              className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-red-500/10 hover:text-[#DC2626] text-[#8B7B68] transition-colors"
                              title="Revoke Access"
                            >
                              <ShieldOff className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[13px] text-[#8B7B68] italic">Inactive</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-[#E9DFCF] text-[13px] text-[#8B7B68]">
              Showing {filteredRecords.length} of {records.length} total records. Entitlements sourced from
              <code className="font-mono mx-1">/api/publications/user-access/</code> (staff-only view).
            </div>
          </div>
        )}
      </div>

      {/* ── Revoke Confirmation ── */}
      <AnimatePresence>
        {revokingId !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !revokeLoading && setRevokingId(null)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white border border-[#E9DFCF] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <ShieldOff className="w-5 h-5 text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#5C4B3A] font-playfair">Revoke Access?</h3>
                    <p className="text-xs text-[#8B7B68] mt-0.5">
                      The user will immediately lose PDF download access. No refund is issued.
                    </p>
                  </div>
                </div>
                {revokeError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[#DC2626] text-xs">
                    {revokeError}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={revokeLoading}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {revokeLoading ? 'Revoking…' : 'Yes, Revoke Access'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRevokingId(null); setRevokeError(null); }}
                    disabled={revokeLoading}
                    className="flex-1 py-2 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-[#8B7B68] text-xs font-semibold hover:text-[#5C4B3A] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Grant Access Drawer ── */}
      <AnimatePresence>
        {isGrantOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGrantOpen(false)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-lg bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[13px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                    Manual Access Grant
                  </span>
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    Grant Journal Access
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGrantOpen(false)}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleGrantSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* Security notice */}
                <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 text-[13px] text-[#8B7B68]">
                  <strong className="text-[#5C4B3A] block mb-1">Backend Permission Check</strong>
                  This action calls <code className="font-mono">POST /api/publications/user-access/</code>.
                  The Django <code className="font-mono">perform_create</code> enforces{' '}
                  <code className="font-mono">is_staff</code> server-side — a non-staff token will receive 403.
                </div>

                {grantError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[#DC2626] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{grantError}</span>
                  </div>
                )}
                {grantSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{grantSuccess}</span>
                  </div>
                )}

                {/* User ID */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">
                    User ID *
                    <span className="text-[13px] font-normal ml-1">(numeric ID from Users admin)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 42"
                      value={grantForm.userId}
                      onChange={(e) => setGrantForm({ ...grantForm, userId: e.target.value })}
                      className="flex-1 bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                    {grantForm.userId && userDirectory[parseInt(grantForm.userId, 10)] && (
                      <div className="flex items-center px-3 bg-[#FFF8EE] border border-[#E9DFCF] rounded-xl text-[13px] text-emerald-400 font-semibold shrink-0">
                        <UserCheck className="w-3 h-3 mr-1" />
                        {userDirectory[parseInt(grantForm.userId, 10)].label}
                        {userDirectory[parseInt(grantForm.userId, 10)].publicId && (
                          <span className="ml-1.5 font-mono text-[#8B7B68]">
                            {userDirectory[parseInt(grantForm.userId, 10)].publicId}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Journal */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Journal *</label>
                  <select
                    required
                    value={grantForm.journal}
                    onChange={(e) => setGrantForm({ ...grantForm, journal: e.target.value, issue: '' })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                  >
                    <option value="">Select journal…</option>
                    {journals.map((j) => <option key={j.id} value={String(j.id)}>{j.title}</option>)}
                  </select>
                </div>

                {/* Access Type */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Access Type *</label>
                  <select
                    value={grantForm.access_type}
                    onChange={(e) => setGrantForm({ ...grantForm, access_type: e.target.value as any, issue: '' })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                  >
                    <option value="manual_grant">Manual Grant (admin-assigned)</option>
                    <option value="subscription">Annual Subscription</option>
                    <option value="issue">Single Issue Access</option>
                  </select>
                </div>

                {/* Issue (only if access_type = 'issue') */}
                {grantForm.access_type === 'issue' && (
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Issue *</label>
                    <select
                      required
                      value={grantForm.issue}
                      onChange={(e) => setGrantForm({ ...grantForm, issue: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      <option value="">Select issue…</option>
                      {grantIssueOptions.map((i) => <option key={i.id} value={String(i.id)}>{i.title}</option>)}
                    </select>
                  </div>
                )}

                {/* Start Date + End Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={grantForm.start_date}
                      onChange={(e) => setGrantForm({ ...grantForm, start_date: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">
                      End Date <span className="text-[13px] font-normal">(blank = lifetime)</span>
                    </label>
                    <input
                      type="date"
                      value={grantForm.end_date}
                      onChange={(e) => setGrantForm({ ...grantForm, end_date: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                {/* Submit */}
                <div className="pt-2 flex items-center gap-3">
                  <Button type="submit" variant="primary" isLoading={grantSubmitting} className="flex-1">
                    Grant Access
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsGrantOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-[#8B7B68] text-xs font-semibold hover:text-[#5C4B3A] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
