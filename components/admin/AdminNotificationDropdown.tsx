'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, FileText, ShoppingBag, Calendar, UserPlus, CheckCircle2,
  Trash2, ChevronRight, X, Sparkles, Filter
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  category: 'submission' | 'order' | 'conference' | 'user';
  // CMS section key (mirrors ADMIN_SECTIONS / the API middleware) whose page
  // this notification points at — drives per-admin visibility below.
  section: 'submissions' | 'orders' | 'conferences' | 'users';
  isRead: boolean;
  linkUrl: string;
}

export interface AdminNotificationViewer {
  is_superuser?: boolean;
  // Same semantics as the sidebar: an explicit "none" hides the section;
  // an absent key keeps full staff access (legacy accounts).
  admin_permissions?: Record<string, string>;
}

// Super Admins see every notification; other admins only see notifications
// for sections they can actually access (a "none" grant hides them, exactly
// like the sidebar entry and the API middleware).
export function canSeeSection(user: AdminNotificationViewer | null, section: string): boolean {
  if (user?.is_superuser) return true;
  return (user?.admin_permissions || {})[section] !== 'none';
}

export function filterNotificationsForAdmin(
  list: AdminNotification[],
  user: AdminNotificationViewer | null
): AdminNotification[] {
  return list.filter((n) => canSeeSection(user, n.section));
}

export function formatNotificationTime(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp; // Already relative string

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ADMIN_NOTIFICATION_SEED: AdminNotification[] = [];

interface AdminNotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  // Notifications this admin is allowed to see (permission-filtered by the
  // layout, which also drives the bell badge from the same list).
  notifications: AdminNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export function AdminNotificationDropdown({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
}: AdminNotificationDropdownProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'submission' | 'order' | 'conference' | 'user'>('all');

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'submission') return n.category === 'submission';
    if (filter === 'order') return n.category === 'order';
    if (filter === 'conference') return n.category === 'conference';
    if (filter === 'user') return n.category === 'user';
    return true;
  });

  const handleMarkAllRead = () => {
    onMarkAllRead();
  };

  const handleClearAll = () => {
    onClearAll();
  };

  const handleNotificationClick = (n: AdminNotification) => {
    onMarkRead(n.id);
    onClose();
    router.push(n.linkUrl);
  };

  const getCategoryIcon = (category: AdminNotification['category']) => {
    switch (category) {
      case 'submission':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'order':
        return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'conference':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'user':
        return <UserPlus className="w-4 h-4 text-purple-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="absolute right-0 top-12 w-80 sm:w-96 rounded-3xl z-50 overflow-hidden shadow-2xl"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF' }}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#E9DFCF', backgroundColor: '#3E2E22' }}>
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" style={{ color: '#C9A66B' }} />
            <h3 className="text-sm font-bold font-playfair" style={{ color: '#F7F3EB' }}>Admin Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[13px] font-extrabold"
                style={{ background: '#C9A66B', color: '#3E2E22' }}>
                {unreadCount} New
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-xs hover:bg-white/10 transition-colors"
            style={{ color: '#F7F3EB' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar & Quick Actions */}
        <div className="p-3 border-b flex items-center justify-between text-xs gap-2" style={{ borderColor: '#E9DFCF', backgroundColor: '#F7F3EB' }}>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {(['all', 'submission', 'order', 'conference', 'user'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-[13px] font-bold capitalize transition-all ${
                  filter === tab ? 'bg-[#C9A66B] text-[#3E2E22]' : 'text-[#8B7B68] hover:text-[#3E2E22]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 text-[13px]">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-emerald-700 hover:underline font-semibold"
              >
                Mark Read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-red-600 hover:underline font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <div className="max-h-80 overflow-y-auto divide-y" style={{ borderColor: '#E9DFCF' }}>
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#8B7B68] flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-[#C9A66B]" />
              <p className="font-bold text-sm text-[#5C4B3A]">All caught up!</p>
              <p className="text-[12px] text-[#8B7B68]">No unread notifications right now.</p>
            </div>
          ) : (
            filteredNotifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 flex items-start gap-3 cursor-pointer transition-colors ${
                  n.isRead ? 'bg-[#FFFFFF] hover:bg-[#F7F3EB]/60' : 'bg-[#FFF8EE] hover:bg-[#FFF2D9]'
                }`}
              >
                <div className="p-2 rounded-xl shrink-0 mt-0.5" style={{ background: '#F7F3EB', border: '1px solid #E9DFCF' }}>
                  {getCategoryIcon(n.category)}
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#3E2E22] truncate">
                      {n.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead(n.id);
                      }}
                      title="Mark read & remove"
                      className="p-1 rounded-md text-[#8B7B68] hover:text-[#1B4332] hover:bg-[#1B4332]/10 transition-colors shrink-0"
                      aria-label="Dismiss notification"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[13px] text-[#6E5238] leading-tight line-clamp-2">{n.message}</p>
                  <span className="text-[12px] font-medium text-[#8B7B68] block">{formatNotificationTime(n.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer — only for admins whose Submissions access is on */}
        {canSeeSection(user as AdminNotificationViewer | null, 'submissions') && (
          <div className="p-3 text-center border-t" style={{ borderColor: '#E9DFCF', backgroundColor: '#F7F3EB' }}>
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push('/admin/journal-submissions');
              }}
              className="text-xs font-bold text-[#A98042] hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              <span>View All Journal Submissions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
