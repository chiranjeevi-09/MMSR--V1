'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchBookById, fetchBooks } from '@/lib/services/books';
import { Book } from '@/lib/types/book';
import { BookBreadcrumb } from '@/components/books/BookBreadcrumb';
import { BookDetailsHero } from '@/components/books/BookDetailsHero';
import { BookInformation } from '@/components/books/BookInformation';
import { BookPreviewSection } from '@/components/books/BookPreviewSection';
import { RelatedBooks } from '@/components/books/RelatedBooks';
import { ReviewSection } from '@/components/reviews/ReviewSection';
import { BookDetailsSkeleton } from '@/components/books/BookSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookOpen } from 'lucide-react';

interface BookDetailClientProps {
  id: string;
}

export const BookDetailClient: React.FC<BookDetailClientProps> = ({ id }) => {
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [relatedBooks, setRelatedBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadBookAndRelated = async () => {
      setLoading(true);
      try {
        const data = await fetchBookById(id);
        if (!isMounted) return;

        setBook(data);

        if (data) {
          const relRes = await fetchBooks({
            category: data.categorySlug || data.category,
            limit: 6,
          });

          if (isMounted) {
            const filtered = relRes.books
              .filter((b) => b.id !== data.id && b.slug !== data.slug)
              .slice(0, 4);
            setRelatedBooks(filtered);
          }
        }
      } catch (err) {
        // Fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (id) {
      loadBookAndRelated();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return <BookDetailsSkeleton />;
  }

  if (!book) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <EmptyState
          icon={<BookOpen className="w-12 h-12 text-gold-400" />}
          title="Academic Book Not Found"
          description="The requested volume may have been updated, moved, or is currently unavailable in the public catalogue."
          primaryActionLabel="Back to Books Catalogue"
          onPrimaryAction={() => router.push('/books')}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope pb-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col gap-8">
        {/* Breadcrumb Navigation */}
        <BookBreadcrumb items={[{ label: book.category, href: `/books?category=${encodeURIComponent(book.categorySlug || book.category)}` }, { label: book.title }]} />

        {/* SECTION 1 — BOOK DETAILS HERO */}
        <BookDetailsHero book={book} />

        {/* SECTION 2 — BOOK INFORMATION TABS */}
        <BookInformation book={book} />

        {/* SECTION 3 — SAMPLE PREVIEW */}
        <BookPreviewSection book={book} />

        {/* SECTION 4 — RELATED BOOKS */}
        {relatedBooks.length > 0 && <RelatedBooks books={relatedBooks} currentBookId={book.id} />}

        {/* SECTION 5 — WRITE A REVIEW (goes to admin testimonials moderation) */}
        <ReviewSection targetType="book" targetId={Number(book.id)} targetTitle={book.title} />
      </div>
    </div>
  );
};
