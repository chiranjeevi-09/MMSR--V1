'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Search,
  ArrowUpDown,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  Eye,
  Edit,
  RefreshCw,
  X,
  MapPin,
  Briefcase,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { Button } from '@/components/ui/Button';
import {
  AdminUser,
  fetchAdminUsers,
} from '@/lib/services/cms';
import { displayId, publicIdOf } from '@/lib/utils/publicId';
import { PublicId } from '@/components/ui/PublicId';

type FilterRole = 'all' | 'authors' | 'readers' | 'staff' | 'superadmins' | 'active' | 'inactive';
type SortOption = 'newest' | 'oldest' | 'name_asc' | 'last_login';
type FetchState = 'idle' | 'loading' | 'success' | 'error';

const ADMIN_ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  publication_admin: 'Publication Admin',
  editorial_admin: 'Editorial Admin',
  finance_admin: 'Finance Admin',
  support_admin: 'Support Admin',
};

export default function AdminUsersPage() {
  const { tokens } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<FilterRole>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Selected User for Drawer (read-only view; edits happen on /admin/access and user profile)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const loadUsers = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    try {
      const list = await fetchAdminUsers(tokens.access);
      setUsers(list);
      setFetchState('success');
    } catch {
      setUsers([]);
      setFetchState('success');
    }
  }, [tokens?.access]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Open Drawer (read-only)
  const openUserDrawer = (user: AdminUser) => {
    setSelectedUser(user);
  };

  // Close Drawer
  const closeUserDrawer = () => {
    setSelectedUser(null);
  };

  // Filter & Sort Logic
  const filteredUsers = useMemo(() => {
    return users
      .filter((u) => {
        // Search by Name, Email, Phone, MMSR public IDs
        if (searchQuery.trim() !== '') {
          const q = searchQuery.toLowerCase().trim();
          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
          const email = (u.email || '').toLowerCase();
          const phone = (u.phone_number || '').toLowerCase();
          const refs = `${u.public_id || ''} ${u.admin_public_id || ''}`.toLowerCase();

          if (!fullName.includes(q) && !email.includes(q) && !phone.includes(q) && !refs.includes(q)) return false;
        }

        // Filters
        if (roleFilter !== 'all') {
          if (roleFilter === 'authors' && !u.is_author) return false;
          if (roleFilter === 'readers' && (u.is_author || u.is_staff || u.is_superuser)) return false;
          if (roleFilter === 'staff' && (!u.is_staff || u.is_superuser)) return false;
          if (roleFilter === 'superadmins' && !u.is_superuser) return false;
          if (roleFilter === 'active' && u.is_active === false) return false;
          if (roleFilter === 'inactive' && u.is_active !== false) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const dateA = new Date(a.date_joined || a.joined_at || 0).getTime();
          const dateB = new Date(b.date_joined || b.joined_at || 0).getTime();
          return dateB - dateA;
        }
        if (sortBy === 'oldest') {
          const dateA = new Date(a.date_joined || a.joined_at || 0).getTime();
          const dateB = new Date(b.date_joined || b.joined_at || 0).getTime();
          return dateA - dateB;
        }
        if (sortBy === 'name_asc') {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email;
          return nameA.localeCompare(nameB);
        }
        if (sortBy === 'last_login') {
          const loginA = new Date(a.last_login || 0).getTime();
          const loginB = new Date(b.last_login || 0).getTime();
          return loginB - loginA;
        }
        return 0;
      });
  }, [users, searchQuery, roleFilter, sortBy]);

  return (
    <AdminLayout
      title="User Account Management"
      subtitle="View, filter, edit roles, and manage registered platform accounts, scholars, authors, and staff."
    >
      {/* Controls Bar */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by full name, email address, phone number, or MMSR ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E9DFCF] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B] transition-colors"
            />
          </div>

          {/* Sort & Refresh */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#C9A66B]" />
              <span className="text-[#8B7B68] text-[13px] hidden sm:inline">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="bg-transparent text-[#5C4B3A] font-medium focus:outline-none cursor-pointer"
              >
                <option value="newest" className="bg-white text-[#5C4B3A]">Newest First</option>
                <option value="oldest" className="bg-white text-[#5C4B3A]">Oldest First</option>
                <option value="name_asc" className="bg-white text-[#5C4B3A]">A-Z Name</option>
                <option value="last_login" className="bg-white text-[#5C4B3A]">Recent Login</option>
              </select>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadUsers}
              isLoading={fetchState === 'loading'}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Users' },
            { id: 'readers', label: 'Readers & Scholars' },
            { id: 'staff', label: 'Editorial Staff' },
            { id: 'superadmins', label: 'Super Admins' },
            { id: 'active', label: 'Active Only' },
            { id: 'inactive', label: 'Inactive Only' },
          ].map((pill) => {
            const isActive = roleFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setRoleFilter(pill.id as FilterRole)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all ${
                  isActive
                    ? 'bg-[#C9A66B] text-white border-gold-500 font-bold shadow-sm'
                    : 'bg-white text-[#8B7B68] border-[#E9DFCF] hover:border-[#E9DFCF] hover:text-[#5C4B3A]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count Header */}
      <div className="text-xs text-[#8B7B68]">
        Showing <strong className="text-[#5C4B3A]">{filteredUsers.length}</strong> of {users.length} registered accounts
      </div>

      {/* Loading */}
      {fetchState === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-[#8B7B68]">Fetching user directory...</p>
        </div>
      )}

      {/* Empty State */}
      {fetchState === 'success' && filteredUsers.length === 0 && (
        <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <Users className="w-8 h-8 text-[#C9A66B] mx-auto" />
          <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Users Found</p>
          <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
            {searchQuery || roleFilter !== 'all'
              ? 'No registered users match your active search filters.'
              : 'Registered user accounts will appear here.'}
          </p>
        </div>
      )}

      {/* Users Table */}
      {fetchState === 'success' && filteredUsers.length > 0 && (
        <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                  <th className="py-3 px-4 font-bold">Full Name</th>
                  <th className="py-3 px-4 font-bold">MMSR ID</th>
                  <th className="py-3 px-4 font-bold">Email</th>
                  <th className="py-3 px-4 font-bold">Phone</th>
                  <th className="py-3 px-4 font-bold">Country</th>
                  <th className="py-3 px-4 font-bold">Role</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Joined</th>
                  <th className="py-3 px-4 font-bold">Last Login</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => {
                  const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Scholar User';
                  const roleLabel = u.is_superuser
                    ? 'Super Admin'
                    : u.is_staff
                    ? 'Editorial Staff'
                    : u.is_author
                    ? 'Academic Author'
                    : 'Scholar / Reader';

                  const joinedStr = u.date_joined || u.joined_at
                    ? new Date(u.date_joined || u.joined_at || '').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
                    : 'N/A';

                  const loginStr = u.last_login
                    ? new Date(u.last_login).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
                    : 'Never';

                  const isActive = u.is_active !== false;

                  return (
                    <tr key={u.id} className="hover:bg-[#FFF8EE] transition-colors">
                      {/* Full Name */}
                      <td className="py-3 px-4 font-semibold text-[#5C4B3A]">{fullName}</td>

                      {/* MMSR ID */}
                      <td className="py-3 px-4 text-[13px] text-[#8B7B68] font-mono">{displayId(u)}</td>

                      {/* Email */}
                      <td className="py-3 px-4 text-[#8B7B68]">{u.email}</td>

                      {/* Phone */}
                      <td className="py-3 px-4 text-[13px] text-[#8B7B68]/80 font-mono">{u.phone_number || '—'}</td>

                      {/* Country */}
                      <td className="py-3 px-4 text-[#8B7B68]">{u.country || 'N/A'}</td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[13px] font-bold border ${
                            u.is_superuser
                              ? 'bg-red-500/10 border-red-500/30 text-[#DC2626]'
                              : u.is_staff
                              ? 'bg-[#FFF2D9] border-[#E9DFCF] text-[#C9A66B]'
                              : u.is_author
                              ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                              : 'bg-[#FFF8EE] border-[#E9DFCF] text-[#8B7B68]'
                          }`}
                        >
                          {roleLabel}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <UserCheck className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[13px] font-bold bg-red-500/10 border border-red-500/30 text-[#DC2626]">
                            <UserX className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-3 px-4 text-[#8B7B68]">{joinedStr}</td>

                      {/* Last Login */}
                      <td className="py-3 px-4 text-[#8B7B68]">{loginStr}</td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openUserDrawer(u)}
                          className="px-3 py-1 rounded-lg bg-[#FFF2D9] border border-[#E9DFCF] hover:bg-[#FFF2D9] text-[#C9A66B] text-[13px] font-bold inline-flex items-center gap-1 transition-all"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View Profile</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Details & Edit Drawer */}
      <AnimatePresence>
        {selectedUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeUserDrawer}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-lg bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between">
                <div>
                  <span className="text-[13px] font-mono text-[#C9A66B] uppercase tracking-widest block font-bold">
                    {selectedUser.admin_public_id
                      ? `Editorial Account ${selectedUser.admin_public_id}`
                      : `User Account ${publicIdOf(selectedUser) ?? 'reference pending'}`}
                  </span>
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    {selectedUser.first_name || selectedUser.last_name
                      ? `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`
                      : selectedUser.email}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={closeUserDrawer}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Read-Only Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Account Metadata */}
                <div className="p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] grid grid-cols-2 gap-3 text-xs">
                  <div className={selectedUser.is_staff || selectedUser.is_superuser ? 'col-span-2' : ''}>
                    <span className="text-[13px] text-[#8B7B68] uppercase tracking-wider block">
                      {selectedUser.is_staff || selectedUser.is_superuser ? 'Work Email' : 'Email Address'}
                    </span>
                    <span className="font-semibold text-[#5C4B3A] font-mono break-all">{selectedUser.email}</span>
                  </div>

                  {/* Standardized MMSR identifiers. The internal database PK is
                      never displayed anywhere in this drawer. */}
                  <div className="col-span-2 flex flex-wrap gap-2">
                    <PublicId value={selectedUser.public_id} label="USR" tone="light" size="sm" />
                    {(selectedUser.is_staff || selectedUser.is_superuser) && (
                      <PublicId value={selectedUser.admin_public_id} label="ADM" tone="light" size="sm" />
                    )}
                  </div>

                  <div>
                    <span className="text-[13px] text-[#8B7B68] uppercase tracking-wider block">Date Joined</span>
                    <span className="font-semibold text-[#5C4B3A] font-mono">
                      {selectedUser.date_joined || selectedUser.joined_at
                        ? new Date(selectedUser.date_joined || selectedUser.joined_at || '').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' })
                        : 'N/A'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[13px] text-[#8B7B68] uppercase tracking-wider block">Last Login</span>
                    <span className="font-semibold text-[#C9A66B] font-mono">
                      {selectedUser.last_login
                        ? new Date(selectedUser.last_login).toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Never logged in'}
                    </span>
                  </div>
                </div>

                {/* Personal Information (read-only) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#C9A66B]">Personal Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-[13px] text-[#8B7B68] block mb-0.5">Full Name</span>
                      <span className="font-semibold text-[#5C4B3A] block">
                        {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[13px] text-[#8B7B68] block mb-0.5">Phone Number</span>
                      <span className="font-semibold text-[#5C4B3A] block">{selectedUser.phone_number || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Address & Location (read-only) */}
                <div className="space-y-3 pt-4 border-t border-[#E9DFCF]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#C9A66B] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Address & Location
                  </h4>
                  <div className="text-xs space-y-3">
                    <div>
                      <span className="text-[13px] text-[#8B7B68] block mb-0.5">Street Address</span>
                      <span className="font-semibold text-[#5C4B3A] block">{selectedUser.address || '—'}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[13px] text-[#8B7B68] block mb-0.5">City</span>
                        <span className="font-semibold text-[#5C4B3A] block">{selectedUser.city || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[13px] text-[#8B7B68] block mb-0.5">Country</span>
                        <span className="font-semibold text-[#5C4B3A] block">{selectedUser.country || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[13px] text-[#8B7B68] block mb-0.5">Postal Code</span>
                        <span className="font-semibold text-[#5C4B3A] block">{selectedUser.postal_code || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Work Details — staff only (read-only) */}
                {(selectedUser.is_staff || selectedUser.is_superuser) && (
                  <div className="space-y-3 pt-4 border-t border-[#E9DFCF]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#C9A66B] flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5" /> Work Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[13px] text-[#8B7B68] block mb-0.5">Staff Role</span>
                        <span className="font-semibold text-[#5C4B3A] block">
                          {selectedUser.is_superuser
                            ? 'Super Admin'
                            : (ADMIN_ROLE_LABELS[selectedUser.admin_role || ''] || 'Editorial Staff')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[13px] text-[#8B7B68] block mb-0.5">Department / Team</span>
                        <span className="font-semibold text-[#5C4B3A] block">{selectedUser.department || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[13px] text-[#8B7B68] block mb-0.5">Work Email</span>
                        <span className="font-semibold text-[#5C4B3A] font-mono block break-all">{selectedUser.email}</span>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[13px] text-[#8B7B68] italic pt-4 border-t border-[#E9DFCF]">
                  This profile is read-only. Users update their own details from their profile; staff roles &amp; permissions are managed on the Access page.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
