'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Search,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Upload,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Filter,
  Lock,
  Unlock,
  BookOpen,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  AdminArticle,
  AdminJournal,
  AdminIssue,
  AdminChapterAuthor,
  fetchAdminArticles,
  fetchAdminJournals,
  fetchAdminIssues,
  createAdminArticle,
  updateAdminArticle,
  deleteAdminArticle,
  fetchChapterAuthors,
  parseCmsError,
} from '@/lib/services/cms';
import { displayId, searchableRefs } from '@/lib/utils/publicId';

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const STATUS_CHOICES = [
  { value: 'published', label: 'Published', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { value: 'draft', label: 'Draft', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-red-500/15 text-[#DC2626] border-red-500/30' },
];

const ACCESS_CHOICES = [
  { value: 'paid', label: 'Paid Access', icon: Lock, color: 'bg-[#FFF2D9] text-[#C9A66B] border-[#C9A66B]/40' },
  { value: 'open_access', label: 'Open Access', icon: Unlock, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
];

const emptyForm = () => ({
  journal: '',
  issue: '',
  title: '',
  slug: '',
  abstract: '',
  full_text: '',
  price: '',
  author_names_raw: '',
  institution: '',
  doi: '',
  publication_date: '',
  page_range: '',
  display_order: '1',
  status: 'published' as const,
  access_mode: 'paid' as const,
});

function getJournalId(j: AdminArticle['journal']): number {
  return typeof j === 'object' ? j.id : j;
}
function getIssueId(i: AdminArticle['issue']): number | null {
  if (!i) return null;
  return typeof i === 'object' ? i.id : i;
}

export default function AdminJournalArticlesPage() {
  const { tokens } = useAuth();

  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [journals, setJournals] = useState<AdminJournal[]>([]);
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [authors, setAuthors] = useState<AdminChapterAuthor[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [filterJournal, setFilterJournal] = useState('');
  const [filterIssue, setFilterIssue] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAccess, setFilterAccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Deep-link presets (from Journals → issue "+" action) ──────────────────────
  const [pendingNew, setPendingNew] = useState(false);
  const autoOpenedRef = useRef(false);

  // ── Drawer state ─────────────────────────────────────────────────────────────
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<AdminArticle | null>(null);
  const [formData, setFormData] = useState(emptyForm());
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // ── Delete state ──────────────────────────────────────────────────────────────
  const [deletingArticle, setDeletingArticle] = useState<AdminArticle | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMessage(null);
    try {
      const params: Parameters<typeof fetchAdminArticles>[1] = {};
      if (filterJournal) params.journal = filterJournal;
      if (filterIssue) params.issue = filterIssue;
      if (filterStatus) params.status = filterStatus;
      if (filterAccess) params.access_mode = filterAccess;

      const [arts, jnls, iss, auths] = await Promise.all([
        fetchAdminArticles(tokens.access, params),
        fetchAdminJournals(tokens.access).catch(() => [] as AdminJournal[]),
        fetchAdminIssues(tokens.access).catch(() => [] as AdminIssue[]),
        fetchChapterAuthors(tokens.access).catch(() => [] as AdminChapterAuthor[]),
      ]);
      setArticles(arts);
      setJournals(jnls);
      setIssues(iss);
      setAuthors(auths);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load article data.');
      setFetchState('error');
    }
  }, [tokens?.access, filterJournal, filterIssue, filterStatus, filterAccess]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Apply deep-link params (?journal=&issue=&new=1) from the Journals page "+" action
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const j = params.get('journal');
    const i = params.get('issue');
    if (j) setFilterJournal(j);
    if (i) setFilterIssue(i);
    if (params.get('new') === '1' && i) setPendingNew(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-open the add-article drawer once the preset issue's data is loaded
  useEffect(() => {
    if (pendingNew && fetchState === 'success' && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      openCreate();
      setPendingNew(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNew, fetchState]);

  // Issues filtered by the journal chosen in the create/edit form
  const formIssueOptions = useMemo(() => {
    if (!formData.journal) return issues;
    return issues.filter((iss) => {
      const jId = typeof iss.journal === 'object' ? String(iss.journal.id) : String(iss.journal);
      return jId === formData.journal;
    });
  }, [issues, formData.journal]);

  // Volume / issue-number dropdowns in the article drawer — they resolve to a concrete issue id
  const [formVolume, setFormVolume] = useState('');
  const [formIssueNum, setFormIssueNum] = useState('');

  const formVolumeOptions = useMemo(() => {
    const nums = new Set<string>();
    let hasUnnumbered = false;
    formIssueOptions.forEach((i) => {
      if (i.volume_number != null) nums.add(String(i.volume_number));
      else hasUnnumbered = true;
    });
    return { volumes: Array.from(nums).sort((a, b) => Number(a) - Number(b)), hasUnnumbered };
  }, [formIssueOptions]);

  const formVolumeIssues = useMemo(() => {
    if (formVolume === 'unnumbered') return formIssueOptions.filter((i) => i.volume_number == null);
    if (!formVolume) return [];
    return formIssueOptions.filter((i) => String(i.volume_number) === formVolume);
  }, [formIssueOptions, formVolume]);

  const handleVolumeChange = (v: string) => {
    setFormVolume(v);
    setFormIssueNum('');
    const inVol = formIssueOptions.filter((i) =>
      v === 'unnumbered' ? i.volume_number == null : v !== '' && String(i.volume_number) === v
    );
    // Auto-select when the volume holds exactly one issue; otherwise clear the association
    if (inVol.length === 1) {
      setFormIssueNum(String(inVol[0].id));
      setFormData((prev) => ({ ...prev, issue: String(inVol[0].id) }));
    } else {
      setFormData((prev) => ({ ...prev, issue: '' }));
    }
  };

  const handleIssueNumChange = (idVal: string) => {
    setFormIssueNum(idVal);
    setFormData((prev) => ({ ...prev, issue: idVal }));
  };

  // Seed the volume/issue selectors from a saved issue id (create deep-link + edit mode)
  const syncIssueSelectors = (issueId: string) => {
    const iss = issues.find((i) => String(i.id) === String(issueId));
    if (iss) {
      setFormVolume(iss.volume_number != null ? String(iss.volume_number) : 'unnumbered');
      setFormIssueNum(String(iss.id));
    } else {
      setFormVolume('');
      setFormIssueNum('');
    }
  };

  // Client-side text search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;
    const q = searchQuery.toLowerCase();
    return articles.filter((a) =>
      a.title.toLowerCase().includes(q) ||
      (a.doi || '').toLowerCase().includes(q) ||
      (a.author_names_raw || '').toLowerCase().includes(q) ||
      (a.abstract || '').toLowerCase().includes(q) ||
      searchableRefs(a.public_id).includes(q)
    );
  }, [articles, searchQuery]);

  // ── Open drawer ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingArticle(null);
    setFormData({
      ...emptyForm(),
      journal: filterJournal || (journals[0] ? String(journals[0].id) : ''),
      issue: filterIssue || '',
    });
    syncIssueSelectors(filterIssue || '');
    setPdfFile(null);
    setFormError(null);
    setFormSuccess(null);
    setIsDrawerOpen(true);
  };

  const openEdit = (a: AdminArticle) => {
    setEditingArticle(a);
    setFormData({
      journal: String(getJournalId(a.journal)),
      issue: getIssueId(a.issue) ? String(getIssueId(a.issue)) : '',
      title: a.title || '',
      slug: a.slug || '',
      abstract: a.abstract || '',
      full_text: (a as any).full_text || '',
      price: (a as any).price != null ? String((a as any).price) : '',
      author_names_raw: a.author_names_raw || '',
      institution: a.institution || '',
      doi: a.doi || '',
      publication_date: a.publication_date || '',
      page_range: a.page_range || '',
      display_order: String(a.display_order ?? 1),
      status: (a.status || 'published') as typeof formData.status,
      access_mode: (!a.access_mode || a.access_mode === 'preview_only' ? 'paid' : a.access_mode) as typeof formData.access_mode,
    });
    syncIssueSelectors(getIssueId(a.issue) ? String(getIssueId(a.issue)) : '');
    setPdfFile(null);
    setFormError(null);
    setFormSuccess(null);
    setIsDrawerOpen(true);
  };

  // ── Submit form ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access) return;
    if (!formData.journal) { setFormError('Please select an associated journal.'); return; }
    if (!formData.title.trim()) { setFormError('Article title is required.'); return; }

    setFormSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const fd = new FormData();
      fd.append('journal', formData.journal);
      if (formData.issue) fd.append('issue', formData.issue);
      fd.append('title', formData.title.trim());
      if (formData.slug.trim()) fd.append('slug', formData.slug.trim());
      if (formData.abstract.trim()) fd.append('abstract', formData.abstract.trim());
      fd.append('full_text', formData.full_text);
      fd.append('price', formData.price.trim() || '');
      if (formData.author_names_raw.trim()) fd.append('author_names_raw', formData.author_names_raw.trim());
      if (formData.institution.trim()) fd.append('institution', formData.institution.trim());
      if (formData.doi.trim()) fd.append('doi', formData.doi.trim());
      if (formData.publication_date) fd.append('publication_date', formData.publication_date);
      if (formData.page_range.trim()) fd.append('page_range', formData.page_range.trim());
      fd.append('display_order', formData.display_order || '1');
      fd.append('status', formData.status);
      fd.append('access_mode', formData.access_mode);
      if (pdfFile) fd.append('file_pdf', pdfFile);

      if (editingArticle) {
        await updateAdminArticle(tokens.access, editingArticle.id, fd);
        setFormSuccess('Article updated successfully.');
      } else {
        await createAdminArticle(tokens.access, fd);
        setFormSuccess('Article created successfully.');
      }

      await loadData();
      setTimeout(() => setIsDrawerOpen(false), 900);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save article.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deletingArticle || !tokens?.access) return;
    setDeleteLoading(true);
    try {
      await deleteAdminArticle(tokens.access, deletingArticle.id);
      setDeletingArticle(null);
      await loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const getStatusBadge = (s: string) => STATUS_CHOICES.find((c) => c.value === s) || STATUS_CHOICES[1];
  const getAccessBadge = (m: string) => ACCESS_CHOICES.find((c) => c.value === m) || ACCESS_CHOICES[0];
  const getJournalTitle = (a: AdminArticle) => {
    if (typeof a.journal === 'object') return a.journal.title;
    return journals.find((j) => j.id === a.journal)?.title ?? 'Journal not listed';
  };
  const getIssueTitle = (a: AdminArticle) => {
    const id = getIssueId(a.issue);
    if (!id) return null;
    if (typeof a.issue === 'object' && a.issue) return (a.issue as any).title;
    // Never quote the internal key: the issue's own title, else its MMSR
    // volume/issue numbers, else a neutral label (spec §11).
    const iss = issues.find((i) => i.id === id);
    if (!iss) return 'Issue not listed';
    if (iss.issue_number != null || iss.volume_number != null) {
      return `Vol. ${iss.volume_number ?? '\u2014'} / Issue ${iss.issue_number ?? '\u2014'}`;
    }
    return iss.title || iss.public_id || 'Unnumbered issue';
  };

  return (
    <AdminLayout
      title="Journal Article Management"
      subtitle="Create, edit, and manage published articles. Filter by journal, issue, status, or access mode. PDF uploads are handled via the protected Django storage backend."
    >
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[#8B7B68] mb-1 -mt-1">
        <Link href="/admin" className="hover:text-[#C9A66B] transition-colors">Admin</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/admin/journals" className="hover:text-[#C9A66B] transition-colors">Journals & Issues</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-[#5C4B3A] font-semibold">Articles</span>
      </nav>

      <div className="space-y-4">
        {/* ── Filter & Action Bar ── */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Text search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-[#8B7B68] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search title, DOI, authors or MMSR ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 bg-white border border-[#E9DFCF] rounded-xl pl-9 pr-3 text-xs text-[#5C4B3A] placeholder:text-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
              />
            </div>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 bg-white border border-[#E9DFCF] rounded-xl px-3 py-0! text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer" style={{ width: 'auto' }}
            >
              <option value="">All Statuses</option>
              {STATUS_CHOICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>

            {/* Access filter */}
            <select
              value={filterAccess}
              onChange={(e) => setFilterAccess(e.target.value)}
              className="h-9 bg-white border border-[#E9DFCF] rounded-xl px-3 py-0! text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer" style={{ width: 'auto' }}
            >
              <option value="">All Access Modes</option>
              {ACCESS_CHOICES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>

            <button
              type="button"
              onClick={loadData}
              className="h-9 px-3 rounded-xl border border-[#E9DFCF] bg-white text-xs font-medium text-[#5C4B3A] hover:border-[#C9A66B] transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${fetchState === 'loading' ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="h-9 px-4 rounded-xl bg-[#C9A66B] text-white font-bold text-xs shadow-sm hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              Add Article
            </button>
          </div>

          {/* Active filter summary */}
          {(filterJournal || filterIssue || filterStatus || filterAccess) && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3 h-3 text-[#C9A66B]" />
              <span className="text-[13px] text-[#8B7B68]">Active filters applied. Showing server-filtered results.</span>
              <button
                type="button"
                onClick={() => { setFilterJournal(''); setFilterIssue(''); setFilterStatus(''); setFilterAccess(''); }}
                className="text-[13px] text-[#DC2626] hover:text-red-500 font-semibold"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── Loading ── */}
        {fetchState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-[#C9A66B] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-[#8B7B68]">Loading articles from Django REST API…</p>
          </div>
        )}

        {/* ── Error ── */}
        {fetchState === 'error' && (
          <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-[#DC2626] mx-auto" />
            <p className="text-sm font-semibold text-[#5C4B3A]">Failed to Load Articles</p>
            <p className="text-xs text-[#8B7B68]">{errorMessage}</p>
            <Button type="button" variant="outline" size="sm" onClick={loadData}>Retry</Button>
          </div>
        )}

        {/* ── Empty ── */}
        {fetchState === 'success' && filteredArticles.length === 0 && (
          <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
            <FileText className="w-8 h-8 text-[#C9A66B] mx-auto" />
            <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Articles Found</p>
            <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
              {searchQuery || filterJournal || filterIssue || filterStatus || filterAccess
                ? 'No articles match the active filters. Try clearing some filters.'
                : 'No articles have been indexed yet. Use "Add Article" to publish the first one.'}
            </p>
          </div>
        )}

        {/* ── Table ── */}
        {fetchState === 'success' && filteredArticles.length > 0 && (
          <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                    <th className="py-3 px-4 font-bold">Title</th>
                    <th className="py-3 px-4 font-bold">MMSR ID</th>
                    <th className="py-3 px-4 font-bold">DOI</th>
                    <th className="py-3 px-4 font-bold">Author</th>
                    <th className="py-3 px-4 font-bold">Journal</th>
                    <th className="py-3 px-4 font-bold">Issue</th>
                    <th className="py-3 px-4 font-bold">Access</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold">PDF</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5EFE4]">
                  {filteredArticles.map((a) => {
                    const statusBadge = getStatusBadge(a.status);
                    const accessBadge = getAccessBadge(a.access_mode);
                    const issueTitle = getIssueTitle(a);
                    return (
                      <tr key={a.id} className="hover:bg-[#FFF8EE] transition-colors">
                        <td className="py-3 px-4 max-w-xs font-semibold text-[#5C4B3A] font-playfair line-clamp-2 leading-tight">{a.title}</td>
                        {/* Article reference (MMSR-ART) — citable record ID */}
                        <td className="py-3 px-4 text-[13px] font-mono text-[#8B7B68]">{displayId(a)}</td>
                        <td className="py-3 px-4 text-[13px] font-mono text-[#C9A66B]">{a.doi || '—'}</td>
                        <td className="py-3 px-4 text-[13px] text-[#8B7B68] line-clamp-1">{a.author_names_raw || '—'}</td>
                        <td className="py-3 px-4 font-medium text-[#5C4B3A] line-clamp-1">{getJournalTitle(a)}</td>
                        <td className="py-3 px-4 text-[13px] text-[#8B7B68] line-clamp-1">{issueTitle || '—'}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] font-bold border ${accessBadge.color}`}>
                            {accessBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[13px] font-bold border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {a.file_pdf ? (
                            <span className="text-emerald-400 text-[13px] font-semibold"> On File</span>
                          ) : (
                            <span className="text-[13px] text-[#8B7B68]">No PDF</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(a)}
                              className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-blue-500/10 hover:text-blue-400 text-[#8B7B68] transition-colors"
                              title="Edit Article"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingArticle(a)}
                              className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-red-500/10 hover:text-[#DC2626] text-[#8B7B68] transition-colors"
                              title="Delete Article"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-[#E9DFCF] text-[13px] text-[#8B7B68]">
              Showing {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}.
              Staff view includes draft and withdrawn articles.
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Drawer ── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-xl bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer header */}
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[13px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                    Article {editingArticle ? 'Update' : 'Creation'}
                  </span>
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    {editingArticle ? `Editing: ${editingArticle.title.slice(0, 50)}…` : 'Add New Journal Article'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {/* Alerts */}
                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[#DC2626] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
                {formSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {/* Journal + Issue */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Journal *</label>
                    <select
                      required
                      value={formData.journal}
                      onChange={(e) => {
                        setFormData({ ...formData, journal: e.target.value, issue: '' });
                        setFormVolume('');
                        setFormIssueNum('');
                      }}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      <option value="">Select journal…</option>
                      {journals.map((j) => <option key={j.id} value={String(j.id)}>{j.title}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Volume &amp; Issue</label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={formVolume}
                        onChange={(e) => handleVolumeChange(e.target.value)}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                      >
                        <option value="">No specific issue</option>
                        {formVolumeOptions.volumes.map((v) => (
                          <option key={v} value={v}>
                            Volume {v}
                          </option>
                        ))}
                        {formVolumeOptions.hasUnnumbered && (
                          <option value="unnumbered">Un-numbered issues</option>
                        )}
                      </select>
                      <select
                        value={formIssueNum}
                        onChange={(e) => handleIssueNumChange(e.target.value)}
                        disabled={!formVolume}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Select issue…</option>
                        {formVolumeIssues.map((i) => (
                          <option key={i.id} value={String(i.id)}>
                            {i.issue_number != null
                              ? `Issue ${i.issue_number}`
                              : i.title || i.public_id || 'Unnumbered issue'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Article Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deep Learning Approaches in Medical Image Segmentation"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                {/* Slug */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">
                    Slug <span className="text-[13px] font-normal">(auto-generated if left blank)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="deep-learning-medical-image-segmentation"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                {/* Abstract */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Abstract</label>
                  <textarea
                    rows={4}
                    placeholder="Provide the full article abstract as it will appear to readers…"
                    value={formData.abstract}
                    onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] leading-relaxed resize-none"
                  />
                </div>

                {/* Article Price */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Individual Article Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Leave empty for no individual purchase option"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                {/* Authors + Institution */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">
                      Author Names <span className="text-[13px] font-normal">(comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Dr. A. Sharma, Dr. B. Patel"
                      value={formData.author_names_raw}
                      onChange={(e) => setFormData({ ...formData, author_names_raw: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Lead Institution</label>
                    <input
                      type="text"
                      placeholder="IIT Madras / University of Oxford"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                {/* DOI + Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">DOI</label>
                    <input
                      type="text"
                      placeholder="10.1000/xyz.2026.001"
                      value={formData.doi}
                      onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Publication Date</label>
                    <input
                      type="date"
                      value={formData.publication_date}
                      onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                {/* Page Range */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Page Range</label>
                  <input
                    type="text"
                    placeholder="pp. 45–60"
                    value={formData.page_range}
                    onChange={(e) => setFormData({ ...formData, page_range: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                {/* Status + Access Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Publication Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      <option value="published">Published</option>
                      <option value="draft">Draft</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Access Mode</label>
                    <select
                      value={formData.access_mode}
                      onChange={(e) => setFormData({ ...formData, access_mode: e.target.value as any })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      <option value="paid">Paid Access</option>
                      <option value="open_access">Open Access</option>
                    </select>
                  </div>
                </div>

                {/* PDF Upload */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Article PDF</label>
                  <div className="border-2 border-dashed border-[#E9DFCF] hover:border-[#C9A66B] rounded-xl p-4 transition-colors">
                    <input
                      type="file"
                      accept="application/pdf"
                      id="article-pdf-upload"
                      className="hidden"
                      onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    />
                    <label htmlFor="article-pdf-upload" className="cursor-pointer flex flex-col items-center gap-2 text-center">
                      <Upload className="w-5 h-5 text-[#C9A66B]" />
                      {pdfFile ? (
                        <span className="text-[#5C4B3A] font-semibold text-[13px]">
                          Selected: {pdfFile.name} ({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      ) : editingArticle?.file_pdf ? (
                        <span className="text-emerald-400 font-semibold text-[13px]">
                          PDF on file — click to replace
                        </span>
                      ) : (
                        <span className="text-[#8B7B68] text-[13px]">
                          Click to upload PDF. Max 50 MB. Leave blank to keep existing.
                        </span>
                      )}
                    </label>
                  </div>
                  <p className="text-[13px] text-[#8B7B68]">
                    PDF is stored in Django protected storage (<code>journals/articles/pdf/</code>).
                    The raw file URL is never exposed publicly; access goes through the
                    <code>/api/publications/articles/&#123;id&#125;/pdf/</code> endpoint.
                  </p>
                </div>

                {/* Submit */}
                <div className="pt-2 flex items-center gap-3">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={formSubmitting}
                    className="flex-1"
                  >
                    {editingArticle ? 'Save Changes' : 'Publish Article'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
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

      {/* ── Delete Confirmation ── */}
      <AnimatePresence>
        {deletingArticle && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleteLoading && setDeletingArticle(null)}
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
                    <Trash2 className="w-5 h-5 text-[#DC2626]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#5C4B3A] font-playfair">Delete Article?</h3>
                    <p className="text-xs text-[#8B7B68] mt-0.5">This action cannot be undone.</p>
                  </div>
                </div>
                <p className="text-xs text-[#8B7B68] bg-[#FFF8EE] rounded-xl p-3 border border-[#E9DFCF] line-clamp-3">
                  {deletingArticle.title}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={deleteLoading}
                    className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-bold hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {deleteLoading ? 'Deleting…' : 'Yes, Delete Article'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingArticle(null)}
                    disabled={deleteLoading}
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
    </AdminLayout>
  );
}
