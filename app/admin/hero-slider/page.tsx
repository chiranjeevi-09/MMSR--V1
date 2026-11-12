'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  Sliders,
  Search,
  RefreshCw,
  Info,
  ExternalLink,
  GripVertical,
  Eye,
  CheckCircle2,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  X,
  Upload,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { displayId, searchableRefs } from '@/lib/utils/publicId';
import { readPending, clearPending } from '@/lib/utils/pendingSync';
import { Button } from '@/components/ui/Button';
import {
  AdminSlide,
  fetchAdminSlider,
  createAdminSlide,
  updateAdminSlide,
  deleteAdminSlide,
  toggleAdminSlide,
} from '@/lib/services/cms';

type FilterState = 'all' | 'active' | 'inactive';
type FetchState = 'idle' | 'loading' | 'success' | 'error';

export default function AdminHeroSliderPage() {
  const { tokens } = useAuth();
  const [slides, setSlides] = useState<AdminSlide[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [loadError, setLoadError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterState>('all');

  // Drag-to-reorder state
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);

  // Full-size slide preview modal
  const [viewingSlide, setViewingSlide] = useState<AdminSlide | null>(null);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<AdminSlide | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formCtaText, setFormCtaText] = useState('');
  const [formCtaUrl, setFormCtaUrl] = useState('');
  const [formOrder, setFormOrder] = useState<number>(1);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string>('');

  const loadSlider = useCallback(async () => {
    setFetchState('loading');
    try {
      const data = await fetchAdminSlider(tokens?.access);
      setSlides(data);
      setFetchState('success');
    } catch (err: any) {
      // L-5: an empty list must never be shown as if it were the truth when the
      // server actually refused the request.
      setSlides([]);
      setLoadError(err?.message || 'The slider could not be loaded.');
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadSlider();
  }, [loadSlider]);

  // Open Modal for Create or Edit
  const handleOpenModal = (slide?: AdminSlide) => {
    if (slide) {
      setEditingSlide(slide);
      setFormTitle(slide.title || '');
      setFormSubtitle(slide.subtitle || '');
      setFormCtaText(slide.cta_text || 'Browse Books');
      setFormCtaUrl(slide.cta_url || slide.cta_link || '/books');
      setFormOrder(slide.display_order ?? slide.order ?? 1);
      setFormIsActive(slide.is_active ?? slide.active ?? true);
      setFormImagePreview(slide.image || slide.cover_image || '');
      setFormImageFile(null);
    } else {
      setEditingSlide(null);
      // A buffered draft only exists after a failed send, so re-offering it can
      // never revive a slide the server already rejected for good.
      const draft = readPending<Record<string, any>>('admin_slide_form');
      const d = draft?.data || {};
      setFormTitle(d.title || '');
      setFormSubtitle(d.subtitle || '');
      setFormCtaText(d.cta_text || 'Browse Books');
      setFormCtaUrl(d.cta_url || '/books');
      setFormOrder(typeof d.display_order === 'number' ? d.display_order : slides.length + 1);
      setFormIsActive(typeof d.is_active === 'boolean' ? d.is_active : true);
      setFormImagePreview('');
      setFormImageFile(null);
      if (draft) {
        alert(
          `An unsent slide from ${new Date(draft.savedAt).toLocaleString()} has been restored into the form — the server rejected it (${draft.reason}). The image must be chosen again.`,
        );
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSlide(null);
  };

  // Image Selection Handler
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormImageFile(file);
      setFormImagePreview(URL.createObjectURL(file));
    }
  };

  // Save Slide (Create or Edit)
  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('title', formTitle.trim());
      formData.append('subtitle', formSubtitle.trim());
      formData.append('caption', formSubtitle.trim());
      formData.append('cta_text', formCtaText.trim());
      formData.append('cta_url', formCtaUrl.trim());
      formData.append('link', formCtaUrl.trim());
      formData.append('display_order', formOrder.toString());
      formData.append('order', formOrder.toString());
      formData.append('is_active', formIsActive ? 'true' : 'false');
      formData.append('active', formIsActive ? 'true' : 'false');

      if (formImageFile) {
        formData.append('image', formImageFile);
      } else if (formImagePreview) {
        formData.append('image', formImagePreview);
      }

      let savedSlide: AdminSlide;
      if (editingSlide) {
        savedSlide = await updateAdminSlide(tokens?.access, editingSlide.id, formData);
      } else {
        savedSlide = await createAdminSlide(tokens?.access, formData);
        clearPending('admin_slide_form');
      }

      setSlides((prev) => {
        const idx = prev.findIndex((s) => s.id === savedSlide.id);
        if (idx !== -1) {
          const clone = [...prev];
          clone[idx] = savedSlide;
          return clone;
        }
        return [savedSlide, ...prev];
      });
      handleCloseModal();
      await loadSlider();
    } catch (err: any) {
      alert(err.message || 'Failed to save slide.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Active/Hidden State
  const handleToggleActive = async (slide: AdminSlide) => {
    const currentState = slide.is_active ?? slide.active ?? true;
    try {
      await toggleAdminSlide(tokens?.access, slide.id, currentState);
      await loadSlider();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle slide status.');
    }
  };

  // Delete Slide
  const handleDeleteSlide = async (id: number) => {
    if (!confirm('Are you sure you want to delete this hero slide?')) return;
    try {
      await deleteAdminSlide(tokens?.access, id);
      await loadSlider();
    } catch (err: any) {
      alert(err.message || 'Failed to delete slide.');
    }
  };

  // Drag & drop reorder: move the slide in the full sequence, renumber 1..n
  // automatically, and persist each changed display_order to the backend.
  const handleReorder = async (fromId: number, toId: number) => {
    if (fromId === toId) return;
    const ordered = [...slides].sort((a, b) => {
      const oa = a.display_order ?? a.order ?? a.id;
      const ob = b.display_order ?? b.order ?? b.id;
      return oa - ob;
    });
    const fromIdx = ordered.findIndex((s) => s.id === fromId);
    const toIdx = ordered.findIndex((s) => s.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    const previousOrders = new Map(slides.map((s) => [s.id, s.display_order ?? s.order]));
    const renumbered = ordered.map((s, i) => ({ ...s, display_order: i + 1 }));
    setSlides(renumbered);

    setReordering(true);
    try {
      for (const s of renumbered) {
        if (previousOrders.get(s.id) === s.display_order) continue;
        const fd = new FormData();
        fd.append('display_order', String(s.display_order));
        fd.append('order', String(s.display_order));
        await updateAdminSlide(tokens?.access, s.id, fd);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save the new slide order.');
    } finally {
      setReordering(false);
      await loadSlider();
    }
  };

  // Filter & Sort
  const filteredSlides = useMemo(() => {
    return slides
      .filter((slide) => {
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const titleStr = (slide.title || '').toLowerCase();
          const subStr = (slide.subtitle || '').toLowerCase();
          const refStr = searchableRefs(slide.public_id);
          if (!titleStr.includes(q) && !subStr.includes(q) && !refStr.includes(q)) return false;
        }

        if (statusFilter !== 'all') {
          const isActive = slide.is_active ?? slide.active ?? true;
          if (statusFilter === 'active' && !isActive) return false;
          if (statusFilter === 'inactive' && isActive) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const orderA = a.display_order ?? a.order ?? a.id;
        const orderB = b.display_order ?? b.order ?? b.id;
        return orderA - orderB;
      });
  }, [slides, searchQuery, statusFilter]);

  return (
    <AdminLayout
      title="Homepage Hero Slider Manager"
      subtitle="Full control to add, edit, activate, or remove homepage hero slides in live sequence."
    >

      {/* Controls Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search hero slides by title, subtitle or MMSR ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E9DFCF] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadSlider}
              isLoading={fetchState === 'loading'}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Button
              type="button"
              variant="gold"
              size="sm"
              onClick={() => handleOpenModal()}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Slide
            </Button>
          </div>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2">
          {[
            { id: 'all', label: 'All Slides' },
            { id: 'active', label: 'Active Slides' },
            { id: 'inactive', label: 'Inactive / Hidden' },
          ].map((pill) => {
            const isActive = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusFilter(pill.id as FilterState)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
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

      {/* Count */}
      <div className="text-xs text-[#8B7B68]">
        Showing <strong className="text-[#5C4B3A]">{filteredSlides.length}</strong> of {slides.length} homepage slides
        {reordering && (
          <span className="ml-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#C9A66B]">
            <span className="w-3 h-3 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
            Saving order…
          </span>
        )}
      </div>

      {/* Loading */}
      {fetchState === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#8B7B68]">Fetching live hero slider data...</p>
        </div>
      )}

      {/* Load failed — never presented as an empty catalogue */}
      {fetchState === 'error' && (
        <div
          role="alert"
          className="p-10 rounded-2xl bg-red-50 border border-red-200 text-center space-y-3"
        >
          <p className="text-sm font-bold text-red-700 font-playfair">Hero slider unavailable</p>
          <p className="text-xs text-red-600 max-w-md mx-auto">{loadError}</p>
          <Button variant="outline" size="sm" onClick={loadSlider} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Try again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {fetchState === 'success' && filteredSlides.length === 0 && (
        <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <Sliders className="w-8 h-8 text-[#C9A66B] mx-auto" />
          <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Hero Slides Found</p>
          <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'No slider items match your search or filter parameters.'
              : 'Click "Add New Slide" above to create your first homepage slide.'}
          </p>
        </div>
      )}

      {/* Slides Cards List */}
      {fetchState === 'success' && filteredSlides.length > 0 && (
        <div className="space-y-3">
          {filteredSlides.map((slide, idx) => {
            const isActive = slide.is_active ?? slide.active ?? true;

            return (
              <div
                key={slide.id}
                draggable
                onDragStart={(e) => {
                  setDragId(slide.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(slide.id));
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragId !== null && dragId !== slide.id) setDragOverId(slide.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === slide.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = dragId ?? Number(e.dataTransfer.getData('text/plain'));
                  if (fromId != null && !Number.isNaN(fromId)) handleReorder(fromId, slide.id);
                  setDragId(null);
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDragOverId(null);
                }}
                className={`p-4 rounded-2xl bg-white border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  dragOverId === slide.id && dragId !== slide.id
                    ? 'border-[#C9A66B] ring-2 ring-[#C9A66B]/30 bg-[#FFF8EE]'
                    : 'border-[#E9DFCF] hover:border-[#C9A66B]'
                } ${dragId === slide.id ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-[#FFF8EE] text-[#8B7B68] cursor-grab active:cursor-grabbing" title="Drag to reorder slides">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="w-16 h-12 rounded-xl bg-white border border-[#E9DFCF] relative overflow-hidden shrink-0 flex items-center justify-center">
                    {(slide.image || slide.cover_image) ? (
                      <Image
                        src={slide.image || slide.cover_image || ''}
                        alt={slide.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <Sliders className="w-5 h-5 text-[#C9A66B]/50" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] text-[#C9A66B] font-bold bg-[#FFF2D9] px-2 py-0.5 rounded border border-[#E9DFCF]">
                        #{idx + 1}
                      </span>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-[#8B7B68]">
                          <XCircle className="w-3 h-3" /> Hidden
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-[#5C4B3A] line-clamp-1">{slide.title}</h4>
                    {slide.subtitle && (
                      <p className="text-[13px] text-[#8B7B68] line-clamp-1">{slide.subtitle}</p>
                    )}
                    {/* Slide reference (MMSR-SLD) — position badge above is display order, not an ID */}
                    <p className="text-[13px] font-mono text-[#8B7B68]">{displayId(slide)}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setViewingSlide(slide)}
                    title="Open Full Preview"
                    className="p-2 rounded-xl bg-[#FFF2D9] border border-[#E9DFCF] text-[#C9A66B] hover:bg-[#FFE6B8] transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(slide)}
                    title={isActive ? 'Hide Slide' : 'Activate Slide'}
                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{isActive ? 'Active' : 'Hidden'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenModal(slide)}
                    title="Edit Slide"
                    className="p-2 rounded-xl bg-white border border-[#E9DFCF] text-[#5C4B3A] hover:bg-[#FFF8EE] hover:border-[#C9A66B] transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSlide(slide.id)}
                    title="Delete Slide"
                    className="p-2 rounded-xl bg-red-50 border border-[#DC2626]/25 text-red-600 hover:bg-[#DC2626]/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FULL SLIDE PREVIEW MODAL */}
      {viewingSlide && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewingSlide(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Hero slide full preview"
        >
          <div
            className="bg-white rounded-2xl border border-[#E9DFCF] shadow-2xl w-full max-w-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 bg-[#FFF8EE] border-b border-[#E9DFCF] flex items-center justify-between">
              <h3 className="font-bold font-playfair text-[#5C4B3A] text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#C9A66B]" />
                Slide Preview — {viewingSlide.title}
              </h3>
              <button
                type="button"
                onClick={() => setViewingSlide(null)}
                className="p-1 rounded-lg text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF2D9] transition-colors"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hero-style rendering as visitors see it */}
            <div className="relative min-h-[280px] sm:min-h-[340px] flex items-center p-8 bg-[#FFF8EE]">
              {(viewingSlide.image || viewingSlide.cover_image) ? (
                <Image
                  src={viewingSlide.image || viewingSlide.cover_image || ''}
                  alt={viewingSlide.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sliders className="w-10 h-10 text-[#C9A66B]/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#3E2E22]/70 via-[#3E2E22]/40 to-transparent" />
              <div className="relative z-10 max-w-xl space-y-3">
                <h2 className="text-xl sm:text-3xl font-bold font-playfair text-white leading-tight drop-shadow">
                  {viewingSlide.title}
                </h2>
                {viewingSlide.subtitle && (
                  <p className="text-sm text-white/90 leading-relaxed drop-shadow">{viewingSlide.subtitle}</p>
                )}
                {(viewingSlide.cta_text || viewingSlide.cta_url || viewingSlide.cta_link) && (
                  <div className="pt-2">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A66B] text-white font-bold text-xs shadow-sm">
                      <span>{viewingSlide.cta_text || 'Learn More'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-[#E9DFCF] flex items-center justify-between text-[13px] text-[#8B7B68]">
              <span>
                {viewingSlide.is_active ?? viewingSlide.active ?? true ? 'Active — visible on homepage' : 'Hidden — not shown on homepage'}
              </span>
              <span className="font-mono font-bold text-[#C9A66B]">#{filteredSlides.findIndex((s) => s.id === viewingSlide.id) + 1 || ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SLIDE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E9DFCF] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#FFF8EE] border-b border-[#E9DFCF] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#C9A66B]" />
                <h3 className="font-bold font-playfair text-[#5C4B3A] text-lg">
                  {editingSlide ? 'Edit Hero Slide' : 'Add New Hero Slide'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-[#8B7B68] hover:text-[#5C4B3A] hover:bg-[#FFF2D9] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveSlide} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                  Slide Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Publish. Discover. Inspire."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                  Subtitle / Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter slide description text..."
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    placeholder="Browse Books"
                    value={formCtaText}
                    onChange={(e) => setFormCtaText(e.target.value)}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                    CTA Button Link
                  </label>
                  <input
                    type="text"
                    placeholder="/books"
                    value={formCtaUrl}
                    onChange={(e) => setFormCtaUrl(e.target.value)}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value))}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                    Status
                  </label>
                  <select
                    value={formIsActive ? 'true' : 'false'}
                    onChange={(e) => setFormIsActive(e.target.value === 'true')}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Hidden (Inactive)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5C4B3A] mb-1">
                  Slide Image Artwork
                </label>
                <div className="flex items-center gap-3">
                  {formImagePreview && (
                    <div className="w-16 h-16 rounded-xl border border-[#E9DFCF] relative overflow-hidden shrink-0">
                      <Image src={formImagePreview} alt="Preview" fill className="object-cover" />
                    </div>
                  )}
                  <label className="flex-1 border-2 border-dashed border-[#E9DFCF] rounded-xl p-3 text-center cursor-pointer hover:border-[#C9A66B] transition-colors bg-[#FFF8EE]/50">
                    <Upload className="w-4 h-4 text-[#C9A66B] mx-auto mb-1" />
                    <span className="text-[13px] text-[#5C4B3A] font-semibold block">
                      {formImageFile ? formImageFile.name : 'Choose image file or drop here'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-[#E9DFCF] flex items-center justify-end gap-3">
                <Button type="button" variant="outline" size="sm" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" size="sm" isLoading={isSaving}>
                  {editingSlide ? 'Update Slide' : 'Create Slide'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
