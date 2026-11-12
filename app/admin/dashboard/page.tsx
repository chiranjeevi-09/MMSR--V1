'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Users,
  BookOpen,
  Newspaper,
  Calendar,
  FileText,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle2,
  Activity,
  ArrowRight,
  Shield,
  Server,
  Database,
  Mail,
  Zap,
  RefreshCw,
  MessageSquare,
  Sliders,
  ChevronRight,
  Crown,
  Ban,
  UserCog,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { displayReference } from '@/lib/utils/publicId';

interface Metrics {
  users: number;
  books: number;
  journals: number;
  conferences: number;
  pendingSubmissions: number;
  publishedPapers: number;
  ordersToday: number;
  totalRevenue: number;
  // Submission review analytics (Phase 9B Task 8)
  pendingScreening: number;
  underReview: number;
  revisionRequested: number;
  acceptedToday: number;
  rejectedPapers: number;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';

// Server-side headcount of CMS administrators (/api/users/admin-stats/)
interface AdminStats {
  total_admins: number;
  active_admins: number;
  inactive_admins: number;
  super_admins: number;
  editorial_admins: number;
  active_super_admins: number;
  active_editorial_admins: number;
}

const DASHBOARD_CACHE_KEY = 'mmsr_admin_metrics_v2';

const DEFAULT_METRICS: Metrics = {
  users: 0, books: 0, journals: 0, conferences: 0,
  pendingSubmissions: 0, publishedPapers: 0, ordersToday: 0, totalRevenue: 0,
  pendingScreening: 0, underReview: 0, revisionRequested: 0, acceptedToday: 0, rejectedPapers: 0,
};

function readCachedDashboardData() {
  if (typeof window === 'undefined') {
    return { metrics: DEFAULT_METRICS, stats: null, subs: [], activities: [] };
  }
  try {
    const raw = sessionStorage.getItem(DASHBOARD_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          metrics: { ...DEFAULT_METRICS, ...(parsed.metrics || {}) },
          stats: parsed.stats || null,
          subs: Array.isArray(parsed.subs) ? parsed.subs : [],
          activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        };
      }
    }
  } catch {}
  return { metrics: DEFAULT_METRICS, stats: null, subs: [], activities: [] };
}

const QUICK_ACTIONS = [
  { title: 'Add New Book', desc: 'Publish a new monograph or textbook entry', icon: BookOpen, href: '/admin/books' },
  { title: 'Add Journal Issue', desc: 'Manage volumes and issue publications', icon: Newspaper, href: '/admin/journals' },
  { title: 'Review Submissions', desc: 'Screen incoming author manuscripts', icon: FileText, href: '/admin/journal-submissions' },
  { title: 'Add Testimonial', desc: 'Manage editorial feedback and reviews', icon: MessageSquare, href: '/admin/testimonials' },
  { title: 'Manage Hero Slider', desc: 'Update homepage banners and announcements', icon: Sliders, href: '/admin/hero-slider' },
  { title: 'View Customer Orders', desc: 'Track sales and fulfillment invoices', icon: ShoppingBag, href: '/admin/orders' },
];

