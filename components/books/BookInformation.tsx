'use client';

import React, { useState } from 'react';
import { Book } from '@/lib/types/book';
import { PublicId } from '@/components/ui/PublicId';
import { cn } from '@/lib/utils/cn';
import { BookOpen, ListOrdered, FileSpreadsheet, User } from 'lucide-react';

export type InfoTab = 'description' | 'specs' | 'author';

const AuthorField: React.FC<{ label: string; value?: string | null; mono?: boolean; span?: boolean }> = ({
  label,
  value,
  mono,
  span,
}) => (
  <div className={cn('p-3.5 rounded-xl bg-white border border-[#D4AC54]/40 flex flex-col gap-1', span && 'sm:col-span-2')}>
    <span className="text-[13px] font-bold uppercase tracking-wider text-[#8C6239]">{label}</span>
    {value?.trim() ? (
      <span className={cn('text-sm font-semibold text-[#3A2312] leading-snug break-words', mono && 'font-mono text-xs')}>{value}</span>
    ) : (
      <span className="text-sm font-medium italic text-[#8C6239]/60">Not specified</span>
    )}
  </div>
);

export const BookInformation: React.FC<{ book: Book }> = ({ book }) => {
  const [activeTab, setActiveTab] = useState<InfoTab>('description');

  const tabs = [
    { id: 'description' as InfoTab, label: 'Description', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'specs' as InfoTab, label: 'Specifications', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'author' as InfoTab, label: 'Author / Editor Info', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <section className="py-12 font-manrope">
      <div className="p-8 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] shadow-glass flex flex-col gap-6">
        {/* Tabs Header */}
        <div className="flex items-center gap-2 border-b border-[#D4AC54]/60 pb-4 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap select-none',
                  isActive
                    ? 'bg-gradient-gold text-navy-900 shadow-gold-glow'
                    : 'text-text-muted hover:text-ivory-white hover:bg-white/5'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Description */}
        {activeTab === 'description' && (
          <div className="flex flex-col gap-4 text-sm text-ivory-white/90 leading-relaxed animate-fade-in">
            <h3 className="text-xl font-bold font-playfair text-gold-400">Book Overview</h3>
            <p>{book.description}</p>
            <p className="text-text-muted text-xs">
              Published under MMSR Publications academic standard. All chapters undergo double-blind peer review and are registered with Crossref DOIs.
            </p>
          </div>
        )}

        {/* Tab 3: Specifications Table */}
        {activeTab === 'specs' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold font-playfair text-gold-400 mb-2">Publication Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex flex-col gap-1.5">
                <span className="text-text-muted">MMSR Publication ID</span>
                <PublicId value={book.publicId} tone="light" size="sm" className="w-fit" />
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">ISBN</span>
                <span className="font-mono font-bold text-ivory-white">{book.isbn}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">Digital Object Identifier (DOI)</span>
                <span className="font-mono text-gold-400">{book.doi || '10.5281/mmsr'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">Publisher</span>
                <span className="font-semibold text-ivory-white">{book.publisher || 'MMSR Publications'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">Publication Year</span>
                <span className="font-semibold text-ivory-white">{book.publishYear} Edition</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">Pages</span>
                <span className="font-semibold text-ivory-white">{book.pages} Pages</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">Binding Format</span>
                <span className="font-semibold text-ivory-white">{book.binding || 'Hardcover'}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">Language</span>
                <span className="font-semibold text-ivory-white">{book.language}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/40 flex justify-between">
                <span className="text-text-muted">Stock Status</span>
                <span className="font-semibold text-emerald-400">{book.stockStatus}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Author / Editor Info */}
        {activeTab === 'author' && (
          <div className="flex flex-col gap-6 animate-fade-in font-manrope">
            <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#D4AC54] shadow-medium space-y-5">
              {/* Identity Header */}
              <div className="flex items-center gap-4 pb-4 border-b border-[#D4AC54]/60">
                <div className="w-16 h-16 rounded-2xl bg-gradient-gold p-0.5 shadow-gold-glow shrink-0 flex items-center justify-center font-playfair font-bold text-navy-900 text-2xl">
                  {(book.editors || book.authors || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="text-[13px] font-bold uppercase tracking-wider text-[#8C6239] block mb-0.5">Author / Editor Profile</span>
                  <h4 className="text-xl font-bold font-playfair text-[#3A2312] leading-snug break-words">
                    {book.editors || book.authors || 'Not specified'}
                  </h4>
                </div>
              </div>

              {/* Structured Detail Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AuthorField label="Full Name" value={book.editors || book.authors} />
                <AuthorField label="Designation / Role" value={book.authorDesignation} />
                <AuthorField label="Affiliation / Institution" value={book.authorAffiliation} />
              </div>

              {/* Biography */}
              <div className="pt-2 border-t border-[#D4AC54]/60">
                <span className="text-xs font-bold text-[#8C6239] uppercase tracking-wider block mb-1.5">
                  Academic Biography &amp; Research Overview
                </span>
                {book.authorBio?.trim() ? (
                  <p className="text-xs text-[#5C4033] leading-relaxed font-medium">{book.authorBio}</p>
                ) : (
                  <p className="text-xs text-[#8C6239]/60 leading-relaxed font-medium italic">
                    No biography has been published for this author / editor yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
