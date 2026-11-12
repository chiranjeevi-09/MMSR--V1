'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  BookMarked,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  Search,
  Tag,
  ExternalLink,
  ListTree,
  ChevronUp,
  ChevronDown,
  Download,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { downloadProtectedFile } from '@/lib/services/protectedFiles';
import {
  AdminBook,
  AdminChapter,
  AdminChapterSection,
  fetchAdminBookDetail,
  fetchAdminChapters,
  createAdminChapter,
  updateAdminChapter,
  uploadAdminChapterPdf,
  deleteAdminChapter,
} from '@/lib/services/cms';

type FetchState = 'idle' | 'loading' | 'success' | 'error';

function AccessBadge({ mode }: { mode: AdminChapter['access_mode'] }) {
  const modeMap: Record<string, { label: string; bg: string; color: string; border: string }> = {
    paid:         { label: 'Paid',        bg: '#FFF8EE',              color: '#8C6239',  border: '#E9DFCF' },
    open_access:  { label: 'Open Access', bg: 'rgba(22,163,74,0.08)', color: '#15803d',  border: 'rgba(22,163,74,0.25)' },
    preview_only: { label: 'Preview',     bg: 'rgba(217,119,6,0.08)',  color: '#b45309',  border: 'rgba(217,119,6,0.25)' },
  };
  const m = modeMap[mode] || modeMap['paid'];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-block"
      style={{ background: m.bg, color: m.color, borderColor: m.border }}
    >
      {m.label}
    </span>
  );
}

function StatusBadge({ status }: { status: AdminChapter['status'] }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    published: { color: '#15803d', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.25)' },
    draft:     { color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.25)' },
    archived:  { color: '#b91c1c', bg: 'rgba(220,38,38,0.08)',   border: 'rgba(220,38,38,0.25)' },
  };
  const s = map[status] || map['draft'];
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border inline-block capitalize"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}
    >
      {status}
    </span>
  );
}

const EMPTY_CHAPTER_FORM = {
  chapter_number: '1',
  title: '',
  description: '',
  author_names_raw: '',
  status: 'published' as AdminChapter['status'],
  access_mode: 'paid' as AdminChapter['access_mode'],
  sample_content: '',
  doi: '',
  page_range: '',
  publication_date: '',
};

function formatAuthorNames(chap: AdminChapter): string {
  if (chap.authors && chap.authors.length > 0) {
    return chap.authors.map((a) => a.name).filter(Boolean).join(', ');
  }
  if (chap.author_names_raw) {
    try {
      const parsed = JSON.parse(chap.author_names_raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((item: any) => (typeof item === 'object' ? item.name : String(item)))
          .filter(Boolean)
          .join(', ');
      }
    } catch {
      return chap.author_names_raw;
    }
  }
  return '';
}

