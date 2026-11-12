'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { ContactFAQ, EnquiryType } from '@/lib/types/contact';
import { getContactFAQs, saveContactFAQs } from '@/lib/services/contact';

export default function AdminFAQsPage() {
  const [faqs, setFaqs] = useState<ContactFAQ[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageFilter, setSelectedPageFilter] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<ContactFAQ | null>(null);
  const [deletingFAQ, setDeletingFAQ] = useState<ContactFAQ | null>(null);

  const [formData, setFormData] = useState<{
    question: string;
    answer: string;
    category: EnquiryType;
    pageTarget: string;
  }>({
    question: '',
    answer: '',
    category: 'General Enquiry',
    pageTarget: 'Contact',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadData = () => {
    setFaqs(getContactFAQs());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingFAQ(null);
    setFormData({
      question: '',
      answer: '',
      category: 'General Enquiry',
      pageTarget: selectedPageFilter === 'All' ? 'Contact' : selectedPageFilter,
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (faq: ContactFAQ) => {
    setEditingFAQ(faq);
    setFormData({
      question: faq.question || '',
      answer: faq.answer || '',
      category: (faq.category || 'General Enquiry') as EnquiryType,
      pageTarget: faq.pageTarget || 'Contact',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.question.trim() || !formData.answer.trim()) {
      setFormError('Question and answer are required.');
      return;
    }

    try {
      if (editingFAQ) {
        const updated = faqs.map((f) =>
          f.id === editingFAQ.id ? { ...f, ...formData } : f
        );
        setFaqs(updated);
        saveContactFAQs(updated);
        setFormSuccess('FAQ updated successfully!');
      } else {
        const newFAQ: ContactFAQ = {
          id: `faq-${Date.now()}`,
          ...formData,
        };
        const updated = [newFAQ, ...faqs];
        setFaqs(updated);
        saveContactFAQs(updated);
        setFormSuccess('FAQ added successfully!');
      }
      setTimeout(() => setIsModalOpen(false), 1000);
    } catch (err: any) {
      setFormError('Failed to save FAQ.');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deletingFAQ) return;
    const updated = faqs.filter((f) => f.id !== deletingFAQ.id);
    setFaqs(updated);
    saveContactFAQs(updated);
    setDeletingFAQ(null);
  };

  const filteredFaqs = faqs.filter((f) => {
    const matchesPage =
      selectedPageFilter === 'All' ||
      (f.pageTarget || 'Contact').toLowerCase() === selectedPageFilter.toLowerCase();

    if (!searchQuery.trim()) return matchesPage;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      f.question.toLowerCase().includes(q) ||
      f.answer.toLowerCase().includes(q) ||
      (f.category || '').toLowerCase().includes(q) ||
      (f.pageTarget || '').toLowerCase().includes(q);

    return matchesPage && matchesSearch;
  });

  return (
    <AdminLayout
      title="User FAQs Management CMS"
      subtitle="Create, edit, and reorganize Frequently Asked Questions (FAQs) displayed across the platform and Contact page."
    >
      <div className="space-y-6 font-manrope">
        {/* Controls Bar */}
        {/* Page Target Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-[#E9DFCF]">
          <span className="text-xs font-bold text-[#8B7B68] mr-2">Filter by Target Page:</span>
          {['All', 'Contact', 'Publishing Services'].map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => setSelectedPageFilter(page)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedPageFilter === page
                  ? 'bg-[#C9A66B] text-white shadow-sm'
                  : 'bg-white border border-[#E9DFCF] text-[#73614C] hover:border-[#C9A66B]'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        {/* Search & Actions bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search FAQs by question, answer, or category..."
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
              <span>Add FAQ</span>
            </button>
          </div>
        </div>

        {/* FAQs List */}
        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <div className="p-12 text-center bg-white border border-[#E9DFCF] rounded-2xl text-[#8B7B68]">
              <HelpCircle className="w-8 h-8 mx-auto mb-2 text-[#C9A66B]/50" />
              <p className="font-bold text-sm">No FAQs found for target page: "{selectedPageFilter}".</p>
            </div>
          ) : (
            filteredFaqs.map((faq) => (
              <div
                key={faq.id}
                className="p-5 rounded-2xl bg-white border border-[#E9DFCF] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-[#C9A66B] transition-all"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#FFF2D9] text-[#C9A66B] text-[13px] font-bold border border-[#E9DFCF]">
                      {faq.category || 'General Enquiry'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#F4EFE6] text-[#73614C] text-[13px] font-bold border border-[#E9DFCF]">
                      Page: {faq.pageTarget || 'Contact'}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#3E2E22]">{faq.question}</h3>
                  <p className="text-xs text-[#73614C] leading-relaxed">{faq.answer}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[#E9DFCF] w-full md:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(faq)}
                    className="p-2 rounded-xl text-[#8B7B68] hover:text-[#C9A66B] hover:bg-[#FFF2D9] transition-colors"
                    title="Edit FAQ"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingFAQ(faq)}
                    className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete FAQ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
              className="bg-white border border-[#E9DFCF] rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9DFCF] bg-[#FAF6F0]">
                <h3 className="font-bold text-sm text-[#3E2E22] flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#C9A66B]" />
                  <span>{editingFAQ ? 'Edit FAQ' : 'Add FAQ'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-[#8B7B68] hover:bg-[#E9DFCF]/50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-manrope">
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Target Page</label>
                    <select
                      value={formData.pageTarget}
                      onChange={(e) => setFormData({ ...formData, pageTarget: e.target.value })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      <option value="Contact">Contact</option>
                      <option value="Publishing Services">Publishing Services</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as EnquiryType })}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] cursor-pointer"
                    >
                      <option value="General Enquiry">General Enquiry</option>
                      <option value="Editorial Enquiry">Editorial Enquiry</option>
                      <option value="Author Support">Author Support</option>
                      <option value="Publishing Enquiry">Publishing Enquiry</option>
                      <option value="Conference Enquiry">Conference Enquiry</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Question *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. How do I submit a manuscript?"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Answer *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide a detailed explanation..."
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E9DFCF]">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="gold" size="sm">
                    {editingFAQ ? 'Save Changes' : 'Create FAQ'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingFAQ && (
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
                <h4 className="font-bold text-base text-[#3E2E22]">Delete FAQ?</h4>
                <p className="text-xs text-[#8B7B68] mt-1">
                  Are you sure you want to delete this FAQ?
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDeletingFAQ(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                  onClick={handleDeleteConfirm}
                >
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
