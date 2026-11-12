'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Journal, JournalFilterOptions, JournalDiscipline } from '@/lib/types/journal';
import { fetchJournals, fetchJournalDisciplines } from '@/lib/services/journals';
import { JournalsHero } from '@/components/journals/JournalsHero';
import { JournalSearchBar } from '@/components/journals/JournalSearchBar';
import { JournalSort, JournalSortOption } from '@/components/journals/JournalSort';
import { JournalFilters } from '@/components/journals/JournalFilters';
import { JournalGrid } from '@/components/journals/JournalGrid';
import { JournalQuickView } from '@/components/journals/JournalQuickView';
import { JournalGridSkeleton } from '@/components/journals/JournalSkeleton';

function JournalsCatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read URL params
  const urlSearch = searchParams.get('search') || '';
  const urlDiscipline = searchParams.get('discipline') || searchParams.get('category') || searchParams.get('domain') || 'all';
  const urlOpenAccess = searchParams.get('openAccess') === 'true' ? true : searchParams.get('openAccess') === 'false' ? false : undefined;
  const urlFrequency = searchParams.get('frequency') || undefined;
  const urlSortBy = (searchParams.get('sortBy') as JournalSortOption) || 'newest';
  const urlPage = searchParams.get('page') ? Number(searchParams.get('page')) : 1;

  const [disciplines, setDisciplines] = useState<JournalDiscipline[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedQuickView, setSelectedQuickView] = useState<Journal | null>(null);

  // Local search state for 300ms debounce
  const [searchTerm, setSearchTerm] = useState(urlSearch);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep local search input synced with URL parameter
  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  // Fetch disciplines on mount
  useEffect(() => {
    async function loadDisc() {
      const discList = await fetchJournalDisciplines();
      setDisciplines(discList);
    }
    loadDisc();
  }, []);

  // Update URL search parameters helper
  const updateUrlParams = useCallback(
    (newParams: Record<string, string | number | boolean | undefined | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(newParams).forEach(([key, val]) => {
        if (val === undefined || val === null || val === '' || val === 'all' || (key === 'page' && val === 1)) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });

      const queryString = params.toString();
      const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(targetUrl, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  // Debounce search term changes (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchTerm !== urlSearch) {
        updateUrlParams({ search: searchTerm, page: 1 });
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchTerm, urlSearch, updateUrlParams]);

  // Fetch journals whenever URL searchParams change
  useEffect(() => {
    let isMounted = true;
    async function loadJournals() {
      setLoading(true);
      try {
        const filters: JournalFilterOptions = {
          search: urlSearch,
          discipline: urlDiscipline,
          openAccess: urlOpenAccess,
          frequency: urlFrequency,
          sortBy: urlSortBy,
          page: urlPage,
          limit: 12,
        };

        const res = await fetchJournals(filters);
        if (isMounted) {
          setJournals(res.journals);
          setTotal(res.total);
          setTotalPages(res.totalPages);
        }
      } catch (err) {
        console.error('Failed to fetch journals catalogue:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadJournals();
    return () => {
      isMounted = false;
    };
  }, [urlSearch, urlDiscipline, urlOpenAccess, urlFrequency, urlSortBy, urlPage]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
  };

  const handleFilterChange = (newFilters: Partial<JournalFilterOptions>) => {
    updateUrlParams({
      ...newFilters,
      page: 1,
    });
  };

  const handleSortChange = (sortBy: JournalSortOption) => {
    updateUrlParams({ sortBy, page: 1 });
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    router.push(pathname, { scroll: false });
  };

  const handleFocusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const activeFilters: JournalFilterOptions = {
    search: urlSearch,
    discipline: urlDiscipline,
    openAccess: urlOpenAccess,
    frequency: urlFrequency,
    sortBy: urlSortBy,
    page: urlPage,
    limit: 12,
  };

  return (
    <div className="min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope flex flex-col gap-10 pb-20">
      {/* SECTION 1 — JOURNALS HERO */}
      <JournalsHero onFocusSearch={handleFocusSearch} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-8">
        {/* SECTION 2 — SEARCH BAR */}
        <JournalSearchBar
          ref={searchInputRef}
          value={searchTerm}
          onChange={handleSearchChange}
          onClear={() => handleSearchChange('')}
        />

        {/* SECTION 3 — SORT BAR */}
        <JournalSort
          currentSort={urlSortBy}
          onSortChange={handleSortChange}
          totalCount={total}
        />

        {/* SECTION 4 & 5 — FILTER SIDEBAR & JOURNAL GRID */}
        <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
          <JournalFilters
            disciplines={disciplines}
            filters={activeFilters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
          />

          <div className="flex-1 w-full">
            {loading ? (
              <JournalGridSkeleton count={6} />
            ) : (
              <JournalGrid
                journals={journals}
                page={urlPage}
                totalPages={totalPages}
                onPageChange={(p) => updateUrlParams({ page: p })}
                onQuickView={(j) => setSelectedQuickView(j)}
                onResetFilters={handleResetFilters}
              />
            )}
          </div>
        </div>
      </div>

      {/* QUICK VIEW MODAL */}
      <JournalQuickView
        journal={selectedQuickView}
        onClose={() => setSelectedQuickView(null)}
      />
    </div>
  );
}

export default function JournalsPage() {
  return (
    <Suspense fallback={<JournalGridSkeleton count={6} />}>
      <JournalsCatalogContent />
    </Suspense>
  );
}

