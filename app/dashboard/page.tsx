'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  FileText,
  ShoppingBag,
  BookOpen,
  Newspaper,
  Briefcase,
  ArrowRight,
  Bell,
  RefreshCw,
  CreditCard,
  TrendingUp,
  DollarSign,
  Package,
  ExternalLink,
  ShieldCheck,
  Send,
  BookOpenCheck,
  AlertTriangle,
  Search as SearchIcon,
  FileCheck,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { OrderStatusBadge } from '@/components/dashboard/OrderStatusBadge';
import { displayReference, publicIdOf, routeIdOf } from '@/lib/utils/publicId';
import {
  generateUserNotifications,
  getReadNotificationIds,
  markAllNotificationsAsRead,
  NotificationItem,
} from '@/lib/services/notifications';
import { fetchUserJournalAccess } from '@/lib/services/journals';
import { UserJournalAccess } from '@/lib/types/journal';

interface ActivityCounts {
  ordersCount: number;
  submissionsCount: number;
  publishedCount: number;
  pendingCount: number;
}

interface SubmissionItem {
  id: number;
  /** Standardized MMSR public ID (MMSR-SUB-1931-NNNNNN). */
  public_id?: string | null;
  title: string;
  status: string;
  status_display?: string;
  submission_type?: string;
  submitted_at?: string;
  updated_at?: string;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';

const SUB_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:             { label: 'Pending Review',      color: 'text-[#8C6239]',   bg: 'bg-[#8C6239]/10 border-[#8C6239]/30' },
  editorial_screening: { label: 'Editorial Screening', color: 'text-[#A97917]',   bg: 'bg-[#C99A2E]/10 border-[#C99A2E]/30' },
  under_review:        { label: 'Under Review',        color: 'text-[#5C4033]',   bg: 'bg-[#5C4033]/10 border-[#5C4033]/30' },
  revision_required:   { label: 'Revision Required',   color: 'text-[#B45309]',   bg: 'bg-[#D97706]/10 border-[#D97706]/30' },
  revision_requested:  { label: 'Revision Requested',  color: 'text-[#B45309]',   bg: 'bg-[#D97706]/10 border-[#D97706]/30' },
  accepted:            { label: 'Accepted',            color: 'text-[#1B4332]',   bg: 'bg-[#2F6B4F]/10 border-[#2F6B4F]/30' },
  rejected:            { label: 'Rejected',            color: 'text-[#DC2626]',   bg: 'bg-[#DC2626]/10 border-[#DC2626]/30' },
  published:           { label: 'Published',           color: 'text-[#8A6A1B]',   bg: 'bg-[#D4AC54]/15 border-[#D4AC54]/60' },
};

function getSubStatusConfig(status: string) {
  return SUB_STATUS_CONFIG[status?.toLowerCase()] ?? {
    label: status || 'Submitted', color: 'text-[#8C6239]', bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',
  };
}