export default function AdminBookDetailPage() {

  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { tokens } = useAuth();

  const [book, setBook]                 = useState<AdminBook | null>(null);
  const [chapters, setChapters]         = useState<AdminChapter[]>([]);
  const [fetchState, setFetchState]     = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Full-book and chapter PDFs left the public /media tree (SECURITY-QA-REPORT
  // C-1): the API now hands out a staff-only streaming endpoint, so the desk
  // fetches it with its own bearer token instead of opening a bare URL.
  const [pdfBusy, setPdfBusy]           = useState<string | null>(null);
  const [pdfError, setPdfError]         = useState<string | null>(null);

  const handleProtectedPdf = async (kind: 'book' | 'chapter', path?: string | null, name?: string) => {
    if (!path) return;
    setPdfBusy(kind);
    setPdfError(null);
    try {
      await downloadProtectedFile(path, tokens?.access || '', name || 'document.pdf');
    } catch (err: any) {
      setPdfError(err?.message || 'This PDF could not be downloaded.');
    } finally {
      setPdfBusy(null);
    }
  };

  const [searchQuery, setSearchQuery]   = useState('');
  const [filterAccess, setFilterAccess] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [isFormOpen, setIsFormOpen]           = useState(false);
  const [editingChapter, setEditingChapter]   = useState<AdminChapter | null>(null);
  const [formData, setFormData]               = useState(EMPTY_CHAPTER_FORM);
  const [authorsList, setAuthorsList]         = useState<{ name: string; designation: string; affiliation: string; bio: string }[]>([
    { name: '', designation: '', affiliation: '', bio: '' },
  ]);
  const [sectionsList, setSectionsList]       = useState<AdminChapterSection[]>([]);
  const [chapterPdfFile, setChapterPdfFile]   = useState<File | null>(null);
  const [formSubmitting, setFormSubmitting]   = useState(false);
  const [formError, setFormError]            = useState<string | null>(null);
  const [formSuccess, setFormSuccess]        = useState<string | null>(null);
  const [deletingChapter, setDeletingChapter] = useState<AdminChapter | null>(null);
  const [deleteLoading, setDeleteLoading]     = useState(false);
  const [previewChapter, setPreviewChapter]   = useState<AdminChapter | null>(null);

  const loadBookAndChapters = useCallback(async () => {
    if (!tokens?.access || !slug) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const bookData = await fetchAdminBookDetail(tokens.access, slug);
      setBook(bookData);

      const allChapters = await fetchAdminChapters(tokens.access);
      const bookChapters = allChapters.filter(
        (c) => String(c.book) === String(bookData.id)
      );
      setChapters(bookChapters);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load book details.');
      setFetchState('error');
    }
  }, [tokens?.access, slug]);

  useEffect(() => {
    loadBookAndChapters();
  }, [loadBookAndChapters]);

  const filteredChapters = useMemo(() => {
    let list = [...chapters];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.author_names_raw || '').toLowerCase().includes(q) ||
          (c.doi || '').toLowerCase().includes(q)
      );
    }
    if (filterAccess !== 'all') list = list.filter((c) => c.access_mode === filterAccess);
    if (filterStatus !== 'all') list = list.filter((c) => c.status === filterStatus);
    return list.sort((a, b) => a.chapter_number - b.chapter_number);
  }, [chapters, searchQuery, filterAccess, filterStatus]);

  // Author list manipulation helpers
  const handleAddAuthor = () => {
    setAuthorsList((prev) => [...prev, { name: '', designation: '', affiliation: '', bio: '' }]);
  };

  const handleRemoveAuthor = (index: number) => {
    setAuthorsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAuthorChange = (index: number, field: string, value: string) => {
    setAuthorsList((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  // Chapter section list manipulation helpers
  const EMPTY_SECTION: AdminChapterSection = { title: '', preview_content: '', full_content: '', status: 'published' };

  const handleAddSection = () => {
    setSectionsList((prev) => [...prev, { ...EMPTY_SECTION }]);
  };

  const handleRemoveSection = (index: number) => {
    setSectionsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSectionChange = (index: number, patch: Partial<AdminChapterSection>) => {
    setSectionsList((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const handleMoveSection = (index: number, direction: -1 | 1) => {
    setSectionsList((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const openCreateModal = () => {
    setEditingChapter(null);
    const nextChapterNum = chapters.length > 0 ? Math.max(...chapters.map((c) => c.chapter_number)) + 1 : 1;
    setFormData({
      ...EMPTY_CHAPTER_FORM,
      chapter_number: String(nextChapterNum),
      publication_date: new Date().toISOString().split('T')[0],
    });
    setAuthorsList([{ name: '', designation: '', affiliation: '', bio: '' }]);
    setSectionsList([]);
    setChapterPdfFile(null);
    setFormError(null);
    setFormSuccess(null);
    setIsFormOpen(true);
  };

  const openEditModal = (chap: AdminChapter) => {
    setEditingChapter(chap);
    setFormData({
      chapter_number:   String(chap.chapter_number),
      title:            chap.title,
      description:      chap.description || '',
      author_names_raw: chap.author_names_raw || '',
      status:           chap.status,
      access_mode:      chap.access_mode,
      sample_content:   chap.sample_content || '',
      doi:              chap.doi || '',
      page_range:       chap.page_range || '',
      publication_date: chap.publication_date || '',
    });

    // Extract authors from chap.authors or parse author_names_raw
    if (chap.authors && chap.authors.length > 0) {
      setAuthorsList(
        chap.authors.map((a) => ({
          name: a.name || '',
          designation: a.designation || '',
          affiliation: a.affiliation || '',
          bio: a.bio || '',
        }))
      );
    } else if (chap.author_names_raw) {
      try {
        const parsed = JSON.parse(chap.author_names_raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAuthorsList(
            parsed.map((item: any) =>
              typeof item === 'object'
                ? {
                    name: item.name || '',
                    designation: item.designation || '',
                    affiliation: item.affiliation || '',
                    bio: item.bio || '',
                  }
                : { name: String(item), designation: '', affiliation: '', bio: '' }
            )
          );
        } else {
          throw new Error('Not array');
        }
      } catch {
        const names = chap.author_names_raw
          .split(/[,;]/)
          .map((n) => n.trim())
          .filter(Boolean);
        setAuthorsList(
          names.length > 0
            ? names.map((name) => ({ name, designation: '', affiliation: '', bio: '' }))
            : [{ name: '', designation: '', affiliation: '', bio: '' }]
        );
      }
    } else {
      setAuthorsList([{ name: '', designation: '', affiliation: '', bio: '' }]);
    }

    // Load existing chapter sections in display order
    const existingSections = [...(chap.sections ?? [])]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((s) => ({
        id: s.id,
        display_order: s.display_order,
        title: s.title || '',
        preview_content: s.preview_content || '',
        full_content: s.full_content || '',
        status: (s.status || 'published') as AdminChapterSection['status'],
      }));
    setSectionsList(existingSections);

    setChapterPdfFile(null);
    setFormError(null);
    setFormSuccess(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access || !book) return;

    if (!formData.title.trim()) {
      setFormError('Chapter title is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    // Filter valid authors
    const validAuthors = authorsList.filter((a) => a.name.trim().length > 0);
    const authorRawString = validAuthors.length > 0 ? JSON.stringify(validAuthors) : '';

    // Drop fully-empty section rows; every remaining section must have a title
    const cleanedSections = sectionsList.filter((s) =>
      (s.title ?? '').trim() || (s.preview_content ?? '').trim() || (s.full_content ?? '').trim()
    );
    if (cleanedSections.some((s) => !(s.title ?? '').trim())) {
      setFormError('Each chapter section must have a title.');
      setFormSubmitting(false);
      return;
    }
    const sectionsPayload = cleanedSections.map((s, idx) => ({
      id: s.id,
      title: s.title.trim(),
      preview_content: (s.preview_content ?? '').trim(),
      full_content: (s.full_content ?? '').trim(),
      status: s.status ?? 'published',
      display_order: idx + 1,
    }));

    const payload = {
      book: book.id,
      chapter_number: parseInt(formData.chapter_number, 10) || 1,
      title: formData.title.trim(),
      description: formData.description.trim(),
      authors: validAuthors,
      author_names_raw: authorRawString,
      sections: sectionsPayload,
      status: formData.status,
      access_mode: formData.access_mode,
      sample_content: formData.sample_content.trim(),
      doi: formData.doi.trim(),
      page_range: formData.page_range.trim(),
      publication_date: formData.publication_date || new Date().toISOString().split('T')[0],
    };

    try {
      let saved: AdminChapter;
      if (editingChapter) {
        saved = await updateAdminChapter(tokens.access, editingChapter.id, payload);
        setFormSuccess('Chapter updated successfully.');
      } else {
        saved = await createAdminChapter(tokens.access, payload);
        setFormSuccess('Chapter created successfully.');
      }
      setChapters((prev) =>
        prev.some((c) => c.id === saved.id) ? prev.map((c) => (c.id === saved.id ? saved : c)) : [...prev, saved]
      );

      // Upload the chapter PDF (multipart) only when a new file was selected
      if (chapterPdfFile) {
        const withPdf = await uploadAdminChapterPdf(tokens.access, saved.id, chapterPdfFile);
        setChapters((prev) => prev.map((c) => (c.id === withPdf.id ? withPdf : c)));
        setChapterPdfFile(null);
      }
      setTimeout(() => {
        setIsFormOpen(false);
        setEditingChapter(null);
      }, 700);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save chapter.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!tokens?.access || !deletingChapter) return;
    setDeleteLoading(true);
    try {
      await deleteAdminChapter(tokens.access, deletingChapter.id);
      setChapters((prev) => prev.filter((c) => c.id !== deletingChapter.id));
      setDeletingChapter(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete chapter.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <AdminLayout title={book ? `Book: ${book.title}` : 'Book Details & Chapter Management'}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Back Link Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/books"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#8B7B68] hover:text-[#5C4B3A] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Books List
          </Link>

          {book && (
            <Link
              href={`/books/${book.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E9DFCF] bg-white text-xs font-semibold text-[#8C6239] hover:bg-[#FFF8EE] transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              View Public Page
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
            </Link>
          )}
        </div>

        {/* Fetch Error Banner */}
        {fetchState === 'error' && (
          <div className="p-4 rounded-2xl bg-red-50 border border-[#DC2626]/25 text-red-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={loadBookAndChapters}
              className="px-3 py-1 rounded-lg bg-[#DC2626]/10 text-xs font-bold text-red-800 hover:bg-[#DC2626]/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {fetchState === 'loading' && (
          <div className="space-y-6">
            <div className="h-48 rounded-2xl bg-[#FFF8EE] border border-[#E9DFCF] animate-pulse" />
            <div className="h-64 rounded-2xl bg-[#FFF8EE] border border-[#E9DFCF] animate-pulse" />
          </div>
        )}

        {/* Main Content (hidden while the chapter editor page view is open) */}
        {fetchState === 'success' && book && !isFormOpen && (
          <>
            {/* Book Overview Card Banner */}
            <div className="rounded-2xl bg-white border border-[#E9DFCF] p-6 md:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                {/* Book Cover Image */}
                <div className="relative w-36 h-48 md:w-44 md:h-60 flex-shrink-0 rounded-xl overflow-hidden bg-[#FFF8EE] border border-[#E9DFCF] shadow-sm flex items-center justify-center">
                  {book.cover_image ? (
                    <Image
                      src={book.cover_image}
                      alt={book.title}
                      fill
                      className="object-cover"
                      sizes="176px"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[#8B7B68] p-4 text-center">
                      <BookOpen className="w-10 h-10 mb-2 text-[#C9A66B]" />
                      <span className="text-[11px] font-medium leading-tight">No Cover Image</span>
                    </div>
                  )}
                </div>

                {/* Book Metadata & Description */}
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#FFF8EE] border border-[#E9DFCF] text-[#8C6239]">
                      <Tag className="w-3 h-3 text-[#C9A66B]" />
                      {typeof book.category === 'object' && book.category ? book.category.name : 'Book Volume'}
                    </span>
                    {book.is_featured && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-[#FFF2D9] border border-[#C9A66B] text-[#C9A66B]">
                        Featured
                      </span>
                    )}
                    <span className="text-xs text-[#8B7B68] font-mono">
                      ISBN: <strong className="text-[#5C4B3A] font-semibold">{book.isbn || 'N/A'}</strong>
                    </span>
                    {book.published_date && (
                      <span className="text-xs text-[#8B7B68]">
                        Published: <strong className="text-[#5C4B3A] font-semibold">{book.published_date.split('-')[0]}</strong>
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-[#5C4B3A] font-playfair leading-tight">
                      {book.title}
                    </h1>
                  </div>

                  {/* Metadata Chips (Removed Pages N/A as explicitly requested) */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 py-3 border-y border-[#E9DFCF] text-xs items-start">
                    <div>
                      <span className="text-[#8B7B68] block font-semibold text-[11px]">Author / Editor</span>
                      <span className="font-bold text-[#5C4B3A] text-sm">
                        {book.author || 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8B7B68] block font-semibold text-[11px]">Price</span>
                      <span className="font-bold text-[#C9A66B] text-sm">
                        {book.price ? `$${book.price}` : 'Free / Open'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8B7B68] block font-semibold text-[11px]">Chapters Count</span>
                      <span className="font-bold text-[#5C4B3A] text-sm">
                        {chapters.length} Chapters
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8B7B68] block font-semibold text-[11px]">Full Book PDF</span>
                      {book.file_pdf ? (
                        <button
                          type="button"
                          onClick={() => handleProtectedPdf('book', book.file_pdf, `book_${slug}_full.pdf`)}
                          disabled={pdfBusy !== null}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C9A66B] hover:opacity-95 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-60"
                        >
                          <Download className="w-3.5 h-3.5" />
                          {pdfBusy === 'book' ? 'Preparing…' : 'Download Full Book'}
                        </button>
                      ) : (
                        <span className="text-sm font-semibold text-[#8B7B68]/60 italic">Not uploaded</span>
                      )}
                      {pdfError && (
                        <span className="text-[11px] text-red-600 block mt-1">{pdfError}</span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {book.description && (
                    <p className="text-xs md:text-sm text-[#8B7B68] leading-relaxed line-clamp-3">
                      {book.description}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Chapters Section Header & Controls */}
            <div className="bg-white rounded-2xl border border-[#E9DFCF] p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E9DFCF]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-[#C9A66B] flex items-center justify-center">
                      <BookMarked className="w-4.5 h-4.5" />
                    </div>
                    <h2 className="text-lg font-bold text-[#5C4B3A] font-playfair">
                      Book Chapters & Table of Contents
                    </h2>
                  </div>
                  <p className="text-xs text-[#8B7B68] mt-1">
                    Manage all chapters, authors, page ranges, DOIs, and access permissions for this book.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={loadBookAndChapters}
                    className="p-2.5 rounded-xl border border-[#E9DFCF] bg-white text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE] transition-colors"
                    title="Refresh chapters list"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>

                  <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C9A66B] hover:opacity-95 text-white font-bold text-xs shadow-sm transition-opacity"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Add New Chapter
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#8B7B68]" />
                  <input
                    type="text"
                    placeholder="Search chapters by title, author or DOI..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-[#E9DFCF] text-xs text-[#5C4B3A] placeholder-[#8B7B68]/70 focus:outline-none focus:border-[#C9A66B] transition-colors"
                  />
                </div>

                <div>
                  <select
                    value={filterAccess}
                    onChange={(e) => setFilterAccess(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E9DFCF] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer transition-colors"
                  >
                    <option value="all">All Access Modes</option>
                    <option value="paid">Paid Content</option>
                    <option value="open_access">Open Access</option>
                    <option value="preview_only">Preview Only</option>
                  </select>
                </div>

                <div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-[#E9DFCF] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer transition-colors"
                  >
                    <option value="all">All Statuses</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Chapters Table */}
              {filteredChapters.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-[#E9DFCF] bg-[#FFF8EE]/30">
                  <BookMarked className="w-10 h-10 text-[#C9A66B] mx-auto mb-3" />
                  <p className="text-sm font-bold text-[#5C4B3A] font-playfair">
                    No chapters found for this book
                  </p>
                  <p className="text-xs text-[#8B7B68] mt-1 max-w-sm mx-auto">
                    {searchQuery || filterAccess !== 'all' || filterStatus !== 'all'
                      ? 'Try adjusting your search filters to find chapters.'
                      : 'Click the "Add New Chapter" button above to create the first chapter for this book.'}
                  </p>
                  <button
                    onClick={openCreateModal}
                    className="mt-4 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#C9A66B] text-white text-xs font-bold hover:opacity-95 transition-opacity"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add First Chapter
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E9DFCF]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#FFF8EE] text-[11px] font-bold uppercase tracking-wider text-[#8B7B68] border-b border-[#E9DFCF]">
                        <th className="py-3 px-4 w-20 text-center">No.</th>
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4 hidden lg:table-cell">Description</th>
                        <th className="py-3 px-4 hidden md:table-cell">Authors</th>
                        <th className="py-3 px-4 hidden lg:table-cell">DOI</th>
                        <th className="py-3 px-4 hidden lg:table-cell">Pages</th>
                        <th className="py-3 px-4">Access Mode</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9DFCF] text-xs">
                      {filteredChapters.map((chap) => (
                        <tr
                          key={chap.id}
                          className="hover:bg-[#FFF8EE]/50 transition-colors text-[#5C4B3A]"
                        >
                          {/* Chapter Number */}
                          <td className="py-3 px-4 text-center font-bold text-[#C9A66B]">
                            Chapter {chap.chapter_number}
                          </td>

                          {/* Chapter Title */}
                          <td className="py-3 px-4 font-bold text-[#5C4B3A] line-clamp-1">
                            {chap.title}
                          </td>

                          {/* Description */}
                          <td className="py-3 px-4 hidden lg:table-cell text-[11px] text-[#8B7B68] line-clamp-1">
                            {chap.description || '—'}
                          </td>

                          {/* Authors */}
                          <td className="py-3 px-4 hidden md:table-cell text-[#5C4B3A] font-medium">
                            <div className="line-clamp-1 max-w-[200px]">
                              {formatAuthorNames(chap) || <span className="text-[#8B7B68] italic">None</span>}
                            </div>
                          </td>


                          {/* DOI */}
                          <td className="py-3 px-4 hidden lg:table-cell font-mono text-[11px] text-[#8B7B68]">
                            {chap.doi || 'No DOI'}
                          </td>

                          {/* Pages */}
                          <td className="py-3 px-4 hidden lg:table-cell font-mono text-[10px] text-[#8B7B68]/80">
                            {chap.page_range ? `pp. ${chap.page_range}` : '—'}
                          </td>

                          {/* Access Mode */}
                          <td className="py-3 px-4">
                            <AccessBadge mode={chap.access_mode} />
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <StatusBadge status={chap.status} />
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {chap.sample_content && (
                                <button
                                  onClick={() => setPreviewChapter(chap)}
                                  className="p-1.5 rounded-lg border border-[#E9DFCF] bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A] transition-colors"
                                  title="Preview Chapter Content"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => openEditModal(chap)}
                                className="p-1.5 rounded-lg border border-[#C9A66B]/30 bg-[#FFF8EE] text-[#8C6239] hover:bg-[#FFF2D9] transition-colors"
                                title="Edit Chapter"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => setDeletingChapter(chap)}
                                className="p-1.5 rounded-lg border border-[#DC2626]/25 bg-red-50 text-red-700 hover:bg-[#DC2626]/10 transition-colors"
                                title="Delete Chapter"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── ADD / EDIT CHAPTER PAGE VIEW ─── */}
        {isFormOpen && (
          <div className="space-y-6">
            {/* Editor Page Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-[#E9DFCF]">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#E9DFCF] text-xs font-semibold text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE] transition-colors flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Chapters
              </button>
              <div>
                <span className="text-[10px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                  Chapter Management
                </span>
                <h3 className="text-lg font-bold font-playfair text-[#5C4B3A]">
                  {editingChapter ? `Edit: ${editingChapter.title}` : 'Add New Chapter'}
                </h3>
              </div>
            </div>

            {/* Editor Form Card */}
            <div className="bg-white rounded-2xl border border-[#E9DFCF] shadow-sm">
              <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">

                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-[#DC2626]/25 text-red-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                    <span>{formSuccess}</span>
                  </div>
                )}
                  {/* Book Lock Select */}
                  <div>
                    <label className="block text-xs font-semibold text-[#8B7B68] mb-1.5">
                      Target Book
                    </label>
                    <input
                      type="text"
                      disabled
                      value={book?.title || ''}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs text-[#5C4B3A] font-bold cursor-not-allowed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Chapter Number */}
                    <div>
                      <label className="block text-xs font-semibold text-[#8B7B68] mb-1.5">
                        Chapter Number *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.chapter_number}
                        onChange={(e) => setFormData({ ...formData, chapter_number: e.target.value })}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] font-bold focus:outline-none focus:border-[#C9A66B]"
                      />
                    </div>

                    {/* Chapter Title */}
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-[#8B7B68] mb-1.5">
                        Chapter Title *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., Foundations of Deep Neural Architectures"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
                      />
                    </div>
                  </div>

                  {/* Structured Chapter Authors Section */}
                  <div className="space-y-3 bg-[#FFF8EE]/60 border border-[#E9DFCF] rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-xs font-bold text-[#5C4B3A]">
                          Chapter Author(s) &amp; Details
                        </label>
                        <span className="text-[11px] text-[#8B7B68]">
                          Add authors individually with designation, institute, and bio details.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddAuthor}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#C9A66B] text-white text-xs font-bold hover:opacity-95 transition-opacity shadow-2xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Add Author
                      </button>
                    </div>

                    <div className="space-y-3">
                      {authorsList.map((author, index) => (
                        <div
                          key={index}
                          className="bg-white border border-[#E9DFCF] rounded-xl p-3.5 space-y-3 shadow-2xs relative"
                        >
                          <div className="flex items-center justify-between border-b border-[#E9DFCF] pb-2">
                            <span className="text-[11px] font-bold text-[#C9A66B]">
                              Author {index + 1}
                            </span>
                            {authorsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAuthor(index)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove Author"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Author Name */}
                            <div>
                              <label className="block text-[11px] font-semibold text-[#8B7B68] mb-1">
                                Author Name *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Dr. Aris Thorne"
                                value={author.name}
                                onChange={(e) => handleAuthorChange(index, 'name', e.target.value)}
                                className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-xs text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
                              />
                            </div>

                            {/* Designation */}
                            <div>
                              <label className="block text-[11px] font-semibold text-[#8B7B68] mb-1">
                                Designation / Role
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Associate Professor"
                                value={author.designation}
                                onChange={(e) => handleAuthorChange(index, 'designation', e.target.value)}
                                className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-xs text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Institute / Affiliation */}
                            <div>
                              <label className="block text-[11px] font-semibold text-[#8B7B68] mb-1">
                                Institute / Affiliation
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. MIT / Cambridge Research Labs"
                                value={author.affiliation}
                                onChange={(e) => handleAuthorChange(index, 'affiliation', e.target.value)}
                                className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-xs text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
                              />
                            </div>

                            {/* Bio */}
                            <div>
                              <label className="block text-[11px] font-semibold text-[#8B7B68] mb-1">
                                Biography (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Specializes in quantum computing..."
                                value={author.bio}
                                onChange={(e) => handleAuthorChange(index, 'bio', e.target.value)}
                                className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-xs text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chapter Sections — powers the "Chapter Sections" panel on the public book page */}
                  <div className="space-y-3 bg-[#FFF8EE]/60 border border-[#E9DFCF] rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ListTree className="w-4 h-4 text-[#C9A66B]" />
                        <h3 className="text-xs font-bold text-[#5C4B3A]">Chapter Sections</h3>
                        <span className="text-[10px] font-semibold text-[#8B7B68]">({sectionsList.length})</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddSection}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#C9A66B] text-white text-xs font-bold hover:opacity-95 transition-opacity shadow-2xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Add Section
                      </button>
                    </div>

                    {sectionsList.length === 0 ? (
                      <p className="text-[11px] text-[#8B7B68] italic">
                        No sections yet. Add the numbered section titles that appear in the “Chapter Sections” panel on the public book page.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sectionsList.map((section, index) => (
                          <div
                            key={section.id ?? `new-${index}`}
                            className="bg-white border border-[#E9DFCF] rounded-xl p-3.5 space-y-3 shadow-2xs"
                          >
                            <div className="flex items-center justify-between border-b border-[#E9DFCF] pb-2">
                              <span className="text-[11px] font-bold text-[#C9A66B]">Section {index + 1}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveSection(index, -1)}
                                  disabled={index === 0}
                                  className="p-1 rounded-lg text-[#8B7B68] hover:bg-[#FFF8EE] disabled:opacity-30 transition-colors"
                                  title="Move up"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveSection(index, 1)}
                                  disabled={index === sectionsList.length - 1}
                                  className="p-1 rounded-lg text-[#8B7B68] hover:bg-[#FFF8EE] disabled:opacity-30 transition-colors"
                                  title="Move down"
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSection(index)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove Section"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-[#8B7B68] mb-1">Section Title *</label>
                              <input
                                type="text"
                                placeholder="e.g. Introduction to Transformer Models & Self-Attention"
                                value={section.title}
                                onChange={(e) => handleSectionChange(index, { title: e.target.value })}
                                className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-1.5 text-xs text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-[#8B7B68] mb-1">Public Preview Snippet (Optional)</label>
                              <textarea
                                rows={2}
                                placeholder="Short excerpt shown publicly for this section..."
                                value={section.preview_content ?? ''}
                                onChange={(e) => handleSectionChange(index, { preview_content: e.target.value })}
                                className="w-full bg-white border border-[#E9DFCF] rounded-lg px-3 py-2 text-xs text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B] leading-relaxed resize-none"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Page Range */}
                    <div>
                      <label className="block text-xs font-semibold text-[#8B7B68] mb-1.5">
                        Page Range
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 1-24"
                        value={formData.page_range}
                        onChange={(e) => setFormData({ ...formData, page_range: e.target.value })}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B]"
                      />
                    </div>

                    {/* Publication Date */}
                    <div>
                      <label className="block text-xs font-semibold text-[#8B7B68] mb-1.5">
                        Publication Date
                      </label>
                      <input
                        type="date"
                        value={formData.publication_date}
                        onChange={(e) => setFormData({ ...formData, publication_date: e.target.value })}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                      />
                    </div>
                  </div>

                  {/* Short Abstract / Summary */}
                  <div>
                    <label className="block text-xs font-semibold text-[#8B7B68] mb-1.5">
                      Chapter Abstract / Overview
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Brief abstract describing the contents of this chapter..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] placeholder-[#8B7B68]/60 focus:outline-none focus:border-[#C9A66B] leading-relaxed resize-none"
                    />
                  </div>

                  {/* Chapter PDF Upload */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-[#8B7B68]">Chapter PDF (Full File)</label>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setChapterPdfFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#8B7B68] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FFF2D9] file:text-[#C9A66B] hover:file:bg-[#FFF2D9] cursor-pointer"
                    />
                    {editingChapter?.file_pdf && !chapterPdfFile && (
                      <button
                        type="button"
                        onClick={() => handleProtectedPdf('chapter', editingChapter.file_pdf, `chapter_${editingChapter.public_id || editingChapter.id}.pdf`)}
                        disabled={pdfBusy !== null}
                        className="text-[10px] text-emerald-400 block truncate hover:underline text-left disabled:opacity-60"
                      >
                        {pdfBusy === 'chapter' ? 'Preparing…' : `Current: ${editingChapter.file_pdf}`}
                      </button>
                    )}
                    {pdfError && (
                      <span className="text-[10px] text-red-600 block">{pdfError}</span>
                    )}
                  </div>

                  {/* Form Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E9DFCF]">
                    <button
                      type="button"
                      onClick={() => setIsFormOpen(false)}
                      className="px-4 py-2 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs font-semibold text-[#8B7B68] hover:text-[#5C4B3A] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#C9A66B] hover:opacity-95 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                    >
                      {formSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      {editingChapter ? 'Update Chapter' : 'Create Chapter'}
                    </button>
                  </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── DELETE CONFIRMATION MODAL ────────────────────────────────────── */}
        <AnimatePresence>
          {deletingChapter && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white border border-[#E9DFCF] rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-[#5C4B3A]"
              >
                <div className="flex items-center gap-3 text-red-700">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base font-playfair text-[#5C4B3A]">Delete Chapter</h4>
                    <p className="text-xs text-[#8B7B68]">This action cannot be undone.</p>
                  </div>
                </div>

                <p className="text-xs text-[#8B7B68]">
                  Are you sure you want to delete{' '}
                  <strong className="text-[#5C4B3A]">Chapter {deletingChapter.chapter_number}: {deletingChapter.title}</strong>?
                </p>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setDeletingChapter(null)}
                    className="px-4 py-2 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs font-semibold text-[#8B7B68] hover:text-[#5C4B3A] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={deleteLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition-all disabled:opacity-50"
                  >
                    {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Confirm Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── SAMPLE CONTENT PREVIEW MODAL ──────────────────────────────────── */}
        <AnimatePresence>
          {previewChapter && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white border border-[#E9DFCF] rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col text-[#5C4B3A]"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E9DFCF]">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#C9A66B]">
                      Chapter {previewChapter.chapter_number} — Sample Content
                    </div>
                    <h3 className="font-bold text-base font-playfair text-[#5C4B3A] leading-tight mt-0.5">
                      {previewChapter.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => setPreviewChapter(null)}
                    className="p-1.5 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 text-xs font-mono text-[#5C4B3A] space-y-2 whitespace-pre-wrap bg-[#FFF8EE] p-4 rounded-xl border border-[#E9DFCF]">
                  {previewChapter.sample_content}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setPreviewChapter(null)}
                    className="px-4 py-2 rounded-xl bg-[#C9A66B] text-white text-xs font-bold hover:opacity-95 transition-opacity"
                  >
                    Close Preview
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
}
