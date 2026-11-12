'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ScrollText,
  ArrowLeft,
  Save,
  UploadCloud,
  DownloadCloud,
  Archive,
  ArchiveRestore,
  Trash2,
  History,
  Eye,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { displayId } from '@/lib/utils/publicId';
import { Button } from '@/components/ui/Button';
import { PolicyMarkdown } from '@/components/policies/PolicyMarkdown';
import {
  AdminPolicy,
  AdminPolicyVersion,
  fetchAdminPolicies,
  fetchAdminPolicyVersions,
  savePolicyDraft,
  publishPolicyVersion,
  unpublishPolicy,
  restorePolicyVersion,
  archivePolicy,
  unarchivePolicy,
  deletePolicyDraft,
} from '@/lib/services/policies';

type FetchState = 'idle' | 'loading' | 'error';

const STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: 'rgba(201,166,107,0.12)', fg: '#A98042', label: 'Draft' },
  published: { bg: 'rgba(34,197,94,0.12)', fg: '#16a34a', label: 'Published' },
  unpublished: { bg: 'rgba(239,68,68,0.10)', fg: '#dc2626', label: 'Unpublished' },
  archived: { bg: 'rgba(139,123,104,0.12)', fg: '#8B7B68', label: 'Archived' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.archived;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-bold uppercase tracking-wider"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.fg}33` }}
    >
      {s.label}
    </span>
  );
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AdminPoliciesPage() {
  const { tokens } = useAuth();
  const accessToken = tokens?.access || '';

  // List state
  const [policies, setPolicies] = useState<AdminPolicy[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [listError, setListError] = useState<string | null>(null);

  // Detail state
  const [selected, setSelected] = useState<AdminPolicy | null>(null);
  const [versions, setVersions] = useState<AdminPolicyVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);

  // Editor state
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorEffectiveDate, setEditorEffectiveDate] = useState('');
  const [editorChangeSummary, setEditorChangeSummary] = useState('');
  const [draftVersionId, setDraftVersionId] = useState<string | null>(null);

  // Feedback / modal state
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<AdminPolicyVersion | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadPolicies = useCallback(async () => {
    setFetchState('loading');
    setListError(null);
    try {
      const data = await fetchAdminPolicies(accessToken);
      setPolicies(data);
      setFetchState('idle');
    } catch (err: any) {
      setListError(err?.message || 'Failed to load policies.');
      setFetchState('error');
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) loadPolicies();
  }, [accessToken, loadPolicies]);

  const reloadVersions = useCallback(
    async (policy: AdminPolicy) => {
      setVersionsLoading(true);
      try {
        const vs = await fetchAdminPolicyVersions(accessToken, policy.id);
        setVersions(vs);
        const draft = vs.find((v) => v.status === 'draft') || null;
        setDraftVersionId(draft ? draft.id : null);
        if (draft) {
          setEditorTitle(draft.title || policy.title);
          setEditorContent(draft.content);
          setEditorEffectiveDate(draft.effective_date || '');
          setEditorChangeSummary(draft.change_summary || '');
        } else {
          const published = vs.find((v) => v.status === 'published') || null;
          setEditorTitle(published?.title || policy.title);
          setEditorContent(published?.content || '');
          setEditorEffectiveDate(published?.effective_date || '');
          setEditorChangeSummary('');
        }
      } catch (err: any) {
        setMessage({ kind: 'error', text: err?.message || 'Failed to load version history.' });
      } finally {
        setVersionsLoading(false);
      }
    },
    [accessToken]
  );

  const openPolicy = (policy: AdminPolicy) => {
    setSelected(policy);
    setMessage(null);
    setPreviewVersion(null);
    setShowPreview(false);
    reloadVersions(policy);
  };

  const backToList = () => {
    setSelected(null);
    setVersions([]);
    setMessage(null);
    loadPolicies();
  };

  const flash = (kind: 'success' | 'error', text: string) => {
    setMessage({ kind, text });
  };

  // ── Workflow actions ────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!selected) return;
    if (!editorContent.trim()) {
      flash('error', 'Policy content cannot be empty.');
      return;
    }
    setBusy(true);
    try {
      await savePolicyDraft(accessToken, selected.id, {
        content: editorContent,
        title: editorTitle || selected.title,
        effective_date: editorEffectiveDate || null,
        change_summary: editorChangeSummary,
      });
      flash('success', 'Draft saved. The published version is unchanged until you publish.');
      await reloadVersions(selected);
    } catch (err: any) {
      flash('error', err?.message || 'Failed to save draft.');
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    if (!selected) return;
    if (!draftVersionId) {
      flash('error', 'Save a draft before publishing.');
      return;
    }
    setBusy(true);
    try {
      const published = await publishPolicyVersion(accessToken, selected.id, draftVersionId);
      flash('success', `Version ${published.version} is now live on the public site.`);
      const refreshed = await fetchAdminPolicies(accessToken);
      setPolicies(refreshed);
      const stillSelected = refreshed.find((p) => p.id === selected.id) || selected;
      setSelected(stillSelected);
      await reloadVersions(stillSelected);
    } catch (err: any) {
      flash('error', err?.message || 'Failed to publish version.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnpublish = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await unpublishPolicy(accessToken, selected.id);
      flash('success', 'The policy has been removed from the public site. History is preserved.');
      const refreshed = await fetchAdminPolicies(accessToken);
      const stillSelected = refreshed.find((p) => p.id === selected.id) || selected;
      setSelected(stillSelected);
      await reloadVersions(stillSelected);
    } catch (err: any) {
      flash('error', err?.message || 'Failed to unpublish.');
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (version: AdminPolicyVersion) => {
    if (!selected) return;
    setBusy(true);
    try {
      await restorePolicyVersion(accessToken, selected.id, version.id);
      flash('success', `Version ${version.version} restored as a new draft. Review and publish when ready.`);
      await reloadVersions(selected);
    } catch (err: any) {
      flash('error', err?.message || 'Failed to restore version.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!selected || !draftVersionId) return;
    setBusy(true);
    try {
      await deletePolicyDraft(accessToken, selected.id);
      flash('success', 'Draft discarded.');
      await reloadVersions(selected);
    } catch (err: any) {
      flash('error', err?.message || 'Failed to delete draft.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleArchive = async (policy: AdminPolicy) => {
    setBusy(true);
    try {
      if (policy.is_archived) {
        await unarchivePolicy(accessToken, policy.id);
      } else {
        await archivePolicy(accessToken, policy.id);
      }
      await loadPolicies();
    } catch (err: any) {
      flash('error', err?.message || 'Failed to change archive state.');
    } finally {
      setBusy(false);
    }
  };

  // ── Render: list view ───────────────────────────────────────────────────────

  if (!selected) {
    return (
      <AdminLayout title="Policy Management" subtitle="Manage the legal documents shown on your website. Authors must accept these before submitting work.">
        {message && (
          <div className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2"
            style={{ background: message.kind === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(34,197,94,0.08)', color: message.kind === 'error' ? '#dc2626' : '#16a34a', border: `1px solid ${message.kind === 'error' ? 'rgba(220,38,38,0.25)' : 'rgba(34,197,94,0.25)'}` }}>
            {message.kind === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        {/* Plain-language intro */}
        <div className="rounded-2xl bg-white border p-4 text-[13px] leading-relaxed space-y-1.5" style={{ borderColor: '#E9DFCF', color: '#5C4B3A' }}>
          <p className="text-xs font-bold" style={{ color: '#3E2E22' }}>What is this page?</p>
          <p>
            These are the legal documents shown on your website (Privacy Policy, Terms and Conditions, Publication Policies).
            Authors must accept them before submitting a book chapter or journal article.
          </p>
          <p>
            <strong style={{ color: '#3E2E22' }}>To change a policy:</strong> click <strong>Manage</strong> → edit the text → <strong>Save Draft</strong> → <strong>Publish Draft</strong>.
            Until you press Publish, visitors keep seeing the old text.
          </p>
          <p>
            <strong style={{ color: '#16a34a' }}>Live version</strong> = what visitors read on the website right now. &nbsp;·&nbsp;
            <strong style={{ color: '#A98042' }}>Draft</strong> = a private copy you are editing — invisible to the public.
          </p>
        </div>

        {fetchState === 'loading' ? (
          <div className="flex items-center gap-2 p-8 justify-center text-xs font-semibold" style={{ color: '#8B7B68' }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Loading policies…
          </div>
        ) : fetchState === 'error' ? (
          <div className="p-6 rounded-2xl bg-white border space-y-3" style={{ borderColor: '#E9DFCF' }}>
            <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>{listError}</p>
            <Button type="button" variant="gold" size="sm" onClick={loadPolicies}>Retry</Button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border overflow-x-auto" style={{ borderColor: '#E9DFCF' }}>
            <table className="w-full text-left text-xs min-w-[900px]">
              <thead>
                <tr style={{ borderBottom: '1px solid #E9DFCF', color: '#8B7B68' }}>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">MMSR ID</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Live version <span className="normal-case font-semibold">(visitors see this)</span></th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Live Status <span className="normal-case font-semibold">(visitors see this)</span></th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Draft Status</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Archived</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Effective from</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Published on</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Last edited by</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider">Last changed</th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FFF8EE] transition-colors" style={{ borderBottom: '1px solid #F2EADC' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: '#3E2E22' }}>{p.title}</td>
                    {/* Policy reference (MMSR-POL) — quoted by acceptance records */}
                    <td className="px-4 py-3 text-[13px] font-mono" style={{ color: '#8B7B68' }}>{displayId(p)}</td>
                    <td className="px-4 py-3" style={{ color: '#5C4B3A' }}>{p.policy_type_display}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: '#3E2E22' }}>
                      {p.current_version_number ? `v${p.current_version_number}` : '—'}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {p.current_version_number ? (
                        <StatusBadge status="published" />
                      ) : p.latest_status ? (
                        <StatusBadge status={p.latest_status} />
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[13px] font-bold uppercase tracking-wider" style={{ color: '#8B7B68', border: '1px solid #E9DFCF' }}>
                          Not published
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {p.has_draft ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[13px] font-bold uppercase tracking-wider"
                          style={{ background: 'rgba(201,166,107,0.12)', color: '#A98042', border: '1px solid rgba(201,166,107,0.35)' }}
                          title="A draft exists with changes that are not live yet — open Manage to review and publish"
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#A98042' }} />
                          Draft pending · v{p.draft_version_number}
                        </span>
                      ) : (
                        <span style={{ color: '#8B7B68' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {p.is_archived ? (
                        <span className="text-[13px] font-bold uppercase" style={{ color: '#dc2626' }}>Archived</span>
                      ) : (
                        <span style={{ color: '#8B7B68' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ color: '#5C4B3A' }}>{fmtDate(p.current_effective_date)}</td>
                    <td className="px-4 py-3" style={{ color: '#5C4B3A' }}>{fmtDateTime(p.current_published_at)}</td>
                    <td className="px-4 py-3" style={{ color: '#5C4B3A' }}>{p.last_updated_by_email || '—'}</td>
                    <td className="px-4 py-3" style={{ color: '#8B7B68' }}>{fmtDateTime(p.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openPolicy(p)}
                          title="Open this policy to view or change it"
                          className="px-3 py-1.5 rounded-lg text-[13px] font-bold transition-colors"
                          style={{ background: 'rgba(201,166,107,0.12)', color: '#A98042', border: '1px solid rgba(201,166,107,0.35)' }}
                        >
                          Manage
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleArchive(p)}
                          disabled={busy}
                          title={p.is_archived ? 'Unarchive: makes this policy usable again' : 'Archive: hides this policy from the website (authors cannot accept it)'}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: p.is_archived ? '#16a34a' : '#8B7B68', border: '1px solid #E9DFCF' }}
                        >
                          {p.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {policies.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center" style={{ color: '#8B7B68' }}>
                      No policies found. Run the seeding command on the backend to initialise official policies.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[13px]" style={{ color: '#8B7B68' }}>
          Want to see which author accepted which version? Open the{' '}
          <Link href="/admin/policy-acceptances" className="font-bold underline" style={{ color: '#A98042' }}>
            Policy Acceptance Records
          </Link>{' '}
          — the legal proof of every author's agreement.
        </p>
      </AdminLayout>
    );
  }

  // ── Render: detail / editor view ────────────────────────────────────────────

  const publishedVersion = versions.find((v) => v.status === 'published') || null;

  return (
    <AdminLayout title={selected.title} subtitle={`Canonical route: ${selected.canonical_route}`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={backToList}
          className="inline-flex items-center gap-1.5 text-xs font-bold transition-colors hover:opacity-80"
          style={{ color: '#8B7B68' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Policies
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={selected.is_archived ? 'archived' : publishedVersion ? 'published' : 'unpublished'} />
          {publishedVersion && (
            <span className="text-[13px] font-mono" style={{ color: '#5C4B3A' }}>
              live v{publishedVersion.version} · effective {fmtDate(publishedVersion.effective_date)}
            </span>
          )}
          <Link
            href={selected.canonical_route}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-bold underline"
            style={{ color: '#A98042' }}
          >
            View public page <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl text-xs font-semibold flex items-center gap-2"
          style={{ background: message.kind === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(34,197,94,0.08)', color: message.kind === 'error' ? '#dc2626' : '#16a34a', border: `1px solid ${message.kind === 'error' ? 'rgba(220,38,38,0.25)' : 'rgba(34,197,94,0.25)'}` }}>
          {message.kind === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Plain-language overview: what is live vs what you are editing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-4 space-y-1" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.3)' }}>
          <p className="text-[13px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#16a34a' }}>
            <Eye className="w-3.5 h-3.5" /> What visitors see right now
          </p>
          {publishedVersion ? (
            <>
              <p className="text-sm font-bold" style={{ color: '#3E2E22' }}>Version v{publishedVersion.version} — live on the website</p>
              <p className="text-[13px]" style={{ color: '#5C4B3A' }}>
                Effective from {fmtDate(publishedVersion.effective_date)} · went live {fmtDateTime(publishedVersion.published_at)}
              </p>
            </>
          ) : (
            <p className="text-xs" style={{ color: '#5C4B3A' }}>
              Nothing is live. The public page {selected.canonical_route} will show an error until you publish a version.
            </p>
          )}
        </div>
        <div className="rounded-2xl p-4 space-y-1" style={{ background: 'rgba(201,166,107,0.10)', border: '1px solid rgba(201,166,107,0.4)' }}>
          <p className="text-[13px] font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#A98042' }}>
            <Save className="w-3.5 h-3.5" /> What you are editing below
          </p>
          <p className="text-sm font-bold" style={{ color: '#3E2E22' }}>
            {draftVersionId ? 'A private draft (saved copy)' : 'A new working copy'}
          </p>
          <p className="text-[13px]" style={{ color: '#5C4B3A' }}>
            Only admins can see this. The public never sees these changes until you press “Publish Draft”.
          </p>
        </div>
      </div>

      {/* How-to guide */}
      <div className="rounded-2xl bg-white border p-5 space-y-3" style={{ borderColor: '#E9DFCF' }}>
        <h2 className="text-sm font-bold" style={{ color: '#3E2E22' }}>How to update this policy — 3 easy steps</h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { n: 1, t: 'Edit the text', d: 'Change the title, content, or effective date in the editor below. Nothing goes live yet.' },
            { n: 2, t: 'Save Draft', d: 'Click “Save Draft” to store your changes safely. You can close this page and continue later.' },
            { n: 3, t: 'Publish', d: 'Click “Publish Draft” to replace the live text. The old version is kept in history forever.' },
          ].map((s) => (
            <li key={s.n} className="rounded-xl p-3.5 flex gap-3 items-start" style={{ background: '#FFF8EE', border: '1px solid #F2EADC' }}>
              <span className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{ background: '#C9A66B' }}>{s.n}</span>
              <div>
                <p className="text-xs font-bold" style={{ color: '#3E2E22' }}>{s.t}</p>
                <p className="text-[13px] leading-snug" style={{ color: '#8B7B68' }}>{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[13px] leading-snug" style={{ color: '#8B7B68' }}>
          Made a mistake? Every old version is listed in “Version History” on the right — click “Load into editor” to bring an older text back as a new draft, then publish it.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Editor column */}
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-2xl bg-white border p-5 space-y-4" style={{ borderColor: '#E9DFCF' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold" style={{ color: '#3E2E22' }}>
                {draftVersionId ? 'Editor — your private draft' : publishedVersion ? 'Editor — new copy started from the live version' : 'Editor — write the first version'}
              </h2>
              {draftVersionId ? (
                <StatusBadge status="draft" />
              ) : (
                <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F7F3EB', color: '#8B7B68' }}>
                  Nothing saved yet — press “Save Draft” to create one
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold uppercase tracking-wider block" style={{ color: '#8B7B68' }}>
                  Policy Title
                </label>
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2 text-xs outline-none bg-white"
                  style={{ border: '1px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-bold uppercase tracking-wider block" style={{ color: '#8B7B68' }}>
                  Effective Date
                </label>
                <input
                  type="date"
                  value={editorEffectiveDate}
                  onChange={(e) => setEditorEffectiveDate(e.target.value)}
                  className="w-full rounded-xl px-3.5 py-2 text-xs outline-none bg-white"
                  style={{ border: '1px solid #E9DFCF', color: '#3E2E22' }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="policy-content-editor" className="text-[13px] font-bold uppercase tracking-wider block" style={{ color: '#8B7B68' }}>
                  Policy Content (safe Markdown)
                </label>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="inline-flex items-center gap-1 text-[13px] font-bold"
                  style={{ color: '#A98042' }}
                >
                  <Eye className="w-3.5 h-3.5" /> {showPreview ? 'Hide preview' : 'Preview'}
                </button>
              </div>
              <textarea
                id="policy-content-editor"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                rows={20}
                spellCheck={false}
                className="w-full rounded-xl px-4 py-3 text-xs font-mono leading-relaxed outline-none resize-y bg-white"
                style={{ border: '1px solid #E9DFCF', color: '#3E2E22' }}
                aria-label="Policy markdown content"
              />
              <p className="text-[13px]" style={{ color: '#8B7B68' }}>
                <strong>Formatting guide (optional):</strong> “## Heading” makes a section title · “- item” makes bullet points · “1. item” makes numbered lists · “**bold**” makes text strong · “---” makes a divider line.
                Copying from Word? Just paste the text — it will display fine as-is. Raw HTML is never executed, so this editor is safe by design.
              </p>
            </div>

            {showPreview && (
              <div className="rounded-xl p-5 max-h-[420px] overflow-y-auto" style={{ background: '#F7F3EB', border: '1px solid #E9DFCF' }}>
                <PolicyMarkdown content={editorContent} />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[13px] font-bold uppercase tracking-wider block" style={{ color: '#8B7B68' }}>
                Version Notes / Change Summary
              </label>
              <input
                type="text"
                value={editorChangeSummary}
                onChange={(e) => setEditorChangeSummary(e.target.value)}
                placeholder="What changed in this revision?"
                className="w-full rounded-xl px-3.5 py-2 text-xs outline-none bg-white"
                style={{ border: '1px solid #E9DFCF', color: '#3E2E22' }}
              />
            </div>

            {/* Action buttons with plain-language explanations */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Button type="button" variant="gold" size="sm" className="w-full justify-center" onClick={handleSaveDraft} disabled={busy}>
                  <Save className="w-4 h-4 mr-1.5" /> Save Draft
                </Button>
                <p className="text-[13px] leading-snug" style={{ color: '#8B7B68' }}>
                  Step 2 — stores your changes as a private copy. The website keeps showing the old version.
                </p>
              </div>
              <div className="space-y-1">
                <Button type="button" variant="success" size="sm" className="w-full justify-center" onClick={handlePublish} disabled={busy || !draftVersionId || selected.is_archived}>
                  <UploadCloud className="w-4 h-4 mr-1.5" /> Publish Draft
                </Button>
                <p className="text-[13px] leading-snug" style={{ color: '#8B7B68' }}>
                  Step 3 — makes your draft official. Everyone sees it immediately; the old text is saved in history forever.
                </p>
              </div>
              {publishedVersion && !selected.is_archived && (
                <div className="space-y-1">
                  <Button type="button" size="sm" className="w-full justify-center" onClick={handleUnpublish} disabled={busy}
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}>
                    <DownloadCloud className="w-4 h-4 mr-1.5" /> Unpublish (careful)
                  </Button>
                  <p className="text-[13px] leading-snug" style={{ color: '#dc2626' }}>
                    Takes the policy off the website. Authors will NOT be able to submit manuscripts until you publish again.
                  </p>
                </div>
              )}
              {draftVersionId && (
                <div className="space-y-1">
                  <Button type="button" size="sm" className="w-full justify-center" onClick={handleDeleteDraft} disabled={busy}
                    style={{ background: 'transparent', color: '#8B7B68', border: '1px solid #E9DFCF' }}>
                    <Trash2 className="w-4 h-4 mr-1.5" /> Discard Draft
                  </Button>
                  <p className="text-[13px] leading-snug" style={{ color: '#8B7B68' }}>
                    Deletes only the private draft. The published version on the website is untouched.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Version history column */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border p-5 space-y-3" style={{ borderColor: '#E9DFCF' }}>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: '#3E2E22' }}>
              <History className="w-4 h-4" style={{ color: '#C9A66B' }} /> Version History
              <span className="text-[13px] font-semibold ml-auto" style={{ color: '#8B7B68' }}>
                {versionsLoading ? 'Loading…' : `${versions.length} record${versions.length === 1 ? '' : 's'}`}
              </span>
            </h2>

            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {versions.map((v) => (
                <div key={v.id} className="rounded-xl p-3.5 space-y-2" style={{ background: '#FFF8EE', border: '1px solid #F2EADC' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold font-mono" style={{ color: '#3E2E22' }}>v{v.version}</span>
                    <StatusBadge status={v.status} />
                  </div>
                  <p className="text-[13px] leading-snug" style={{ color: '#5C4B3A' }}>
                    {v.title}
                    {v.status === 'published' && (
                      <span className="block font-bold mt-0.5" style={{ color: '#16a34a' }}>← This is what visitors see on the website</span>
                    )}
                    {v.status === 'draft' && (
                      <span className="block font-bold mt-0.5" style={{ color: '#A98042' }}>← This is what your editor is working on</span>
                    )}
                    {(v.status === 'unpublished' || v.status === 'archived') && (
                      <span className="block mt-0.5" style={{ color: '#8B7B68' }}>Older saved copy — kept forever, never deleted</span>
                    )}
                  </p>
                  <div className="text-[13px] space-y-0.5" style={{ color: '#8B7B68' }}>
                    <p className="font-mono">Version reference: {displayId(v)}</p>
                    <p>Effective: {fmtDate(v.effective_date)} · Published: {fmtDateTime(v.published_at)}</p>
                    <p>By: {v.last_edited_by_email || v.created_by_email || 'system'}</p>
                    {v.change_summary && <p className="italic">“{v.change_summary}”</p>}
                    {v.acceptance_count > 0 && (
                      <p style={{ color: '#A98042' }} className="font-semibold">
                        {v.acceptance_count} acceptance record{v.acceptance_count === 1 ? '' : 's'} reference this version
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setPreviewVersion(v)}
                      title="Read the exact text of this version"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] font-bold"
                      style={{ background: 'rgba(201,166,107,0.12)', color: '#A98042' }}
                    >
                      <Eye className="w-3 h-3" /> See text
                    </button>
                    {v.status !== 'draft' && (
                      <button
                        type="button"
                        onClick={() => handleRestore(v)}
                        disabled={busy || selected.is_archived}
                        title="Copy this old text into the editor as a new draft — nothing goes live until you publish"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] font-bold"
                        style={{ background: 'rgba(22,163,94,0.1)', color: '#16a34a' }}
                      >
                        <ArchiveRestore className="w-3 h-3" /> Load into editor
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!versionsLoading && versions.length === 0 && (
                <p className="text-[13px] py-4 text-center" style={{ color: '#8B7B68' }}>No versions recorded yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl p-4 text-[13px] leading-relaxed space-y-1.5" style={{ background: 'rgba(201,166,107,0.08)', border: '1px solid rgba(201,166,107,0.25)', color: '#5C4B3A' }}>
            <p className="font-bold flex items-center gap-1.5" style={{ color: '#3E2E22' }}>
              <ScrollText className="w-3.5 h-3.5" style={{ color: '#C9A66B' }} /> Why old versions are never deleted
            </p>
            <p>
              When authors submit work they accept a specific version of a policy. We must always be able to prove exactly what they agreed to,
              so every published version is kept forever — even when a newer one replaces it. Versions referenced by acceptance records cannot be deleted.
            </p>
          </div>
        </div>
      </div>

      {/* Version preview modal */}
      {previewVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Preview of version ${previewVersion.version}`}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setPreviewVersion(null)} aria-hidden="true" />
          <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white border p-6 space-y-4" style={{ borderColor: '#E9DFCF' }}>
            <div className="flex items-center justify-between sticky top-0 bg-white pb-2" style={{ borderBottom: '1px solid #E9DFCF' }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: '#3E2E22' }}>{previewVersion.title}</h3>
                <p className="text-[13px]" style={{ color: '#8B7B68' }}>
                  v{previewVersion.version} · <StatusBadge status={previewVersion.status} /> · effective {fmtDate(previewVersion.effective_date)}
                </p>
              </div>
              <button type="button" onClick={() => setPreviewVersion(null)} className="text-xs font-bold px-2 py-1 rounded-lg" style={{ color: '#8B7B68', border: '1px solid #E9DFCF' }}>
                Close
              </button>
            </div>
            <PolicyMarkdown content={previewVersion.content} />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
