'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Search,
  BookOpen,
  FileText,
  Presentation,
  Link as LinkIcon,
  Hash,
  PenTool,
  Edit3,
  ShieldCheck,
  Users,
  Award,
  Lightbulb,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { PublishingService, ServiceCategory } from '@/lib/types/service';
import { getPublishingServices, savePublishingServices } from '@/lib/services/publishingServices';

const AVAILABLE_ICONS = [
  'BookOpen',
  'FileText',
  'Layers',
  'Presentation',
  'Link',
  'Hash',
  'PenTool',
  'Edit3',
  'ShieldCheck',
  'Users',
  'Award',
  'Lightbulb',
];

const CATEGORIES: ServiceCategory[] = [
  'Publication',
  'Editorial',
  'Technical',
  'Certification',
  'Research Support',
];

export default function AdminServicesPage() {
  const [services, setServices] = useState<PublishingService[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<PublishingService | null>(null);
  const [deletingService, setDeletingService] = useState<PublishingService | null>(null);

  const [formData, setFormData] = useState<{
    title: string;
    shortDescription: string;
    fullDescription: string;
    icon: string;
    category: ServiceCategory;
    benefits: string;
    turnaround: string;
    tags: string;
  }>({
    title: '',
    shortDescription: '',
    fullDescription: '',
    icon: 'BookOpen',
    category: 'Publication',
    benefits: '',
    turnaround: '',
    tags: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadData = () => {
    setServices(getPublishingServices());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingService(null);
    setFormData({
      title: '',
      shortDescription: '',
      fullDescription: '',
      icon: 'BookOpen',
      category: 'Publication',
      benefits: '',
      turnaround: '3–5 business days',
      tags: '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service: PublishingService) => {
    setEditingService(service);
    setFormData({
      title: service.title,
      shortDescription: service.shortDescription,
      fullDescription: service.fullDescription,
      icon: service.icon,
      category: service.category,
      benefits: service.benefits ? service.benefits.join(', ') : '',
      turnaround: service.turnaround || '',
      tags: service.tags ? service.tags.join(', ') : '',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.shortDescription.trim()) {
      setFormError('Title and Short Description are required.');
      return;
    }

    const benefitsArray = formData.benefits
      .split(',')
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const tagsArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      if (editingService) {
        const updated = services.map((s) =>
          s.id === editingService.id
            ? {
                ...s,
                title: formData.title.trim(),
                shortDescription: formData.shortDescription.trim(),
                fullDescription: formData.fullDescription.trim() || formData.shortDescription.trim(),
                icon: formData.icon,
                category: formData.category,
                benefits: benefitsArray.length > 0 ? benefitsArray : s.benefits,
                turnaround: formData.turnaround.trim(),
                tags: tagsArray.length > 0 ? tagsArray : s.tags,
              }
            : s
        );
        setServices(updated);
        savePublishingServices(updated);
        setFormSuccess('Service updated successfully!');
      } else {
        const newService: PublishingService = {
          id: `svc-${Date.now()}`,
          title: formData.title.trim(),
          shortDescription: formData.shortDescription.trim(),
          fullDescription: formData.fullDescription.trim() || formData.shortDescription.trim(),
          icon: formData.icon,
          category: formData.category,
          benefits: benefitsArray.length > 0 ? benefitsArray : ['Professional Quality Assurance'],
          turnaround: formData.turnaround.trim() || '3–5 business days',
          tags: tagsArray.length > 0 ? tagsArray : ['Service'],
        };
        const updated = [newService, ...services];
        setServices(updated);
        savePublishingServices(updated);
        setFormSuccess('Service card added successfully!');
      }
      setTimeout(() => setIsModalOpen(false), 1000);
    } catch (err: any) {
      setFormError('Failed to save service card.');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deletingService) return;
    const updated = services.filter((s) => s.id !== deletingService.id);
    setServices(updated);
    savePublishingServices(updated);
    setDeletingService(null);
  };

  const filteredServices = services.filter((s) => {
    const matchesCategory =
      selectedCategory === 'All' || s.category.toLowerCase() === selectedCategory.toLowerCase();

    if (!searchQuery.trim()) return matchesCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      s.title.toLowerCase().includes(q) ||
      s.shortDescription.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  return (
    <AdminLayout
      title="Publishing Services Management"
      subtitle="Add, edit, or remove service cards displayed on the User-side Publishing Services page."
    >
      <div className="space-y-6 font-manrope">
        {/* Category Filters Bar */}
        <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-[#E9DFCF]">
          <span className="text-xs font-bold text-[#8B7B68] mr-2">Filter by Category:</span>
          {['All', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#C9A66B] text-white shadow-sm'
                  : 'bg-white border border-[#E9DFCF] text-[#73614C] hover:border-[#C9A66B]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Actions bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search publishing services..."
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
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Reload
            </Button>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2.5 rounded-xl bg-[#C9A66B] text-white font-bold text-xs shadow-sm hover:opacity-95 transition-opacity flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Service Card</span>
            </button>
          </div>
        </div>

        {/* Services Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredServices.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white border border-[#E9DFCF] rounded-2xl text-[#8B7B68]">
              <Layers className="w-8 h-8 mx-auto mb-2 text-[#C9A66B]/50" />
              <p className="font-bold text-sm">No service cards found.</p>
            </div>
          ) : (
            filteredServices.map((service) => (
              <div
                key={service.id}
                className="p-5 rounded-2xl bg-white border border-[#E9DFCF] shadow-sm flex flex-col justify-between gap-4 hover:border-[#C9A66B] transition-all"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFF2D9] text-[#C9A66B] text-[13px] font-bold border border-[#E9DFCF]">
                      {service.category}
                    </span>
                    <span className="text-[13px] text-[#73614C] font-semibold">{service.turnaround}</span>
                  </div>
                  <h3 className="font-bold text-base text-[#3E2E22] font-playfair">{service.title}</h3>
                  <p className="text-xs text-[#73614C] leading-relaxed line-clamp-3">{service.shortDescription}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#E9DFCF] mt-auto">
                  <span className="text-[13px] text-[#8B7B68] font-mono">Icon: {service.icon}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(service)}
                      className="p-2 rounded-xl text-[#8B7B68] hover:text-[#C9A66B] hover:bg-[#FFF2D9] transition-colors"
                      title="Edit Service Card"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingService(service)}
                      className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete Service Card"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E9DFCF] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9DFCF] bg-[#FAF6F0]">
                <h3 className="font-bold text-sm text-[#3E2E22] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#C9A66B]" />
                  <span>{editingService ? 'Edit Service Card' : 'Add Service Card'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-[#8B7B68] hover:bg-[#E9DFCF]/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-manrope overflow-y-auto">
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
                  <label className="text-[#8B7B68] font-semibold block">Service Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Journal Publishing"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as ServiceCategory })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Icon</label>
                    <select
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      {AVAILABLE_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Short Description *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Brief overview shown on card..."
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Full Description (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Extended details shown when expanded..."
                    value={formData.fullDescription}
                    onChange={(e) => setFormData({ ...formData, fullDescription: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Turnaround Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 3–5 business days"
                      value={formData.turnaround}
                      onChange={(e) => setFormData({ ...formData, turnaround: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Tags (comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. DOI, ISSN, Peer Review"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Benefits (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Crossref DOI, Double-blind review, Certificate"
                    value={formData.benefits}
                    onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-[#E9DFCF]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="gold" size="sm">
                    {editingService ? 'Save Changes' : 'Create Service Card'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E9DFCF] rounded-2xl p-6 shadow-xl w-full max-w-sm text-center space-y-4 font-manrope"
            >
              <div className="w-12 h-12 rounded-full bg-[#DC2626]/10 text-red-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[#3E2E22] font-playfair">Delete Service Card?</h3>
              <p className="text-xs text-[#73614C] leading-relaxed">
                Are you sure you want to remove <span className="font-bold text-[#3E2E22]">"{deletingService.title}"</span>?
                This card will no longer appear on the Publishing Services page.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setDeletingService(null)}>
                  Cancel
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleDeleteConfirm}
                  className="bg-red-600 hover:bg-red-700 text-white border-none"
                >
                  Delete Card
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