export default function DashboardOverviewPage() {
  const { user, tokens } = useAuth();

  const [counts, setCounts] = useState<ActivityCounts>({
    ordersCount: 0,
    submissionsCount: 0,
    publishedCount: 0,
    pendingCount: 0,
  });
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [submissionsList, setSubmissionsList] = useState<SubmissionItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<{ id: string; title: string; date: string; type: string }[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('idle');

  const userFullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Scholar';

  const fetchDashboardMetrics = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const headers = { Authorization: `Bearer ${tokens.access}` };

      // Fetch Submissions and Orders in parallel — they are independent
      // per-user endpoints (halves dashboard load latency; no-store semantics
      // unchanged since these carry Authorization headers).
      const [subRes, orderRes] = await Promise.all([
        fetch(`${apiBase}/api/submissions/`, { headers }).catch(() => null),
        fetch(`${apiBase}/api/commerce/`, { headers }).catch(() => null),
      ]);

      let submissionsList_: SubmissionItem[] = [];
      if (subRes && subRes.ok) {
        const subData = await subRes.json();
        submissionsList_ = Array.isArray(subData) ? subData : subData.results ?? [];
      }
      setSubmissionsList(submissionsList_);

      let rawOrders: any[] = [];
      if (orderRes && orderRes.ok) {
        const orderData = await orderRes.json();
        const allOrders = Array.isArray(orderData) ? orderData : orderData.results ?? [];
        // Only successful payments belong on the dashboard overview — pending/unpaid orders are hidden
        rawOrders = allOrders.filter((order: any) => {
          const s = (order.status || '').toLowerCase();
          return s !== 'pending' && s !== 'cancelled';
        });
      }
      setOrdersList(rawOrders);

      const published = submissionsList_.filter((s) => s.status?.toLowerCase() === 'published').length;
      const pending = submissionsList_.filter((s) =>
        ['pending', 'under_review', 'editorial_screening'].includes(s.status?.toLowerCase())
      ).length;

      setCounts({
        ordersCount: rawOrders.length,
        submissionsCount: submissionsList_.length,
        publishedCount: published,
        pendingCount: pending,
      });

      // Build activity feed
      const activities: { id: string; title: string; date: string; type: string }[] = [];

      submissionsList_.slice(0, 3).forEach((sub) => {
        activities.push({
          id: `sub-${sub.id}`,
          title: `Submission: "${sub.title}" (${sub.status_display || sub.status})`,
          date: sub.submitted_at || sub.updated_at || '',
          type: 'submission',
        });
      });

      rawOrders.slice(0, 2).forEach((ord) => {
        activities.push({
          id: `ord-${ord.id}`,
          title: `Order ${displayReference(ord, ord.custom_order_id)} (${ord.status}) — ₹${ord.total_amount}`,
          date: ord.created_at || '',
          type: 'order',
        });
      });

      setRecentActivities(activities);
      setFetchState('success');
    } catch {
      setFetchState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [fetchDashboardMetrics]);

  // JOURNAL LIBRARY — active subscriptions + individually purchased articles
  const [journalLibrary, setJournalLibrary] = useState<UserJournalAccess[]>([]);
  const [libraryState, setLibraryState] = useState<FetchState>('idle');

  const fetchJournalLibrary = useCallback(async () => {
    if (!tokens?.access) return;
    setLibraryState('loading');
    try {
      const list = await fetchUserJournalAccess(tokens.access);
      setJournalLibrary(list);
      setLibraryState('success');
    } catch {
      setLibraryState('error');
    }
  }, [tokens?.access]);

  useEffect(() => {
    fetchJournalLibrary();
  }, [fetchJournalLibrary]);

  const activeSubscriptions = useMemo(
    () => journalLibrary.filter((a) => (a.accessType === 'subscription' || a.accessType === 'manual_grant') && a.issue == null && a.article == null && a.isValid),
    [journalLibrary]
  );
  const purchasedArticles = useMemo(
    () => journalLibrary.filter((a) => a.accessType === 'article' && a.article != null && a.isValid),
    [journalLibrary]
  );

  // Client side analytics calculation (successful orders only)
  const orderAnalytics = useMemo(() => {
    let totalSpent = 0;
    let booksCount = 0;
    let journalsCount = 0;
    let completedPayments = 0;

    ordersList.forEach((order) => {
      const statusNorm = (order.status || '').toLowerCase();
      const amount = parseFloat(order.total_amount || '0');

      if (['paid', 'delivered', 'shipped', 'completed'].includes(statusNorm)) {
        completedPayments += 1;
        if (!isNaN(amount)) totalSpent += amount;
      }

      if (Array.isArray(order.items)) {
        order.items.forEach((it: any) => {
          if (it.book) booksCount += (it.quantity || 1);
          if (it.journal_issue || it.journal_subscription) journalsCount += (it.quantity || 1);
        });
      }
    });

    return {
      totalOrders: ordersList.length,
      totalSpent,
      booksCount,
      journalsCount,
      completedPayments,
    };
  }, [ordersList]);

  // Latest 5 successful payments for Payment History Widget
  const latestPayments = useMemo(() => {
    return [...ordersList]
      .filter((order) => {
        const s = (order.status || '').toLowerCase();
        return s !== 'pending' && s !== 'cancelled';
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [ordersList]);

  // TASK 2 — Notification Widget (Latest 5 notifications)
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  useEffect(() => {
    setReadNotifIds(getReadNotificationIds());
  }, []);

  const latestNotifications = useMemo(() => {
    const list = generateUserNotifications(submissionsList, ordersList);
    return list.slice(0, 5);
  }, [submissionsList, ordersList]);

  const handleDashboardMarkAllRead = () => {
    const ids = latestNotifications.map(n => n.id);
    const updated = markAllNotificationsAsRead(ids);
    setReadNotifIds(updated);
  };

  const QUICK_ACTIONS = [
    {
      label: 'Submit Manuscript',
      href: '/submit-manuscript',
      description: 'Submit a research paper or book chapter for peer review.',
      icon: FileText,
    },
    {
      label: 'Browse Books',
      href: '/books',
      description: 'Explore MMSR Publications academic books catalogue.',
      icon: BookOpen,
    },
    {
      label: 'Browse Journals',
      href: '/journals',
      description: 'Access peer-reviewed open access journals.',
      icon: Newspaper,
    },
    {
      label: 'Publishing Services',
      href: '/services',
      description: 'Learn about DOI registration, editing, and indexing.',
      icon: Briefcase,
    },
  ];

  return (
    <DashboardLayout
      title="Dashboard Overview"
      subtitle={`Welcome back, ${userFullName}. Manage your submissions, orders, and academic profile.`}
    >
      {/* PUBLICATION ACTIVITY WIDGET */}
      {fetchState === 'success' && submissionsList.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
              <FileText className="w-4 h-4" /> Publication Activity
            </h3>
            <Link href="/dashboard/submissions" className="text-xs text-gold-400 hover:underline flex items-center gap-1 font-semibold">
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Manuscripts',   value: submissionsList.length,                                                                                                                           color: 'text-[#2F241A]', border: 'border-[#D4AC54]/60' },
              { label: 'Under Review',        value: submissionsList.filter(s => ['editorial_screening','under_review'].includes(s.status?.toLowerCase())).length,                                      color: 'text-[#5C4033]',    border: 'border-[#5C4033]/30' },
              { label: 'Accepted',            value: submissionsList.filter(s => s.status?.toLowerCase() === 'accepted').length,                                                                        color: 'text-[#1B4332]', border: 'border-[#2F6B4F]/30' },
              { label: 'Published',           value: submissionsList.filter(s => s.status?.toLowerCase() === 'published').length,                                                                       color: 'text-[#8A6A1B]',    border: 'border-[#D4AC54]/60' },
              { label: 'Revisions Required',  value: submissionsList.filter(s => ['revision_required','revision_requested'].includes(s.status?.toLowerCase())).length,                                  color: 'text-[#B45309]',  border: 'border-[#D97706]/30' },
            ].map((stat) => (
              <div key={stat.label} className={`p-3 rounded-xl bg-[#F8EEDC] border ${stat.border} text-center`}>
                <p className={`text-xl font-bold font-playfair ${stat.color}`}>{stat.value}</p>
                <p className="text-[13px] text-text-muted mt-0.5 leading-tight">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Recent submission timeline — latest 5 */}
          <div className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60">
            <p className="text-[13px] font-semibold text-text-muted uppercase tracking-wider mb-1">Recent Submissions</p>
            <div className="divide-y divide-[#D4AC54]/40">
            {[...submissionsList]
              .sort((a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime())
              .slice(0, 5)
              .map((sub) => {
                const sc = getSubStatusConfig(sub.status);
                return (
                  <Link
                    key={sub.id}
                    href={`/dashboard/submissions/${routeIdOf(sub)}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <Send className="w-3.5 h-3.5 text-gold-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ivory-white font-semibold truncate group-hover:text-gold-400 transition-colors">{sub.title}</p>
                      <p className="text-[13px] text-text-muted">
                        {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[13px] font-bold border ${sc.bg} ${sc.color} shrink-0`}>
                      {sc.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TASK 9 — ORDER ANALYTICS WIDGET */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Order & Financial Analytics
          </h3>
          <button
            type="button"
            onClick={fetchDashboardMetrics}
            className="text-[13px] text-text-muted hover:text-gold-400 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${fetchState === 'loading' ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. Total Orders */}
          <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-1">
            <span className="text-[13px] text-text-muted uppercase tracking-wider block">Total Orders</span>
            <p className="text-xl font-bold font-playfair text-ivory-white">
              {fetchState === 'loading' ? '...' : orderAnalytics.totalOrders}
            </p>
          </div>

          {/* 2. Total Amount Spent */}
          <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] space-y-1">
            <span className="text-[13px] text-text-muted uppercase tracking-wider block">Total Spent</span>
            <p className="text-xl font-bold font-playfair text-gold-400">
              {fetchState === 'loading' ? '...' : `₹${orderAnalytics.totalSpent.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`}
            </p>
          </div>

          {/* 3. Books Purchased */}
          <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-1">
            <span className="text-[13px] text-text-muted uppercase tracking-wider block">Books Purchased</span>
            <p className="text-xl font-bold font-playfair text-ivory-white">
              {fetchState === 'loading' ? '...' : orderAnalytics.booksCount}
            </p>
          </div>

          {/* 4. Journal Subscriptions */}
          <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-1">
            <span className="text-[13px] text-text-muted uppercase tracking-wider block">Journals & Subs</span>
            <p className="text-xl font-bold font-playfair text-ivory-white">
              {fetchState === 'loading' ? '...' : orderAnalytics.journalsCount}
            </p>
          </div>

          {/* 5. Completed Payments */}
          <div className="p-4 rounded-xl bg-[#F8EEDC] border border-emerald-500/20 space-y-1">
            <span className="text-[13px] text-text-muted uppercase tracking-wider block">Completed</span>
            <p className="text-xl font-bold font-playfair text-emerald-400">
              {fetchState === 'loading' ? '...' : orderAnalytics.completedPayments}
            </p>
          </div>
        </div>
      </div>

      {/* TASK 8 — PAYMENT HISTORY WIDGET */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gold-400" /> Recent Payment History
          </h3>
          <Link
            href="/dashboard/orders"
            className="text-xs text-gold-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>View All Orders</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {fetchState === 'loading' && (
          <div className="py-8 text-center text-xs text-text-muted">Fetching payment history...</div>
        )}

        {fetchState === 'success' && latestPayments.length === 0 && (
          <div className="p-8 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center space-y-2">
            <CreditCard className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-xs font-bold text-ivory-white">No Successful Payment Transactions Recorded</p>
            <p className="text-[13px] text-text-muted">
              Once you complete book or journal purchases through Razorpay, transaction logs will appear here.
            </p>
          </div>
        )}

        {fetchState === 'success' && latestPayments.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#D4AC54]/60 text-text-muted uppercase tracking-wider text-[13px]">
                  <th className="py-2.5 pr-4 font-bold">Reference / ID</th>
                  <th className="py-2.5 px-4 font-bold">Amount</th>
                  <th className="py-2.5 px-4 font-bold">Date</th>
                  <th className="py-2.5 px-4 font-bold">Status</th>
                  <th className="py-2.5 pl-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {latestPayments.map((pay) => {
                  const refId = publicIdOf(pay) ?? (pay.custom_order_id || pay.transaction_id || 'Not assigned yet');
                  const formattedDate = pay.created_at
                    ? new Date(pay.created_at).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'N/A';
                  const amount = parseFloat(pay.total_amount || '0');

                  return (
                    <tr key={pay.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pr-4 font-mono font-bold text-ivory-white text-[13px]">
                        {refId}
                      </td>
                      <td className="py-3 px-4 font-bold text-gold-400">
                        ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-text-muted">
                        {formattedDate}
                      </td>
                      <td className="py-3 px-4">
                        <OrderStatusBadge status={pay.status} size="sm" />
                      </td>
                      <td className="py-3 pl-4 text-right">
                        <Link
                          href={`/dashboard/orders/${routeIdOf(pay)}`}
                          className="px-2.5 py-1 rounded-lg bg-gold-500/10 border border-[#D4AC54] text-gold-400 hover:text-gold-300 transition-colors text-[13px] font-semibold inline-flex items-center gap-1"
                        >
                          <span>View Order</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* JOURNAL LIBRARY — My Active Journal Subscriptions */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D4AC54]/60 pb-3">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-gold-400" /> My Active Journal Subscriptions
          </h3>
          <button
            type="button"
            onClick={fetchJournalLibrary}
            className="text-[13px] text-text-muted hover:text-gold-400 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${libraryState === 'loading' ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>

        {libraryState === 'loading' && activeSubscriptions.length === 0 && (
          <div className="py-6 text-center text-xs text-text-muted">Loading your journal library...</div>
        )}

        {libraryState === 'success' && activeSubscriptions.length === 0 && (
          <div className="p-6 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center space-y-2">
            <Newspaper className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-xs font-bold text-ivory-white">No Active Journal Subscriptions</p>
            <p className="text-[13px] text-text-muted">
              Subscribe to a journal from the archive to unlock every article in it for a full year.
            </p>
            <Link href="/journals" className="inline-block mt-2">
              <Button size="sm" variant="gold" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Browse Journals
              </Button>
            </Link>
          </div>
        )}

        {activeSubscriptions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeSubscriptions.map((acc) => (
              <div key={acc.id} className="p-4 rounded-xl bg-white/5 border border-[#D4AC54]/60 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ivory-white truncate">{acc.journalTitle}</p>
                  <span className="text-[13px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                    Active
                  </span>
                </div>
                <p className="text-[13px] text-text-muted">
                  {acc.endDate
                    ? `Renews / expires on ${new Date(acc.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : 'Lifetime journal-wide access'}
                </p>
                {acc.journalSlug && (
                  <Link href={`/journals/${acc.journalSlug}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-gold-400 hover:underline">
                    Open Journal <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* JOURNAL LIBRARY — My Purchased Single Articles */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 space-y-4">
        <div className="flex items-center justify-between border-b border-[#D4AC54]/60 pb-3">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-gold-400" /> My Purchased Single Articles
          </h3>
          <Link href="/journals" className="text-[13px] text-gold-400 hover:underline font-semibold">
            Find More Articles
          </Link>
        </div>

        {libraryState === 'success' && purchasedArticles.length === 0 && (
          <div className="p-6 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center space-y-2">
            <FileText className="w-8 h-8 text-text-muted mx-auto" />
            <p className="text-xs font-bold text-ivory-white">No Single Article Purchases Yet</p>
            <p className="text-[13px] text-text-muted">
              Buy individual article PDFs directly from any article page — they stay unlocked in your library forever.
            </p>
          </div>
        )}

        {purchasedArticles.length > 0 && (
          <div className="space-y-2">
            {purchasedArticles.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-[#D4AC54]/60 hover:border-gold-500/50 transition-colors group">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-ivory-white truncate group-hover:text-gold-400 transition-colors">
                    {acc.articleTitle || 'Purchased Article'}
                  </p>
                  <p className="text-[13px] text-text-muted truncate">
                    {acc.journalTitle}
                    {acc.grantedAt
                      ? ` • Purchased ${new Date(acc.grantedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}`
                      : ''}
                  </p>
                </div>
                {acc.articleSlug && (
                  <Link
                    href={`/articles/${acc.articleSlug}`}
                    className="px-2.5 py-1 rounded-lg bg-gold-500/10 border border-[#D4AC54] text-gold-400 hover:text-gold-300 transition-colors text-[13px] font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <span>Read</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* TASK 2 — Dashboard Notifications Panel Widget */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D4AC54]/60 pb-3">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4 text-gold-400" />
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-ivory-white">
              Recent Author Notifications
            </h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDashboardMarkAllRead}
              className="text-[13px] text-gold-400 hover:text-gold-300 font-medium transition-colors"
            >
              Mark All Read
            </button>
            <Link
              href="/dashboard/notifications"
              className="px-3 py-1 rounded-lg bg-gold-500/10 border border-[#D4AC54] text-gold-400 hover:text-gold-300 transition-colors text-[13px] font-semibold flex items-center gap-1"
            >
              <span>View All Notifications</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {latestNotifications.length > 0 ? (
          <div className="space-y-2.5">
            {latestNotifications.map((notif) => {
              const isRead = notif.isRead || readNotifIds.includes(notif.id);
              return (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 text-xs ${
                    !isRead
                      ? 'bg-navy-950 border-gold-500/40 shadow-sm shadow-gold-500/5'
                      : 'bg-white/5 border-[#D4AC54]/60 hover:border-white/20'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#5C4033] line-clamp-1">{notif.title}</span>
                      {!isRead && <span className="w-2 h-2 rounded-full bg-gold-400 shrink-0"></span>}
                    </div>
                    <p className="text-[13px] text-text-muted line-clamp-1">{notif.message}</p>
                  </div>
                  {notif.linkUrl && (
                    <Link
                      href={notif.linkUrl}
                      className="px-2.5 py-1 rounded bg-gold-500/10 text-gold-300 hover:bg-gold-500/20 text-[13px] font-medium shrink-0 border border-[#D4AC54]"
                    >
                      {notif.linkText || 'View'}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-center space-y-1">
            <p className="text-xs font-semibold text-ivory-white">No New Notifications</p>
            <p className="text-[13px] text-text-muted">
              Notifications regarding manuscript review progress and order updates will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold font-playfair uppercase tracking-wider text-gold-400">Quick Portal Shortcuts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/60 hover:border-[#D4AC54] transition-all hover:bg-navy-800 hover:shadow-gold-glow flex items-start gap-4"
              >
                <div className="p-2.5 rounded-xl bg-gold-500/10 border border-[#D4AC54] shrink-0 group-hover:scale-110 transition-transform">
                  <Icon className="w-5 h-5 text-gold-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ivory-white group-hover:text-gold-400 transition-colors">
                      {action.label}
                    </span>
                    <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-gold-400 transition-colors shrink-0" />
                  </div>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
