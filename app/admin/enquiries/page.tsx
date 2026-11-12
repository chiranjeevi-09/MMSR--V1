'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Inbox,
  Search,
  RefreshCw,
  Mail,
  Send,
  User,
  Building,
  Tag,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  X,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/context/AuthContext';
import { ContactSubmission } from '@/lib/types/contact';
import {
  fetchContactSubmissions,
  updateContactSubmission,
} from '@/lib/services/contact';

const STATUS_BADGES: Record<
  ContactSubmission['status'],
  { bg: string; text: string; border: string }
> = {
  New: { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-500/30' },
  'In Progress': { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-500/30' },
  Replied: { bg: 'bg-blue-500/10', text: 'text-blue-700', border: 'border-blue-500/30' },
  Resolved: { bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-500/30' },
};

export default function AdminEnquiriesPage() {
  const { tokens } = useAuth();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedEnquiry, setSelectedEnquiry] = useState<ContactSubmission | null>(null);

  // Admin reply form
  const [replyMessage, setReplyMessage] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!tokens?.access) return;
    setLoading(true);
    setLoadError(null);
    try {
      const list = await fetchContactSubmissions(tokens.access);
      setSubmissions(list);
    } catch (err: unknown) {
      setLoadError((err as Error)?.message || 'Failed to load enquiries.');
    } finally {
      setLoading(false);
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDetail = (sub: ContactSubmission) => {
    setSelectedEnquiry(sub);
    setReplyMessage(sub.adminReply || '');
    setAdminNotes(sub.adminNotes || '');
    setActionSuccess(null);
  };

  const handleStatusChange = async (id: string, newStatus: ContactSubmission['status']) => {
    if (!tokens?.access) return;
    setSaving(true);
    try {
      const updated = await updateContactSubmission(tokens.access, id, { status: newStatus });
      setSubmissions((prev) => prev.map((s) => (s.id === id ? updated : s)));
      if (selectedEnquiry && selectedEnquiry.id === id) {
        setSelectedEnquiry(updated);
      }
    } catch (err: unknown) {
      setLoadError((err as Error)?.message || 'Failed to update enquiry status.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry || !tokens?.access) return;

    if (!replyMessage.trim()) return;

    setSaving(true);
    try {
      // Persist the reply + status against the server record
      const updated = await updateContactSubmission(tokens.access, selectedEnquiry.id, {
        status: 'Replied',
        adminReply: replyMessage.trim(),
        adminNotes: adminNotes.trim(),
      });
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSelectedEnquiry(updated);

      // Open mail client for sending email directly to user's filled email
      const subject = encodeURIComponent(`Re: ${updated.subject} [Ref: ${updated.referenceId}]`);
      const body = encodeURIComponent(
        `Dear ${updated.fullName},\n\n` +
          `${replyMessage.trim()}\n\n` +
          `----------------------------------------\n` +
          `Original Enquiry Reference: ${updated.referenceId}\n` +
          `Enquiry Type: ${updated.enquiryType}\n` +
          `MMSR Publications Editorial & Support Team`
      );

      window.open(`mailto:${updated.email}?subject=${subject}&body=${body}`, '_blank');

      setActionSuccess('Reply recorded and email client launched!');
      setTimeout(() => setActionSuccess(null), 3500);
    } catch (err: unknown) {
      setLoadError((err as Error)?.message || 'Failed to record reply.');
    } finally {
      setSaving(false);
    }
  };

  const filteredSubmissions = submissions.filter((sub) => {
    const matchesStatus =
      selectedStatus === 'All' || sub.status.toLowerCase() === selectedStatus.toLowerCase();

    if (!searchQuery.trim()) return matchesStatus;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      sub.fullName.toLowerCase().includes(q) ||
      sub.email.toLowerCase().includes(q) ||
      sub.subject.toLowerCase().includes(q) ||
      sub.referenceId.toLowerCase().includes(q) ||
      sub.enquiryType.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  const countNew = submissions.filter((s) => s.status === 'New').length;

  return (
    <AdminLayout
      title="User Contact Enquiries & Support"
      subtitle="Monitor user enquiries submitted from the Contact page and respond directly via email."
    >
      <div className="space-y-6 font-manrope">
        {/* Quick Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-[#73614C] uppercase tracking-wider">Total Enquiries</p>
              <h3 className="text-xl font-bold text-[#2F241A]">{submissions.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#C99A2E]/15 border border-[#D4AC54] flex items-center justify-center text-[#C99A2E]">
              <Inbox className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F1] border border-emerald-500/30 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-emerald-800 uppercase tracking-wider">New Enquiries</p>
              <h3 className="text-xl font-bold text-emerald-900">{countNew}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700">
              <Mail className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F1] border border-amber-500/30 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-amber-800 uppercase tracking-wider">In Progress</p>
              <h3 className="text-xl font-bold text-amber-900">
                {submissions.filter((s) => s.status === 'In Progress').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FFF9F1] border border-blue-500/30 flex items-center justify-between">
            <div>
              <p className="text-[13px] font-bold text-blue-800 uppercase tracking-wider">Replied &amp; Resolved</p>
              <h3 className="text-xl font-bold text-blue-900">
                {submissions.filter((s) => s.status === 'Replied' || s.status === 'Resolved').length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {loadError && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* Filter & Search Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-2 border-b border-[#E9DFCF]">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#8B7B68] mr-1">Status:</span>
            {['All', 'New', 'In Progress', 'Replied', 'Resolved'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  selectedStatus === st
                    ? 'bg-[#C9A66B] text-white shadow-sm'
                    : 'bg-white border border-[#E9DFCF] text-[#73614C] hover:border-[#C9A66B]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-[#8B7B68] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, ref..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-[#E9DFCF] rounded-xl pl-9 pr-3 py-2 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B]"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadData}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Reload
            </Button>
          </div>
        </div>

        {/* Enquiries Table / List */}
        <div className="bg-white border border-[#E9DFCF] rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-[#8B7B68]">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 text-[#C9A66B]/50 animate-spin" />
              <p className="font-bold text-sm">Loading enquiries…</p>
            </div>
          ) : filteredSubmissions.length === 0 ? (
            <div className="p-12 text-center text-[#8B7B68]">
              <Inbox className="w-8 h-8 mx-auto mb-2 text-[#C9A66B]/50" />
              <p className="font-bold text-sm">No user enquiries found.</p>
              <p className="text-xs mt-1">When users submit enquiries on the Contact page, they will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E9DFCF]">
              {filteredSubmissions.map((sub) => {
                const badge = STATUS_BADGES[sub.status] || STATUS_BADGES.New;
                return (
                  <div
                    key={sub.id}
                    onClick={() => handleOpenDetail(sub)}
                    className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-[#FFF2D9]/30 transition-colors cursor-pointer group"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[13px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {sub.status}
                        </span>
                        <span className="text-[13px] font-mono text-[#8B7B68] bg-[#F4EFE6] px-2 py-0.5 rounded border border-[#E9DFCF]">
                          {sub.referenceId}
                        </span>
                        <span className="text-[13px] text-[#C9A66B] font-semibold bg-[#FFF2D9] px-2 py-0.5 rounded border border-[#E9DFCF]">
                          {sub.enquiryType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-[#3E2E22] group-hover:text-[#C9A66B] transition-colors truncate">
                          {sub.subject}
                        </h4>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#73614C] flex-wrap">
                        <span className="font-semibold text-[#3E2E22] flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[#C9A66B]" /> {sub.fullName}
                        </span>
                        <span className="text-[#8B7B68] flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-[#8B7B68]" /> {sub.email}
                        </span>
                        {sub.organization && (
                          <span className="text-[#8B7B68] flex items-center gap-1">
                            <Building className="w-3.5 h-3.5" /> {sub.organization}
                          </span>
                        )}
                        <span className="text-[13px] text-[#8B7B68] ml-auto">
                          {new Date(sub.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" rightIcon={<ChevronRight className="w-3.5 h-3.5" />}>
                        View &amp; Reply
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ENQUIRY DETAIL & REPLY MODAL */}
      <AnimatePresence>
        {selectedEnquiry && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border border-[#E9DFCF] rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col font-manrope"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9DFCF] bg-[#FAF6F0]">
                <div>
                  <h3 className="font-bold text-base text-[#3E2E22] font-playfair flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#C9A66B]" />
                    <span>Enquiry Details &amp; Reply</span>
                  </h3>
                  <p className="text-xs text-[#73614C] font-mono mt-0.5">Reference: {selectedEnquiry.referenceId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEnquiry(null)}
                  className="p-1 rounded-lg text-[#8B7B68] hover:bg-[#E9DFCF]/50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
                {actionSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{actionSuccess}</span>
                  </div>
                )}

                {/* User Info Box */}
                <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E9DFCF] space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="space-y-0.5">
                      <h4 className="font-bold text-sm text-[#3E2E22]">{selectedEnquiry.fullName}</h4>
                      <a
                        href={`mailto:${selectedEnquiry.email}`}
                        className="text-xs text-[#C9A66B] font-mono hover:underline flex items-center gap-1 font-bold"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {selectedEnquiry.email}
                      </a>
                    </div>

                    {/* Status Changer Buttons */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] text-[#8B7B68] font-bold mr-1">Status:</span>
                      {(['New', 'In Progress', 'Replied', 'Resolved'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={saving}
                          onClick={() => handleStatusChange(selectedEnquiry.id, st)}
                          className={`px-2.5 py-1 rounded-lg text-[13px] font-bold border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            selectedEnquiry.status === st
                              ? 'bg-[#C9A66B] text-white border-[#C9A66B]'
                              : 'bg-white text-[#73614C] border-[#E9DFCF] hover:border-[#C9A66B]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[#E9DFCF] text-[13px] text-[#73614C]">
                    <div>
                      <span className="font-semibold block text-[#8B7B68]">Enquiry Type:</span>
                      <span className="font-bold text-[#3E2E22]">{selectedEnquiry.enquiryType}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-[#8B7B68]">Organization:</span>
                      <span className="font-bold text-[#3E2E22]">{selectedEnquiry.organization || 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="font-semibold block text-[#8B7B68]">Date Submitted:</span>
                      <span className="font-bold text-[#3E2E22]">
                        {new Date(selectedEnquiry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Message Content */}
                <div className="space-y-1.5">
                  <h4 className="font-bold text-xs text-[#3E2E22] uppercase tracking-wider">User Subject &amp; Message</h4>
                  <div className="p-4 rounded-xl bg-white border border-[#E9DFCF] space-y-2">
                    <p className="font-bold text-sm text-[#3E2E22]">{selectedEnquiry.subject}</p>
                    <p className="text-xs text-[#5C4B3A] leading-relaxed whitespace-pre-wrap">{selectedEnquiry.message}</p>
                  </div>
                </div>

                {/* Admin Reply Form */}
                <form onSubmit={handleSendReply} className="space-y-4 pt-2 border-t border-[#E9DFCF]">
                  <h4 className="font-bold text-xs text-[#3E2E22] uppercase tracking-wider">
                    <span>Reply to User ({selectedEnquiry.email})</span>
                  </h4>

                  <div className="space-y-1.5">
                    <label className="text-[#8B7B68] font-semibold block">Response Message *</label>
                    <textarea
                      rows={4}
                      required
                      placeholder="Write your official response to the user's enquiry here..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedEnquiry(null)}>
                      Close
                    </Button>
                    <Button
                      type="submit"
                      variant="gold"
                      size="sm"
                      isLoading={saving}
                      leftIcon={!saving ? <Send className="w-4 h-4" /> : undefined}
                    >
                      Send Email Reply to User
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
