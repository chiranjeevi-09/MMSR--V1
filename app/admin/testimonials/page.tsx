'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  MessageSquare,
  Search,
  RefreshCw,
  PlusCircle,
  Star,
  Pencil,
  BookMarked,
  Newspaper,
  ShieldCheck,
  Eye,
  EyeOff,
  Trash2,
  Mail,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { displayId, searchableRefs } from '@/lib/utils/publicId';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  AdminTestimonial,
  fetchAdminTestimonials,
  createAdminTestimonial,
  updateAdminTestimonial,
  deleteAdminTestimonial,
} from '@/lib/services/cms';

type FilterState = 'all' | 'active' | 'hidden';
type SourceFilter = 'all' | 'manual' | 'user';

interface TestimonialFormData {
  name: string;
  designation: string;
  university: string;
  country: string;
  rating: number;
  quote: string;
}

const EMPTY_FORM: TestimonialFormData = {
  name: '',
  designation: '',
  university: '',
  country: '',
  rating: 5,
  quote: '',
};

const SOURCE_CHIP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  manual: {
    label: 'Admin Added',
    cls: 'bg-[#FFF8EE] text-[#8B7B68] border-[#E9DFCF]',
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  book: {
    label: 'Book Review',
    cls: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <BookMarked className="w-3 h-3" />,
  },
  journal: {
    label: 'Journal Review',
    cls: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Newspaper className="w-3 h-3" />,
  },
};

