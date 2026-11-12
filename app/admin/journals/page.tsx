'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper,
  Search,
  PlusCircle,
  Eye,
  Edit,
  Trash2,
  RefreshCw,
  Tag,
  Star,
  X,
  Upload,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Globe,
  Download,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { validateIssn, validatePrice } from '@/lib/validation';
import {
  AdminJournal,
  AdminIssue,
  AdminArticle,
  Category,
  fetchAdminJournals,
  fetchAdminIssues,
  fetchAdminArticles,
  fetchCategories,
  createAdminJournal,
  updateAdminJournal,
  deleteAdminJournal,
  createAdminIssue,
  updateAdminIssue,
  deleteAdminIssue,
  clearAdminIssueDigitalFile,
} from '@/lib/services/cms';
import { downloadIssuePdf, openIssuePdf } from '@/lib/services/journals';
import { searchableRefs } from '@/lib/utils/publicId';

type ActiveTab = 'journals' | 'issues' | 'articles';
type FetchState = 'idle' | 'loading' | 'success' | 'error';

// Extract the volume number for an issue: DB field first, then a "Volume N"/"Vol N"
// token parsed from the title (older records store the number only in the title).
function getIssueVolumeNumber(iss: AdminIssue): string {
  if (iss.volume_number != null && !isNaN(Number(iss.volume_number))) {
    return String(iss.volume_number);
  }
  const m = iss.title?.match(/vol(?:ume)?\s*(\d+)/i);
  return m ? String(parseInt(m[1], 10)) : '';
}

// Same idea for the issue number: DB field first, then an "Issue N"/"No N" token in
// the title, falling back to a trailing standalone number.
function getIssueNumber(iss: AdminIssue): string {
  if (iss.issue_number != null && !isNaN(Number(iss.issue_number))) {
    return String(iss.issue_number);
  }
  const m = iss.title?.match(/(?:issue|no\.?)\s*(\d+)/i);
  return m ? String(parseInt(m[1], 10)) : '';
}

