'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  BookOpen,
  FileText,
  CalendarDays,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { MOCK_BOOKS } from '@/lib/services/books';
import { MOCK_JOURNALS } from '@/lib/services/journals';
import { fetchConferences } from '@/lib/services/conferences';
import { Book } from '@/lib/types/book';
import { Journal } from '@/lib/types/journal';
import { Conference } from '@/lib/types/conference';

interface ServiceItem {
  id: string;
  title: string;
  description: string;
  href: string;
  category: string;
}

const PUBLISHING_SERVICES: ServiceItem[] = [
  {
    id: 'srv-1',
    title: 'DOI Registration & Crossref Syndication',
    description: 'Assign registered Crossref DOIs to books, journal articles, and conference proceedings.',
    href: '/services',
    category: 'Services',
  },
  {
    id: 'srv-2',
    title: 'International ISBN Allocation',
    description: 'Official international standard book number assignment for academic monographs.',
    href: '/services',
    category: 'Services',
  },
  {
    id: 'srv-3',
    title: 'Peer Review Management & Editing',
    description: 'Double-blind peer review coordination, manuscript formatting, and language editing.',
    href: '/services',
    category: 'Services',
  },
  {
    id: 'srv-4',
    title: 'Academic Indexing & Open Access',
    description: 'Google Scholar metadata indexing, repository archiving, and open access licensing.',
    href: '/services',
    category: 'Services',
  },
];

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [matchingConferences, setMatchingConferences] = useState<Conference[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Monotonic request id so only the most recent search response is applied.
  // Without this, a slow earlier request can resolve after a faster later one
  // and overwrite the results with stale matches for a previous query.
  const searchReqIdRef = useRef(0);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch conferences when query changes
  useEffect(() => {
    const qTrim = query.trim();
    const reqId = ++searchReqIdRef.current;
    if (!qTrim) {
      setMatchingConferences([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetchConferences({ search: qTrim, limit: 3 });
        // Apply only if this is still the latest request (stale responses ignored)
        if (reqId === searchReqIdRef.current) setMatchingConferences(res.conferences);
      } catch {
        if (reqId === searchReqIdRef.current) setMatchingConferences([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  // Search results matching
  const matchingBooks: Book[] = q
    ? MOCK_BOOKS.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.authors && b.authors.toLowerCase().includes(q)) ||
          b.category.toLowerCase().includes(q) ||
          (b.isbn && b.isbn.toLowerCase().includes(q))
      ).slice(0, 3)
    : [];

  const matchingJournals: Journal[] = q
    ? MOCK_JOURNALS.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.shortTitle.toLowerCase().includes(q) ||
          j.discipline.toLowerCase().includes(q) ||
          (j.issn && j.issn.toLowerCase().includes(q)) ||
          (j.eissn && j.eissn.toLowerCase().includes(q))
      ).slice(0, 3)
    : [];

  const matchingServices: ServiceItem[] = q
    ? PUBLISHING_SERVICES.filter(
        (s) => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      ).slice(0, 3)
    : [];

  const totalResults =
    matchingBooks.length +
    matchingJournals.length +
    matchingConferences.length +
    matchingServices.length;

  const handleSelectResult = (path: string) => {
    onClose();
    router.push(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 font-manrope">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#F8EEDC]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global Search Modal"
        className="relative w-full max-w-3xl bg-[#FFF9F1] border border-[#D4AC54] rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-in"
      >
        {/* Search Header */}
        <div className="p-4 sm:p-5 border-b border-[#D4AC54] flex items-center gap-3 bg-[#F8EEDC]/60">
          <Search className="w-5 h-5 text-[#C99A2E] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books, journals, conferences, services..."
            className="w-full bg-transparent text-[#2F241A] placeholder-[#73614C] text-sm sm:text-base outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-[#73614C] hover:text-[#2F241A] hover:bg-[#F8EEDC]"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#73614C] hover:text-[#C99A2E] hover:bg-[#F8EEDC] shrink-0 text-xs font-semibold px-2 border border-[#D4AC54]"
            aria-label="Close search modal"
          >
            ESC
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-6 space-y-6">
          {!q ? (
            <div className="py-8 text-center space-y-3 text-[#73614C]">
              <Search className="w-10 h-10 text-[#C99A2E]/50 mx-auto" />
              <p className="text-xs sm:text-sm">
                Type keywords to search across books, journals, conferences, and services.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="text-[13px] text-[#73614C]">Popular:</span>
                {['Engineering', 'Nanotechnology', 'Crossref DOI', 'ICASET 2025'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setQuery(tag)}
                    className="px-2.5 py-1 rounded-full bg-[#F8EEDC] hover:bg-[#FFF2D9] text-[#2F241A] hover:text-[#C99A2E] text-xs transition-colors border border-[#D4AC54]"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#F8EEDC] border border-[#D4AC54] flex items-center justify-center mx-auto text-[#C99A2E]">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold font-playfair text-[#2F241A]">No Results Found</h3>
              <p className="text-xs sm:text-sm text-[#73614C] max-w-sm mx-auto">
                No matches found for &quot;<strong className="text-[#C99A2E]">{query}</strong>&quot;. Try searching with broader terms or different domain names.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Books */}
              {matchingBooks.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C99A2E] flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> Books & Chapters ({matchingBooks.length})
                  </span>
                  <div className="space-y-1.5">
                    {matchingBooks.map((book) => (
                      <button
                        key={book.id}
                        onClick={() => handleSelectResult(`/books/${book.slug || book.publicId || book.id}`)}
                        className="w-full text-left p-3 rounded-xl bg-[#FFFDF8] hover:bg-[#FFF2D9] border border-[#D4AC54] hover:border-[#C99A2E] transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-[#2F241A] group-hover:text-[#C99A2E] transition-colors truncate">
                            {book.title}
                          </p>
                          <p className="text-[13px] text-[#73614C] truncate">
                            {book.authors || 'MMSR Editors'} • Category: {book.category}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#73614C] group-hover:text-[#C99A2E] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Journals */}
              {matchingJournals.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C99A2E] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Academic Journals ({matchingJournals.length})
                  </span>
                  <div className="space-y-1.5">
                    {matchingJournals.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => handleSelectResult(`/journals/${j.slug}`)}
                        className="w-full text-left p-3 rounded-xl bg-[#FFFDF8] hover:bg-[#FFF2D9] border border-[#D4AC54] hover:border-[#C99A2E] transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-[#2F241A] group-hover:text-[#C99A2E] transition-colors truncate">
                            {j.title} ({j.shortTitle})
                          </p>
                          <p className="text-[13px] text-[#73614C] truncate">
                            ISSN: {j.issn} • Discipline: {j.discipline}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#73614C] group-hover:text-[#C99A2E] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conferences */}
              {matchingConferences.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C99A2E] flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Scientific Conferences ({matchingConferences.length})
                  </span>
                  <div className="space-y-1.5">
                    {matchingConferences.map((conf) => (
                      <button
                        key={conf.id}
                        onClick={() => handleSelectResult(`/conference/${conf.slug}`)}
                        className="w-full text-left p-3 rounded-xl bg-[#FFFDF8] hover:bg-[#FFF2D9] border border-[#D4AC54] hover:border-[#C99A2E] transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-[#2F241A] group-hover:text-[#C99A2E] transition-colors truncate">
                            {conf.title} ({conf.shortTitle})
                          </p>
                          <p className="text-[13px] text-[#73614C] truncate">
                            {conf.location} • {conf.date} • Mode: {conf.mode}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#73614C] group-hover:text-[#C99A2E] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Services */}
              {matchingServices.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#C99A2E] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Publishing Services ({matchingServices.length})
                  </span>
                  <div className="space-y-1.5">
                    {matchingServices.map((srv) => (
                      <button
                        key={srv.id}
                        onClick={() => handleSelectResult(srv.href)}
                        className="w-full text-left p-3 rounded-xl bg-[#FFFDF8] hover:bg-[#FFF2D9] border border-[#D4AC54] hover:border-[#C99A2E] transition-all flex items-center justify-between gap-3 group"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-[#2F241A] group-hover:text-[#C99A2E] transition-colors truncate">
                            {srv.title}
                          </p>
                          <p className="text-[13px] text-[#73614C] truncate">
                            {srv.description}
                          </p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#73614C] group-hover:text-[#C99A2E] shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#F8EEDC]/40 border-t border-[#D4AC54] text-center text-[13px] text-[#73614C]">
          Showing results from MMSR V2 academic catalogue data
        </div>
      </div>
    </div>
  );
};