export default function AdminTestimonialsPage() {
  const { tokens } = useAuth();
  const [testimonials, setTestimonials] = useState<AdminTestimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterState>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [actionError, setActionError] = useState<string | null>(null);

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminTestimonial | null>(null);
  const [form, setForm] = useState<TestimonialFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadTestimonials = useCallback(async () => {
    if (!tokens?.access) return;
    setLoading(true);
    try {
      const data = await fetchAdminTestimonials(tokens.access);
      setTestimonials(data);
    } catch {
      setTestimonials([]);
    } finally {
      setLoading(false);
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadTestimonials();
  }, [loadTestimonials]);

  const openAddModal = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setActionError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: AdminTestimonial) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      designation: item.designation || '',
      university: item.institution || '',
      country: item.country || '',
      rating: item.rating ?? 5,
      quote: item.content || '',
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens?.access) return;
    if (!form.name.trim() || !form.quote.trim()) {
      setActionError('Name and review text are required.');
      return;
    }

    setSaving(true);
    setActionError(null);
    const payload: Partial<AdminTestimonial> = {
      name: form.name.trim(),
      designation: form.designation.trim(),
      institution: form.university.trim(),
      rating: form.rating,
      content: form.quote.trim(),
    };

    try {
      if (editingItem) {
        const updated = await updateAdminTestimonial(tokens.access, editingItem.id, payload);
        setTestimonials((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const created = await createAdminTestimonial(tokens.access, { ...payload, source: 'manual', is_active: true });
        setTestimonials((prev) => [created, ...prev]);
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to save testimonial.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: AdminTestimonial) => {
    if (!tokens?.access) return;
    setActionError(null);
    try {
      const updated = await updateAdminTestimonial(tokens.access, item.id, {
        is_active: !(item.is_active ?? true),
      });
      setTestimonials((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to update publish status.');
    }
  };

  const handleDelete = async (item: AdminTestimonial) => {
    if (!tokens?.access) return;
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    setActionError(null);
    try {
      await deleteAdminTestimonial(tokens.access, item.id);
      setTestimonials((prev) => prev.filter((t) => t.id !== item.id));
    } catch (err: any) {
      setActionError(err?.message || 'Failed to delete testimonial.');
    }
  };

  const filteredTestimonials = useMemo(() => {
    return testimonials.filter((item) => {
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const nameStr = (item.name || '').toLowerCase();
        const uniStr = (item.institution || '').toLowerCase();
        const countryStr = (item.country || '').toLowerCase();
        const titleStr = (item.book_title || item.journal_title || '').toLowerCase();
        const refStr = searchableRefs(item.public_id);
        if (!nameStr.includes(q) && !uniStr.includes(q) && !countryStr.includes(q) && !titleStr.includes(q) && !refStr.includes(q)) return false;
      }

      const isActive = item.is_active ?? true;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'hidden' && isActive) return false;

      const source = item.source || 'manual';
      if (sourceFilter === 'manual' && source !== 'manual') return false;
      if (sourceFilter === 'user' && source === 'manual') return false;

      return true;
    });
  }, [testimonials, searchQuery, statusFilter, sourceFilter]);

  const pendingCount = useMemo(() => testimonials.filter((t) => !(t.is_active ?? true)).length, [testimonials]);

  return (
    <AdminLayout
      title="Testimonials CMS Management"
      subtitle="Review, edit and publish author reviews — including submissions from the public book & journal pages."
    >
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-xs text-[#8B7B68]">
            Total Testimonials: <strong className="text-[#5C4B3A]">{testimonials.length}</strong>
          </p>
          {pendingCount > 0 && (
            <span className="text-[13px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {pendingCount} Pending Review
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadTestimonials}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openAddModal}
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            + Add New Testimonial
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
          {actionError}
        </div>
      )}

      {/* Search & Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-white border border-[#E9DFCF] space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, institution, country, reviewed title or MMSR ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FFFBF7] border border-[#E9DFCF] rounded-xl pl-10 pr-4 py-2 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B]"
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'All Reviews' },
              { id: 'active', label: 'Published Only' },
              { id: 'hidden', label: 'Pending / Hidden' },
            ].map((pill) => {
              const isActive = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setStatusFilter(pill.id as FilterState)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#C9A66B] text-white border-[#C9A66B] shadow-sm'
                      : 'bg-white text-[#8B7B68] border-[#E9DFCF] hover:border-[#C9A66B]'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Source Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68]">Source:</span>
          {[
            { id: 'all', label: 'Everything' },
            { id: 'user', label: 'User Submitted' },
            { id: 'manual', label: 'Admin Added' },
          ].map((pill) => {
            const isActive = sourceFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSourceFilter(pill.id as SourceFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#5C4B3A] text-white border-[#5C4B3A]'
                    : 'bg-white text-[#8B7B68] border-[#E9DFCF] hover:border-[#5C4B3A]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Testimonials List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#8B7B68]">Loading testimonials...</div>
      ) : filteredTestimonials.length === 0 ? (
        <div className="p-12 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <MessageSquare className="w-10 h-10 text-[#C9A66B] mx-auto" />
          <p className="text-base font-bold text-[#5C4B3A] font-playfair">No Testimonials Found</p>
          <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
            Reviews submitted from the public book and journal pages land here for approval. You can also add
            testimonials manually.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTestimonials.map((item) => {
            const authorName = item.name || 'Academic Scholar';
            const roleStr = item.designation || 'Senior Researcher';
            const locationStr = [item.institution, item.country].filter(Boolean).join(', ');
            const starCount = item.rating ?? 5;
            const quoteText = item.content || '';
            const isActive = item.is_active ?? true;
            const source = item.source || 'manual';
            const chip = SOURCE_CHIP[source] || SOURCE_CHIP.manual;
            const reviewedTitle = item.book_title || item.journal_title;

            return (
              <div
                key={item.id}
                className={`p-6 rounded-2xl bg-white border transition-all flex flex-col justify-between gap-4 shadow-sm ${
                  isActive ? 'border-[#E9DFCF]' : 'border-amber-200 bg-amber-50/30'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: starCount }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#C9A66B] text-[#C9A66B]" />
                      ))}
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[13px] font-bold px-2 py-0.5 rounded-full border ${chip.cls}`}>
                      {chip.icon}
                      {chip.label}
                    </span>
                  </div>

                  {reviewedTitle && (
                    <p className="text-[13px] font-bold uppercase tracking-wider text-[#8B7B68] truncate">
                      On: {reviewedTitle}
                    </p>
                  )}

                  <p className="text-xs text-[#5C4B3A] leading-relaxed italic line-clamp-4">"{quoteText}"</p>

                  {item.email && (
                    <p className="text-[13px] text-[#8B7B68] flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 shrink-0" />
                      {item.email}
                    </p>
                  )}
                </div>

                <div className="pt-4 border-t border-[#E9DFCF] flex items-center justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <h5 className="text-xs font-bold text-[#5C4B3A] font-playfair truncate">{authorName}</h5>
                    <span className="text-[13px] text-[#C9A66B] font-semibold truncate">{roleStr}</span>
                    {locationStr && <span className="text-[13px] text-[#8B7B68] truncate">{locationStr}</span>}
                    {/* Testimonial reference (MMSR-TST) — quoted in moderation trails */}
                    <span className="text-[13px] font-mono text-[#8B7B68] truncate">{displayId(item)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[13px] font-bold px-2 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isActive ? 'Published' : source === 'manual' ? 'Hidden' : 'Pending'}
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="p-2 rounded-xl bg-white border border-[#E9DFCF] text-[#8B7B68] hover:bg-[#FFF8EE] hover:text-[#5C4B3A] transition-colors cursor-pointer"
                      title="Edit Testimonial"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(item)}
                      className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-white border-[#E9DFCF] text-[#8B7B68] hover:bg-amber-50 hover:text-amber-700'
                      }`}
                      title={isActive ? 'Hide from User Side' : 'Publish to User Side'}
                    >
                      {isActive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="p-2 rounded-xl bg-white border border-[#DC2626]/25 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete Testimonial"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Testimonial Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Testimonial' : 'Add New Scholar Testimonial'}
        subtitle={
          editingItem
            ? 'Edits save to the backend. Publish status is controlled separately on the card.'
            : 'This review will be published immediately to the user homepage slider upon saving.'
        }
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 font-manrope">
          <div>
            <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
              Author Full Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Sarah Jenkins"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Designation / Role</label>
              <input
                type="text"
                placeholder="e.g. Professor of Physics"
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5C4B3A] mb-1">University / Institute</label>
              <input
                type="text"
                placeholder="e.g. Stanford University"
                value={form.university}
                onChange={(e) => setForm({ ...form, university: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5C4B3A] mb-1">Star Rating</label>
            <select
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] font-bold"
            >
              <option value={5}>5 Stars (Excellent)</option>
              <option value={4}>4 Stars (Very Good)</option>
              <option value={3}>3 Stars (Good)</option>
              <option value={2}>2 Stars</option>
              <option value={1}>1 Star</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
              Testimonial Quote / Review Text <span className="text-red-600">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Enter the scholar recommendation or testimonial text... (max 50 words)"
              value={form.quote}
              onChange={(e) => setForm({ ...form, quote: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E9DFCF] bg-[#FFFBF7] text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={saving}>
              {editingItem ? 'Save Changes' : 'Save & Publish Testimonial'}
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
