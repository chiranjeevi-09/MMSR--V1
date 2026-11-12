'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Tag,
  Search,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Newspaper,
  Calendar,
  Layers,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { displayId, searchableRefs } from '@/lib/utils/publicId';
import { Button } from '@/components/ui/Button';
import {
  Category,
  fetchCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
} from '@/lib/services/cms';

type CategoryTab = 'books' | 'journals' | 'conferences' | 'all';
type FetchState = 'idle' | 'loading' | 'success' | 'error';

export default function AdminCategoriesPage() {
  const { tokens } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<CategoryTab>('books');
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Delete State
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category_type: 'books' as 'books' | 'journals' | 'conferences' | 'all',
    description: '',
  });

  // Load Data
  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMessage(null);

    try {
      const data = await fetchCategories(tokens.access);
      setCategories(data);
      setFetchState('success');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load categories.');
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Form
  const handleOpenCreate = (defaultType?: 'books' | 'journals' | 'conferences' | 'all') => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      category_type: defaultType || activeTab,
      description: '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name || '',
      slug: cat.slug || '',
      category_type: (cat.category_type as any) || 'all',
      description: cat.description || '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  // Submit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access) return;

    if (!formData.name.trim()) {
      setFormError('Category name is required.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      const slugVal = formData.slug.trim() || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      const payload = {
        name: formData.name.trim(),
        slug: slugVal,
        category_type: formData.category_type,
        description: formData.description.trim(),
      };

      if (editingCategory) {
        await updateAdminCategory(tokens.access, editingCategory.id, payload);
        setFormSuccess('Category updated successfully!');
      } else {
        await createAdminCategory(tokens.access, payload);
        setFormSuccess('Category created successfully!');
      }

      await loadData();
      setTimeout(() => setIsModalOpen(false), 1000);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save category.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Confirm Delete
  const handleDeleteConfirm = async () => {
    if (!deletingCategory || !tokens?.access) return;
    setDeleteLoading(true);
    try {
      await deleteAdminCategory(tokens.access, deletingCategory.id);
      setDeletingCategory(null);
      await loadData();
    } catch (err: any) {
      alert(`Delete failed: ${err?.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered List
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      // Tab filter
      if (activeTab !== 'all') {
        const catType = cat.category_type || 'all';
        if (catType !== activeTab && catType !== 'all') {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nMatch = (cat.name || '').toLowerCase().includes(q);
        const sMatch = (cat.slug || '').toLowerCase().includes(q);
        const dMatch = (cat.description || '').toLowerCase().includes(q);
        const rMatch = searchableRefs(cat.public_id).includes(q);
        if (!nMatch && !sMatch && !dMatch && !rMatch) return false;
      }

      return true;
    });
  }, [categories, activeTab, searchQuery]);

  return (
    <AdminLayout
      title="Catalogue Categories CMS"
      subtitle="Manage academic categories & domains for Books, Journals, and Conferences across the platform."
    >
      <div className="space-y-6">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search categories by name, slug, description or MMSR ID..."
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
              onClick={() => handleOpenCreate()}
              className="px-4 py-2.5 rounded-xl bg-[#C9A66B] text-white font-bold text-xs shadow-sm hover:opacity-95 transition-opacity flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Category</span>
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E9DFCF] pb-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('books')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'books'
                ? 'bg-[#C9A66B] text-white shadow-sm'
                : 'text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Books Categories ({categories.filter((c) => (c.category_type || 'all') === 'books' || (c.category_type || 'all') === 'all').length})</span>
          </button>

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
            <span>Journals Categories ({categories.filter((c) => (c.category_type || 'all') === 'journals' || (c.category_type || 'all') === 'all').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('conferences')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'conferences'
                ? 'bg-[#C9A66B] text-white shadow-sm'
                : 'text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Conferences Categories ({categories.filter((c) => (c.category_type || 'all') === 'conferences' || (c.category_type || 'all') === 'all').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-[#C9A66B] text-white shadow-sm'
                : 'text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF8EE]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>All Categories ({categories.length})</span>
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-[#DC2626]/25 text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Categories Grid / Table */}
        <div className="bg-white border border-[#E9DFCF] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#5C4B3A]">
              <thead className="bg-[#FAF6F0] border-b border-[#E9DFCF] font-bold text-[#8B7B68] uppercase text-[13px] tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Category Name</th>
                  <th className="px-5 py-3.5">MMSR ID</th>
                  <th className="px-5 py-3.5">Slug</th>
                  <th className="px-5 py-3.5">Assigned Module</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9DFCF]">
                {fetchState === 'loading' ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[#8B7B68]">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#C9A66B]" />
                      Loading catalog categories...
                    </td>
                  </tr>
                ) : filteredCategories.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[#8B7B68]">
                      <Tag className="w-8 h-8 mx-auto mb-2 text-[#C9A66B]/50" />
                      <p className="font-bold text-sm">No categories found.</p>
                      <p className="text-xs text-[#8B7B68] mt-1">
                        Click "Add Category" above to create a new category for this section.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((cat) => {
                    const typeLabel = cat.category_type === 'books'
                      ? 'Books'
                      : cat.category_type === 'journals'
                      ? 'Journals'
                      : cat.category_type === 'conferences'
                      ? 'Conferences'
                      : 'All Modules';

                    const typeBadgeColor = cat.category_type === 'books'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : cat.category_type === 'journals'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : cat.category_type === 'conferences'
                      ? 'bg-purple-100 text-purple-800 border-purple-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300';

                    return (
                      <tr key={cat.id} className="hover:bg-[#FFF9F1] transition-colors">
                        <td className="px-5 py-4 font-bold text-[#3E2E22]">
                          {cat.name}
                        </td>
                        <td className="px-5 py-4 text-[13px] font-mono text-[#8B7B68]">{displayId(cat)}</td>
                        <td className="px-5 py-4 font-mono text-[13px] text-[#8B7B68]">
                          {cat.slug}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[13px] font-bold border ${typeBadgeColor}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-[#73614C] max-w-xs truncate">
                          {cat.description || '—'}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(cat)}
                              className="p-1.5 rounded-lg text-[#8B7B68] hover:text-[#C9A66B] hover:bg-[#FFF2D9] transition-colors"
                              title="Edit Category"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingCategory(cat)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                              title="Delete Category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT CATEGORY MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E9DFCF] rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9DFCF] bg-[#FAF6F0]">
                <h3 className="font-bold text-sm text-[#3E2E22] flex items-center gap-2">
                  <Tag className="w-4 h-4 text-[#C9A66B]" />
                  <span>{editingCategory ? 'Edit Category' : 'Add New Category'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-[#8B7B68] hover:bg-[#E9DFCF]/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-[#DC2626]/25 text-red-700 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {formSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{formSuccess}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Category Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Artificial Intelligence & Data Science"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Target Publication Module *</label>
                  <select
                    value={formData.category_type}
                    onChange={(e) => setFormData({ ...formData, category_type: e.target.value as any })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                  >
                    <option value="books">Books Catalogue</option>
                    <option value="journals">Journals Catalogue</option>
                    <option value="conferences">Conferences Catalogue</option>
                    <option value="all">All Modules (Universal)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">URL Slug (Optional)</label>
                  <input
                    type="text"
                    placeholder="ai-data-science"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 font-mono text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                  <span className="text-[13px] text-[#8B7B68] block">Leave blank to auto-generate from category name.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of this domain or research field..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E9DFCF]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="gold"
                    size="sm"
                    isLoading={formSubmitting}
                  >
                    {editingCategory ? 'Save Changes' : 'Create Category'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E9DFCF] rounded-2xl shadow-xl w-full max-w-sm p-6 text-center space-y-4"
            >
              <div className="w-12 h-12 rounded-full bg-[#DC2626]/10 border border-[#DC2626]/25 text-red-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div>
                <h4 className="font-bold text-base text-[#3E2E22]">Delete Category?</h4>
                <p className="text-xs text-[#8B7B68] mt-1">
                  Are you sure you want to delete <span className="font-bold text-[#3E2E22]">{deletingCategory.name}</span>? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingCategory(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  isLoading={deleteLoading}
                  onClick={handleDeleteConfirm}
                >
                  Delete Category
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