export default function AdminDashboardPage() {
  const { tokens, user, refreshAccessToken } = useAuth();
  // Read auth state at call time via a ref, never through effect deps:
  // refreshAccessToken() updates `tokens`, and if `tokens` were in the
  // useCallback deps that would re-trigger the fetch in an endless loop
  // (visible as metrics flickering between 0 and their real values).
  const authRef = useRef({ tokens, refreshAccessToken });
  authRef.current = { tokens, refreshAccessToken };
  // The page mounts while auth is still hydrating from sessionStorage, so the
  // first effect pass may not have a token yet. This flag lets the fetch fire
  // exactly once — as soon as a token exists — without ever re-triggering on
  // later token updates (which a refresh produces).
  const didInitialFetch = useRef(false);
  const [metrics, setMetrics] = useState<Metrics>({
    users: 0, books: 0, journals: 0, conferences: 0,
    pendingSubmissions: 0, publishedPapers: 0, ordersToday: 0, totalRevenue: 0,
    pendingScreening: 0, underReview: 0, revisionRequested: 0, acceptedToday: 0, rejectedPapers: 0,
  });
  const [recentActivities, setRecentActivities] = useState<{ id: string; title: string; subtitle: string; time: string; type: string; subId?: number }[]>([]);
  const [submissionFeed, setSubmissionFeed] = useState<{ id: number; title: string; author: string; status: string; status_label: string; time: string; type: string }[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('loading');

  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const fetchAdminMetrics = useCallback(async () => {
    const { tokens, refreshAccessToken } = authRef.current;
    if (!tokens?.access) return;
    setFetchState('loading');

    try {
      const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      // Use active access token directly; only invoke refreshAccessToken if absent
      let access: string | null | undefined = tokens?.access;
      if (!access && refreshAccessToken) {
        access = await refreshAccessToken();
      }
      if (!access) return;
      const headers = { Authorization: `Bearer ${access}` };

      // Helper: DRF paginated responses expose the true total as `count`;
      // never trust one page's length for a headline number.
      const listOf = (data: any): any[] => (Array.isArray(data) ? data : data?.results ?? []);
      const totalOf = (data: any, list: any[]): number =>
        typeof data?.count === 'number' ? data.count : list.length;

      // Parallelize only the 5 required endpoints with page_size limits:
      // - admin-stats returns all system-wide counts directly in ~15ms without downloading entity trees
      // - commerce/stats returns commerce totals
      // - users, submissions, commerce only load 5-10 recent items for the widgets
      const [
        adminStatsRes,
        statsRes,
        usersRes,
        subRes,
        ordRes,
      ] = await Promise.all([
        fetch(apiBase + "/api/users/admin-stats/", { headers }).catch(() => null),
        fetch(apiBase + "/api/commerce/stats/", { headers }).catch(() => null),
        fetch(apiBase + "/api/users/?page_size=5&ordering=-date_joined", { headers }).catch(() => null),
        fetch(apiBase + "/api/submissions/?page_size=10&ordering=-submitted_at", { headers }).catch(() => null),
        fetch(apiBase + "/api/commerce/?page_size=5&ordering=-created_at", { headers }).catch(() => null),
      ]);

      let adminStatsData: any = null;
      if (adminStatsRes && adminStatsRes.ok) {
        adminStatsData = await adminStatsRes.json();
        setAdminStats(adminStatsData);
      }

      let totalRev = 0;
      let todayOrders = 0;
      if (statsRes && statsRes.ok) {
        const st = await statsRes.json();
        totalRev = parseFloat(st.total_revenue || '0') || 0;
        todayOrders = Number(st.orders_today || 0);
      }

      let rawUsers: any[] = [];
      let usersCount = adminStatsData?.users_total ?? 0;
      if (usersRes && usersRes.ok) {
        const data = await usersRes.json();
        rawUsers = listOf(data);
        if (!usersCount) usersCount = totalOf(data, rawUsers);
      }

      let rawSubs: any[] = [];
      if (subRes && subRes.ok) {
        const data = await subRes.json();
        rawSubs = listOf(data);
      }

      let rawOrders: any[] = [];
      if (ordRes && ordRes.ok) {
        rawOrders = listOf(await ordRes.json());
      }

      const booksCount = adminStatsData?.books_total ?? 0;
      const journalsCount = adminStatsData?.journals_total ?? 0;
      const confCount = adminStatsData?.conferences_total ?? 0;
      const pendingSub = adminStatsData?.submissions_pending ?? rawSubs.filter((s) => ['pending', 'under_review', 'editorial_screening'].includes(s.status?.toLowerCase())).length;
      const publishedSub = adminStatsData?.submissions_published ?? rawSubs.filter((s) => s.status?.toLowerCase() === 'published').length;
      const pendingScreening = adminStatsData?.submissions_screening ?? rawSubs.filter((s) => s.status?.toLowerCase() === 'pending').length;
      const underReviewCount = adminStatsData?.submissions_under_review ?? rawSubs.filter((s) => ['editorial_screening', 'under_review'].includes(s.status?.toLowerCase())).length;
      const revisionReqCount = adminStatsData?.submissions_revision ?? rawSubs.filter((s) => ['revision_requested', 'revision_required'].includes(s.status?.toLowerCase())).length;
      const acceptedTodayCount = adminStatsData?.submissions_accepted_today ?? 0;
      const rejectedCount = adminStatsData?.submissions_rejected ?? rawSubs.filter((s) => s.status?.toLowerCase() === 'rejected').length;

      setMetrics({
        users: usersCount, books: booksCount, journals: journalsCount, conferences: confCount,
        pendingSubmissions: pendingSub, publishedPapers: publishedSub,
        ordersToday: todayOrders, totalRevenue: totalRev,
        pendingScreening, underReview: underReviewCount, revisionRequested: revisionReqCount,
        acceptedToday: acceptedTodayCount, rejectedPapers: rejectedCount,
      });

      // Submission Activity Feed — latest 10 (Task 9)
      const sortedSubs = [...rawSubs].sort((a, b) =>
        new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime()
      );
      const STATUS_LABELS: Record<string, string> = {
        pending: 'Pending Review', editorial_screening: 'Screening', under_review: 'Under Review',
        revision_requested: 'Revision', revision_required: 'Revision', accepted: 'Accepted',
        published: 'Published', rejected: 'Rejected',
      };
      setSubmissionFeed(
        sortedSubs.slice(0, 10).map((s) => ({
          id: s.id,
          title: s.title,
          author: s.author_name || s.author_email || 'Author',
          status: s.status?.toLowerCase() || 'pending',
          status_label: STATUS_LABELS[s.status?.toLowerCase()] || s.status,
          time: s.submitted_at || s.created_at || '',
          type: (s.submission_type || '').toLowerCase(),
        }))
      );

      // Build Activity Feed
      const activities: { id: string; title: string; subtitle: string; time: string; type: string }[] = [];

      rawSubs.slice(0, 2).forEach((s) => {
        activities.push({
          id: `sub-${s.id}`,
          title: `Manuscript Submitted`,
          subtitle: `"${s.title}" by ${s.author_name || 'Author'}`,
          time: s.submitted_at || s.created_at || 'Recent',
          type: 'submission',
        });
      });

      rawOrders.slice(0, 2).forEach((o) => {
        activities.push({
          id: `ord-${o.id}`,
          title: `New Order ${displayReference(o, o.custom_order_id)}`,
          subtitle: `Amount: ₹${o.total_amount} · Status: ${o.status}`,
          time: o.created_at || 'Recent',
          type: 'order',
        });
      });

      rawUsers.slice(0, 2).forEach((u) => {
        activities.push({
          id: `usr-${u.id}`,
          title: `User Registered`,
          subtitle: `${u.first_name || ''} ${u.last_name || ''} (${u.email})`,
          time: u.date_joined || 'Recent',
          type: 'user',
        });
      });

      setRecentActivities(activities);
      setFetchState('success');
    } catch {
      setFetchState('error');
    }
  }, []);

  useEffect(() => {
    if (didInitialFetch.current || !tokens?.access) return;
    didInitialFetch.current = true;
    fetchAdminMetrics();
  }, [tokens?.access, fetchAdminMetrics]);

  const adminName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Administrator';

  const REVIEW_ANALYTICS: { label: string; value: number | string; colorStyle: React.CSSProperties; borderStyle: React.CSSProperties }[] = [
    { label: 'Pending Screening',   value: metrics.pendingScreening,  colorStyle: { color: '#d97706' }, borderStyle: { border: '1px solid rgba(217,119,6,0.25)' } },
    { label: 'Under Review',        value: metrics.underReview,       colorStyle: { color: '#2563eb' }, borderStyle: { border: '1px solid rgba(37,99,235,0.25)' } },
    { label: 'Revision Requested',  value: metrics.revisionRequested, colorStyle: { color: '#ea580c' }, borderStyle: { border: '1px solid rgba(234,88,12,0.25)' } },
    { label: 'Accepted Today',      value: metrics.acceptedToday,     colorStyle: { color: '#16a34a' }, borderStyle: { border: '1px solid rgba(22,163,74,0.25)' } },
    { label: 'Published Papers',    value: metrics.publishedPapers,   colorStyle: { color: '#8C6212' }, borderStyle: { border: '1px solid rgba(201,166,107,0.3)' } },
    { label: 'Rejected Papers',     value: metrics.rejectedPapers,    colorStyle: { color: '#dc2626' }, borderStyle: { border: '1px solid rgba(220,38,38,0.25)' } },
  ];

  const STATUS_STYLE: Record<string, React.CSSProperties> = {
    pending:             { color: '#d97706', background: 'rgba(217,119,6,0.08)',    border: '1px solid rgba(217,119,6,0.25)' },
    editorial_screening: { color: '#0284c7', background: 'rgba(2,132,199,0.08)',   border: '1px solid rgba(2,132,199,0.25)' },
    under_review:        { color: '#2563eb', background: 'rgba(37,99,235,0.08)',   border: '1px solid rgba(37,99,235,0.25)' },
    revision_requested:  { color: '#ea580c', background: 'rgba(234,88,12,0.08)',   border: '1px solid rgba(234,88,12,0.25)' },
    revision_required:   { color: '#ea580c', background: 'rgba(234,88,12,0.08)',   border: '1px solid rgba(234,88,12,0.25)' },
    accepted:            { color: '#16a34a', background: 'rgba(22,163,74,0.08)',   border: '1px solid rgba(22,163,74,0.25)' },
    published:           { color: '#8C6212', background: 'rgba(201,166,107,0.1)',  border: '1px solid rgba(201,166,107,0.3)' },
    rejected:            { color: '#dc2626', background: 'rgba(220,38,38,0.08)',   border: '1px solid rgba(220,38,38,0.25)' },
  };

  const ANALYTICS_CARDS = [
    { label: 'Total Registered Users', value: metrics.users,              icon: Users,        iconColor: '#2563eb', href: '/admin/users' },
    { label: 'Books Catalogue',        value: metrics.books,              icon: BookOpen,     iconColor: '#C9A66B', href: '/admin/books' },
    { label: 'Journals & Periodicals', value: metrics.journals,           icon: Newspaper,    iconColor: '#16a34a', href: '/admin/journals' },
    { label: 'Conferences Managed',    value: metrics.conferences,        icon: Calendar,     iconColor: '#7c3aed', href: '/admin/conferences' },
    { label: 'Pending Manuscripts',    value: metrics.pendingSubmissions, icon: Clock,        iconColor: '#d97706', href: '/admin/journal-submissions' },
    { label: 'Published Papers',       value: metrics.publishedPapers,    icon: CheckCircle2, iconColor: '#16a34a', href: '/admin/journal-submissions' },
    { label: 'Orders Placed Today',    value: metrics.ordersToday,        icon: ShoppingBag,  iconColor: '#0284c7', href: '/admin/orders' },
    {
      label: 'Gross Platform Revenue',
      value: `₹${metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`,
      icon: DollarSign, iconColor: '#C9A66B', href: '/admin/orders',
    },
  ];

  // Admin team headline numbers — served by /api/users/admin-stats/.
  const ADMIN_STATS_CARDS = [
    { label: 'Total Portal Admins', value: adminStats?.total_admins,     sub: 'Staff accounts with CMS access',        icon: Users,        iconColor: '#2563eb', href: '/admin/users' },
    { label: 'Active Admins',       value: adminStats?.active_admins,    sub: 'Can sign in to the portal today',       icon: CheckCircle2, iconColor: '#16a34a', href: '/admin/users' },
    { label: 'Inactive Admins',     value: adminStats?.inactive_admins,  sub: 'Deactivated or auto-expired accounts',  icon: Ban,          iconColor: '#dc2626', href: '/admin/users' },
    { label: 'Super Admins',        value: adminStats?.super_admins,     sub: 'Full control incl. roles & access',     icon: Crown,        iconColor: '#C9A66B', href: '/admin/access' },
    { label: 'Editorial Admins',    value: adminStats?.editorial_admins, sub: 'Staff accounts with limited rights',    icon: UserCog,      iconColor: '#7c3aed', href: '/admin/users' },
  ];

  const QUICK_ACTIONS = [
    { title: 'Add New Book', desc: 'Publish a new monograph or textbook entry', icon: BookOpen, href: '/admin/books' },
    { title: 'Add Journal Issue', desc: 'Manage volumes and issue publications', icon: Newspaper, href: '/admin/journals' },
    { title: 'Review Submissions', desc: 'Screen incoming author manuscripts', icon: FileText, href: '/admin/journal-submissions' },
    { title: 'Add Testimonial', desc: 'Manage editorial feedback and reviews', icon: MessageSquare, href: '/admin/testimonials' },
    { title: 'Manage Hero Slider', desc: 'Update homepage banners and announcements', icon: Sliders, href: '/admin/hero-slider' },
    { title: 'View Customer Orders', desc: 'Track sales and fulfillment invoices', icon: ShoppingBag, href: '/admin/orders' },
  ];

  const SYSTEM_HEALTH = [
    { service: 'Authentication (JWT)', status: 'Operational', ping: '12ms', icon: Shield, ok: true },
    { service: 'Razorpay Gateway', status: 'Healthy', ping: '45ms', icon: Zap, ok: true },
    { service: 'Email (SMTP Service)', status: 'Operational', ping: '18ms', icon: Mail, ok: true },
    { service: 'PostgreSQL Database', status: 'Connected', ping: '4ms', icon: Database, ok: true },
    { service: 'REST API Engine', status: 'Healthy', ping: '8ms', icon: Server, ok: true },
  ];

  return (
    <AdminLayout
      title={`Welcome Back, ${adminName}`}
      subtitle="Complete publishing system overview, CMS statistics, and real-time operations."
    >
      {/* Hero Banner */}
      <div className="p-6 md:p-8 rounded-2xl relative overflow-hidden space-y-4"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 2px 20px rgba(92,75,58,0.06)' }}>
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-[100px] pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(201,166,107,0.08), transparent)' }} />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[13px] font-extrabold uppercase tracking-widest flex items-center gap-1.5"
                style={{ background: 'rgba(201,166,107,0.1)', color: '#7A5210', border: '1px solid rgba(201,166,107,0.3)' }}>
                <Activity className="w-3 h-3" /> System Online
              </span>
              <span className="text-xs" style={{ color: '#655444' }}>{currentDate}</span>
            </div>
            <h2 className="text-lg md:text-xl font-bold font-playfair" style={{ color: '#3E2E22' }}>
              MMSR Publications Content Management System
            </h2>
          </div>
          <button type="button" onClick={fetchAdminMetrics}
            className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
            style={{ background: 'rgba(201,166,107,0.1)', border: '1px solid rgba(201,166,107,0.3)', color: '#7A5210' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,166,107,0.18)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(201,166,107,0.1)')}>
            <RefreshCw className={`w-3.5 h-3.5 ${fetchState === 'loading' ? 'animate-spin' : ''}`} />
            <span>Sync System Data</span>
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold font-playfair uppercase tracking-wider" style={{ color: '#8C6212' }}>
          Core Analytics & System Totals
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {ANALYTICS_CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link key={idx} href={card.href}
                className="p-5 rounded-2xl group space-y-3 transition-all"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 2px 12px rgba(92,75,58,0.05)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9A66B'; e.currentTarget.style.background = '#FFF8EE'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E9DFCF'; e.currentTarget.style.background = '#FFFFFF'; }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: '#655444' }}>{card.label}</span>
                  <div className="p-2 rounded-xl group-hover:scale-110 transition-transform"
                    style={{ background: 'rgba(201,166,107,0.08)', border: '1px solid #E9DFCF' }}>
                    <Icon className="w-4 h-4" style={{ color: card.iconColor }} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-playfair" style={{ color: '#3E2E22' }}>
                  {fetchState === 'loading' ? '...' : card.value}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Admin Team & Access Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider" style={{ color: '#8C6212' }}>
            Admin Team &amp; Access Overview
          </h3>
          <Link href="/admin/users" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: '#8C6212' }}>
            <span>Manage Admins</span><ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {ADMIN_STATS_CARDS.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link key={idx} href={card.href}
                className="p-5 rounded-2xl group space-y-2.5 transition-all"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 2px 12px rgba(92,75,58,0.05)' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9A66B'; e.currentTarget.style.background = '#FFF8EE'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E9DFCF'; e.currentTarget.style.background = '#FFFFFF'; }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: '#655444' }}>{card.label}</span>
                  <div className="p-2 rounded-xl group-hover:scale-110 transition-transform"
                    style={{ background: 'rgba(201,166,107,0.08)', border: '1px solid #E9DFCF' }}>
                    <Icon className="w-4 h-4" style={{ color: card.iconColor }} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-playfair" style={{ color: '#3E2E22' }}>
                  {fetchState === 'loading' ? '…' : (card.value ?? '—')}
                </p>
                <p className="text-[13px] leading-tight" style={{ color: '#655444' }}>{card.sub}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Editorial Review Analytics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider" style={{ color: '#8C6212' }}>
            Editorial Review Analytics
          </h3>
          <div className="flex items-center gap-4">
            <Link href="/admin/book-submissions" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: '#8C6212' }}>
              <span>Book Submissions</span><ArrowRight className="w-3 h-3" />
            </Link>
            <Link href="/admin/journal-submissions" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: '#8C6212' }}>
              <span>Journal Submissions</span><ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {REVIEW_ANALYTICS.map((card) => (
            <Link key={card.label} href="/admin/journal-submissions"
              className="p-3 rounded-xl text-center hover:scale-105 transition-transform"
              style={{ backgroundColor: '#FFFFFF', ...card.borderStyle, boxShadow: '0 2px 8px rgba(92,75,58,0.04)' }}>
              <p className="text-2xl font-bold font-playfair" style={card.colorStyle}>
                {fetchState === 'loading' ? '…' : card.value}
              </p>
              <p className="text-[13px] mt-0.5 leading-tight" style={{ color: '#655444' }}>{card.label}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Author Communication Analytics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider flex items-center gap-2" style={{ color: '#8C6212' }}>
            <Mail className="w-4 h-4" /> Author Communication Analytics
          </h3>
          <span className="text-[13px] font-mono px-2 py-0.5 rounded"
            style={{ background: 'rgba(2,132,199,0.08)', border: '1px solid rgba(2,132,199,0.2)', color: '#0284c7' }}>
            Awaiting backend email metrics.
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Emails Sent Today',     value: 0,                          icon: Mail,        iconColor: '#0284c7', valColor: '#3E2E22' },
            { label: 'Pending Author Replies', value: metrics.pendingScreening,   icon: Clock,       iconColor: '#d97706', valColor: '#d97706' },
            { label: 'Revision Requests',      value: metrics.revisionRequested,  icon: RefreshCw,   iconColor: '#ea580c', valColor: '#ea580c' },
            { label: 'Acceptance Letters',     value: metrics.acceptedToday,      icon: CheckCircle2,iconColor: '#16a34a', valColor: '#16a34a' },
            { label: 'Publication Notices',    value: metrics.publishedPapers,    icon: BookOpen,    iconColor: '#C9A66B', valColor: '#C9A66B' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="p-4 rounded-xl space-y-1"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 2px 8px rgba(92,75,58,0.04)' }}>
                <div className="flex items-center justify-between text-[13px] uppercase font-bold" style={{ color: '#655444' }}>
                  <span>{item.label}</span>
                  <Icon className="w-3.5 h-3.5" style={{ color: item.iconColor }} />
                </div>
                <p className="text-2xl font-bold font-playfair" style={{ color: item.valColor }}>
                  {fetchState === 'loading' ? '...' : item.value}
                </p>
                <p className="text-[13px]" style={{ color: '#655444', opacity: 0.7 }}>Awaiting backend email metrics.</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Submission Activity Feed */}
      {submissionFeed.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-playfair uppercase tracking-wider" style={{ color: '#8C6212' }}>
              Submission Activity Feed
            </h3>
            <Link href="/admin/journal-submissions" className="text-xs font-semibold flex items-center gap-1 hover:underline" style={{ color: '#8C6212' }}>
              <span>View All</span><ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 2px 16px rgba(92,75,58,0.06)' }}>
            {submissionFeed.map((row, idx) => {
              const ss = STATUS_STYLE[row.status] || { color: '#655444', background: '#F7F3EB', border: '1px solid #E9DFCF' };
              const date = row.time ? new Date(row.time).toLocaleDateString('en-IN', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';
              return (
                <div key={row.id}
                  className="flex items-center gap-3 px-4 py-3 transition-colors"
                  style={idx < submissionFeed.length - 1 ? { borderBottom: '1px solid #E9DFCF' } : {}}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#FFF8EE')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                    style={{ background: 'rgba(201,166,107,0.12)', border: '1px solid rgba(201,166,107,0.25)', color: '#8C6212' }}>
                    {row.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: '#3E2E22' }}>{row.title}</p>
                    <p className="text-[13px]" style={{ color: '#655444' }}>{row.author} · {date}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[13px] font-bold shrink-0" style={ss}>
                    {row.status_label}
                  </span>
                  <Link href={row.type === 'book_chapter' || row.type === 'full_book' ? '/admin/book-submissions' : '/admin/journal-submissions'}
                    className="p-1.5 rounded-lg transition-all shrink-0"
                    style={{ background: 'rgba(201,166,107,0.1)', border: '1px solid rgba(201,166,107,0.25)', color: '#8C6212' }}
                    aria-label={`View submission: ${row.title}`}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Actions + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider" style={{ color: '#8C6212' }}>
            Publisher Shortcuts & Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {QUICK_ACTIONS.map((action, idx) => {
              const Icon = action.icon;
              return (
                <Link key={idx} href={action.href}
                  className="p-4 rounded-2xl flex items-start gap-3.5 group transition-all"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 2px 12px rgba(92,75,58,0.05)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#C9A66B'; e.currentTarget.style.background = '#FFF8EE'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E9DFCF'; e.currentTarget.style.background = '#FFFFFF'; }}>
                  <div className="p-2.5 rounded-xl group-hover:scale-110 transition-transform shrink-0"
                    style={{ background: 'rgba(201,166,107,0.1)', border: '1px solid rgba(201,166,107,0.25)', color: '#8C6212' }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold transition-colors" style={{ color: '#3E2E22' }}>{action.title}</h4>
                      <ArrowRight className="w-3.5 h-3.5 transition-colors" style={{ color: '#655444' }} />
                    </div>
                    <p className="text-[13px] mt-0.5" style={{ color: '#655444' }}>{action.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-bold font-playfair uppercase tracking-wider" style={{ color: '#8C6212' }}>
            Recent System Activity
          </h3>
          <div className="p-5 rounded-2xl space-y-3"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF', boxShadow: '0 2px 12px rgba(92,75,58,0.05)' }}>
            {recentActivities.length > 0 ? (
              recentActivities.map((act) => (
                <div key={act.id} className="p-3 rounded-xl text-xs space-y-1"
                  style={{ background: '#F7F3EB', border: '1px solid #E9DFCF' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold" style={{ color: '#8C6212' }}>{act.title}</span>
                    <span className="text-[13px]" style={{ color: '#655444' }}>{act.time}</span>
                  </div>
                  <p className="text-[13px] line-clamp-1" style={{ color: '#655444' }}>{act.subtitle}</p>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs space-y-1">
                <Activity className="w-6 h-6 mx-auto opacity-50" style={{ color: '#8C6212' }} />
                <p className="font-semibold" style={{ color: '#3E2E22' }}>No Recent Activity</p>
                <p className="text-[13px]" style={{ color: '#655444' }}>New platform events will stream live here.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </AdminLayout>
  );
}

