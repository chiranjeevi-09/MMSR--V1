'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  PlusCircle,
  Edit,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { ContactInfo } from '@/lib/types/contact';
import { getContactDepartments, saveContactDepartments } from '@/lib/services/contact';
import { SITE_DOMAIN } from '@/lib/config/site';

export default function AdminContactDepartmentsPage() {
  const [departments, setDepartments] = useState<ContactInfo[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<ContactInfo | null>(null);
  const [deletingDept, setDeletingDept] = useState<ContactInfo | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    email: '',
    icon: 'Mail',
    responseTime: 'Within 2–3 business days',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const loadData = () => {
    setDepartments(getContactDepartments());
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingDept(null);
    setFormData({
      title: '',
      description: '',
      email: '',
      icon: 'Mail',
      responseTime: 'Within 2–3 business days',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept: ContactInfo) => {
    setEditingDept(dept);
    setFormData({
      title: dept.title || '',
      description: dept.description || '',
      email: dept.email || '',
      icon: dept.icon || 'Mail',
      responseTime: dept.responseTime || 'Within 2–3 business days',
    });
    setFormError(null);
    setFormSuccess(null);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.email.trim()) {
      setFormError('Department title and email address are required.');
      return;
    }

    try {
      if (editingDept) {
        const updated = departments.map((d) =>
          d.id === editingDept.id ? { ...d, ...formData } : d
        );
        setDepartments(updated);
        saveContactDepartments(updated);
        setFormSuccess('Department updated successfully!');
      } else {
        const newDept: ContactInfo = {
          id: `dept-${Date.now()}`,
          ...formData,
        };
        const updated = [newDept, ...departments];
        setDepartments(updated);
        saveContactDepartments(updated);
        setFormSuccess('Department added successfully!');
      }
      setTimeout(() => setIsModalOpen(false), 1000);
    } catch (err: any) {
      setFormError('Failed to save department.');
    }
  };

  const handleDeleteConfirm = () => {
    if (!deletingDept) return;
    const updated = departments.filter((d) => d.id !== deletingDept.id);
    setDepartments(updated);
    saveContactDepartments(updated);
    setDeletingDept(null);
  };

  return (
    <AdminLayout
      title="Contact Departments & Response Times CMS"
      subtitle="Manage contact departments, email routing, and official enquiry response times displayed on the Contact Us page."
    >
      <div className="space-y-6 font-manrope">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <p className="text-xs text-[#8B7B68]">
            Showing <span className="font-bold text-[#3E2E22]">{departments.length}</span> contact departments
          </p>

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
              <span>Add Department</span>
            </button>
          </div>
        </div>

        {/* Departments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="p-5 rounded-2xl bg-white border border-[#E9DFCF] shadow-sm flex flex-col justify-between gap-4 hover:border-[#C9A66B] transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-[#FFF2D9] text-[#C9A66B]">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(dept)}
                      className="p-1.5 rounded-lg text-[#8B7B68] hover:text-[#C9A66B] hover:bg-[#FFF2D9] transition-colors"
                      title="Edit Department"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingDept(dept)}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete Department"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-[#3E2E22]">{dept.title}</h3>
                <p className="text-xs text-[#73614C] leading-relaxed">{dept.description}</p>
              </div>

              <div className="pt-3 border-t border-[#E9DFCF] space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-[#C9A66B] font-mono font-medium truncate">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{dept.email}</span>
                </div>
                <div className="flex items-center gap-2 text-[#8B7B68] text-[13px]">
                  <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Response: <strong className="text-[#3E2E22]">{dept.responseTime || 'Within 2–3 business days'}</strong></span>
                </div>
              </div>
            </div>
          ))}
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
                  <Building2 className="w-4 h-4 text-[#C9A66B]" />
                  <span>{editingDept ? 'Edit Contact Department' : 'Add Contact Department'}</span>
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

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Department Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Editorial Enquiries"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Contact Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder={`editorial@${SITE_DOMAIN}`}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Official Response Time *</label>
                  <input
                    type="text"
                    required
                    placeholder="Within 2 business days"
                    value={formData.responseTime}
                    onChange={(e) => setFormData({ ...formData, responseTime: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3.5 py-2.5 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[#8B7B68] font-semibold block">Description</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of department scope..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E9DFCF]">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="gold" size="sm">
                    {editingDept ? 'Save Changes' : 'Create Department'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deletingDept && (
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
                <h4 className="font-bold text-base text-[#3E2E22]">Delete Department?</h4>
                <p className="text-xs text-[#8B7B68] mt-1">
                  Are you sure you want to delete <span className="font-bold text-[#3E2E22]">{deletingDept.title}</span>?
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDeletingDept(null)}>
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
