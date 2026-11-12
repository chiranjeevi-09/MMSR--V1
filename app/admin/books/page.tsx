'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
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
  ArrowRight,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  validateIsbn,
  validatePrice,
  validateInteger,
  validateDecimal,
} from '@/lib/validation';
import {
  AdminBook,
  Category,
  fetchAdminBooks,
  fetchCategories,
  createAdminBook,
  updateAdminBook,
  deleteAdminBook,
} from '@/lib/services/cms';
import { clearPending, purgeLegacyOverrides, readPending, savePending } from '@/lib/utils/pendingSync';

type FilterStatus = 'all' | 'published' | 'featured' | 'draft';
type FetchState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Retry-buffer key prefix (SECURITY-QA-REPORT L-5). Only ever holds a draft
 * whose POST/PATCH the server rejected, and only the edit form reads it.
 */
const PENDING_BOOK = 'book_';

// Shape of the locally buffered draft — mirrors the fields the desk edits.
interface BookDraft {
  title?: string;
  authors?: string;
  authorBio?: string;
  authorDesignation?: string;
  authorAffiliation?: string;
  publisher?: string;
  binding?: string;
  language?: string;
  doi?: string;
  pages?: number;
  isbn?: string;
  description?: string;
}

export default function AdminBooksPage() {
  const { tokens } = useAuth();
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  // Modals & Drawers State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<AdminBook | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  // Set when the form was pre-filled from an unsent draft (server never got it).
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingBook, setDeletingBook] = useState<AdminBook | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    author: '',
    author_designation: '',
    author_affiliation: '',
    author_bio: '',
    isbn: '',
    doi: '',
    publisher: 'MMSR Publications',
    binding: 'Hardcover',
    language: 'English',
    category_id: '',
    description: '',
    price: '',
    stock: '10',
    pages: '250',
    edition: '2026 Edition',
    rating: '4.9',
    published_date: '',
    is_featured: false,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [bookPdfFile, setBookPdfFile] = useState<File | null>(null);

  // Fetch real backend data
  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMessage(null);
    // One-off cleanup of the pre-L-5 "override" copies, which used to be merged
    // over server data and could make the desk disagree with the database.
    purgeLegacyOverrides('mmsr_book_override_');

    try {
      const [cats, booksData] = await Promise.all([
        fetchCategories(tokens.access).catch(() => []),
        fetchAdminBooks(tokens.access),
      ]);
      setCategories(cats);
      setBooks(booksData);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load books from backend.');
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingBook(null);
    setFormData({
      title: '',
      slug: '',
      author: '',
      author_designation: '',
      author_affiliation: '',
      author_bio: '',
      isbn: '',
      doi: '',
      publisher: 'MMSR Publications',
      binding: 'Hardcover',
      language: 'English',
      category_id: categories[0] ? String(categories[0].id) : '',
      description: '',
      price: '',
      stock: '10',
      pages: '250',
      edition: '2026 Edition',
      rating: '4.9',
      published_date: new Date().toISOString().split('T')[0],
      is_featured: false,
    });
    setCoverFile(null);
    setSampleFile(null);
    setBookPdfFile(null);
    setFormError(null);
    setFormSuccess(null);
    setPendingNotice(null);
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (book: AdminBook) => {
    setEditingBook(book);
    const catId = typeof book.category === 'object' && book.category
      ? String(book.category.id)
      : book.category_id
      ? String(book.category_id)
      : categories[0]
      ? String(categories[0].id)
      : '';

    // The server row is the default. Only a draft the API never accepted is
    // layered on top, and the desk is told so explicitly (L-5) instead of the
    // difference being hidden.
    const draft = readPending<BookDraft>(`${PENDING_BOOK}${book.slug}`)
      || readPending<BookDraft>(`${PENDING_BOOK}${book.id}`);
    const override = draft?.data || {};
    setPendingNotice(draft
      ? `Unsent changes from ${new Date(draft.savedAt).toLocaleString()} are loaded — the server rejected them (${draft.reason}). Press Save to retry.`
      : null);

    setFormData({
      title: override.title || book.title || '',
      slug: book.slug || '',
      author: override.authors || book.author || '',
      author_designation: override.authorDesignation || (book as any).author_designation || '',
      author_affiliation: override.authorAffiliation || (book as any).author_affiliation || '',
      author_bio: override.authorBio || (book as any).author_bio || '',
      isbn: override.isbn || book.isbn || '',
      doi: override.doi || (book as any).doi || '',
      publisher: override.publisher || (book as any).publisher || 'MMSR Publications',
      binding: override.binding || (book as any).binding || 'Hardcover',
      language: override.language || (book as any).language || 'English',
      category_id: catId,
      description: override.description || book.description || '',
      price: book.price !== undefined ? String(book.price) : '',
      stock: book.stock !== undefined ? String(book.stock) : '10',
      pages: override.pages !== undefined ? String(override.pages) : book.pages !== undefined ? String(book.pages) : '250',
      edition: book.edition || '2026 Edition',
      rating: book.rating !== undefined ? String(book.rating) : '4.9',
      published_date: book.published_date || '',
      is_featured: Boolean(book.is_featured),
    });
    setCoverFile(null);
    setSampleFile(null);
    setBookPdfFile(null);
    setFormError(null);
    setFormSuccess(null);
    setIsFormOpen(true);
  };


  // Submit Form (Create or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access) return;

    if (!formData.title.trim()) {
      setFormError('Book title is required.');
      return;
    }

    // Client-side mirror of the backend BookSerializer rules so an invalid
    // identifier/quantity never round-trips to a 400.
    const isbnErr = validateIsbn(formData.isbn);
    if (isbnErr) { setFormError(isbnErr); return; }
    const priceErr = validatePrice(formData.price, 'Price', { required: false });
    if (priceErr) { setFormError(priceErr); return; }
    const pagesErr = validateInteger(formData.pages, { min: 1, max: 100000, required: false, label: 'Page count' });
    if (pagesErr) { setFormError(pagesErr); return; }
    const stockErr = validateInteger(formData.stock, { min: 0, max: 1000000, required: false, label: 'Stock units' });
    if (stockErr) { setFormError(stockErr); return; }
    const ratingErr = validateDecimal(formData.rating, { min: 0, max: 5, decimals: 1, required: false, label: 'Star rating' });
    if (ratingErr) { setFormError(ratingErr); return; }

    setFormSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const fd = new FormData();
      fd.append('title', formData.title.trim());

      const slugVal = formData.slug.trim() || formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      fd.append('slug', slugVal);

      if (formData.author.trim()) fd.append('author', formData.author.trim());
      if (formData.author_bio.trim()) fd.append('author_bio', formData.author_bio.trim());
      if (formData.isbn.trim()) fd.append('isbn', formData.isbn.trim());
      if (formData.doi.trim()) fd.append('doi', formData.doi.trim());
      if (formData.publisher.trim()) fd.append('publisher', formData.publisher.trim());
      if (formData.binding.trim()) fd.append('binding', formData.binding.trim());
      if (formData.language.trim()) fd.append('language', formData.language.trim());
      if (formData.category_id) fd.append('category_id', formData.category_id);
      if (formData.description.trim()) fd.append('description', formData.description.trim());
      if (formData.price) fd.append('price', formData.price);
      if (formData.stock) fd.append('stock', formData.stock);
      if (formData.pages) fd.append('pages', formData.pages);
      if (formData.edition.trim()) fd.append('edition', formData.edition.trim());
      if (formData.rating) fd.append('rating', formData.rating);
      if (formData.published_date) fd.append('published_date', formData.published_date);
      fd.append('is_featured', formData.is_featured ? 'true' : 'false');

      if (coverFile) {
        fd.append('cover_image', coverFile);
      }
      if (sampleFile) {
        fd.append('file_sample', sampleFile);
      }
      if (bookPdfFile) {
        fd.append('file_pdf', bookPdfFile);
      }

      // Draft copy used ONLY as a retry buffer if the server call below fails
      // (SECURITY-QA-REPORT L-5). It is no longer written on success, and it is
      // never merged into catalog data — the API response is authoritative.
      const draftObj: BookDraft = {
        title: formData.title.trim(),
        authors: formData.author.trim() || 'MMSR Editorial Board',
        authorBio: formData.author_bio.trim(),
        authorDesignation: formData.author_designation.trim(),
        authorAffiliation: formData.author_affiliation.trim(),
        publisher: formData.publisher.trim(),
        binding: formData.binding.trim(),
        language: formData.language.trim(),
        doi: formData.doi.trim(),
        pages: Number(formData.pages) || 250,
        isbn: formData.isbn.trim(),
        description: formData.description.trim(),
      };
      const pendingKeys = [`${PENDING_BOOK}${slugVal}`,
        ...(editingBook ? [`${PENDING_BOOK}${editingBook.id}`] : [])];

      let saveFailure: string | null = null;
      try {
        if (editingBook) {
          await updateAdminBook(tokens.access, editingBook.slug || String(editingBook.id), fd);
        } else {
          await createAdminBook(tokens.access, fd);
        }
      } catch (err: any) {
        saveFailure = err?.message || 'Failed to save the book.';
      }

      if (saveFailure) {
        // The database did not accept this — say so, and keep the typing.
        pendingKeys.forEach((key) => savePending(key, draftObj, saveFailure as string));
        setPendingNotice(null);
        setFormError(`${saveFailure} Nothing was written to the server; your changes are kept in this browser so you can fix and retry.`);
      } else {
        clearPending(...pendingKeys);
        setPendingNotice(null);
        setFormSuccess(editingBook ? 'Book updated successfully!' : 'Book created successfully!');
        // Reload real backend data
        await loadData();
        setTimeout(() => {
          setIsFormOpen(false);
        }, 1000);
      }
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save book.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Featured Quick Action
  const handleToggleFeatured = async (book: AdminBook) => {
    if (!tokens?.access) return;
    try {
      const fd = new FormData();
      fd.append('is_featured', (!book.is_featured).toString());
      await updateAdminBook(tokens.access, book.slug, fd);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update featured state: ${err?.message}`);
    }
  };

  // Confirm Delete Action
  const handleDeleteConfirm = async () => {
    if (!deletingBook || !tokens?.access) return;
    setDeleteLoading(true);

    try {
      await deleteAdminBook(tokens.access, deletingBook.slug);
      setDeletingBook(null);
      await loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered & Searched Books computation
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      // Search Query
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (b.title || '').toLowerCase().includes(q);
        const isbnMatch = (b.isbn || '').toLowerCase().includes(q);
        const authorMatch = (b.author || '').toLowerCase().includes(q);
        if (!titleMatch && !isbnMatch && !authorMatch) return false;
      }

      // Category Filter
      if (selectedCategory !== 'all') {
        const catId = typeof b.category === 'object' && b.category
          ? String(b.category.id)
          : String(b.category_id || '');
        if (catId !== selectedCategory) return false;
      }

      // Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'featured' && !b.is_featured) return false;
        if (statusFilter === 'published' && b.published_date && new Date(b.published_date) > new Date()) return false;
      }

      return true;
    });
  }, [books, searchQuery, selectedCategory, statusFilter]);

  return (
    <AdminLayout
      title="Real Book CMS & Catalogue"
    >
      {/* Top Header & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search book title, author or ISBN..."
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
              Refresh
            </Button>

            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-xl bg-[#C9A66B] text-white font-bold text-xs shadow-sm hover:opacity-95 transition-opacity flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Book</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-[#E9DFCF] rounded-xl px-3 py-1.5 text-xs">
            <Tag className="w-3.5 h-3.5 text-[#C9A66B]" />
            <span className="text-[#8B7B68] text-[13px]">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Filter books by category"
              className="bg-transparent text-[#5C4B3A] font-medium focus:outline-none cursor-pointer text-xs"
            >
              <option value="all" className="bg-white text-[#5C4B3A]">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)} className="bg-white text-[#5C4B3A]">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {[
              { id: 'all', label: 'All Books' },
              { id: 'featured', label: 'Featured' },
            ].map((pill) => {
              const isActive = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id as FilterStatus)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                    isActive
                      ? 'bg-[#C9A66B] text-white border-gold-500 font-bold shadow-sm'
                      : 'bg-white text-[#8B7B68] border-[#E9DFCF] hover:border-[#E9DFCF] hover:text-[#5C4B3A]'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Count & Status */}
      <div className="text-xs text-[#8B7B68]">
        Loaded <strong className="text-[#5C4B3A]">{filteredBooks.length}</strong> of {books.length} backend book records
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

      {/* Empty State */}
      {fetchState === 'success' && filteredBooks.length === 0 && (
        <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <BookOpen className="w-8 h-8 text-[#C9A66B] mx-auto" />
          <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Books Found in Backend</p>
          <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
            {searchQuery || selectedCategory !== 'all'
              ? 'No backend books matched your active search filters.'
              : 'No book records exist in the database. Use "Create New Book" to add one.'}
          </p>
        </div>
      )}

      {/* Books Table */}
      {fetchState === 'success' && filteredBooks.length > 0 && (
        <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                  <th className="py-3 px-4 font-bold">Title</th>
                  <th className="py-3 px-4 font-bold">Slug</th>
                  <th className="py-3 px-4 font-bold">ISBN</th>
                  <th className="py-3 px-4 font-bold">Author</th>
                  <th className="py-3 px-4 font-bold">Price</th>
                  <th className="py-3 px-4 font-bold">Category</th>
                  <th className="py-3 px-4 font-bold">Stock</th>
                  <th className="py-3 px-4 font-bold">Featured</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredBooks.map((book) => {
                  const catObj = typeof book.category === 'object' ? book.category : null;
                  const catName = catObj?.name || 'Academic Monograph';
                  const priceStr = book.price !== undefined && book.price !== null ? `₹${book.price}` : '₹0.00';

                  return (
                    <tr key={book.id} className="hover:bg-[#FFF8EE] transition-colors">
                      {/* Title */}
                      <td className="py-3 px-4 font-bold text-[#5C4B3A] font-playfair">{book.title}</td>

                      {/* Slug */}
                      <td className="py-3 px-4 text-[13px] text-[#8B7B68] font-mono">{book.slug}</td>

                      {/* ISBN */}
                      <td className="py-3 px-4 font-mono text-[#C9A66B] text-[13px]">{book.isbn || 'No ISBN'}</td>

                      {/* Author */}
                      <td className="py-3 px-4 text-[#8B7B68] text-[13px]">{book.author || 'Author N/A'}</td>

                      {/* Price */}
                      <td className="py-3 px-4 font-bold text-[#5C4B3A]">
                        {priceStr}
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-[#8B7B68]">
                        <span className="inline-flex items-center gap-1 bg-[#FFF8EE] border border-[#E9DFCF] px-2 py-0.5 rounded text-[13px]">
                          {catName}
                        </span>
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-[#5C4B3A] font-semibold">
                        {book.stock ?? 0} units
                      </td>

                      {/* Featured */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleFeatured(book)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold border transition-all ${
                            book.is_featured
                              ? 'bg-[#FFF2D9] border-[#C9A66B] text-[#C9A66B]'
                              : 'bg-[#FFF8EE] border-[#E9DFCF] text-[#8B7B68] hover:text-[#5C4B3A]'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${book.is_featured ? 'fill-gold-400 text-[#C9A66B]' : ''}`} />
                          {book.is_featured ? 'Featured' : 'Standard'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/admin/books/${book.slug}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[13px] font-bold border hover:opacity-80 transition-opacity"
                            style={{ borderColor: '#C9A66B', color: '#8C6239', background: 'rgba(201,166,107,0.10)' }}
                            title="Manage book & chapters"
                          >
                            Manage <ArrowRight className="w-3 h-3" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(book)}
                            className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-blue-500/10 hover:text-blue-400 text-[#8B7B68] transition-colors"
                            title="Quick Edit Book"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingBook(book)}
                            className="p-1.5 rounded-lg bg-[#FFF8EE] hover:bg-red-500/10 hover:text-[#DC2626] text-[#8B7B68] transition-colors"
                            title="Delete Book"
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

      {/* CREATE / EDIT FORM DRAWER */}
      <AnimatePresence>
        {isFormOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFormOpen(false)}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-xl bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              {/* Form Header */}
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                    Backend Book Mutation
                  </span>
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    {editingBook ? `Edit Book: ${editingBook.title}` : 'Create New Academic Book'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-[#DC2626] text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                {pendingNotice && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-700 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{pendingNotice}</span>
                  </div>
                )}

                {/* Title & Slug */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Book Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Advances in Deep Learning Architectures"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Slug (URL string)</label>
                    <input
                      type="text"
                      placeholder="advances-in-deep-learning"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Author / Editors</label>
                    <input
                      type="text"
                      placeholder="Dr. A. Sharma et al."
                      value={formData.author}
                      onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Author / Editor Bio & Background</label>
                  <textarea
                    rows={2}
                    placeholder="Provide details about author experience, background, and research publications..."
                    value={formData.author_bio}
                    onChange={(e) => setFormData({ ...formData, author_bio: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] leading-relaxed"
                  />
                </div>

                {/* Additional Author Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Author Designation / Role</label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Professor & Dean"
                      value={formData.author_designation}
                      onChange={(e) => setFormData({ ...formData, author_designation: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">University / Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. IIT Madras / Imperial College"
                      value={formData.author_affiliation}
                      onChange={(e) => setFormData({ ...formData, author_affiliation: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                {/* Specifications Section */}
                <div className="pt-2">
                  <span className="text-[13px] font-bold text-[#C9A66B] uppercase tracking-wider block mb-2">Book Specifications</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[#8B7B68] font-semibold block">Publisher</label>
                      <input
                        type="text"
                        placeholder="MMSR Publications"
                        value={formData.publisher}
                        onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[#8B7B68] font-semibold block">Language</label>
                      <input
                        type="text"
                        placeholder="English"
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                      />
                    </div>
                  </div>
                </div>

                {/* ISBN & DOI & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">ISBN Number</label>
                    <input
                      type="text"
                      placeholder="978-93-98765-01-2"
                      value={formData.isbn}
                      onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">DOI Identifier</label>
                    <input
                      type="text"
                      placeholder="10.5281/mmsr.2026.01"
                      value={formData.doi}
                      onChange={(e) => setFormData({ ...formData, doi: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Academic Category</label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price, Stock, Published Date */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Price (INR ₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="499.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Stock Units</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="25"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Publish Date</label>
                    <input
                      type="date"
                      value={formData.published_date}
                      onChange={(e) => setFormData({ ...formData, published_date: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                {/* Additional Metadata: Pages, Rating */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Page Count</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="250"
                      value={formData.pages}
                      onChange={(e) => setFormData({ ...formData, pages: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Star Rating (1-5)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      placeholder="4.9"
                      value={formData.rating}
                      onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Description & Overview</label>
                  <textarea
                    rows={4}
                    placeholder="Provide detailed academic summary of this monograph..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] leading-relaxed"
                  />
                </div>

                {/* Files Upload (Cover Image, Sample PDF & Full Book PDF) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Cover Image (Image File)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#8B7B68] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FFF2D9] file:text-[#C9A66B] hover:file:bg-[#FFF2D9] cursor-pointer"
                    />
                    {editingBook?.cover_image && !coverFile && (
                      <span className="text-[13px] text-emerald-400 block truncate">Current: {editingBook.cover_image}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Sample Chapter PDF</label>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setSampleFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#8B7B68] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FFF2D9] file:text-[#C9A66B] hover:file:bg-[#FFF2D9] cursor-pointer"
                    />
                    {editingBook?.file_sample && !sampleFile && (
                      <span className="text-[13px] text-emerald-400 block truncate">Current: {editingBook.file_sample}</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Full Book PDF</label>
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setBookPdfFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#8B7B68] file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#FFF2D9] file:text-[#C9A66B] hover:file:bg-[#FFF2D9] cursor-pointer"
                    />
                    {editingBook?.file_pdf && !bookPdfFile && (
                      <span className="text-[13px] text-emerald-400 block truncate">Current: {editingBook.file_pdf}</span>
                    )}
                  </div>
                </div>

                {/* Featured Checkbox */}
                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_featured_cb"
                    checked={formData.is_featured}
                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                    className="w-4 h-4 rounded border-[#E9DFCF] bg-white text-gold-500 focus:ring-gold-500"
                  />
                  <label htmlFor="is_featured_cb" className="text-xs text-[#5C4B3A] font-medium cursor-pointer">
                    Mark as Featured Book on Homepage
                  </label>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-[#E9DFCF] flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A] font-semibold"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="gold"
                    size="sm"
                    isLoading={formSubmitting}
                  >
                    {editingBook ? 'Save Changes' : 'Create Book'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {deletingBook && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingBook(null)}
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
                <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">Confirm Book Deletion</h3>
              </div>

              <p className="text-xs text-[#8B7B68] leading-relaxed">
                Are you sure you want to delete <strong className="text-[#5C4B3A]">"{deletingBook.title}"</strong> from the backend database? This action is permanent and cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingBook(null)}
                  className="px-4 py-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A] text-xs font-semibold"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteConfirm}
                  isLoading={deleteLoading}
                  className="border-red-500/40 text-[#DC2626] hover:bg-red-500/20 font-bold"
                >
                  Delete Book
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