export default function AdminJournalsPage() {
  const { tokens } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('journals');

  const [journals, setJournals] = useState<AdminJournal[]>([]);
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Journal Modal State
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<AdminJournal | null>(null);
  const [journalFormSubmitting, setJournalFormSubmitting] = useState(false);
  const [journalFormError, setJournalFormError] = useState<string | null>(null);
  const [journalFormSuccess, setJournalFormSuccess] = useState<string | null>(null);

  const [journalData, setJournalData] = useState({
    title: '',
    slug: '',
    issn: '',
    impact_factor: '3.50',
    aims_text: '',
    category_id: '',
    description: '',
    subscription_price_annual: '',
    indexed_in: 'Crossref, Google Scholar, DOAJ, Scopus',
    frequency: 'Quarterly',
    access_type: 'Open Access',
    is_featured: false,
  });

  // Key Research Topics Covered as separate input boxes
  const [scopeTopics, setScopeTopics] = useState<string[]>(['']);
  const addScopeTopic = () => setScopeTopics((prev) => [...prev, '']);
  const removeScopeTopic = (idx: number) => setScopeTopics((prev) => prev.filter((_, i) => i !== idx));
  const updateScopeTopic = (idx: number, value: string) =>
    setScopeTopics((prev) => prev.map((t, i) => (i === idx ? value : t)));

  // Indexed-in databases as separate add-style inputs (with a + icon)
  const [indexedInItems, setIndexedInItems] = useState<string[]>(['Crossref', 'Google Scholar', 'DOAJ', 'Scopus']);
  const addIndexedIn = () => setIndexedInItems((prev) => [...prev, '']);
  const removeIndexedIn = (idx: number) => setIndexedInItems((prev) => prev.filter((_, i) => i !== idx));
  const updateIndexedIn = (idx: number, value: string) =>
    setIndexedInItems((prev) => prev.map((t, i) => (i === idx ? value : t)));

  // Editorial Board as structured rows — each member has separate fields
  const emptyMember = () => ({ name: '', role: '', institution: '', country: '', specialization: '' });
  const [boardMembers, setBoardMembers] = useState<Array<{ name: string; role: string; institution: string; country: string; specialization: string }>>([emptyMember()]);

  const addBoardMember = () => setBoardMembers((prev) => [...prev, emptyMember()]);
  const removeBoardMember = (idx: number) => setBoardMembers((prev) => prev.filter((_, i) => i !== idx));
  const updateBoardMember = (idx: number, field: string, value: string) =>
    setBoardMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));

  const [journalCoverFile, setJournalCoverFile] = useState<File | null>(null);

  // Issue Modal State
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [editingIssue, setEditingIssue] = useState<AdminIssue | null>(null);
  const [issueFormSubmitting, setIssueFormSubmitting] = useState(false);
  const [issueFormError, setIssueFormError] = useState<string | null>(null);
  const [issueFormSuccess, setIssueFormSuccess] = useState<string | null>(null);

  const [issueData, setIssueData] = useState({
    journal: '',
    title: '',
    publication_date: '',
    price: '',
    stock: '100',
  });
  const [issueCoverFile, setIssueCoverFile] = useState<File | null>(null);
  const [issueDigitalFile, setIssueDigitalFile] = useState<File | null>(null);
  const [issuePdfBusy, setIssuePdfBusy] = useState(false);

  // Volume and Issue number fields — stored separately so auto-suggest works cleanly
  const [issueVolumeNumber, setIssueVolumeNumber] = useState<string>('');
  const [issueIssueNumber, setIssueIssueNumber] = useState<string>('');
  // Whether the admin has manually edited the volume field (prevents overwriting on re-render)
  const [volumeManuallyEdited, setVolumeManuallyEdited] = useState(false);

  // Dropdown format for volume/issue numbers: existing numbers listed, new ones via + Add box
  const [newVolumeInput, setNewVolumeInput] = useState('');
  const [newIssueInput, setNewIssueInput] = useState('');
  const [extraVolumeOptions, setExtraVolumeOptions] = useState<string[]>([]);
  const [extraIssueOptions, setExtraIssueOptions] = useState<string[]>([]);

  // Delete Confirmations
  const [deletingJournal, setDeletingJournal] = useState<AdminJournal | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<AdminIssue | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Bulk selection on the Volumes and Issues table (select multiple → delete at once)
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Load Real Backend Data
  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const [cats, journalsData, issuesData, articlesData] = await Promise.all([
        fetchCategories(tokens.access).catch(() => []),
        fetchAdminJournals(tokens.access),
        fetchAdminIssues(tokens.access).catch(() => []),
        fetchAdminArticles(tokens.access).catch(() => [] as AdminArticle[]),
      ]);

      setCategories(cats);
      setJournals(journalsData);
      setIssues(issuesData);
      setArticles(articlesData);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load journals and issues.');
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Compute the next suggested volume number for a given journal.
   * Uses volume_number DB field when available; falls back to title-string parsing.
   * Returns max existing volume + 1, or 1 if no issues exist.
   */
  const computeSuggestedVolume = useCallback(
    (journalId: string): number => {
      const jId = String(journalId);
      const journalIssues = issues.filter((iss) => {
        const issJournalId =
          typeof iss.journal === 'object' ? String(iss.journal.id) : String(iss.journal);
        return issJournalId === jId;
      });

      if (journalIssues.length === 0) return 1;

      let maxVol = 0;
      journalIssues.forEach((iss) => {
        let vol: number | null = null;
        if (iss.volume_number != null) {
          vol = Number(iss.volume_number);
        } else if (iss.title) {
          const m = iss.title.match(/vol(?:ume)?\s*(\d+)/i);
          if (m) vol = parseInt(m[1], 10);
        }
        if (vol !== null && !isNaN(vol) && vol > maxVol) maxVol = vol;
      });

      return maxVol + 1;
    },
    [issues]
  );

  // Issues belonging to the journal currently selected in the issue drawer
  const selectedJournalIssues = useMemo(() => {
    const jId = String(issueData.journal);
    if (!jId) return [];
    return issues.filter((iss) => {
      const issJournalId =
        typeof iss.journal === 'object' ? String(iss.journal.id) : String(iss.journal);
      return issJournalId === jId;
    });
  }, [issues, issueData.journal]);

  // Volume dropdown lists ONLY volumes that actually exist for this journal, plus any
  // the admin explicitly created via “+ Add”, plus the current selection. New volumes
  // are never fabricated automatically — opening the picker just shows the real ones.
  const volumeNumberOptions = useMemo(() => {
    const nums = new Set<string>();
    selectedJournalIssues.forEach((iss) => {
      const vol = getIssueVolumeNumber(iss);
      if (vol) nums.add(vol);
    });
    extraVolumeOptions.forEach((v) => nums.add(v));
    if (issueVolumeNumber) nums.add(issueVolumeNumber);
    return Array.from(nums).sort((a, b) => Number(a) - Number(b));
  }, [selectedJournalIssues, extraVolumeOptions, issueVolumeNumber]);

  // Issue numbers scoped strictly to the selected volume (no fallback to all).
  const issueNumberOptions = useMemo(() => {
    const nums = new Set<string>();
    const volKey = issueVolumeNumber !== '' ? String(issueVolumeNumber) : '';
    if (volKey !== '') {
      selectedJournalIssues.forEach((iss) => {
        if (getIssueVolumeNumber(iss) !== volKey) return;
        const issNum = getIssueNumber(iss);
        if (issNum) nums.add(issNum);
      });
    }
    extraIssueOptions.forEach((v) => nums.add(v));
    if (issueIssueNumber) nums.add(issueIssueNumber);
    return Array.from(nums).sort((a, b) => Number(a) - Number(b));
  }, [selectedJournalIssues, extraIssueOptions, issueVolumeNumber, issueIssueNumber]);

  const handleAddVolumeNumber = () => {
    const v = newVolumeInput.trim();
    if (!v || isNaN(Number(v)) || Number(v) < 1) return;
    setExtraVolumeOptions((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setIssueVolumeNumber(v);
    setVolumeManuallyEdited(true);
    setNewVolumeInput('');
  };

  const handleAddIssueNumber = () => {
    if (issueVolumeNumber === '') return; // volume must be chosen first
    const v = newIssueInput.trim();
    if (!v || isNaN(Number(v)) || Number(v) < 1) return;
    setExtraIssueOptions((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setIssueIssueNumber(v);
    setNewIssueInput('');
  };

  // Open Journal Form
  const handleOpenJournalCreate = () => {
    setEditingJournal(null);
    setJournalData({
      title: '',
      slug: '',
      issn: '',
      impact_factor: '3.50',
      aims_text: '',
      category_id: categories[0] ? String(categories[0].id) : '',
      description: '',
      subscription_price_annual: '',
      indexed_in: 'Crossref, Google Scholar, DOAJ, Scopus',
      frequency: 'Quarterly',
      access_type: 'Open Access',
      is_featured: false,
    });
    setScopeTopics(['']);
    setIndexedInItems(['Crossref', 'Google Scholar', 'DOAJ', 'Scopus']);
    setBoardMembers([emptyMember()]);
    setJournalCoverFile(null);
    setJournalFormError(null);
    setJournalFormSuccess(null);
    setIsJournalModalOpen(true);
  };

  const handleOpenJournalEdit = (journal: AdminJournal) => {
    setEditingJournal(journal);
    const catId = typeof journal.category === 'object' && journal.category
      ? String(journal.category.id)
      : journal.category_id
      ? String(journal.category_id)
      : categories[0]
      ? String(categories[0].id)
      : '';

    // Aims & Scope and the Editorial Board are now real Journal columns
    // (SECURITY-QA-REPORT L-5), so the edit form reads them straight off the
    // API row instead of a browser-only `mmsr_journal_override_*` copy.

    // Populate editorial board rows from the backend
    const savedBoard: any[] = (journal as any).editorialBoard
      || (journal as any).editorial_board
      || [];
    if (savedBoard.length > 0) {
      setBoardMembers(savedBoard.map((m: any) => ({
        name: m.name || '',
        role: m.role || '',
        institution: m.institution || '',
        country: m.country || '',
        specialization: Array.isArray(m.researchAreas)
          ? m.researchAreas.join(', ')
          : (Array.isArray(m.research_areas) ? m.research_areas.join(', ') : (m.specialization || '')),
      })));
    } else {
      setBoardMembers([emptyMember()]);
    }

    // Resolve aims_text
    const aimsValue = (journal as any).aims_scope || (journal as any).aims || '';

    // Resolve scopeTopics
    let savedScope: string[] = [];
    if (Array.isArray((journal as any).scope_topics) && (journal as any).scope_topics.length > 0) {
      savedScope = (journal as any).scope_topics.map((s: any) => String(s));
    } else if (typeof (journal as any).scope_topics === 'string' && (journal as any).scope_topics.trim()) {
      savedScope = (journal as any).scope_topics.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
    }

    setJournalData({
      title: journal.title || '',
      slug: journal.slug || '',
      issn: journal.issn || '',
      impact_factor: (journal as any).impact_factor || '',
      aims_text: aimsValue,
      category_id: catId,
      description: journal.description || '',
      subscription_price_annual: journal.subscription_price_annual !== undefined ? String(journal.subscription_price_annual) : '',
      indexed_in: journal.indexed_in || 'Crossref, Google Scholar, DOAJ, Scopus',
      frequency: journal.frequency || 'Quarterly',
      access_type: journal.access_type || 'Open Access',
      is_featured: Boolean(journal.is_featured),
    });

    // Seed the add-style Indexed In rows from the saved comma-separated value.
    const savedIndexed = typeof journal.indexed_in === 'string' && journal.indexed_in.trim()
      ? journal.indexed_in.split(',').map((s: string) => s.trim()).filter(Boolean)
      : [];
    setIndexedInItems(savedIndexed.length > 0 ? savedIndexed : ['']);

    if (savedScope.length > 0) {
      setScopeTopics(savedScope);
    } else {
      setScopeTopics(['']);
    }

    setJournalCoverFile(null);
    setJournalFormError(null);
    setJournalFormSuccess(null);
    setIsJournalModalOpen(true);
  };

  // Submit Journal Form
  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access) return;

    if (!journalData.title.trim()) {
      setJournalFormError('Journal title is required.');
      return;
    }

    // Mirror the backend JournalSerializer rules (ISSN checksum + bounded
    // subscription price) so invalid values are blocked before the request.
    const issnErr = validateIssn(journalData.issn);
    if (issnErr) { setJournalFormError(issnErr); return; }
    const subPriceErr = validatePrice(journalData.subscription_price_annual, 'Subscription price', { required: false });
    if (subPriceErr) { setJournalFormError(subPriceErr); return; }

    setJournalFormSubmitting(true);
    setJournalFormError(null);
    setJournalFormSuccess(null);

    try {
      const fd = new FormData();
      fd.append('title', journalData.title.trim());

      const slugVal = journalData.slug.trim() || journalData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      fd.append('slug', slugVal);

      if (journalData.issn.trim()) fd.append('issn', journalData.issn.trim());
      // Sent unconditionally so an operator can clear a value; the serializer
      // accepts blanks for both.
      fd.append('impact_factor', journalData.impact_factor.trim());
      fd.append('aims_scope', journalData.aims_text.trim());
      if (journalData.category_id) fd.append('category_id', journalData.category_id);
      if (journalData.description.trim()) fd.append('description', journalData.description.trim());
      if (journalData.subscription_price_annual) fd.append('subscription_price_annual', journalData.subscription_price_annual);
      if (journalData.frequency.trim()) fd.append('frequency', journalData.frequency.trim());
      if (journalData.access_type.trim()) fd.append('access_type', journalData.access_type.trim());
      // Total Volumes / Total Issues are auto-computed from real issue data — no longer submitted here.
      const indexedVal = indexedInItems.map((s) => s.trim()).filter(Boolean).join(', ');
      if (indexedVal) fd.append('indexed_in', indexedVal);
      fd.append('is_featured', journalData.is_featured ? 'true' : 'false');

      if (journalCoverFile) {
        fd.append('cover_image', journalCoverFile);
      }

      // Build editorial board from structured rows — snake_case, because these
      // are stored exactly as received in the Journal.editorial_board column.
      const parsedBoard = boardMembers
        .filter((m) => m.name.trim())
        .map((m) => ({
          name: m.name.trim(),
          role: m.role.trim() || 'Editorial Board Member',
          institution: m.institution.trim() || 'MMSR Advisory Council',
          country: m.country.trim() || 'International',
          research_areas: m.specialization ? m.specialization.split(',').map((s) => s.trim()).filter(Boolean) : ['Academic Research'],
        }));

      // Filter non-empty scope topics
      const scopeArr = scopeTopics.map((t) => t.trim()).filter(Boolean);

      // The cover upload means this request is multipart/form-data, where a
      // nested list can only travel as text; publications.serializers.FormJSONField
      // decodes it back into the JSON column.
      fd.append('scope_topics', JSON.stringify(scopeArr));
      fd.append('editorial_board', JSON.stringify(parsedBoard));

      if (editingJournal) {
        await updateAdminJournal(tokens.access, editingJournal.slug || String(editingJournal.id), fd);
        setJournalFormSuccess('Journal updated successfully!');
      } else {
        await createAdminJournal(tokens.access, fd);
        setJournalFormSuccess('Journal created successfully!');
      }

      await loadData();
      setTimeout(() => setIsJournalModalOpen(false), 1000);
    } catch (err: any) {
      // Nothing is mirrored into localStorage any more: a rejected journal form
      // stays open with the server's message, and the list keeps showing the
      // row that is actually in the database (SECURITY-QA-REPORT L-5).
      setJournalFormError(err?.message || 'Failed to save journal. Nothing was published.');
    } finally {
      setJournalFormSubmitting(false);
    }
  };

  // Open Issue Form
  const handleOpenIssueCreate = (preselectedJournalId?: number) => {
    setEditingIssue(null);
    const jId = preselectedJournalId
      ? String(preselectedJournalId)
      : journals[0]
      ? String(journals[0].id)
      : '';

    setIssueData({
      journal: jId,
      title: '',
      publication_date: new Date().toISOString().split('T')[0],
      price: '',
      stock: '100',
    });

    // Start with no volume selected so the issue picker stays frozen until the
    // admin explicitly chooses a volume.
    setIssueVolumeNumber('');
    setIssueIssueNumber('');
    setVolumeManuallyEdited(false);
    setNewVolumeInput('');
    setNewIssueInput('');
    setExtraVolumeOptions([]);
    setExtraIssueOptions([]);

    setIssueCoverFile(null);
    setIssueDigitalFile(null);
    setIssueFormError(null);
    setIssueFormSuccess(null);
    setIsIssueModalOpen(true);
  };

  const handleOpenIssueEdit = (issue: AdminIssue) => {
    setEditingIssue(issue);
    const jId = typeof issue.journal === 'object' ? String(issue.journal.id) : String(issue.journal || '');

    setIssueData({
      journal: jId,
      title: issue.title || '',
      publication_date: issue.publication_date || '',
      price: issue.price !== undefined ? String(issue.price) : '',
      stock: issue.stock !== undefined ? String(issue.stock) : '100',
    });

    // Populate volume/issue from existing DB record, falling back to title parsing
    let existingVol = issue.volume_number != null ? String(issue.volume_number) : '';
    let existingIss = issue.issue_number != null ? String(issue.issue_number) : '';
    if (!existingVol && issue.title) {
      const m = issue.title.match(/vol(?:ume)?\s*(\d+)/i);
      if (m) existingVol = m[1];
    }
    if (!existingIss && issue.title) {
      const m = issue.title.match(/issue\s*(\d+)/i);
      if (m) existingIss = m[1];
    }
    setIssueVolumeNumber(existingVol || '1');
    setIssueIssueNumber(existingIss || '1');
    setVolumeManuallyEdited(true); // editing mode — don't override
    setNewVolumeInput('');
    setNewIssueInput('');
    setExtraVolumeOptions([]);
    setExtraIssueOptions([]);

    setIssueCoverFile(null);
    setIssueDigitalFile(null);
    setIssueFormError(null);
    setIssueFormSuccess(null);
    setIsIssueModalOpen(true);
  };

  // Complete Issue PDF actions (operate on the persisted backend record)
  const handleAdminViewIssuePdf = async () => {
    if (!editingIssue || !tokens?.access) return;
    setIssueFormError(null);
    setIssuePdfBusy(true);
    const res = await openIssuePdf(String(editingIssue.id), tokens.access);
    setIssuePdfBusy(false);
    if (res.error) setIssueFormError(res.error);
  };

  const handleAdminDownloadIssuePdf = async () => {
    if (!editingIssue || !tokens?.access) return;
    setIssueFormError(null);
    setIssuePdfBusy(true);
    const res = await downloadIssuePdf(String(editingIssue.id), tokens.access);
    setIssuePdfBusy(false);
    if (res.error) {
      setIssueFormError(res.error);
    } else if (res.blob) {
      const url = window.URL.createObjectURL(res.blob);
      const a = document.createElement('a');
      a.href = url;
      // Fall back to the issue's standardized reference — never its key.
      a.download = res.filename || `issue_${editingIssue.public_id || 'unassigned'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleRemoveIssuePdf = async () => {
    if (!editingIssue || !tokens?.access) return;
    if (!window.confirm('Remove the saved complete issue PDF from this issue? Individual article PDFs are not affected.')) return;
    setIssueFormError(null);
    setIssueFormSuccess(null);
    setIssuePdfBusy(true);
    try {
      await clearAdminIssueDigitalFile(tokens.access, editingIssue.id);
      await loadData();
      setEditingIssue({
        ...editingIssue,
        file_digital: null,
        file_digital_url: null,
        file_digital_name: null,
        has_file_digital: false,
      });
      setIssueFormSuccess('Complete issue PDF removed.');
    } catch (err: any) {
      setIssueFormError(err?.message || 'Failed to remove the issue PDF.');
    } finally {
      setIssuePdfBusy(false);
    }
  };

  // Navigate to the Articles CMS with this issue pre-selected so the admin can add articles to it
  const goToArticlesForIssue = (issue: AdminIssue) => {
    const jId = typeof issue.journal === 'object' ? issue.journal.id : issue.journal;
    const params = new URLSearchParams({ issue: String(issue.id), new: '1' });
    if (jId) params.set('journal', String(jId));
    router.push(`/admin/journals/articles?${params.toString()}`);
  };

  // Submit Issue Form
  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access) return;

    if (!issueData.journal) {
      setIssueFormError('Associated journal selection is required.');
      return;
    }

    const volNum = parseInt(issueVolumeNumber, 10);
    const issNum = parseInt(issueIssueNumber, 10);
    if (isNaN(volNum) || volNum < 1) {
      setIssueFormError('Volume number must be a positive integer (e.g. 1, 2, 3).');
      return;
    }
    if (isNaN(issNum) || issNum < 1) {
      setIssueFormError('Issue number must be a positive integer (e.g. 1, 2, 3).');
      return;
    }

    // Client-side duplicate guard: (journal, volume, issue) must be unique on the server.
    const duplicate = selectedJournalIssues.find((iss) => {
      if (editingIssue && iss.id === editingIssue.id) return false;
      return getIssueVolumeNumber(iss) === String(volNum) && getIssueNumber(iss) === String(issNum);
    });
    if (duplicate) {
      setIssueFormError(
        `Issue ${issNum} already exists in Volume ${volNum} for this journal. Please choose a different volume or issue number, or edit the existing issue.`
      );
      return;
    }

    setIssueFormSubmitting(true);
    setIssueFormError(null);
    setIssueFormSuccess(null);

    try {
      const fd = new FormData();
      fd.append('journal', issueData.journal);
      // No separate issue name is required — derive the title from the volume/issue numbers.
      fd.append('title', `Volume ${volNum} Issue ${issNum}`);
      fd.append('volume_number', String(volNum));
      fd.append('issue_number', String(issNum));

      if (issueData.publication_date) fd.append('publication_date', issueData.publication_date);
      if (issueData.price) fd.append('price', issueData.price);
      if (issueData.stock) fd.append('stock', issueData.stock);

      if (issueCoverFile) fd.append('cover_image', issueCoverFile);
      if (issueDigitalFile) fd.append('file_digital', issueDigitalFile);

      if (editingIssue) {
        await updateAdminIssue(tokens.access, editingIssue.id, fd);
        setIssueFormSuccess('Journal issue updated successfully!');
      } else {
        await createAdminIssue(tokens.access, fd);
        setIssueFormSuccess('Journal issue created successfully!');
      }

      await loadData();
      setTimeout(() => setIsIssueModalOpen(false), 1000);
    } catch (err: any) {
      const raw = String(err?.message || '');
      // Django returns a raw unique_together message naming DB fields; translate it into
      // plain language the admin can act on.
      if (/must make a unique set/i.test(raw) || (/unique/i.test(raw) && /volume/i.test(raw))) {
        setIssueFormError(
          `Issue ${issNum} already exists in Volume ${volNum} for this journal. Please choose a different volume or issue number, or edit the existing issue.`
        );
      } else {
        setIssueFormError(raw || 'Failed to save issue.');
      }
    } finally {
      setIssueFormSubmitting(false);
    }
  };

  // Delete Confirmations
  const handleDeleteJournalConfirm = async () => {
    if (!deletingJournal || !tokens?.access) return;
    setDeleteLoading(true);
    try {
      await deleteAdminJournal(tokens.access, deletingJournal.slug);
      setDeletingJournal(null);
      await loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteIssueConfirm = async () => {
    if (!deletingIssue || !tokens?.access) return;
    setDeleteLoading(true);
    try {
      await deleteAdminIssue(tokens.access, deletingIssue.id);
      setDeletingIssue(null);
      await loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered Items Computation
  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const tMatch = (j.title || '').toLowerCase().includes(q);
        const issnMatch = (j.issn || '').toLowerCase().includes(q);
        if (!tMatch && !issnMatch) return false;
      }
      return true;
    });
  }, [journals, searchQuery]);

  // Resolve a journal id (or embedded object) to its full title using the loaded catalog.
  const journalTitleMap = useMemo(() => {
    const m = new Map<number, string>();
    journals.forEach((j) => m.set(Number(j.id), j.title));
    return m;
  }, [journals]);

  const getJournalIdOfIssue = (iss: AdminIssue): number =>
    typeof iss.journal === 'object' && iss.journal ? Number(iss.journal.id) : Number(iss.journal);

  const resolveJournalTitle = (iss: AdminIssue): string => {
    if (typeof iss.journal === 'object' && iss.journal) return iss.journal.title;
    return journalTitleMap.get(Number(iss.journal)) || 'Journal not listed';
  };

  const filteredIssues = useMemo(() => {
    // Order journals by their position in the catalog so issues are grouped per journal.
    const journalOrder = new Map<number, number>();
    journals.forEach((j, idx) => journalOrder.set(Number(j.id), idx));

    const q = searchQuery.toLowerCase().trim();
    const list = issues.filter((iss) => {
      if (!q) return true;
      const tMatch = (iss.title || '').toLowerCase().includes(q);
      const jTitle = resolveJournalTitle(iss).toLowerCase();
      return tMatch || jTitle.includes(q) || searchableRefs(iss.public_id).includes(q);
    });

    // Group by journal (catalog order), then newest volume/issue first within each journal.
    return [...list].sort((a, b) => {
      const oa = journalOrder.get(getJournalIdOfIssue(a)) ?? Number.MAX_SAFE_INTEGER;
      const ob = journalOrder.get(getJournalIdOfIssue(b)) ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      const va = a.volume_number ?? 0;
      const vb = b.volume_number ?? 0;
      if (va !== vb) return vb - va;
      const ia = a.issue_number ?? 0;
      const ib = b.issue_number ?? 0;
      return ib - ia;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, journals, searchQuery, journalTitleMap]);

  // ── Bulk issue selection helpers ──
  const toggleIssueSelected = (id: number) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleIssuesSelected =
    filteredIssues.length > 0 && filteredIssues.every((iss) => selectedIssueIds.has(Number(iss.id)));

  const toggleSelectAllIssues = () => {
    setSelectedIssueIds(allVisibleIssuesSelected ? new Set() : new Set(filteredIssues.map((iss) => Number(iss.id))));
  };

  const handleBulkDeleteIssues = async () => {
    if (!tokens?.access || selectedIssueIds.size === 0) return;
    setDeleteLoading(true);
    const ids = Array.from(selectedIssueIds);
    try {
      for (const id of ids) {
        await deleteAdminIssue(tokens.access, id);
      }
      setSelectedIssueIds(new Set());
      setBulkDeleteOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Bulk delete failed: ${err?.message}`);
      await loadData();
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Article helpers (journal + issue detail resolution) ──
  const getArticleJournalId = (a: AdminArticle): number =>
    typeof a.journal === 'object' && a.journal ? Number(a.journal.id) : Number(a.journal);

  const articleJournalTitle = (a: AdminArticle): string => {
    if (typeof a.journal === 'object' && a.journal) return a.journal.title;
    return journalTitleMap.get(Number(a.journal)) || 'Journal not listed';
  };

  const articleIssueLabel = (a: AdminArticle): string | null => {
    const id =
      typeof a.issue === 'object' && a.issue
        ? Number(a.issue.id)
        : a.issue
        ? Number(a.issue)
        : null;
    if (!id) return null;
    const iss = issues.find((i) => Number(i.id) === id);
    if (iss) {
      // Numbers only — no issue titles (matches the Vol./Issue format used across the CMS)
      if (iss.volume_number != null || iss.issue_number != null) {
        return `Vol. ${iss.volume_number ?? '\u2014'} / Issue ${iss.issue_number ?? '\u2014'}`;
      }
      // Unnumbered issue: its MMSR public ID is the only displayable reference
      // (the internal key is never quoted — spec §11).
      return iss.public_id || iss.title || 'Unnumbered issue';
    }
    // Issue is not in the loaded set: fall back to whatever label the article
    // row carries rather than printing its foreign-key number.
    if (a.issue && typeof a.issue === 'object' && a.issue.title) return a.issue.title;
    return 'Issue not listed';
  };

  const filteredArticles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const list = articles.filter((a) => {
      if (!q) return true;
      return (
        (a.title || '').toLowerCase().includes(q) ||
        articleJournalTitle(a).toLowerCase().includes(q) ||
        (a.doi || '').toLowerCase().includes(q) ||
        searchableRefs(a.public_id).includes(q)
      );
    });
    const journalOrder = new Map<number, number>();
    journals.forEach((j, idx) => journalOrder.set(Number(j.id), idx));
    return [...list].sort((a, b) => {
      const oa = journalOrder.get(getArticleJournalId(a)) ?? Number.MAX_SAFE_INTEGER;
      const ob = journalOrder.get(getArticleJournalId(b)) ?? Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articles, journals, searchQuery, journalTitleMap, issues]);

  return (
    <AdminLayout
      title="Journals & Serial Issues CMS"
    >
      {/* Search & Actions Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search journals by title, ISSN number, volume/issue or article DOI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E9DFCF] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B] transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              isLoading={fetchState === 'loading'}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh Data
            </Button>

            <button
              type="button"
              onClick={handleOpenJournalCreate}
              className="px-4 py-2 rounded-xl bg-[#C9A66B] text-white font-bold text-xs shadow-sm hover:opacity-95 transition-opacity flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Journal</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenIssueCreate()}
              className="px-4 py-2 rounded-xl bg-[#FFF2D9] border border-[#E9DFCF] hover:bg-[#FFF2D9] text-[#C9A66B] font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <Layers className="w-4 h-4" />
              <span>Add Journal Issue</span>
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-3 border-b border-[#E9DFCF] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('journals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'journals'
                ? 'bg-[#C9A66B] text-white shadow-sm'
                : 'text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE]'
            }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>Journals Catalog ({journals.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('issues')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'issues'
                ? 'bg-[#C9A66B] text-white shadow-sm'
                : 'text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Volumes and Issues</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('articles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'articles'
                ? 'bg-[#C9A66B] text-white shadow-sm'
                : 'text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Articles ({articles.length})</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {fetchState === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#8B7B68]">Connecting to Django REST API...</p>
        </div>
      )}

      {/* Error State */}
      {fetchState === 'error' && (
        <div className="p-6 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <p className="text-sm font-semibold text-[#5C4B3A]">Backend Fetch Failed</p>
          <p className="text-xs text-[#8B7B68]">{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadData}>
            Retry Request
          </Button>
        </div>
      )}

      {/* TAB 1: JOURNALS TABLE */}
      {fetchState === 'success' && activeTab === 'journals' && (
        <>
          {filteredJournals.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
              <Newspaper className="w-8 h-8 text-[#C9A66B] mx-auto" />
              <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Journals Found</p>
              <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
                {searchQuery ? 'No journals match your active search.' : 'Use "Create Journal" to publish a new journal title.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                      <th className="py-3 px-4 font-bold">Title</th>
                      <th className="py-3 px-4 font-bold">Slug</th>
                      <th className="py-3 px-4 font-bold">ISSN</th>
                      <th className="py-3 px-4 font-bold">Annual Price</th>
                      <th className="py-3 px-4 font-bold">Issues Count</th>
                      <th className="py-3 px-4 font-bold">Featured</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredJournals.map((j) => {
                      const priceStr = j.subscription_price_annual ? `₹${j.subscription_price_annual}` : '₹0.00';
                      const issueCount = j.issues?.length || issues.filter((is) => (typeof is.journal === 'object' ? is.journal.id : is.journal) === j.id).length;

                      return (
                        <tr key={j.id} className="hover:bg-[#FFF8EE] transition-colors">
                          <td className="py-3 px-4 font-bold text-[#5C4B3A] font-playfair line-clamp-1">{j.title}</td>

                          <td className="py-3 px-4 text-[13px] text-[#8B7B68] font-mono">{j.slug}</td>

                          <td className="py-3 px-4 font-mono text-[#C9A66B] text-[13px]">{j.issn || 'ISSN N/A'}</td>

                          <td className="py-3 px-4 font-bold text-[#5C4B3A]">{priceStr}</td>

                          <td className="py-3 px-4 text-[#8B7B68]">
                            <span className="inline-flex items-center gap-1 bg-[#FFF8EE] border border-[#E9DFCF] px-2 py-0.5 rounded text-[13px] font-semibold">
                              {issueCount} issue{issueCount !== 1 ? 's' : ''}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[13px] font-bold border ${
                                j.is_featured
                                  ? 'bg-[#FFF2D9] border-[#C9A66B] text-[#C9A66B]'
                                  : 'bg-[#FFF8EE] border-[#E9DFCF] text-[#8B7B68]'
                              }`}
                            >
                              {j.is_featured ? 'Featured' : 'Standard'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenIssueCreate(j.id)}
                                className="p-1.5 rounded-lg bg-[#FFF2D9] hover:bg-[#FFF2D9] text-[#C9A66B] transition-colors"
                                title="Add Issue for this Journal"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenJournalEdit(j)}
                                className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-blue-500/10 hover:text-blue-400 text-[#8B7B68] transition-colors"
                                title="Edit Journal"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingJournal(j)}
                                className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-red-500/10 hover:text-[#DC2626] text-[#8B7B68] transition-colors"
                                title="Delete Journal"
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
            </div>
          )}
        </>
      )}

      {/* TAB 2: ISSUES TABLE */}
      {fetchState === 'success' && activeTab === 'issues' && (
        <>
          {filteredIssues.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
              <Layers className="w-8 h-8 text-[#C9A66B] mx-auto" />
              <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Journal Issues Found</p>
              <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
                {searchQuery ? 'No issues match your active search.' : 'Use "Add Journal Issue" to publish a new issue release.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
              {selectedIssueIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#FFF8EE] border-b border-[#E9DFCF]">
                  <span className="text-xs font-semibold text-[#5C4B3A]">
                    {selectedIssueIds.size} issue{selectedIssueIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedIssueIds(new Set())}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#8B7B68] hover:text-[#5C4B3A]"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkDeleteOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#DC2626] text-white text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={allVisibleIssuesSelected}
                          onChange={toggleSelectAllIssues}
                          className="w-4 h-4 accent-[#C9A66B] cursor-pointer"
                          aria-label="Select all issues"
                        />
                      </th>
                      <th className="py-3 px-4 font-bold">Journal</th>
                      <th className="py-3 px-4 font-bold">Volume</th>
                      <th className="py-3 px-4 font-bold">Issue</th>
                      <th className="py-3 px-4 font-bold">Issue Price</th>
                      <th className="py-3 px-4 font-bold">Publication Date</th>
                      <th className="py-3 px-4 font-bold">Digital File</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredIssues.map((iss) => {
                      const journalTitle = resolveJournalTitle(iss);
                      const priceStr = iss.price !== undefined && iss.price !== null ? `\u20B9${iss.price}` : '\u20B90.00';
                      const volNum = iss.volume_number != null ? iss.volume_number : null;
                      const issNum = iss.issue_number != null ? iss.issue_number : null;

                      return (
                        <tr key={iss.id} className="hover:bg-[#FFF8EE] transition-colors align-top">
                          <td className="py-3 px-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedIssueIds.has(Number(iss.id))}
                              onChange={() => toggleIssueSelected(Number(iss.id))}
                              className="w-4 h-4 accent-[#C9A66B] cursor-pointer"
                              aria-label={`Select issue ${iss.public_id || iss.title || 'unnumbered'}`}
                            />
                          </td>
                          <td className="py-3 px-4 max-w-[260px] min-w-[160px]">
                            <span className="font-bold text-[#5C4B3A] font-playfair block break-words whitespace-normal leading-snug">{journalTitle}</span>
                          </td>

                          <td className="py-3 px-4 font-mono text-[#5C4B3A] font-semibold whitespace-nowrap">
                            {volNum === null ? <span className="text-[#8B7B68] italic">—</span> : volNum}
                          </td>

                          <td className="py-3 px-4 font-mono text-[#5C4B3A] font-semibold whitespace-nowrap">
                            {issNum === null ? <span className="text-[#8B7B68] italic">—</span> : issNum}
                          </td>

                          <td className="py-3 px-4 font-bold text-[#5C4B3A]">{priceStr}</td>

                          <td className="py-3 px-4 text-[#8B7B68]">{iss.publication_date || 'N/A'}</td>

                          <td className="py-3 px-4">
                            {iss.file_digital ? (
                              <span className="text-emerald-400 text-[13px] font-semibold">
                                Available
                              </span>
                            ) : (
                              <span className="text-[#8B7B68] text-[13px]">No PDF</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => goToArticlesForIssue(iss)}
                                className="p-1.5 rounded-lg bg-[#FFF2D9] hover:bg-[#F5E4BE] text-[#C9A66B] transition-colors"
                                title="Add Articles to this Issue"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenIssueEdit(iss)}
                                className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-blue-500/10 hover:text-blue-400 text-[#8B7B68] transition-colors"
                                title="Edit Issue"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingIssue(iss)}
                                className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-red-500/10 hover:text-[#DC2626] text-[#8B7B68] transition-colors"
                                title="Delete Issue"
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
            </div>
          )}
        </>
      )}

      {/* TAB 3: ARTICLES TABLE */}
      {fetchState === 'success' && activeTab === 'articles' && (
        <>
          {filteredArticles.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
              <FileText className="w-8 h-8 text-[#C9A66B] mx-auto" />
              <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Articles Found</p>
              <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
                {searchQuery
                  ? 'No articles match your active search.'
                  : 'Articles added through the Articles manager will appear here.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                      <th className="py-3 px-4 font-bold">Title</th>
                      <th className="py-3 px-4 font-bold">Author</th>
                      <th className="py-3 px-4 font-bold">DOI</th>
                      <th className="py-3 px-4 font-bold">Journal</th>
                      <th className="py-3 px-4 font-bold">Volume / Issue</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Access</th>
                      <th className="py-3 px-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 align-top">
                    {filteredArticles.map((a) => {
                      const jId = getArticleJournalId(a);
                      const iId =
                        typeof a.issue === 'object' && a.issue
                          ? Number(a.issue.id)
                          : a.issue
                          ? Number(a.issue)
                          : null;
                      const statusColor =
                        a.status === 'published'
                          ? 'bg-emerald-50 border-emerald-500/30 text-emerald-700'
                          : a.status === 'withdrawn'
                          ? 'bg-red-50 border-[#DC2626]/30 text-[#DC2626]'
                          : 'bg-[#FFF8EE] border-[#E9DFCF] text-[#8B7B68]';
                      const accessLabel =
                        a.access_mode === 'open_access'
                          ? 'Open Access'
                          : 'Paid';
                      return (
                        <tr key={a.id} className="hover:bg-[#FFF8EE] transition-colors">
                          <td className="py-3 px-4 max-w-[280px] min-w-[160px] font-semibold text-[#5C4B3A] font-playfair break-words whitespace-normal leading-snug">{a.title}</td>
                          <td className="py-3 px-4 text-[13px] text-[#8B7B68] line-clamp-1">{a.author_names_raw || '—'}</td>
                          <td className="py-3 px-4 text-[13px] font-mono text-[#C9A66B]">{a.doi || '—'}</td>
                          <td className="py-3 px-4 max-w-[240px] min-w-[140px]">
                            <span className="font-bold text-[#5C4B3A] block break-words whitespace-normal leading-snug">{articleJournalTitle(a)}</span>
                          </td>
                          <td className="py-3 px-4 max-w-[220px] min-w-[120px]">
                            {articleIssueLabel(a) ? (
                              <span className="text-[#8B7B68] block break-words whitespace-normal leading-snug">{articleIssueLabel(a)}</span>
                            ) : (
                              <span className="text-[#8B7B68] italic">No issue assigned</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[13px] font-bold border capitalize ${statusColor}`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-[#8B7B68]">{accessLabel}</td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const params = new URLSearchParams();
                                if (jId) params.set('journal', String(jId));
                                if (iId) params.set('issue', String(iId));
                                router.push(`/admin/journals/articles?${params.toString()}`);
                              }}
                              className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-blue-500/10 hover:text-blue-400 text-[#8B7B68] transition-colors"
                              title="Manage this article"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-[#E9DFCF] text-[13px] text-[#8B7B68]">
                Showing {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}. Staff view includes draft and withdrawn articles.
              </div>
            </div>
          )}
        </>
      )}

      {/* CREATE / EDIT JOURNAL DRAWER */}
      <AnimatePresence>
        {isJournalModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsJournalModalOpen(false)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-xl bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                    Journal Mutation
                  </span>
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    {editingJournal ? `Edit Journal: ${editingJournal.title}` : 'Create New Open Access Journal'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsJournalModalOpen(false)}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitJournal} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {journalFormError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[#DC2626] text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{journalFormError}</span>
                  </div>
                )}

                {journalFormSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{journalFormSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Journal Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Journal of Advanced Mechanical Engineering"
                    value={journalData.title}
                    onChange={(e) => setJournalData({ ...journalData, title: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Slug (URL identifier)</label>
                  <input
                    type="text"
                    placeholder="journal-advanced-mechanical"
                    value={journalData.slug}
                    onChange={(e) => setJournalData({ ...journalData, slug: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">ISSN Reference</label>
                    <input
                      type="text"
                      placeholder="2583-1245"
                      value={journalData.issn}
                      onChange={(e) => setJournalData({ ...journalData, issn: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Impact Factor Score</label>
                    <input
                      type="text"
                      placeholder="e.g. 3.50"
                      value={journalData.impact_factor}
                      onChange={(e) => setJournalData({ ...journalData, impact_factor: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono font-bold text-[#C9A66B] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Category</label>
                    <select
                      value={journalData.category_id}
                      onChange={(e) => setJournalData({ ...journalData, category_id: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Annual Subscription (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="1200.00"
                      value={journalData.subscription_price_annual}
                      onChange={(e) => setJournalData({ ...journalData, subscription_price_annual: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Journal Description & Overview</label>
                  <textarea
                    rows={3}
                    placeholder="Describe general journal overview and peer review policies..."
                    value={journalData.description}
                    onChange={(e) => setJournalData({ ...journalData, description: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] leading-relaxed"
                  />
                </div>

                {/* Aims & Mission Overview */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Aims & Mission Overview</label>
                  <textarea
                    rows={3}
                    placeholder="Specify detailed primary aims, mission, and scope overview paragraph..."
                    value={journalData.aims_text}
                    onChange={(e) => setJournalData({ ...journalData, aims_text: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] leading-relaxed"
                  />
                </div>

                {/* Key Research Topics Covered (Individual Topic Inputs) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[#8B7B68] font-semibold block">
                      Key Research Topics Covered (Individual Input Boxes)
                    </label>
                    <button
                      type="button"
                      onClick={addScopeTopic}
                      className="px-3 py-1 rounded-lg bg-[#FFF2D9] border border-[#C9A66B] text-[#C9A66B] text-[13px] font-bold hover:bg-[#C9A66B] hover:text-white transition-colors"
                    >
                      + Add Topic
                    </button>
                  </div>

                  <div className="space-y-2">
                    {scopeTopics.map((topic, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#FFF2D9] text-[#C9A66B] text-[13px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder={`Topic ${idx + 1} (e.g. Advanced Nanomaterials & Engineering)`}
                          value={topic}
                          onChange={(e) => updateScopeTopic(idx, e.target.value)}
                          className="flex-1 bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] text-xs"
                        />
                        {scopeTopics.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeScopeTopic(idx)}
                            className="text-[13px] text-[#DC2626] hover:text-red-600 font-bold px-2.5 py-2 rounded-xl border border-[#DC2626]/25 hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Editorial Board & Academic Leadership — structured rows */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[#8B7B68] font-semibold block">
                      Academic Leadership & Editorial Board
                    </label>
                    <button
                      type="button"
                      onClick={addBoardMember}
                      className="px-3 py-1 rounded-lg bg-[#FFF2D9] border border-[#C9A66B] text-[#C9A66B] text-[13px] font-bold hover:bg-[#C9A66B] hover:text-white transition-colors"
                    >
                      + Add Member
                    </button>
                  </div>

                  <div className="space-y-3">
                    {boardMembers.map((member, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-bold text-[#C9A66B] uppercase tracking-wider">
                            Member {idx + 1}
                          </span>
                          {boardMembers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBoardMember(idx)}
                              className="text-[13px] text-[#DC2626] hover:text-red-600 font-bold px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[13px] text-[#8B7B68] font-semibold block">Full Name *</label>
                            <input
                              type="text"
                              placeholder="e.g. Dr. S. Ramanujan"
                              value={member.name}
                              onChange={(e) => updateBoardMember(idx, 'name', e.target.value)}
                              className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-[13px] text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[13px] text-[#8B7B68] font-semibold block">Role / Designation</label>
                            <input
                              type="text"
                              placeholder="e.g. Editor-in-Chief"
                              value={member.role}
                              onChange={(e) => updateBoardMember(idx, 'role', e.target.value)}
                              className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-[13px] text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[13px] text-[#8B7B68] font-semibold block">Institution / University</label>
                            <input
                              type="text"
                              placeholder="e.g. IIT Madras / Oxford University"
                              value={member.institution}
                              onChange={(e) => updateBoardMember(idx, 'institution', e.target.value)}
                              className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-[13px] text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[13px] text-[#8B7B68] font-semibold block">Country</label>
                            <input
                              type="text"
                              placeholder="e.g. India"
                              value={member.country}
                              onChange={(e) => updateBoardMember(idx, 'country', e.target.value)}
                              className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-[13px] text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[13px] text-[#8B7B68] font-semibold block">Research Areas / Specialization (comma-separated)</label>
                          <input
                            type="text"
                            placeholder="e.g. Mathematics, Computer Science, AI"
                            value={member.specialization}
                            onChange={(e) => updateBoardMember(idx, 'specialization', e.target.value)}
                            className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-[13px] text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Indexed In — add-style chip rows with a + icon */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[#8B7B68] font-semibold block">Indexed In</label>
                    <button
                      type="button"
                      onClick={addIndexedIn}
                      className="px-3 py-1 rounded-lg bg-[#FFF2D9] border border-[#C9A66B] text-[#C9A66B] text-[13px] font-bold hover:bg-[#C9A66B] hover:text-white transition-colors"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {indexedInItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#FFF2D9] text-[#C9A66B] text-[13px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Crossref, Scopus, DOAJ"
                          value={item}
                          onChange={(e) => updateIndexedIn(idx, e.target.value)}
                          className="flex-1 bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] text-xs"
                        />
                        {indexedInItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeIndexedIn(idx)}
                            className="text-[13px] text-[#DC2626] hover:text-red-600 font-bold px-2.5 py-2 rounded-xl border border-[#DC2626]/25 hover:bg-red-50 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Publication Frequency select removed per admin request — default 'Quarterly' still submitted with the form state. */}

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Access Type</label>
                  <select
                    value={journalData.access_type}
                    onChange={(e) => setJournalData({ ...journalData, access_type: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                  >
                    <option value="Open Access">Open Access (CC-BY 4.0)</option>
                    <option value="Hybrid Open Access">Hybrid Open Access</option>
                    <option value="Subscription">Subscription</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Journal Cover Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setJournalCoverFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-[#8B7B68] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FFF2D9] file:text-[#C9A66B] hover:file:bg-[#FFF2D9] cursor-pointer"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="j_featured_cb"
                    checked={journalData.is_featured}
                    onChange={(e) => setJournalData({ ...journalData, is_featured: e.target.checked })}
                    className="w-4 h-4 rounded border-[#E9DFCF] bg-white text-gold-500"
                  />
                  <label htmlFor="j_featured_cb" className="text-xs text-[#5C4B3A] font-medium cursor-pointer">
                    Feature on Homepage Journal Directory
                  </label>
                </div>

                <div className="pt-4 border-t border-[#E9DFCF] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsJournalModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] font-semibold"
                  >
                    Cancel
                  </button>
                  <Button type="submit" variant="gold" size="sm" isLoading={journalFormSubmitting}>
                    {editingJournal ? 'Save Journal' : 'Create Journal'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CREATE / EDIT ISSUE DRAWER */}
      <AnimatePresence>
        {isIssueModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsIssueModalOpen(false)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-xl bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                    Journal Issue Release
                  </span>
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    {editingIssue ? 'Edit Journal Volume/Issue' : 'Publish Journal Volume/Issue'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsIssueModalOpen(false)}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitIssue} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {issueFormError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[#DC2626] text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{issueFormError}</span>
                  </div>
                )}

                {issueFormSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{issueFormSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Associated Journal *</label>
                  <select
                    value={issueData.journal}
                    onChange={(e) => {
                      const newJId = e.target.value;
                      setIssueData({ ...issueData, journal: newJId });
                      // Recalculate suggested volume when journal changes — only if admin hasn't manually edited it
                      if (!volumeManuallyEdited) {
                        const suggested = computeSuggestedVolume(newJId);
                        setIssueVolumeNumber(String(suggested));
                      }
                    }}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                  >
                    {journals.map((j) => (
                      <option key={j.id} value={String(j.id)}>
                        {j.title} ({j.issn || 'No ISSN'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Volume and Issue numbers — dropdown of existing numbers with a + Add box for new ones */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block" htmlFor="issue_volume_number">
                      Volume *
                    </label>
                    <select
                      id="issue_volume_number"
                      required
                      value={issueVolumeNumber}
                      onChange={(e) => {
                        const newVol = e.target.value;
                        setIssueVolumeNumber(newVol);
                        setVolumeManuallyEdited(true);
                        // Re-point the issue picker at the first issue that exists in the
                        // newly chosen volume (blank when that volume has none yet).
                        const firstInVol = selectedJournalIssues
                          .filter((iss) => getIssueVolumeNumber(iss) === newVol)
                          .map((iss) => getIssueNumber(iss))
                          .filter((n) => n !== '')
                          .sort((a, b) => Number(a) - Number(b))[0];
                        setIssueIssueNumber(firstInVol || '');
                      }}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      <option value="" disabled>
                        Select volume…
                      </option>
                      {volumeNumberOptions.map((v) => (
                        <option key={v} value={v}>
                          Volume {v}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="New volume no."
                        value={newVolumeInput}
                        onChange={(e) => setNewVolumeInput(e.target.value)}
                        className="flex-1 min-w-0 bg-white border border-[#E9DFCF] rounded-xl px-3 py-1.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                      />
                      <button
                        type="button"
                        onClick={handleAddVolumeNumber}
                        className="px-3 py-1.5 rounded-xl bg-[#FFF2D9] text-[#C9A66B] font-bold hover:bg-[#F7E8C4] transition-colors shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block" htmlFor="issue_issue_number">
                      Issue *
                    </label>
                    <select
                      id="issue_issue_number"
                      required
                      value={issueIssueNumber}
                      disabled={issueVolumeNumber === ''}
                      onChange={(e) => setIssueIssueNumber(e.target.value)}
                      className={`w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] ${issueVolumeNumber === '' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                      {issueVolumeNumber === '' ? (
                        <option value="" disabled>
                          Select a volume first
                        </option>
                      ) : issueNumberOptions.length === 0 ? (
                        <option value="" disabled>
                          No issues — add one below
                        </option>
                      ) : (
                        issueNumberOptions.map((v) => (
                          <option key={v} value={v}>
                            Issue {v}
                          </option>
                        ))
                      )}
                    </select>
                    {issueVolumeNumber !== '' && issueNumberOptions.length === 0 && (
                      <p className="text-[13px] text-[#A97917]">
                        Volume {issueVolumeNumber} has no issues yet. Use “+ Add” below to create one.
                      </p>
                    )}
                    <div className="flex gap-2 items-center">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        placeholder="New issue no."
                        value={newIssueInput}
                        disabled={issueVolumeNumber === ''}
                        onChange={(e) => setNewIssueInput(e.target.value)}
                        className="flex-1 min-w-0 bg-white border border-[#E9DFCF] rounded-xl px-3 py-1.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={handleAddIssueNumber}
                        disabled={issueVolumeNumber === ''}
                        className="px-3 py-1.5 rounded-xl bg-[#FFF2D9] text-[#C9A66B] font-bold hover:bg-[#F7E8C4] transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Publication Date</label>
                    <input
                      type="date"
                      value={issueData.publication_date}
                      onChange={(e) => setIssueData({ ...issueData, publication_date: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Single Issue Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="299.00"
                      value={issueData.price}
                      onChange={(e) => setIssueData({ ...issueData, price: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Stock Units</label>
                    <input
                      type="number"
                      placeholder="100"
                      value={issueData.stock}
                      onChange={(e) => setIssueData({ ...issueData, stock: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Volume Cover Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setIssueCoverFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#8B7B68] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FFF2D9] file:text-[#C9A66B] hover:file:bg-[#FFF2D9] cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Digital Issue PDF File</label>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setIssueDigitalFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#8B7B68] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FFF2D9] file:text-[#C9A66B] hover:file:bg-[#FFF2D9] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Persistent Complete Issue PDF section (data comes from the saved backend record) */}
                {editingIssue && (editingIssue.has_file_digital || editingIssue.file_digital) && (
                  <div className="mt-2 p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#C9A66B]" />
                      <span className="text-[#5C4B3A] font-bold text-sm">Complete Issue PDF</span>
                      <span className="text-[13px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Saved
                      </span>
                    </div>
                    <p className="text-xs text-[#8B7B68]">
                      Current document:{' '}
                      <span className="font-semibold text-[#5C4B3A] break-all">
                        {editingIssue.file_digital_name || 'complete-issue PDF'}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleAdminViewIssuePdf} isLoading={issuePdfBusy} leftIcon={<Eye className="w-3.5 h-3.5" />}>
                        View PDF
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleAdminDownloadIssuePdf} disabled={issuePdfBusy} leftIcon={<Download className="w-3.5 h-3.5" />}>
                        Download
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={handleRemoveIssuePdf} disabled={issuePdfBusy} leftIcon={<Trash2 className="w-3.5 h-3.5" />}>
                        Remove
                      </Button>
                    </div>
                    <p className="text-[13px] text-[#8B7B68]">
                      Choose a new file above and press Save to replace it. Leaving it empty keeps the current PDF. Individual article PDFs are never affected.
                    </p>
                  </div>
                )}

                {issueDigitalFile && (
                  <div className="mt-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                    <Upload className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="text-xs text-emerald-800 font-semibold">
                      {editingIssue ? 'Will replace on save' : 'Ready to upload on save'}:{' '}
                      <span className="break-all">{issueDigitalFile.name}</span>
                    </span>
                  </div>
                )}

                <div className="pt-4 border-t border-[#E9DFCF] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsIssueModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] font-semibold"
                  >
                    Cancel
                  </button>
                  <Button type="submit" variant="gold" size="sm" isLoading={issueFormSubmitting}>
                    {editingIssue ? 'Save Issue' : 'Publish Issue'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DELETE JOURNAL CONFIRMATION DIALOG */}
      <AnimatePresence>
        {deletingJournal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingJournal(null)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-red-500/30 rounded-2xl p-6 z-50 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-[#DC2626]">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">Confirm Journal Deletion</h3>
              </div>

              <p className="text-xs text-[#8B7B68] leading-relaxed">
                Are you sure you want to delete journal <strong className="text-[#5C4B3A]">"{deletingJournal.title}"</strong> from the backend database?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingJournal(null)}
                  className="px-4 py-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] text-xs font-semibold"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteJournalConfirm}
                  isLoading={deleteLoading}
                  className="border-red-500/40 text-[#DC2626] hover:bg-red-500/20 font-bold"
                >
                  Delete Journal
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DELETE ISSUE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {deletingIssue && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingIssue(null)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-red-500/30 rounded-2xl p-6 z-50 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-[#DC2626]">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">Confirm Issue Deletion</h3>
              </div>

              <p className="text-xs text-[#8B7B68] leading-relaxed">
                Are you sure you want to delete journal issue <strong className="text-[#5C4B3A]">"{deletingIssue.title}"</strong>?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingIssue(null)}
                  className="px-4 py-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] text-xs font-semibold"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteIssueConfirm}
                  isLoading={deleteLoading}
                  className="border-red-500/40 text-[#DC2626] hover:bg-red-500/20 font-bold"
                >
                  Delete Issue
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* BULK DELETE ISSUES CONFIRMATION DIALOG */}
      <AnimatePresence>
        {bulkDeleteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBulkDeleteOpen(false)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-red-500/30 rounded-2xl p-6 z-50 space-y-4 shadow-2xl"
            >
              <div className="flex items-center gap-3 text-[#DC2626]">
                <AlertTriangle className="w-6 h-6" />
                <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">Confirm Bulk Deletion</h3>
              </div>

              <p className="text-xs text-[#8B7B68] leading-relaxed">
                Are you sure you want to delete <strong className="text-[#5C4B3A]">{selectedIssueIds.size}</strong> selected journal
                issue{selectedIssueIds.size !== 1 ? 's' : ''}? This cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] text-xs font-semibold"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDeleteIssues}
                  isLoading={deleteLoading}
                  className="border-red-500/40 text-[#DC2626] hover:bg-red-500/20 font-bold"
                >
                  Delete {selectedIssueIds.size} Issue{selectedIssueIds.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
