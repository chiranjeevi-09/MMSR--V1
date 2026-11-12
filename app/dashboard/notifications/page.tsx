'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  FileText,
  Package,
  Clock,
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCheck,
  RefreshCw,
  ExternalLink,
  BookOpen,
  DollarSign,
  FileCheck,
  ShieldAlert,
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  NotificationItem,
  generateUserNotifications,
  getReadNotificationIds,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/services/notifications';

type FilterType = 'all' | 'unread' | 'manuscripts' | 'orders';

export default function AuthorNotificationsPage() {
  const { tokens } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [readIds, setReadIds] = useState<string[]>([]);

  const fetchUserDataAndBuildNotifications = useCallback(async () => {
    if (!tokens?.access) {
      setNotifications(generateUserNotifications([], []));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    const headers = { Authorization: `Bearer ${tokens.access}` };

    try {
      const [subRes, ordRes] = await Promise.all([
        fetch(`${apiBase}/api/submissions/`, { headers }).catch(() => null),
        fetch(`${apiBase}/api/commerce/`, { headers }).catch(() => null),
      ]);

      let subs: any[] = [];
      let ords: any[] = [];

      if (subRes && subRes.ok) {
        const subData = await subRes.json().catch(() => null);
        subs = Array.isArray(subData) ? subData : subData?.results || [];
      }

      if (ordRes && ordRes.ok) {
        const ordData = await ordRes.json().catch(() => null);
        ords = Array.isArray(ordData) ? ordData : ordData?.results || [];
      }

      const list = generateUserNotifications(subs, ords);
      setNotifications(list);
    } catch {
      setNotifications(generateUserNotifications([], []));
    } finally {
      setIsLoading(false);
    }
  }, [tokens?.access]);

  useEffect(() => {
    setReadIds(getReadNotificationIds());
    fetchUserDataAndBuildNotifications();
  }, [fetchUserDataAndBuildNotifications]);

  const handleMarkAsRead = (id: string) => {
    const updated = markNotificationAsRead(id);
    setReadIds(updated);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const updated = markAllNotificationsAsRead(allIds);
    setReadIds(updated);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const isItemRead = item.isRead || readIds.includes(item.id);

      if (activeFilter === 'unread') return !isItemRead;
      if (activeFilter === 'manuscripts') {
        return [
          'manuscript_submitted',
          'editorial_screening',
          'under_review',
          'revision_requested',
          'accepted',
          'published',
        ].includes(item.category);
      }
      if (activeFilter === 'orders') {
        return ['order_paid', 'order_delivered', 'invoice_generated'].includes(item.category);
      }
      return true;
    });
  }, [notifications, activeFilter, readIds]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.isRead && !readIds.includes(n.id)).length;
  }, [notifications, readIds]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'manuscript_submitted':
        return <FileText className="w-5 h-5 text-amber-400" />;
      case 'editorial_screening':
        return <Clock className="w-5 h-5 text-sky-400" />;
      case 'under_review':
        return <BookOpen className="w-5 h-5 text-blue-400" />;
      case 'revision_requested':
        return <AlertTriangle className="w-5 h-5 text-orange-400" />;
      case 'accepted':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      case 'published':
        return <FileCheck className="w-5 h-5 text-gold-400" />;
      case 'order_paid':
        return <DollarSign className="w-5 h-5 text-emerald-400" />;
      case 'order_delivered':
        return <Package className="w-5 h-5 text-purple-400" />;
      case 'invoice_generated':
        return <FileText className="w-5 h-5 text-sky-400" />;
      default:
        return <Bell className="w-5 h-5 text-gold-400" />;
    }
  };

  return (
    <DashboardLayout
      title="Notification Center"
      subtitle="Track all your peer review dispatches and order alerts"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#FFF9F1] p-6 rounded-2xl border border-[#D4AC54] shadow-md">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-center text-gold-400">
                <Bell className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-[#2F241A] tracking-wide">Author Notification Center</h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gold-500 text-navy-950">
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">
              Real-time updates regarding peer review decisions, manuscript progress, and publication orders.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUserDataAndBuildNotifications}
              disabled={isLoading}
              className="text-xs border-[#D4AC54]/60 hover:border-gold-500/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleMarkAllAsRead}
                className="text-xs bg-gold-500 hover:bg-gold-400 text-navy-950 font-semibold"
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 border-b border-[#D4AC54]/60 pb-4 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/10'
                : 'bg-[#F8EEDC]/60 text-text-muted hover:text-[#2F241A] border border-[#D4AC54]/40'
            }`}
          >
            All Notifications ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
              activeFilter === 'unread'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/10'
                : 'bg-[#F8EEDC]/60 text-text-muted hover:text-[#2F241A] border border-[#D4AC54]/40'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setActiveFilter('manuscripts')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
              activeFilter === 'manuscripts'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/10'
                : 'bg-[#F8EEDC]/60 text-text-muted hover:text-[#2F241A] border border-[#D4AC54]/40'
            }`}
          >
            Manuscripts
          </button>
          <button
            onClick={() => setActiveFilter('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
              activeFilter === 'orders'
                ? 'bg-gold-500 text-navy-950 shadow-md shadow-gold-500/10'
                : 'bg-[#F8EEDC]/60 text-text-muted hover:text-[#2F241A] border border-[#D4AC54]/40'
            }`}
          >
            Orders & Invoices
          </button>
        </div>

        {/* Notifications List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54]/40 animate-pulse flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-[#D4AC54]/20 shrink-0"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#D4AC54]/20 rounded w-1/3"></div>
                  <div className="h-3 bg-[#D4AC54]/20 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center bg-[#FFF9F1] rounded-2xl border border-[#D4AC54]/60 space-y-3">
            <Bell className="w-12 h-12 text-text-muted/40 mx-auto" />
            <h3 className="text-lg font-semibold text-[#2F241A]">No Notifications Found</h3>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              {activeFilter === 'unread'
                ? "You've read all your notifications! Check back later for peer review updates."
                : 'No notifications match your selected filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => {
              const isItemRead = notif.isRead || readIds.includes(notif.id);

              return (
                <div
                  key={notif.id}
                  className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    !isItemRead
                      ? 'bg-[#F8EEDC]/90 border-gold-500/40 shadow-lg shadow-gold-500/5'
                      : 'bg-[#FFF9F1] border-[#D4AC54]/60 hover:border-[#D4AC54]'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FFF2D9] border border-[#D4AC54]/60 flex items-center justify-center shrink-0 mt-0.5">
                      {getCategoryIcon(notif.category)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-[#5C4033] text-sm">{notif.title}</h4>
                        {!isItemRead && (
                          <span className="w-2 h-2 rounded-full bg-gold-400 inline-block animate-pulse"></span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted leading-relaxed">{notif.message}</p>
                      <div className="text-[13px] text-text-muted flex items-center space-x-2 pt-1">
                        <Clock className="w-3 h-3 text-gold-400/70" />
                        <span>{new Date(notif.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                    {!isItemRead && (
                      <button
                        onClick={() => handleMarkAsRead(notif.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#C99A2E]/10 hover:bg-[#C99A2E]/20 text-[#8C6B1B] text-xs font-medium border border-[#D4AC54] transition-colors"
                      >
                        Mark Read
                      </button>
                    )}
                    {notif.linkUrl && (
                      <Link
                        href={notif.linkUrl}
                        className="inline-flex items-center px-4 py-2 rounded-xl bg-[#C99A2E]/10 hover:bg-[#C99A2E]/20 text-[#8C6B1B] text-xs font-semibold border border-[#D4AC54] transition-all group"
                      >
                        <span>{notif.linkText || 'View'}</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
