'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Download,
  Trash2,
  Search,
  Users,
  Calendar,
  Inbox,
  Filter,
  RefreshCw,
} from 'lucide-react';

import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/Button';
import { getSubscribers, removeSubscriber, Subscriber } from '@/lib/services/subscribers';

export default function AdminSubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Compose Email Modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    setSubscribers(getSubscribers());
  }, []);

  const handleRefresh = () => {
    setSubscribers(getSubscribers());
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to remove this subscriber?')) {
      removeSubscriber(id);
      setSubscribers(getSubscribers());
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const filtered = subscribers.filter((s) =>
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.source && s.source.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeCount = subscribers.filter((s) => s.status === 'active').length;
  const newThisMonth = subscribers.filter((s) => {
    const t = new Date(s.subscribedAt).getTime();
    return !isNaN(t) && Date.now() - t <= 30 * 24 * 60 * 60 * 1000;
  }).length;

  const handleExportCSV = () => {
    const headers = ['ID', 'Email', 'Subscribed At', 'Source', 'Status'];
    const rows = filtered.map((s) => [s.id, s.email, s.subscribedAt, s.source || 'Footer', s.status]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `mmsr_subscribers_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendUpdates = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !body) return;

    // Recipients = the selected subscribers, or everyone currently in view.
    const recipients = (
      selectedIds.size > 0
        ? subscribers.filter((s) => selectedIds.has(s.id))
        : filtered
    )
      .map((s) => s.email)
      .filter(Boolean);

    if (recipients.length === 0) return;

    // Open the admin's mail client with every recipient CC'd so the broadcast can be sent.
    const href =
      `mailto:?cc=${encodeURIComponent(recipients.join(','))}` +
      `&subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    window.location.href = href;

    // Reset and close the composer — no in-app success notification.
    setComposeOpen(false);
    setSubject('');
    setBody('');
  };

  return (
    <AdminLayout
      title="Newsletter Subscribers & Audience"
      subtitle="View user subscriptions submitted via user side and broadcast academic updates."
    >
      <div className="space-y-6 font-manrope">
        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="p-4 sm:p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-[#C99A2E]">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex flex-col justify-center min-w-0 space-y-0.5">
              <span className="text-xs text-[#73614C] uppercase font-semibold leading-tight break-words">Total Subscribers</span>
              <h3 className="text-xl sm:text-2xl font-bold font-playfair text-[#2F241A] leading-tight break-words">{subscribers.length}</h3>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700">
              <Mail className="w-6 h-6" />
            </div>
            <div className="flex flex-col justify-center min-w-0 space-y-0.5">
              <span className="text-xs text-[#73614C] uppercase font-semibold leading-tight break-words">Active Subscribers</span>
              <h3 className="text-xl sm:text-2xl font-bold font-playfair text-[#2F241A] leading-tight break-words">{activeCount}</h3>
            </div>
          </div>

          <div className="p-4 sm:p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex items-center gap-3 sm:gap-4 overflow-hidden">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-700">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="flex flex-col justify-center min-w-0 space-y-0.5">
              <span className="text-xs text-[#73614C] uppercase font-semibold leading-tight break-words">New This Month</span>
              <h3 className="text-xl sm:text-2xl font-bold font-playfair text-[#2F241A] leading-tight break-words">{newThisMonth}</h3>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#73614C] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by email or source..."
              className="w-full bg-[#F8EEDC] border border-[#D4AC54] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#2F241A] placeholder-[#73614C] outline-none focus:border-[#C99A2E]"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export CSV
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={() => setComposeOpen(true)}
              leftIcon={<Send className="w-3.5 h-3.5" />}
            >
              Compose Broadcast Update
            </Button>
          </div>
        </div>

        {/* Subscribers Table */}
        <div className="rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8EEDC] border-b border-[#D4AC54] text-[#73614C] uppercase font-semibold">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                      className="rounded accent-[#C99A2E]"
                    />
                  </th>
                  <th className="p-4">Subscriber Email</th>
                  <th className="p-4">Registration Date</th>
                  <th className="p-4">Submission Source</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D4AC54]/40 text-[#2F241A]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-[#73614C]">
                      <Inbox className="w-8 h-8 text-[#C99A2E] mx-auto mb-2" />
                      No subscribers found matching your search.
                    </td>
                  </tr>
                ) : (
                  filtered.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[#F8EEDC]/50 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(sub.id)}
                          onChange={() => toggleSelect(sub.id)}
                          className="rounded accent-[#C99A2E]"
                        />
                      </td>
                      <td className="p-4 font-bold text-[#2F241A] font-mono">
                        {sub.email}
                      </td>
                      <td className="p-4 text-[#73614C]">
                        {new Date(sub.subscribedAt).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span className="inline-block bg-[#F8EEDC] border border-[#D4AC54] text-[#73614C] px-2.5 py-1 rounded-full text-[13px] whitespace-nowrap">
                          {sub.source || 'Home Footer'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[13px] font-bold uppercase">
                          Active
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(sub.id)}
                          className="p-2 text-red-600 hover:bg-red-500/10 rounded-lg transition-all"
                          title="Remove subscriber"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Compose Broadcast Modal */}
        {composeOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-3xl bg-[#FFF9F1] border-2 border-[#D4AC54] p-6 sm:p-8 shadow-2xl space-y-5">
              <div className="flex justify-between items-center border-b border-[#D4AC54] pb-4">
                <div>
                  <h3 className="text-xl font-bold font-playfair text-[#2F241A]">
                    Broadcast Academic Update
                  </h3>
                  <p className="text-xs text-[#73614C]">
                    Send announcement to {selectedIds.size > 0 ? selectedIds.size : subscribers.length} subscribed email recipient(s).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setComposeOpen(false)}
                  className="text-[#73614C] hover:text-[#2F241A] font-bold text-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSendUpdates} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#73614C] uppercase mb-1">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Call for Papers: Special Volume on Artificial Intelligence 2026"
                      className="w-full bg-[#F8EEDC] border border-[#D4AC54] rounded-xl px-4 py-2.5 text-xs text-[#2F241A] outline-none focus:border-[#C99A2E]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#73614C] uppercase mb-1">
                      Message Content (HTML or Text)
                    </label>
                    <textarea
                      required
                      rows={6}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Dear Author / Researcher, We are pleased to announce new book chapter submission windows..."
                      className="w-full bg-[#F8EEDC] border border-[#D4AC54] rounded-xl p-4 text-xs text-[#2F241A] outline-none focus:border-[#C99A2E]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <Button variant="outline" size="sm" type="button" onClick={() => setComposeOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      type="submit"
                      rightIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      Send Broadcast Now
                    </Button>
                  </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
