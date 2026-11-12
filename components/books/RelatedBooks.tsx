'use client';

import React from 'react';
import { Book } from '@/lib/types/book';
import { BookCard } from './BookCard';
import { SectionHeader } from '@/components/ui/SectionHeader';

export const RelatedBooks: React.FC<{ books: Book[]; currentBookId: string }> = ({
  books,
  currentBookId,
}) => {
  const filtered = books.filter((b) => b.id !== currentBookId).slice(0, 4);

  if (filtered.length === 0) return null;

  return (
    <section className="py-16 font-manrope">
      <SectionHeader
        badge="Related Research"
        title="More Books in This Category"
        subtitle="Explore related peer-reviewed volumes and edited book chapter collections."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  );
};
