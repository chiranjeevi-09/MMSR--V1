'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, BookOpen, Newspaper, Calendar, FileText,
  ShoppingBag, MessageSquare, Sliders, Mail,
  LogOut, Menu, X, Bell, ChevronRight, ShieldCheck, User, Lock, Tag,
  Building2, HelpCircle, Layers, Inbox, BookMarked, Truck, CalendarCheck,
  ScrollText, FileCheck2,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { SiteLogo } from '@/components/ui/SiteLogo';
import { AdminGuard } from './AdminGuard';

import { AdminNotificationDropdown, filterNotificationsForAdmin, type AdminNotification } from './AdminNotificationDropdown';
import { fetchAdminNotifications } from '@/lib/services/cms';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

// `key` maps the page to a CMS section from ADMIN_SECTIONS / the API
// middleware; sections without a key (Dashboard, Profile, Settings) are
// always available once portal access is on. `superuserOnly` hides the
// entry for editorial staff.
const SIDEBAR_ITEMS: { label: string; href: string; icon: React.ElementType; key?: string; superuserOnly?: boolean }[] = [
  { label: 'Dashboard',    href: '/admin/dashboard',           icon: LayoutDashboard },
  { label: 'Users',        href: '/admin/users',               icon: Users, key: 'users' },
  { label: 'Admin Access', href: '/admin/access',              icon: Lock, superuserOnly: true },
  { label: 'Books',        href: '/admin/books',               icon: BookOpen, key: 'books' },
  { label: 'Book Submissions', href: '/admin/book-submissions',   icon: BookMarked, key: 'submissions' },
  { label: 'Journals',     href: '/admin/journals',            icon: Newspaper, key: 'journals' },
  { label: 'Journal Submissions', href: '/admin/journal-submissions', icon: FileText, key: 'submissions' },
  { label: 'Conferences',  href: '/admin/conferences',         icon: Calendar, key: 'conferences' },
  { label: 'Conference Submissions', href: '/admin/conference-submissions', icon: CalendarCheck, key: 'conferences' },
  { label: 'Services',     href: '/admin/services',            icon: Layers, key: 'site_content' },
  { label: 'Categories',   href: '/admin/categories',          icon: Tag, key: 'categories' },
  { label: 'Departments',  href: '/admin/contact-departments', icon: Building2, key: 'enquiries' },
  { label: 'User Enquiries', href: '/admin/enquiries',        icon: Inbox, key: 'enquiries' },
  { label: 'FAQs',         href: '/admin/faqs',                icon: HelpCircle, key: 'site_content' },
  { label: 'Orders',       href: '/admin/orders',              icon: ShoppingBag, key: 'orders' },
  { label: 'Fulfillment',  href: '/admin/fulfillment',         icon: Truck, key: 'orders' },
  { label: 'Subscribers',  href: '/admin/subscribers',         icon: Mail, key: 'subscribers' },
  { label: 'Site Content', href: '/admin/site-settings',       icon: Sliders, key: 'site_content' },
  { label: 'Policy Management', href: '/admin/policies',           icon: ScrollText, key: 'policies' },
  { label: 'Policy Acceptances', href: '/admin/policy-acceptances', icon: FileCheck2, key: 'policies' },
  { label: 'Testimonials', href: '/admin/testimonials',        icon: MessageSquare, key: 'testimonials' },
  { label: 'Hero Slider',  href: '/admin/hero-slider',         icon: Sliders, key: 'hero_slider' },
  { label: 'Profile',      href: '/admin/profile',             icon: User },
];

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title, subtitle }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, tokens, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const NOTIFS_READ_KEY = 'mmsr_admin_notifications_read_v1';
  const NOTIFS_CLEARED_KEY = 'mmsr_admin_notifications_cleared_v1';

  const getStoredIds = (key: string): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };

  const saveStoredIds = (key: string, ids: string[]) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(ids));
    } catch {}
  };

  // Notification state populated live from the backend API, synchronized with
  // localStorage read/cleared state so that seen notifications stay read across
  // page navigation and refreshes.
  const [allNotifications, setAllNotifications] = useState<AdminNotification[]>([]);

  const loadNotifications = React.useCallback(async () => {
    if (!tokens?.access) return;
    try {
      const live = await fetchAdminNotifications(tokens.access);
      if (!live || live.length === 0) return;
      const readIds = new Set(getStoredIds(NOTIFS_READ_KEY));
      const clearedIds = new Set(getStoredIds(NOTIFS_CLEARED_KEY));

      // Once a notification is read or cleared, remove it completely from the list
      const activeUnread: AdminNotification[] = live
        .filter((n) => !readIds.has(n.id) && !clearedIds.has(n.id))
        .map((n) => ({
          ...n,
          isRead: false,
        }));

      setAllNotifications(activeUnread);
    } catch (err) {
      console.error('Failed to load admin notifications:', err);
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 45000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  useEffect(() => {
    if (notifOpen) {
      loadNotifications();
    }
  }, [notifOpen, loadNotifications]);

  // Admin number inputs should be edit-by-typing only: scrolling the mouse wheel
  // must never change a value. Native spinner arrows are hidden via CSS scoped to
  // the `.admin-portal` wrapper. Blurring on wheel keeps the field value untouched.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'number') {
        t.blur();
      }
    };
    document.addEventListener('wheel', onWheel, { passive: true });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);

  const userFullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Administrator';
  const isSuperuser = (user as any)?.is_superuser;
  const roleLabel = isSuperuser ? 'Super Admin' : user?.is_staff ? 'Editorial Staff' : 'Staff Admin';

  // Hide nav entries the middleware would block anyway: superuser-only
  // pages for staff, and any section explicitly granted "none".
  const adminPerms = (user as any)?.admin_permissions as Record<string, string> | undefined;
  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (item.superuserOnly && !isSuperuser) return false;
    if (!isSuperuser && item.key && adminPerms?.[item.key] === 'none') return false;
    return true;
  });

  // Same access rule as the sidebar, applied to notifications.
  // All active notifications are unread (read ones are removed completely).
  const myNotifications = filterNotificationsForAdmin(allNotifications, user as any);
  const notifUnreadCount = myNotifications.length;
  const myNotificationIds = new Set(myNotifications.map((n) => n.id));

  // Once read, remove the notification from the list immediately and persist to localStorage
  const handleMarkRead = (id: string) => {
    const readIds = new Set(getStoredIds(NOTIFS_READ_KEY));
    readIds.add(id);
    saveStoredIds(NOTIFS_READ_KEY, Array.from(readIds));
    setAllNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMarkAllRead = () => {
    const readIds = new Set(getStoredIds(NOTIFS_READ_KEY));
    myNotifications.forEach((n) => readIds.add(n.id));
    saveStoredIds(NOTIFS_READ_KEY, Array.from(readIds));
    setAllNotifications((prev) => prev.filter((n) => !myNotificationIds.has(n.id)));
  };

  const handleClearNotifications = () => {
    const clearedIds = new Set(getStoredIds(NOTIFS_CLEARED_KEY));
    myNotifications.forEach((n) => clearedIds.add(n.id));
    saveStoredIds(NOTIFS_CLEARED_KEY, Array.from(clearedIds));
    setAllNotifications((prev) => prev.filter((n) => !myNotificationIds.has(n.id)));
  };

  const handleLogout = () => { logout(); router.push('/admin/login'); };

  const pathSegments = (pathname || '/admin').split('/').filter(Boolean).map((seg) => seg.replace(/-/g, ' '));

  const SidebarLink = ({ item, onClick }: { item: typeof SIDEBAR_ITEMS[0]; onClick?: () => void }) => {
    const Icon = item.icon;
    const isActive = item.href === '/admin/dashboard' || item.href === '/admin'
      ? pathname === '/admin' || pathname === '/admin/dashboard'
      : pathname?.startsWith(item.href);
    return (
      <Link
        href={item.href}
        onClick={onClick}
        className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group"
        style={isActive
          ? { background: '#FFF2D9', color: '#5C4B3A', borderLeft: '4px solid #C9A66B', paddingLeft: '10px', fontWeight: 700 }
          : { color: '#655444' }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = '#FFF8EE'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"
          style={{ color: isActive ? '#C9A66B' : '#8B7B68' }} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <AdminGuard>
      <div className="admin-portal min-h-screen font-manrope flex flex-col md:flex-row" style={{ backgroundColor: '#F7F3EB', color: '#5C4B3A' }}>

        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-64 fixed top-0 bottom-0 left-0 z-40"
          style={{ backgroundColor: '#FFFFFF', borderRight: '1px solid #E9DFCF' }}>
          <div className="p-5 flex items-center" style={{ borderBottom: '1px solid #E9DFCF' }}>
            <Link href="/admin/dashboard" className="flex items-center gap-2.5">
              <SiteLogo className="w-9 h-9" />
              <div>
                <span className="font-playfair font-bold text-sm tracking-wider block leading-tight" style={{ color: '#3E2E22' }}>
                  MMSR <span style={{ color: '#C9A66B' }}>CMS</span>
                </span>
                <span className="text-[13px] font-semibold uppercase tracking-widest block" style={{ color: '#7A5210' }}>
                  Administration Portal
                </span>
              </div>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-none">
            {visibleItems.map((item) => <SidebarLink key={item.href} item={item} />)}
          </nav>

          <div className="p-4 space-y-3" style={{ borderTop: '1px solid #E9DFCF' }}>
            <div className="flex items-center justify-between text-[13px] font-mono px-1" style={{ color: '#655444' }}>
              <span>Version 2.0 CMS</span>
              <span className="font-semibold" style={{ color: '#22c55e' }}>Live</span>
            </div>
            <button type="button" onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ color: '#dc2626', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}>
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Logout Session</span>
            </button>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 transition-opacity duration-300"
              style={{ background: 'rgba(62,46,34,0.5)', backdropFilter: 'blur(4px)' }}
            />
            <aside
              className="fixed top-0 bottom-0 left-0 w-72 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out"
              style={{ backgroundColor: '#FFFFFF', borderRight: '1px solid #E9DFCF' }}
            >
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid #E9DFCF' }}>
                <div className="flex items-center gap-2">
                  <SiteLogo className="w-7 h-7" />
                  <span className="font-playfair font-bold text-sm" style={{ color: '#3E2E22' }}>MMSR Publications CMS</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-lg transition-colors"
                  style={{ background: '#F7F3EB', color: '#655444' }}
                  aria-label="Close mobile menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {visibleItems.map((item) => <SidebarLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />)}
              </nav>
              <div className="p-4 space-y-2" style={{ borderTop: '1px solid #E9DFCF' }}>
                <span className="text-[13px] font-mono block text-center" style={{ color: '#655444' }}>Version 2.0 CMS</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold"
                  style={{ color: '#dc2626', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.2)' }}
                >
                  <LogOut className="w-4 h-4" /><span>Admin Logout</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Main Area */}
        <div className="flex-1 md:pl-64 flex flex-col min-h-screen min-w-0">
          {/* Top Header */}
          <header className="sticky top-0 z-30 px-4 md:px-8 h-[77px] flex items-center justify-between gap-4"
            style={{ backgroundColor: '#3E2E22', borderBottom: '1px solid rgba(201,166,107,0.2)' }}>
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <button type="button" onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 rounded-xl transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#F7F3EB' }}
                aria-label="Toggle Navigation Menu">
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[13px] font-bold uppercase tracking-widest flex items-center gap-1.5"
                  style={{ background: 'rgba(201,166,107,0.15)', border: '1px solid rgba(201,166,107,0.35)', color: '#C9A66B' }}>
                  <ShieldCheck className="w-3 h-3" /> Editorial Management System
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 relative">
              {/* Notification Bell Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="p-2 rounded-xl transition-all relative hover:scale-105"
                  style={{
                    background: notifOpen ? 'rgba(201,166,107,0.25)' : 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#F7F3EB',
                  }}
                  aria-label="Admin Notifications"
                  title="Admin Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {/* Badge only while something genuinely unread reaches this
                      admin — no dot once everything visible is read. */}
                  {notifUnreadCount > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 animate-pulse"
                      style={{ background: '#C9A66B', boxShadow: '0 0 0 2px #3E2E22' }}
                    />
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                <AdminNotificationDropdown
                  isOpen={notifOpen}
                  onClose={() => setNotifOpen(false)}
                  notifications={myNotifications}
                  onMarkRead={handleMarkRead}
                  onMarkAllRead={handleMarkAllRead}
                  onClearAll={handleClearNotifications}
                />
              </div>

              <div className="h-6 w-px hidden sm:block" style={{ background: 'rgba(255,255,255,0.15)' }} />

              {/* Clickable Profile Avatar & Name */}
              <Link
                href="/admin/profile"
                className="flex items-center gap-2.5 p-1 px-2 rounded-xl transition-all hover:bg-white/10 group cursor-pointer"
                title="View & Edit Admin Profile"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-transform group-hover:scale-105"
                  style={{ background: 'rgba(201,166,107,0.2)', border: '1px solid rgba(201,166,107,0.4)', color: '#C9A66B' }}
                >
                  <User className="w-4 h-4" />
                </div>
                <div className="hidden sm:block text-left">
                  <span className="text-xs font-bold block leading-tight group-hover:text-[#C9A66B] transition-colors" style={{ color: '#F7F3EB' }}>
                    {userFullName}
                  </span>
                  <span className="text-[13px] font-semibold uppercase tracking-wider block" style={{ color: '#C9A66B' }}>
                    {roleLabel}
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all hover:bg-red-900/30"
                style={{ color: '#fca5a5', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)' }}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 min-w-0 p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
            <nav className="flex items-center gap-1.5 text-[13px] capitalize" style={{ color: '#655444' }}>
              <span>Admin</span>
              {pathSegments.slice(1).map((segment, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3" style={{ color: '#E9DFCF' }} />
                  <span className={idx === pathSegments.length - 2 ? 'font-semibold' : ''}
                    style={idx === pathSegments.length - 2 ? { color: '#C9A66B' } : {}}>
                    {segment}
                  </span>
                </React.Fragment>
              ))}
            </nav>

            {(title || subtitle) && (
              <div className="space-y-1">
                {title && <h1 className="text-xl md:text-2xl font-bold font-playfair" style={{ color: '#3E2E22' }}>{title}</h1>}
                {subtitle && <p className="text-xs" style={{ color: '#655444' }}>{subtitle}</p>}
              </div>
            )}

            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};
