'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Crown,
  Eye,
  Pencil,
  Ban,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  Send,
  XCircle,
  Power,
  Users,
  UserRound,
  UserPlus as UserPlusIcon,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/lib/context/AuthContext';
import { displayId, searchableRefs } from '@/lib/utils/publicId';
import { digitsOnly, validateOptionalIndianMobile } from '@/lib/validation';
import {
  AdminUser,
  AdminInvitation,
  AdminRole,
  AccessLevel,
  ADMIN_SECTIONS,
  ADMIN_ROLES,
  CreateInvitationPayload,
  fetchAdminUsers,
  updateAdminUser,
  fetchAdminInvitations,
  createAdminInvitation,
  resendAdminInvitation,
} from '@/lib/services/cms';

type FetchState = 'loading' | 'success' | 'error';

const INVITATION_BADGE: Record<string, { label: string; color: string }> = {
  sent: { label: 'Invitation Sent', color: '#B45309' },
  delivery_failed: { label: 'Email Delivery Failed', color: '#DC2626' },
  expired: { label: 'Invitation Expired', color: '#DC2626' },
  accepted: { label: 'Active', color: '#16a34a' },
  revoked: { label: 'Invitation Revoked', color: '#8B7B68' },
};

// Truthful display state derived from the ACTUAL backend invitation row —
// a pending invitation whose email never went out must not read "Sent".
const inviteDisplayState = (inv: AdminInvitation): string => {
  if (inv.status === 'pending') return inv.sent_at ? 'sent' : 'delivery_failed';
  return inv.status;
};

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
};

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  action: () => Promise<void>;
}

