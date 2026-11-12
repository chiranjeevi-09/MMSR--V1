'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Conference, ConferenceFilterOptions } from '@/lib/types/conference';
import { fetchConferences, fetchConferenceDomains } from '@/lib/services/conferences';
import { ConferencesHero } from '@/components/conference/ConferencesHero';
import { ConferenceSearchBar } from '@/components/conference/ConferenceSearchBar';
import { ConferenceFilters } from '@/components/conference/ConferenceFilters';
import { ConferenceSort } from '@/components/conference/ConferenceSort';
import { ConferenceGrid } from '@/components/conference/ConferenceGrid';

function ConferenceCatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const searchInputRef = useRef<HTMLInputElement>(null);

  const [conferences, setConferences] = useState<Conference[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search input value for immediate UI response
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');

  const [filters, setFilters] = useState<ConferenceFilterOptions>({
    search: searchParams.get('search') || '',
    status: (searchParams.get('status') as ConferenceFilterOptions['status']) || 'all',
    mode: (searchParams.get('mode') as ConferenceFilterOptions['mode']) || 'all',
    domain: searchParams.get('domain') || undefined,
    country: searchParams.get('country') || undefined,
    year: searchParams.get('year') ? (searchParams.get('year') === 'all' ? 'all' : Number(searchParams.get('year'))) : 'all',
    registrationOpen: searchParams.get('registrationOpen') === 'true',
    sortBy: (searchParams.get('sortBy') as ConferenceFilterOptions['sortBy']) || 'date_desc',
    page: Number(searchParams.get('page')) || 1,
    limit: 12,
  });

  // Fetch dynamic domains on mount
  useEffect(() => {
    async function loadDomains() {
      const list = await fetchConferenceDomains();
      setDomains(list);
    }
    loadDomains();
  }, []);

  // 300ms debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => (prev.search === searchTerm ? prev : { ...prev, search: searchTerm, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Sync filters to URL query string
  useEffect(() => {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.mode && filters.mode !== 'all') params.set('mode', filters.mode);
    if (filters.domain) params.set('domain', filters.domain);
    if (filters.country) params.set('country', filters.country);
    if (filters.year && filters.year !== 'all') params.set('year', String(filters.year));
    if (filters.registrationOpen) params.set('registrationOpen', 'true');
    if (filters.sortBy && filters.sortBy !== 'date_desc') params.set('sortBy', filters.sortBy);
    if (filters.page && filters.page > 1) params.set('page', String(filters.page));

    const str = params.toString();
    const query = str ? `?${str}` : '';
    router.replace(`/conference${query}`, { scroll: false });
  }, [filters, router]);

  // Fetch conferences from service
  const loadConferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchConferences(filters);
      setConferences(res.conferences);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load conferences. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadConferences();
  }, [loadConferences]);

  const handleFilterChange = (newFilters: Partial<ConferenceFilterOptions>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      page: 1, // Reset page on filter change
    }));
  };

  const handleReset = () => {
    setSearchTerm('');
    setFilters({
      search: '',
      status: 'all',
      mode: 'all',
      domain: undefined,
      country: undefined,
      year: 'all',
      registrationOpen: false,
      sortBy: 'date_desc',
      page: 1,
      limit: 12,
    });
  };

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope pb-20 flex flex-col gap-10">
      {/* Hero */}
      <ConferencesHero onFocusSearch={() => searchInputRef.current?.focus()} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-8">
        {/* Search Bar */}
        <ConferenceSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          inputRef={searchInputRef}
        />

        {/* Sort Bar */}
        <ConferenceSort
          currentSort={filters.sortBy}
          onSortChange={(sortBy) => handleFilterChange({ sortBy })}
          totalCount={total}
        />

        {/* Filter Sidebar & Grid */}
        <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
          <ConferenceFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleReset}
            domains={domains}
          />

          {/* Grid / Content */}
          <div className="flex-1 w-full min-w-0">
            {error ? (
              <div className="p-8 rounded-2xl bg-[#FFF9F1] border border-red-500/30 text-center space-y-4">
                <p className="text-sm text-ruby-red font-semibold">{error}</p>
                <button
                  onClick={loadConferences}
                  className="px-5 py-2.5 rounded-xl bg-gold-500/20 text-gold-400 font-bold text-xs hover:bg-gold-500/30 border border-gold-500/40 transition-all cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <h2 className="sr-only">Research Conferences Directory</h2>
                <ConferenceGrid
                  conferences={conferences}
                  loading={loading}
                  totalPages={totalPages}
                  currentPage={filters.page || 1}
                  onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
                  onReset={handleReset}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ConferencePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8EEDC]" />}>
      <ConferenceCatalogContent />
    </Suspense>
  );
}
