'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  ShoppingBag,
  User,
  Settings,
  LogOut,
  ArrowLeft,
  ChevronRight,
  Menu,
  X,
  Home,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Authentication Protection Guard — preserve the intended page so the user
  // returns here after signing in.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const target = `${pathname}${typeof window !== 'undefined' ? window.location.search : ''}`;
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#F8F5EE] flex flex-col items-center justify-center font-manrope">
        <div className="w-12 h-12 border-2 border-[#C99A2E] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-[#73614C]">Loading MMSR Dashboard Session...</p>
      </div>
    );
  }

  const userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const userInitials = (user.first_name?.[0] || user.email[0] || 'U').toUpperCase();

  const NAV_LINKS = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'My Submissions', href: '/dashboard/submissions', icon: FileText },
    { label: 'My Orders', href: '/dashboard/orders', icon: ShoppingBag },
    { label: 'My Library', href: '/dashboard/journals', icon: BookOpen },
    { label: 'Profile Details', href: '/dashboard/profile', icon: User },
    { label: 'Account Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  // ─── Dynamic Breadcrumbs ──────────────────────────────────────────────────
  const getBreadcrumbs = () => {
    const crumbs: { label: string; href: string }[] = [{ label: 'Dashboard', href: '/dashboard' }];

    if (pathname.startsWith('/dashboard/orders')) {
      crumbs.push({ label: 'Orders', href: '/dashboard/orders' });
      if (pathname.split('/').length > 3) {
        crumbs.push({ label: 'Order Details', href: pathname });
      }
    } else if (pathname.startsWith('/dashboard/submissions')) {
      crumbs.push({ label: 'Submissions', href: '/dashboard/submissions' });
      if (pathname.split('/').length > 3) {
        crumbs.push({ label: 'Submission Details', href: pathname });
      }
    } else if (pathname.startsWith('/dashboard/journals')) {
      crumbs.push({ label: 'My Library', href: '/dashboard/journals' });
    } else if (pathname === '/dashboard/profile') {
      crumbs.push({ label: 'Profile', href: '/dashboard/profile' });
    } else if (pathname === '/dashboard/settings') {
      crumbs.push({ label: 'Settings', href: '/dashboard/settings' });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#2F241A] font-manrope pt-6 sm:pt-8 pb-16">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Mobile Navigation Header */}
        <div className="lg:hidden flex items-center justify-between p-4 mb-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-gold p-0.5 shrink-0">
              <div className="w-full h-full bg-[#FFF9F1] rounded-[10px] flex items-center justify-center font-playfair font-bold text-sm text-[#C99A2E]">
                {userInitials}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#2F241A] truncate">{userFullName}</p>
              <p className="text-[13px] text-[#73614C] truncate">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] text-[#C99A2E] hover:bg-[#FFF2D9] transition-colors"
            aria-label="Open Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Drawer Slide-over */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-[#2F241A]/50 backdrop-blur-md transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide Drawer Content */}
            <div className="relative ml-auto w-full max-w-xs bg-[#FFF9F1] border-l border-[#D4AC54] p-6 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto">
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#D4AC54]">
                  <span className="font-playfair text-sm font-bold text-[#C99A2E]">Dashboard Menu</span>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg bg-[#F8EEDC] border border-[#D4AC54] text-[#73614C] hover:text-[#2F241A]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile User Info */}
                <div className="p-4 rounded-xl bg-[#F8EEDC]/60 border border-[#D4AC54] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-gold p-0.5 shrink-0">
                    <div className="w-full h-full bg-[#FFF9F1] rounded-[10px] flex items-center justify-center font-playfair font-bold text-base text-[#C99A2E]">
                      {userInitials}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#2F241A] truncate">{userFullName}</p>
                    <p className="text-[13px] text-[#73614C] truncate">{user.email}</p>
                  </div>
                </div>

                {/* Mobile Nav Links */}
                <nav className="space-y-1.5">
                  {NAV_LINKS.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-[#FFF2D9] text-[#C99A2E] border border-[#D4AC54]'
                            : 'text-[#73614C] hover:text-[#2F241A] hover:bg-[#F8EEDC]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-[#C99A2E]' : 'text-[#73614C]'}`} />
                          <span>{link.label}</span>
                        </div>
                        {isActive && <ChevronRight className="w-4 h-4 text-[#C99A2E]" />}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-6 space-y-3 border-t border-[#D4AC54]">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-50 border border-[#DC2626]/25 text-xs font-semibold text-red-700 hover:bg-[#DC2626]/10"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* DESKTOP & TABLET SIDEBAR — profile card + nav on the left, aligned with the content column top */}
          <aside className="hidden lg:block lg:col-span-3 space-y-6">
            {/* User Profile Card */}
            <div className="p-6 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] backdrop-blur-xl shadow-md flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#C99A2E]/10 rounded-full blur-[60px] pointer-events-none" />

              <div className="w-16 h-16 rounded-2xl bg-gradient-gold p-0.5 shadow-sm mb-3 shrink-0">
                <div className="w-full h-full bg-[#FFF9F1] rounded-[14px] flex items-center justify-center font-playfair font-extrabold text-2xl text-[#C99A2E]">
                  {userInitials}
                </div>
              </div>

              <h2 className="text-base font-bold font-playfair text-[#2F241A] truncate max-w-full">
                {userFullName}
              </h2>
              <p className="text-[13px] text-[#73614C] truncate max-w-full mb-3">{user.email}</p>

              <div>
                {user.is_staff ? (
                  <span className="text-[13px] font-extrabold uppercase tracking-widest bg-[#FFF2D9] text-[#C99A2E] px-3 py-1 rounded-full border border-[#D4AC54]">
                    Editorial Staff
                  </span>
                ) : user.is_author ? (
                  <span className="text-[13px] font-semibold uppercase tracking-wider bg-[#FFF2D9] text-[#C99A2E] px-3 py-1 rounded-full border border-[#D4AC54]">
                    Academic Author
                  </span>
                ) : (
                  <span className="text-[13px] font-medium uppercase tracking-wider bg-[#F8EEDC] text-[#73614C] px-3 py-1 rounded-full border border-[#D4AC54]">
                    Scholar & Reader
                  </span>
                )}
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="p-2 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] space-y-1 shadow-md" aria-label="Dashboard Navigation">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold transition-all relative ${
                      isActive
                        ? 'bg-[#FFF2D9] text-[#C99A2E] border border-[#D4AC54]'
                        : 'text-[#73614C] hover:text-[#2F241A] hover:bg-[#F8EEDC]'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#C99A2E] rounded-r-full" />
                    )}
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#C99A2E]' : 'text-[#73614C]'}`} />
                      <span>{link.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-[#C99A2E]" />}
                  </Link>
                );
              })}
            </nav>

            {/* Sign Out Action */}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 border border-[#DC2626]/25 text-xs font-semibold text-red-700 hover:bg-[#DC2626]/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Account</span>
            </button>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="lg:col-span-9 space-y-6">
            
            {/* Breadcrumb Navigation Bar */}
            <nav className="flex items-center gap-2 text-xs text-[#73614C] overflow-x-auto pb-1" aria-label="Breadcrumb">
              <Link href="/home" className="hover:text-[#C99A2E] transition-colors flex items-center gap-1 shrink-0">
                <Home className="w-3.5 h-3.5 text-[#C99A2E]" />
                <span>Home</span>
              </Link>
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.href + idx}>
                    <ChevronRight className="w-3.5 h-3.5 text-[#73614C]/60 shrink-0" />
                    {isLast ? (
                      <span className="font-semibold text-[#C99A2E] truncate">{crumb.label}</span>
                    ) : (
                      <Link href={crumb.href} className="hover:text-[#C99A2E] transition-colors shrink-0">
                        {crumb.label}
                      </Link>
                    )}
                  </React.Fragment>
                );
              })}
            </nav>

            {/* Header Section */}
            <div className="p-6 sm:p-8 rounded-[24px] bg-[#FFF9F1] border border-[#D4AC54] shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#2F241A] tracking-tight">
                  {title}
                </h1>
                {subtitle && <p className="text-xs text-[#73614C] mt-1 leading-relaxed">{subtitle}</p>}
              </div>

              <Link
                href="/home"
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[#C99A2E] text-xs font-bold text-[#C99A2E] bg-[#FFF2D9]/60 hover:bg-[#C99A2E] hover:text-[#FFF9F1] hover:shadow-gold-glow hover:-translate-y-0.5 transition-all duration-300 shrink-0"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                <span>Return to Website</span>
              </Link>
            </div>

            {/* Page Children */}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