export default function AdminAccessPage() {
  const { user: currentUser, tokens } = useAuth();
  const isSuper = Boolean((currentUser as any)?.is_superuser);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invitations, setInvitations] = useState<AdminInvitation[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'accounts' | 'matrix'>('accounts');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    try {
      const [userList, inviteList] = await Promise.all([
        fetchAdminUsers(tokens.access),
        fetchAdminInvitations(tokens.access).catch(() => [] as AdminInvitation[]),
      ]);
      setUsers(userList);
      setInvitations(inviteList);
      setFetchState('success');
    } catch {
      setUsers([]);
      setInvitations([]);
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Latest invitation per user id (list is ordered newest-first by backend).
  const latestInviteByUser = useMemo(() => {
    const map = new Map<number, AdminInvitation>();
    for (const inv of invitations) {
      if (!map.has(inv.user)) map.set(inv.user, inv);
    }
    return map;
  }, [invitations]);

  // Stored grants with unset = full staff access (legacy default).
  const effectiveLevel = (u: AdminUser, key: string): AccessLevel =>
    u.admin_permissions?.[key] || 'edit';

  const persistRow = async (u: AdminUser, next: Partial<AdminUser>, successMsg?: string) => {
    const prev = u;
    setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...next } : x)));
    setSavingId(u.id);
    try {
      const updated = await updateAdminUser(tokens!.access, u.id, next);
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, ...updated } : x)));
      showToast(true, successMsg || `${updated.email}: access saved.`);
      return updated;
    } catch (err: unknown) {
      setUsers((list) => list.map((x) => (x.id === u.id ? prev : x)));
      showToast(false, err instanceof Error ? err.message : 'Failed to save access.');
      return null;
    } finally {
      setSavingId(null);
    }
  };

  const changeLevel = (u: AdminUser, sectionKey: string, level: AccessLevel) => {
    if (u.is_superuser || !u.is_staff || savingId !== null) return;
    if (effectiveLevel(u, sectionKey) === level) return;
    // Send the complete map so every section's level stays explicit.
    const fullMap: Record<string, AccessLevel> = {};
    for (const s of ADMIN_SECTIONS) {
      fullMap[s.key] = s.key === sectionKey ? level : effectiveLevel(u, s.key);
    }
    persistRow(u, { admin_permissions: fullMap });
  };

  const togglePortal = (u: AdminUser) => {
    if (u.is_superuser || savingId !== null) return;
    persistRow(u, { is_staff: !u.is_staff });
  };

  // Reassign an admin's role label. Real section permissions stay managed by
  // the matrix cells (the role is only an informational grouping + seed).
  const changeRole = (u: AdminUser, role: string) => {
    if (u.is_superuser || !u.is_staff || savingId !== null) return;
    if ((u.admin_role || '') === role) return;
    persistRow(u, { admin_role: role }, `${u.email}: role updated.`);
  };

  // ── Account actions (confirmation-gated where risky). Resend is surfaced
  // for every not-yet-activated invitation so a fresh link can reach the
  // staff member until they accept; revoke stays API-only. ──

  const handleResendInvite = async (inv: AdminInvitation) => {
    if (!tokens?.access || resendingId !== null) return;
    setResendingId(inv.id);
    try {
      const result = await resendAdminInvitation(tokens.access, inv.id);
      // The toast already carries the backend's honest delivery caveat, so no
      // separate banner is needed.
      showToast(true, result.message || `A fresh activation link was sent to ${inv.personal_email || inv.email}.`);
      await loadData();
    } catch (err: unknown) {
      showToast(false, err instanceof Error ? err.message : 'Resend failed.');
    } finally {
      setResendingId(null);
    }
  };

  const runAction = async (fn: () => Promise<void>) => {
    setConfirmBusy(true);
    try {
      await fn();
    } finally {
      setConfirmBusy(false);
      setConfirm(null);
    }
  };

  const handleToggleActive = (u: AdminUser) => {
    const deactivating = Boolean(u.is_active);
    setConfirm({
      title: deactivating ? 'Deactivate Admin' : 'Reactivate Admin',
      message: deactivating
        ? `${u.email} will be signed out and blocked from every admin endpoint immediately. Their history and audit records are kept.`
        : `${u.email} will be able to sign in again with their existing password.`,
      confirmLabel: deactivating ? 'Deactivate' : 'Reactivate',
      action: async () => {
        const updated = await persistRow(u, { is_active: !deactivating }, deactivating ? 'Admin deactivated.' : 'Admin reactivated.');
        if (updated) loadData();
      },
    });
  };

  // Super Admins first, then staff, then readers; search filters the list.
  // Admins only: staff, superusers, or anyone with an invitation record
  // (pending/expired invitees aren't staff yet). Normal reader accounts are
  // excluded from this page entirely.
  const visibleUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users
      .filter((u) => u.is_staff || u.is_superuser || latestInviteByUser.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        // Editors paste the printed MMSR reference when chasing an account.
        const refs = searchableRefs(u.public_id, u.admin_public_id);
        return name.includes(q) || (u.email || '').toLowerCase().includes(q) || refs.includes(q);
      })
      .sort(
        (a, b) =>
          Number(Boolean(b.is_superuser)) - Number(Boolean(a.is_superuser)) ||
          Number(Boolean(b.is_staff)) - Number(Boolean(a.is_staff)) ||
          (a.email || '').localeCompare(b.email || ''),
      );
  }, [users, search, latestInviteByUser]);

  const staffCount = users.filter((u) => (u.is_staff || u.is_superuser) && u.is_active).length;
  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  // Only Super Admins may hand out CMS access (server enforces this too).
  if (!isSuper) {
    return (
      <AdminLayout title="Admin Access" subtitle="Grant or restrict CMS section permissions.">
        <div className="rounded-2xl bg-white border border-[#E9DFCF] p-10 text-center space-y-3 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
            <Ban className="w-7 h-7" style={{ color: '#dc2626' }} />
          </div>
          <h2 className="text-base font-bold font-playfair text-[#3E2E22]">Super Admins Only</h2>
          <p className="text-xs text-[#8B7B68]">
            Only Super Admins can manage admin access. If you need changes here, ask a Super Admin to adjust your permissions.
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Admin Access Control"
      subtitle="Invite new admins and manage every account's CMS permissions. Changes save instantly."
    >
      {/* ── Summary bar ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total Accounts', value: users.length, icon: ShieldCheck, color: '#C9A66B' },
          { label: 'Active Admins', value: staffCount, icon: Eye, color: '#2563eb' },
          { label: 'Pending Invitations', value: pendingCount, icon: Send, color: '#B45309' },
          { label: 'Sections Managed', value: ADMIN_SECTIONS.length, icon: Pencil, color: '#16a34a' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-4 rounded-2xl bg-white border border-[#E9DFCF] flex items-center gap-3">
              <div className="p-2.5 rounded-xl shrink-0" style={{ background: 'rgba(201,166,107,0.08)', border: '1px solid #E9DFCF' }}>
                <Icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold font-playfair text-[#3E2E22] leading-none">{s.value}</p>
                <p className="text-[13px] text-[#8B7B68] mt-1 truncate" title={s.label}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── View switch: Accounts & Invitations / Access Matrix ─────── */}
      <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-[#E9DFCF] bg-[#FFF8EE]">
          <button
            type="button"
            onClick={() => setView('accounts')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-[13px] font-bold transition-colors ${
              view === 'accounts' ? 'bg-white text-[#A98042] border border-[#E9DFCF] border-b-white -mb-px' : 'text-[#8B7B68] hover:text-[#5C4B3A]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Accounts &amp; Invitations
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[12px] font-bold" style={{ background: '#FEF3C7', color: '#B45309' }}>
                {pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setView('matrix')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-[13px] font-bold transition-colors ${
              view === 'matrix' ? 'bg-white text-[#A98042] border border-[#E9DFCF] border-b-white -mb-px' : 'text-[#8B7B68] hover:text-[#5C4B3A]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Access Matrix
          </button>
        </div>

        {view === 'accounts' ? (
          <AccountsPanel
            users={visibleUsers}
            latestInviteByUser={latestInviteByUser}
            search={search}
            setSearch={setSearch}
            refresh={() => { void loadData(); }}
            loading={fetchState === 'loading'}
            currentUserId={(currentUser as any)?.id}
            onAddAdmin={() => setShowAddForm(true)}
            onToggleActive={handleToggleActive}
            onResend={handleResendInvite}
            resendingId={resendingId}
          />
        ) : (
          <AccessMatrix
            users={visibleUsers}
            search={search}
            setSearch={setSearch}
            refresh={() => { void loadData(); }}
            fetchState={fetchState}
            savingId={savingId}
            effectiveLevel={effectiveLevel}
            onTogglePortal={togglePortal}
            onChangeLevel={changeLevel}
            onChangeRole={changeRole}
          />
        )}
      </div>

      {/* ── Honest email-transport notice removed by request: the toast from
          the API already carries any delivery caveat. ─────────────────── */}

      {/* ── Add Admin modal ─────────────────────────────────────────── */}
      {showAddForm && (
        <AddAdminModal
          allUsers={users}
          invitations={invitations}
          onClose={() => setShowAddForm(false)}
          onCreated={(message, realEmailConfigured) => {
            setShowAddForm(false);
            // message already includes the backend's delivery caveat when
            // SMTP is not live — no separate banner.
            showToast(true, message);
            loadData();
          }}
          onError={(msg) => showToast(false, msg)}
        />
      )}

      {/* ── Confirm dialog ──────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        isBusy={confirmBusy}
        onConfirm={() => confirm && runAction(confirm.action)}
        onCancel={() => setConfirm(null)}
      />

      {/* ── Toast ───────────────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg max-w-md ${
            toast.ok ? 'bg-emerald-50 text-[#16a34a] border border-emerald-200' : 'bg-red-50 text-[#DC2626] border border-red-200'
          }`}
        >
          {toast.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{toast.msg}</span>
        </div>
      )}
    </AdminLayout>
  );
}

// ─── Accounts & invitations table ────────────────────────────────────────────

interface AccountsPanelProps {
  users: AdminUser[];
  latestInviteByUser: Map<number, AdminInvitation>;
  search: string;
  setSearch: (v: string) => void;
  refresh: () => void;
  loading: boolean;
  currentUserId?: number;
  onAddAdmin: () => void;
  onToggleActive: (u: AdminUser) => void;
  onResend: (inv: AdminInvitation) => void;
  resendingId: number | null;
}

const AccountsPanel: React.FC<AccountsPanelProps> = ({
  users,
  latestInviteByUser,
  search,
  setSearch,
  refresh,
  loading,
  currentUserId,
  onAddAdmin,
  onToggleActive,
  onResend,
  resendingId,
}) => {
  return (
    <>
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E9DFCF] bg-[#FFF8EE] flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold font-playfair text-[#3E2E22]">Admin Accounts &amp; Invitations</h2>
          <p className="text-[13px] text-[#8B7B68] mt-0.5">Staff, their work emails, and where each invitation stands.</p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <Button type="button" size="sm" variant="gold" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={onAddAdmin}>
            Add Admin
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-[#F3EDE1] flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8B7B68] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search accounts, email or MMSR ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E9DFCF] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
          />
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-white border border-[#E9DFCF] text-[13px] font-semibold text-[#8B7B68] hover:text-[#5C4B3A] flex items-center gap-1.5 shrink-0 ml-auto"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {users.length === 0 ? (
        <div className="py-14 text-center text-xs text-[#8B7B68]">
          {loading ? 'Loading accounts...' : 'No accounts match your search.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[820px]">
            <thead>
              <tr className="border-b border-[#E9DFCF] bg-white text-[#8B7B68] uppercase tracking-wider text-[12px]">
                <th className="py-2.5 px-4 font-bold">Name</th>
                <th className="py-2.5 px-3 font-bold">Personal Email</th>
                <th className="py-2.5 px-3 font-bold">Reference</th>
                <th className="py-2.5 px-3 font-bold">Work Email</th>
                <th className="py-2.5 px-3 font-bold">Role</th>
                <th className="py-2.5 px-3 font-bold">Department</th>
                <th className="py-2.5 px-3 font-bold">Status</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap">Invited / Activated</th>
                <th className="py-2.5 px-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EDE1]">
              {users.map((u) => {
                const inv = latestInviteByUser.get(u.id);
                const stateKey = inv ? inviteDisplayState(inv) : null;
                const badge = stateKey ? INVITATION_BADGE[stateKey] : null;
                const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                const roleLabel = u.is_superuser ? 'Super Admin' : ADMIN_ROLES.find((r) => r.value === u.admin_role)?.label || (u.is_staff ? 'Editorial Staff' : 'Reader');
                const accountActive = u.is_active !== false;
                const isSelf = currentUserId === u.id;
                // Status always mirrors the real backend state: staff rows
                // report the account, not-invited-yet rows the invitation.
                const isStaffRow = Boolean(u.is_staff || u.is_superuser);
                return (
                  <tr key={u.id} className="hover:bg-[#FFF8EE] transition-colors align-middle">
                    <td className="py-2.5 px-4 font-bold text-[#5C4B3A] truncate max-w-[160px]">
                      {name}
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-[#8B7B68] truncate max-w-[160px]" title="Personal email — existing account">
                      {inv?.personal_email || u.email}
                    </td>
                    {/* Editorial rows lead with the staff reference (MMSR-ADM);
                        invitees who are not staff yet show their account
                        reference (MMSR-USR). The internal key stays hidden. */}
                    <td className="py-2.5 px-3 text-[12px] font-mono text-[#8B7B68] truncate max-w-[160px]">
                      {(u.is_staff || u.is_superuser)
                        ? displayId({ public_id: u.admin_public_id })
                        : displayId(u)}
                    </td>
                    <td className="py-2.5 px-3 text-[#8B7B68] max-w-[180px] truncate" title="Work email — admin login">
                      {u.work_email || inv?.email || '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold whitespace-nowrap"
                        style={
                          u.is_superuser
                            ? { background: '#FEF3C7', border: '1px solid #FCD34D', color: '#B45309' }
                            : u.is_staff
                              ? { background: '#FFF2D9', border: '1px solid #E9DFCF', color: '#A98042' }
                              : { background: '#F7F3EB', border: '1px solid #E9DFCF', color: '#8B7B68' }
                        }
                      >
                        {roleLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#8B7B68] max-w-[120px] truncate">{u.department || inv?.department || '—'}</td>
                    <td className="py-2.5 px-3">
                      {isStaffRow ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold whitespace-nowrap"
                          style={{
                            color: accountActive ? '#16a34a' : '#DC2626',
                            background: accountActive ? 'rgba(22,163,74,0.08)' : 'rgba(220,38,38,0.06)',
                            border: `1px solid ${accountActive ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.25)'}`,
                          }}
                        >
                          {accountActive ? 'Active' : 'Inactive'}
                        </span>
                      ) : badge ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold whitespace-nowrap"
                          style={{
                            color: badge.color,
                            background: `${badge.color}14`,
                            border: `1px solid ${badge.color}4D`,
                          }}
                          title={
                            stateKey === 'sent' && inv
                              ? `Link expires ${new Date(inv.expires_at).toLocaleString('en-IN')}`
                              : stateKey === 'delivery_failed'
                                ? 'The invitation email could not be delivered — fix email settings and send again from Add Admin.'
                                : undefined
                          }
                        >
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-[13px] text-[#8B7B68]/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[13px] text-[#8B7B68] whitespace-nowrap">
                      {inv ? `Invited ${fmtDate(inv.sent_at || inv.created_at)}` : '—'}
                      <span className="block">{inv?.accepted_at ? `Activated ${fmtDate(inv.accepted_at)}` : 'Activated —'}</span>
                      {/* Invitation reference (MMSR-AIN) so a support thread can
                          quote the exact invite; the internal key stays hidden. */}
                      {inv && (
                        <span className="block font-mono text-[12px] text-[#8B7B68]">{displayId(inv)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Deactivate / reactivate real staff accounts (never self, never super) */}
                        {!u.is_superuser && u.is_staff && !isSelf && (
                          <button
                            type="button"
                            onClick={() => onToggleActive(u)}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors"
                            style={
                              accountActive
                                ? { background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }
                                : { background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.3)', color: '#16a34a' }
                            }
                            title={accountActive ? 'Deactivate — blocks sign-in immediately' : 'Reactivate this account'}
                          >
                            <Power className="w-3 h-3" /> {accountActive ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                        {/* Resend — stays until the invitee activates the account */}
                        {inv && inv.status === 'pending' && (
                          <button
                            type="button"
                            disabled={resendingId === inv.id}
                            onClick={() => onResend(inv)}
                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors disabled:opacity-60"
                            style={{ background: 'rgba(201,166,107,0.10)', border: '1px solid rgba(201,166,107,0.45)', color: '#A98042' }}
                            title={`Send a fresh activation link to ${inv.personal_email || inv.email}`}
                          >
                            <Send className="w-3 h-3" /> {resendingId === inv.id ? 'Sending…' : 'Resend'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// ─── Access matrix: accounts × CMS sections ─────────────────────────────────

const LEVEL_ORDER: AccessLevel[] = ['none', 'read', 'edit'];
const LEVEL_META: Record<AccessLevel, { short: string; label: string; icon: React.ElementType; color: string }> = {
  none: { short: 'None', label: 'No Access', icon: Ban, color: '#dc2626' },
  read: { short: 'Read', label: 'Read Only', icon: Eye, color: '#2563eb' },
  edit: { short: 'Edit', label: 'Full Edit', icon: Pencil, color: '#16a34a' },
};

interface AccessMatrixProps {
  users: AdminUser[];
  search: string;
  setSearch: (v: string) => void;
  refresh: () => void;
  fetchState: FetchState;
  savingId: number | null;
  effectiveLevel: (u: AdminUser, key: string) => AccessLevel;
  onTogglePortal: (u: AdminUser) => void;
  onChangeLevel: (u: AdminUser, sectionKey: string, level: AccessLevel) => void;
  onChangeRole: (u: AdminUser, role: string) => void;
}

const AccessMatrix: React.FC<AccessMatrixProps> = ({
  users,
  search,
  setSearch,
  refresh,
  fetchState,
  savingId,
  effectiveLevel,
  onTogglePortal,
  onChangeLevel,
  onChangeRole,
}) => {
  const nextLevel = (cur: AccessLevel): AccessLevel =>
    LEVEL_ORDER[(LEVEL_ORDER.indexOf(cur) + 1) % LEVEL_ORDER.length];

  return (
    <>
      {/* Header + legend */}
      <div className="px-5 py-4 border-b border-[#E9DFCF] bg-[#FFF8EE] flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold font-playfair text-[#3E2E22]">Section Access Matrix</h2>
        </div>
        <div className="flex items-center gap-1.5 lg:ml-auto shrink-0">
          {LEVEL_ORDER.map((lv) => {
            const m = LEVEL_META[lv];
            const Icon = m.icon;
            return (
              <span
                key={lv}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[13px] font-bold"
                style={{ background: `${m.color}14`, border: `1px solid ${m.color}4D`, color: m.color }}
              >
                <Icon className="w-3 h-3" />
                {m.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-5 py-3 border-b border-[#F3EDE1] flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-[#8B7B68] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search accounts, email or MMSR ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#E9DFCF] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
          />
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg bg-white border border-[#E9DFCF] text-[13px] font-semibold text-[#8B7B68] hover:text-[#5C4B3A] flex items-center gap-1.5 shrink-0 ml-auto"
        >
          <RefreshCw className={`w-3 h-3 ${fetchState === 'loading' ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {fetchState === 'loading' ? (
        <div className="py-14 text-center">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-[#C9A66B] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#8B7B68]">Loading accounts...</p>
          </div>
        </div>
      ) : fetchState === 'error' ? (
        <div className="py-14 text-center space-y-2">
          <AlertCircle className="w-6 h-6 mx-auto" style={{ color: '#dc2626' }} />
          <p className="text-xs text-[#8B7B68]">Could not load accounts.</p>
          <button type="button" onClick={refresh} className="text-[13px] font-bold" style={{ color: '#C9A66B' }}>
            Try again
          </button>
        </div>
      ) : users.length === 0 ? (
        <div className="py-14 text-center text-xs text-[#8B7B68]">No accounts match your search.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E9DFCF] bg-white text-[#8B7B68] uppercase tracking-wider text-[12px]">
                <th className="py-2.5 px-4 font-bold sticky left-0 bg-white z-10 min-w-[150px]">Name</th>
                <th className="py-2.5 px-3 font-bold min-w-[160px]">Email</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap min-w-[130px]">Reference</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap min-w-[150px]">Role</th>
                <th className="py-2.5 px-3 font-bold whitespace-nowrap">CMS Portal</th>
                {ADMIN_SECTIONS.map((s) => (
                  <th key={s.key} className="py-2.5 px-1.5 font-bold text-center whitespace-nowrap align-bottom" title={`Covers: ${s.pages}`}>
                    <span className="block leading-tight">{s.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EDE1]">
              {users.map((u) => {
                const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                const rowBusy = savingId === u.id;
                const roleLabel = u.is_superuser
                  ? 'Super Admin'
                  : ADMIN_ROLES.find((r) => r.value === u.admin_role)?.label || (u.is_staff ? 'Editorial Staff' : 'Reader');
                return (
                  <tr key={u.id} className={`hover:bg-[#FFF8EE] transition-opacity align-middle ${rowBusy ? 'opacity-60' : ''}`}>
                    {/* Sticky account column split into Name | Email | Reference */}
                    <td className="py-2.5 px-4 sticky left-0 bg-white z-10">
                      <span className="text-[13px] font-bold text-[#5C4B3A] block truncate max-w-[150px] leading-tight">
                        {name}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-[#8B7B68] truncate max-w-[160px]">{u.email}</td>
                    <td className="py-2.5 px-3 text-[12px] font-mono text-[#8B7B68] truncate max-w-[130px]">
                      {(u.is_staff || u.is_superuser)
                        ? displayId({ public_id: u.admin_public_id })
                        : displayId(u)}
                    </td>

                    {/* Role column */}
                    <td className="py-2.5 px-3">
                      {u.is_superuser ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold whitespace-nowrap"
                          style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#B45309' }}
                        >
                          {roleLabel}
                        </span>
                      ) : !u.is_staff ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-bold whitespace-nowrap"
                          style={{ background: '#F7F3EB', border: '1px solid #E9DFCF', color: '#8B7B68' }}
                          title="Invitee activates to become staff, then the role can be set"
                        >
                          {roleLabel}
                        </span>
                      ) : (
                        <select
                          value={u.admin_role || 'editorial_admin'}
                          disabled={rowBusy}
                          onChange={(e) => onChangeRole(u, e.target.value)}
                          className="font-bold cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C9A66B]"
                          style={{
                            backgroundColor: '#FFF2D9',
                            border: '1px solid #E9DFCF',
                            color: '#A98042',
                            fontSize: '10px',
                            fontWeight: 700,
                            lineHeight: '1.2',
                            height: '22px',
                            minHeight: '22px',
                            padding: '2px 18px 2px 6px',
                            borderRadius: '6px',
                            minWidth: '96px',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            backgroundImage:
                              'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2710%27 height=%2710%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%23A98042%27 stroke-width=%272.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27%3E%3C/polyline%3E%3C/svg%3E")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 4px center',
                            backgroundSize: '10px 10px',
                          }}
                          title="Change this admin's role"
                        >
                          {ADMIN_ROLES.filter((r) => r.value !== 'super_admin').map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                    </td>

                    {/* Portal toggle column */}
                    <td className="py-2.5 px-3">
                      {u.is_superuser ? (
                        <span className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: '#B45309' }}>
                          <Crown className="w-3 h-3" /> Always On
                        </span>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(u.is_staff)}
                          disabled={rowBusy}
                          onClick={() => onTogglePortal(u)}
                          className="relative w-9 h-5 rounded-full transition-colors disabled:opacity-50"
                          style={{ background: u.is_staff ? '#C9A66B' : '#E9DFCF' }}
                          title={u.is_staff ? 'CMS portal access ON — click to turn off' : 'CMS portal access OFF — click to grant'}
                        >
                          <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: u.is_staff ? 18 : 2 }} />
                        </button>
                      )}
                    </td>

                    {/* One cell per section */}
                    {ADMIN_SECTIONS.map((s) => {
                      const level: AccessLevel = u.is_superuser ? 'edit' : effectiveLevel(u, s.key);
                      const m = LEVEL_META[level];
                      const Icon = m.icon;
                      const chipCls =
                        'inline-flex items-center justify-center gap-1 w-[58px] py-1 rounded-md text-[12px] font-bold';

                      if (u.is_superuser) {
                        return (
                          <td key={s.key} className="py-2.5 px-1.5 text-center">
                            <span
                              className={chipCls}
                              style={{ background: 'rgba(201,166,107,0.12)', border: '1px solid #E9DFCF', color: '#A98042' }}
                              title="Super Admins always have full access"
                            >
                              <Crown className="w-3 h-3" /> Full
                            </span>
                          </td>
                        );
                      }

                      if (!u.is_staff) {
                        return (
                          <td key={s.key} className="py-2.5 px-1.5 text-center">
                            <span
                              className={chipCls}
                              style={{ background: '#F7F3EB', border: '1px solid #E9DFCF', color: '#B0A291' }}
                              title="Enable CMS portal access first to set section levels"
                            >
                              —
                            </span>
                          </td>
                        );
                      }

                      return (
                        <td key={s.key} className="py-2.5 px-1.5 text-center">
                          <button
                            type="button"
                            disabled={rowBusy}
                            onClick={() => onChangeLevel(u, s.key, nextLevel(level))}
                            className={`${chipCls} transition-all cursor-pointer`}
                            style={{ background: `${m.color}14`, border: `1px solid ${m.color}4D`, color: m.color }}
                            title={`${m.label} — click for ${LEVEL_META[nextLevel(level)].label}`}
                          >
                            <Icon className="w-3 h-3" />
                            {m.short}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// ─── Add Admin invitation form ───────────────────────────────────────────────

interface AddAdminModalProps {
  allUsers: AdminUser[];
  invitations: AdminInvitation[];
  onClose: () => void;
  onCreated: (message: string, realEmailConfigured?: boolean) => void;
  onError: (msg: string) => void;
}

type WizardMode = 'existing' | 'new';

// Every CMS section starts locked at None — nothing is preset, and the
// Super Admin must opt each section into Read/Edit deliberately.
const ALL_NONE: Record<string, AccessLevel> = Object.fromEntries(
  ADMIN_SECTIONS.map((s) => [s.key, 'none'] as [string, AccessLevel]),
);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Two-letter monogram for the user-picker avatars.
const userInitials = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean);
  const ini = parts.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return ini || '?';
};

const AddAdminModal: React.FC<AddAdminModalProps> = ({
  allUsers: users,
  invitations,
  onClose,
  onCreated,
  onError,
}) => {
  const { tokens } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<WizardMode>('existing');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickQuery, setPickQuery] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    personal_email: '',
    email: '',
    role: 'editorial_admin',
    department: '',
    phone: '',
    notes: '',
  });
  const [permissions, setPermissions] = useState<Record<string, AccessLevel>>({ ...ALL_NONE });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [emailWarning, setEmailWarning] = useState('');

  const set = (key: keyof typeof form, value: string) => {
    setForm((f: typeof form) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
    setEmailWarning('');
  };

  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) || null,
    [users, selectedId],
  );

  // Real registered users (from the accounts API), excluding admins and
  // anyone with a LIVE pending invitation — duplicate invites are blocked.
  const pendingUserIds = useMemo(
    () =>
      new Set(
        invitations
          .filter((i) => i.status === 'pending' && new Date(i.expires_at) > new Date())
          .map((i) => i.user),
      ),
    [invitations],
  );
  const eligible = useMemo(() => {
    const q = pickQuery.toLowerCase().trim();
    return users
      .filter((u) => !u.is_staff && !u.is_superuser && !pendingUserIds.has(u.id))
      .filter((u) => {
        if (!q) return true;
        const name = `${u.first_name || ''} ${u.last_name || ''}`.trim().toLowerCase();
        return name.includes(q) || (u.email || '').toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q);
      });
  }, [users, pickQuery, pendingUserIds]);

  const chooseExisting = (id: number | null) => {
    setSelectedId(id);
    setErrors((e) => ({ ...e, user: '', email: '' }));
    const u = users.find((x) => x.id === id);
    if (u) {
      // Auto-fill from the real account; the personal email is never touched.
      setForm((f) => ({
        ...f,
        full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
        department: u.department || '',
        phone: u.phone_number || '',
      }));
    }
  };

  const switchMode = (next: WizardMode) => {
    setMode(next);
    setErrors({});
    setEmailWarning('');
    if (next === 'new') setSelectedId(null);
  };

  const setLevel = (key: string, level: AccessLevel) => setPermissions((p) => ({ ...p, [key]: level }));

  // Work email must be unique across every login identifier in the system:
  // no existing account's personal or work email, and no live invitation.
  const workEmailConflict = (raw: string, exceptId?: number | null): string => {
    const value = raw.trim().toLowerCase();
    if (!value) return 'Enter the staff work email — it receives the invitation and becomes the admin login.';
    if (!EMAIL_RE.test(value)) return 'Enter a valid email address.';
    const clash = users.find(
      (u) => u.id !== exceptId && (u.email || '').toLowerCase() === value || (u.work_email || '').toLowerCase() === value,
    );
    if (clash) return 'That work email already belongs to another account. Use a different address.';
    const inviteClash = invitations.find(
      (i) =>
        i.status === 'pending' &&
        new Date(i.expires_at) > new Date() &&
        i.user !== exceptId &&
        i.email.toLowerCase() === value,
    );
    if (inviteClash) return 'A pending invitation already uses that work email.';
    return '';
  };

  const validateStep1 = () => {
    const next: Record<string, string> = {};
    if (mode === 'existing') {
      if (!selectedId) next.user = 'Choose an existing user, or switch to Add new staff.';
      next.email = workEmailConflict(form.email, selectedId);
    } else {
      if (form.full_name.trim().length < 2) next.full_name = 'Enter the staff member\'s full name.';
      if (form.personal_email.trim() && !EMAIL_RE.test(form.personal_email.trim())) {
        next.personal_email = 'Enter a valid personal email, or leave blank.';
      }
      next.email = workEmailConflict(form.email, null);
    }
    // Same strict Indian 10-digit rule the backend serializer enforces on
    // AdminInvitationCreateSerializer.validate_phone.
    if (form.phone) {
      const phoneError = validateOptionalIndianMobile(form.phone);
      if (phoneError) next.phone = phoneError;
    }
    if (next.email === '') delete next.email;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goStep2 = () => {
    if (validateStep1()) setStep(2);
  };

  const buildPayload = (): CreateInvitationPayload => {
    const email = form.email.trim();
    const base = {
      full_name: form.full_name.trim() || (selected ? `${selected.first_name || ''} ${selected.last_name || ''}`.trim() || selected.email : ''),
      email,
      role: form.role as AdminRole,
      department: form.department || '',
      phone: form.phone || '',
      notes: form.notes.trim(),
      // All 13 keys are always sent — an absent section can never imply Edit.
      permissions: { ...permissions },
    };
    return mode === 'existing' && selected
      ? { ...base, user_id: selected.id }
      : { ...base, personal_email: form.personal_email.trim() } as CreateInvitationPayload;
  };

  const send = async () => {
    if (!tokens?.access || submitting) return;
    setSubmitting(true);
    setEmailWarning('');
    try {
      const res = await createAdminInvitation(tokens.access, buildPayload());
      onCreated(res.message, res.real_email_configured);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invitation failed.';
      if (msg.includes('could NOT be delivered')) {
        // The invitation row exists but never reached an inbox — stay in the
        // modal so Send can be pressed again (the server rotates the token on
        // the same row, so this can never create a duplicate).
        setEmailWarning(msg);
      } else {
        onError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full bg-white border rounded-lg px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]';

  const selectedName = selected
    ? `${selected.first_name || ''} ${selected.last_name || ''}`.trim() || selected.email
    : '';

  return (
    <Modal
      isOpen
      onClose={submitting ? () => undefined : onClose}
      title="Add Admin"
      subtitle={
        step === 1
          ? 'Choose an existing user or register new staff, then enter their work email.'
          : 'Assign section permissions before sending. Every section starts at No Access.'
      }
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <span className="text-[12px] font-bold uppercase tracking-wider text-[#8B7B68]">Step {step} of 2</span>
          <div className="flex items-center gap-3">
            {step === 1 ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="button" variant="gold" size="sm" onClick={goStep2} leftIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Continue
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setStep(1)} disabled={submitting} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                  Back
                </Button>
                <Button type="button" variant="gold" size="sm" isLoading={submitting} disabled={submitting} onClick={send} leftIcon={<Send className="w-3.5 h-3.5" />}>
                  Send Invitation
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3.5 font-manrope">
        {/* Step indicator pills */}
        <div className="flex items-center gap-2" aria-hidden="true">
          {[1, 2].map((n) => (
            <React.Fragment key={n}>
              {n === 2 && <ArrowRight className="w-3 h-3 text-[#8B7B68]/60" />}
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold"
                style={
                  step === n
                    ? { background: 'rgba(201,166,107,0.16)', border: '1.5px solid #C9A66B', color: '#A98042' }
                    : { background: '#F7F3EB', border: '1px solid #E9DFCF', color: '#8B7B68' }
                }
              >
                {n === 1 ? <UserRound className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                {n === 1 ? 'Staff Details' : 'Permissions & Send'}
              </span>
            </React.Fragment>
          ))}
        </div>

        {step === 1 ? (
          <>
            {/* Mode choice */}
            <div>
              <p className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] mb-1.5" id="wizard-mode-label">Who are you inviting?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-labelledby="wizard-mode-label">
                {([
                  { value: 'existing', label: 'Existing User', desc: 'Pick a registered account and issue it a work email', icon: UserRound },
                  { value: 'new', label: 'Add New Staff', desc: 'Register a new staff member manually', icon: UserPlusIcon },
                ] as const).map((opt) => {
                  const Icon = opt.icon;
                  const active = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => switchMode(opt.value)}
                      className="p-3 rounded-xl text-left transition-colors"
                      style={
                        active
                          ? { background: 'rgba(201,166,107,0.1)', border: '1.5px solid #C9A66B' }
                          : { background: 'white', border: '1px solid #E9DFCF' }
                      }
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" style={{ color: active ? '#A98042' : '#8B7B68' }} />
                        <span className="text-[13px] font-bold" style={{ color: active ? '#A98042' : '#5C4B3A' }}>{opt.label}</span>
                      </span>
                      <span className="block text-[12px] text-[#8B7B68] mt-1 leading-relaxed">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {mode === 'existing' ? (
              selected ? (
                /* Chosen account — polished read-only summary card */
                <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #C9A66B' }} aria-live="polite">
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: 'rgba(201,166,107,0.1)' }}>
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0" style={{ background: '#3E2E22', color: '#E9DFCF' }}>
                      {userInitials(selectedName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#3E2E22] flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#16a34a' }} />
                        <span className="truncate">{selectedName}</span>
                      </p>
                      <p className="text-[13px] text-[#8B7B68] truncate">{selected.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { chooseExisting(null); setPickQuery(''); }}
                      className="shrink-0 text-[13px] font-bold px-2.5 py-1.5 rounded-lg transition-colors hover:border-[#C9A66B]"
                      style={{ background: 'white', border: '1px solid #E9DFCF', color: '#A98042' }}
                    >
                      Change
                    </button>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 px-4 py-3 bg-white">
                    <div className="min-w-0">
                      <dt className="text-[12px] uppercase tracking-wider text-[#8B7B68] font-bold">Personal Email — Existing Account</dt>
                      <dd className="text-[13px] font-semibold text-[#5C4B3A] truncate">{selected.email}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[12px] uppercase tracking-wider text-[#8B7B68] font-bold">Department</dt>
                      <dd className="text-[13px] font-semibold text-[#5C4B3A] truncate">{selected.department || '—'}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[12px] uppercase tracking-wider text-[#8B7B68] font-bold">Phone</dt>
                      <dd className="text-[13px] font-semibold text-[#5C4B3A] truncate">{selected.phone_number || '—'}</dd>
                    </div>
                  </dl>
                  <p className="px-4 pb-3 pt-1 text-[12px] text-[#8B7B68] leading-relaxed bg-white">
                    The personal email is never replaced — the work email below is added as a separate admin login.
                  </p>
                </div>
              ) : (
                /* Searchable user picker */
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68]" htmlFor="admin-pick-query">
                      Select Existing User
                    </label>
                    <span className="text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F7F3EB', border: '1px solid #E9DFCF', color: '#8B7B68' }}>
                      {eligible.length} available
                    </span>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="admin-pick-query"
                      type="text"
                      className={`${inputCls} border-[#C9A66B]/60 pl-10 pr-10 py-2.5`}
                      value={pickQuery}
                      onChange={(e) => setPickQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && eligible.length) {
                          e.preventDefault();
                          chooseExisting(eligible[0].id);
                        }
                      }}
                      placeholder="Search by name, email or department…"
                      aria-describedby={errors.user ? 'admin-pick-error' : undefined}
                    />
                    {pickQuery && (
                      <button
                        type="button"
                        onClick={() => setPickQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7B68] hover:text-[#5C4B3A]"
                        aria-label="Clear search"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 rounded-xl bg-white overflow-hidden" style={{ border: '1px solid #E9DFCF' }}>
                    {eligible.length === 0 ? (
                      <div className="py-8 px-4 text-center">
                        <UserRound className="w-6 h-6 mx-auto mb-2" style={{ color: '#C9C0B2' }} />
                        <p className="text-[13px] text-[#8B7B68]">No eligible users match your search.</p>
                        <p className="text-[12px] text-[#8B7B68]/70 mt-1">Existing admins and already-invited users are hidden here — use “Add New Staff” for new people.</p>
                      </div>
                    ) : (
                      <ul className="max-h-60 overflow-y-auto divide-y divide-[#F3EDE1]" role="listbox" aria-label="Eligible users">
                        {eligible.map((u) => {
                          const n = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
                          return (
                            <li key={u.id} role="option" aria-selected={false}>
                              <button
                                type="button"
                                onClick={() => chooseExisting(u.id)}
                                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#FFF8EE] transition-colors"
                              >
                                <span className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0" style={{ background: 'rgba(201,166,107,0.18)', color: '#A98042' }}>
                                  {userInitials(n)}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] font-bold text-[#5C4B3A] truncate">{n}</span>
                                  <span className="block text-[13px] text-[#8B7B68] truncate">{u.email}</span>
                                </span>
                                {u.department && (
                                  <span className="shrink-0 text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F7F3EB', border: '1px solid #E9DFCF', color: '#8B7B68' }}>
                                    {u.department}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {errors.user && (
                    <p id="admin-pick-error" className="text-[13px] mt-1" style={{ color: '#DC2626' }}>{errors.user}</p>
                  )}
                </div>
              )
            ) : (
              <>
                <div>
                  <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1" htmlFor="admin-new-name">Full Name *</label>
                  <input
                    id="admin-new-name"
                    className={`${inputCls} ${errors.full_name ? 'border-[#DC2626]' : 'border-[#E9DFCF]'}`}
                    value={form.full_name}
                    onChange={(e) => set('full_name', e.target.value)}
                    placeholder="e.g. Dr. Priya Raman"
                  />
                  {errors.full_name && <p className="text-[13px] mt-1" style={{ color: '#DC2626' }}>{errors.full_name}</p>}
                </div>
                <div>
                  <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1" htmlFor="admin-new-personal">
                    Personal Email <span className="font-normal normal-case">(links an existing account)</span>
                  </label>
                  <input
                    id="admin-new-personal"
                    type="email"
                    className={`${inputCls} ${errors.personal_email ? 'border-[#DC2626]' : 'border-[#E9DFCF]'}`}
                    value={form.personal_email}
                    onChange={(e) => set('personal_email', e.target.value)}
                    placeholder="existing.person@gmail.com"
                  />
                  {errors.personal_email && <p className="text-[13px] mt-1" style={{ color: '#DC2626' }}>{errors.personal_email}</p>}
                </div>
              </>
            )}

            {/* Work email — the only field the Super Admin must always enter */}
            <div>
              <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1" htmlFor="admin-work-email">
                Work Email — Admin Login *
              </label>
              <input
                id="admin-work-email"
                type="email"
                className={`${inputCls} ${errors.email ? 'border-[#DC2626]' : 'border-[#E9DFCF]'}`}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="admin@institution.edu"
                aria-describedby="admin-work-email-hint"
              />
              {errors.email ? (
                <p className="text-[13px] mt-1" style={{ color: '#DC2626' }}>{errors.email}</p>
              ) : (
                <p id="admin-work-email-hint" className="text-[13px] mt-1 text-[#8B7B68]">
                  This becomes the staff member&rsquo;s admin login once they set a password. For security, the
                  activation email is delivered to their personal email instead.
                </p>
              )}
            </div>

            <div>
              <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1" htmlFor="admin-role">Role Label</label>
              <select id="admin-role" className={`${inputCls} border-[#E9DFCF]`} value={form.role} onChange={(e) => set('role', e.target.value)}>
                {ADMIN_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {/* Department + phone: captured for BOTH paths — these values land
                on the staff member's admin profile as locked fields. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1" htmlFor="admin-dept">Department / Team</label>
                  <input id="admin-dept" className={`${inputCls} border-[#E9DFCF]`} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. Editorial" />
                </div>
                <div>
                  <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1" htmlFor="admin-phone">Phone (optional)</label>
                  <input id="admin-phone" className={`${inputCls} ${errors.phone ? 'border-[#DC2626]' : 'border-[#E9DFCF]'}`} value={form.phone} onChange={(e) => set('phone', digitsOnly(e.target.value, 10))} inputMode="numeric" maxLength={10} placeholder="9876543210" aria-invalid={!!errors.phone} />
                  {errors.phone && <p className="text-[13px] mt-1" style={{ color: '#DC2626' }}>{errors.phone}</p>}
                </div>
              </div>
          </>
        ) : (
          <>
            {/* Step 2: send summary */}
            <div className="rounded-xl p-3 text-[13px] leading-relaxed text-[#5C4B3A]" style={{ background: 'rgba(201,166,107,0.08)', border: '1px solid #E9DFCF' }}>
              Inviting <strong>{form.full_name.trim() || selectedName}</strong> — invitation &amp; login email{' '}
              <strong>{form.email.trim()}</strong>. Every section starts at <strong>No Access</strong>; pick
              Read or Edit to grant it. You can send with everything left at None.
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68]">CMS Section Permissions</p>
                <button
                  type="button"
                  onClick={() => setPermissions({ ...ALL_NONE })}
                  className="text-[12px] font-bold text-[#A98042] hover:text-[#5C4B3A]"
                >
                  Reset all to None
                </button>
              </div>
              <div className="rounded-xl border border-[#E9DFCF] divide-y divide-[#F3EDE1] max-h-[300px] overflow-y-auto">
                {ADMIN_SECTIONS.map((s) => (
                  <div key={s.key} className="flex items-center gap-3 px-3 py-2 bg-white">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-[#5C4B3A] truncate">{s.label}</p>
                      <p className="text-[12px] text-[#8B7B68] truncate">{s.pages}</p>
                    </div>
                    <div role="radiogroup" aria-label={`${s.label} access level`} className="flex items-center gap-1 shrink-0">
                      {LEVEL_ORDER.map((lvl) => {
                        const m = LEVEL_META[lvl];
                        const Icon = m.icon;
                        const active = permissions[s.key] === lvl;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setLevel(s.key, lvl)}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-[13px] font-semibold transition-colors"
                            style={
                              active
                                ? { background: `${m.color}14`, border: '1.5px solid', color: m.color, borderColor: m.color }
                                : { background: 'white', border: '1px solid #E9DFCF', color: '#8B7B68' }
                            }
                          >
                            <Icon className="w-3 h-3" /> {m.short}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] block mb-1" htmlFor="admin-notes">Internal Notes (optional)</label>
              <textarea id="admin-notes" className={`${inputCls} border-[#E9DFCF] resize-none`} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Never included in the invitation email." />
            </div>

            <p className="text-[13px] leading-relaxed text-[#8B7B68] rounded-lg px-3 py-2" style={{ background: '#F7F3EB', border: '1px solid #E9DFCF' }}>
              The invitation is delivered to the staff member&rsquo;s personal email (their work email only when no
              personal address is on record) with a single-use, 24-hour setup link. The recipient
              creates their own password — you never set or see it — then signs in with the work email. Only the
              sections granted above appear in their sidebar, and the API enforces the same levels.
            </p>
          </>
        )}

        {emailWarning && (
          <div className="p-3 rounded-xl text-[13px] font-semibold flex items-start gap-2" style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#B45309' }} role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Email delivery failed — the invitation was saved but never reached an inbox. Fix the mail settings,
              then press <strong>Send Invitation</strong> again; a fresh link is emailed without creating a duplicate.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
};
