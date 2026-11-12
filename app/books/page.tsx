'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Book, BookFilterOptions, BookCategory } from '@/lib/types/book';
import { fetchBooks, fetchBookCategories } from '@/lib/services/books';
import { BooksHero } from '@/components/books/BooksHero';
import { BookSearchBar } from '@/components/books/BookSearchBar';
import { BookSort, BookSortOption } from '@/components/books/BookSort';
import { BookFilters } from '@/components/books/BookFilters';
import { BookGrid } from '@/components/books/BookGrid';
import dynamic from 'next/dynamic';
const BookQuickView = dynamic(() => import('@/components/books/BookQuickView').then((m) => m.BookQuickView), { ssr: false });
import { BookGridSkeleton } from '@/components/books/BookSkeleton';

function BooksCatalogContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Read URL params
  const urlSearch = searchParams.get('search') || '';
  const urlCategory = searchParams.get('category') || searchParams.get('domain') || 'all';
  const urlAvailability = searchParams.get('availability') || undefined;
  const urlYear = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
  const urlSortBy = (searchParams.get('sortBy') as BookSortOption) || 'newest';
  const urlPage = searchParams.get('page') ? Number(searchParams.get('page')) : 1;

  const [categories, setCategories] = useState<BookCategory[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedQuickView, setSelectedQuickView] = useState<Book | null>(null);

  // Local state for immediate typing feedback
  const [searchTerm, setSearchTerm] = useState(urlSearch);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keep search input synced with URL search param
  useEffect(() => {
    setSearchTerm(urlSearch);
  }, [urlSearch]);

  // Load categories on mount
  useEffect(() => {
    async function loadCats() {
      const cats = await fetchBookCategories();
      setCategories(cats);
    }
    loadCats();
  }, []);

  // Update URL search parameters helper
  const updateUrlParams = useCallback(
    (newParams: Record<string, string | number | undefined | null>) => {
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

  // Fetch books whenever URL searchParams change
  useEffect(() => {
    let isMounted = true;
    async function loadBooks() {
      setLoading(true);
      try {
        const filters: BookFilterOptions = {
          search: urlSearch,
          category: urlCategory,
          availability: urlAvailability,
          year: urlYear,
          sortBy: urlSortBy,
          page: urlPage,
          limit: 12,
        };

        const res = await fetchBooks(filters);
        if (isMounted) {
          setBooks(res.books);
          setTotal(res.total);
          setTotalPages(res.totalPages);
        }
      } catch (err) {
        console.error('Failed to fetch books catalogue:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBooks();
    return () => {
      isMounted = false;
    };
  }, [urlSearch, urlCategory, urlAvailability, urlYear, urlSortBy, urlPage]);

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
  };

  const handleFilterChange = (newFilters: Partial<BookFilterOptions>) => {
    updateUrlParams({
      ...newFilters,
      page: 1,
    });
  };

  const handleSortChange = (sortBy: BookSortOption) => {
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

  const activeFilters: BookFilterOptions = {
    search: urlSearch,
    category: urlCategory,
    availability: urlAvailability,
    year: urlYear,
    sortBy: urlSortBy,
    page: urlPage,
    limit: 12,
  };

  return (
    <div className="min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope flex flex-col gap-10 pb-20">
      {/* SECTION 1 — BOOKS HERO */}
      <BooksHero onFocusSearch={handleFocusSearch} />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col gap-8">
        {/* SECTION 2 — SEARCH BAR */}
        <BookSearchBar
          ref={searchInputRef}
          value={searchTerm}
          onChange={handleSearchChange}
          onClear={() => handleSearchChange('')}
        />

        {/* SECTION 4 — SORT BAR */}
        <BookSort
          currentSort={urlSortBy}
          onSortChange={handleSortChange}
          totalCount={total}
        />

        {/* SECTION 3 & 5 — FILTER SIDEBAR & BOOK GRID */}
        <div className="flex flex-col lg:flex-row gap-8 items-start w-full">
          <BookFilters
            categories={categories}
            filters={activeFilters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
          />

          <div className="flex-1 w-full">
            <h2 className="sr-only">Academic Books Catalog</h2>
            {loading ? (
              <BookGridSkeleton count={8} />
            ) : (
              <BookGrid
                books={books}
                page={urlPage}
                totalPages={totalPages}
                onPageChange={(p) => updateUrlParams({ page: p })}
                onQuickView={(b) => setSelectedQuickView(b)}
                onResetFilters={handleResetFilters}
              />
            )}
          </div>
        </div>
      </div>

      {/* QUICK VIEW MODAL */}
      <BookQuickView
        book={selectedQuickView}
        onClose={() => setSelectedQuickView(null)}
      />
    </div>
  );
}

export default function BooksCatalogPage() {
  return (
    <Suspense fallback={<BookGridSkeleton count={8} />}>
      <BooksCatalogContent />
    </Suspense>
  );
}

