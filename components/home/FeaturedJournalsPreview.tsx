'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { FileText, Download, ArrowRight, ShieldCheck, RefreshCw, BookOpen } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AdminJournal, fetchPublicJournals } from '@/lib/services/cms';

export const FeaturedJournalsPreview: React.FC = () => {
  const [journals, setJournals] = useState<AdminJournal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJournals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPublicJournals();
      // Sort featured first, cap at 6
      const sorted = [...data].sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return 0;
      });
      setJournals(sorted.slice(0, 6));
    } catch {
      setJournals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJournals();
  }, [loadJournals]);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <SectionHeader
        badge="Peer-Reviewed Publications"
        title="Featured Academic Journals"
        subtitle="Explore high-impact double-blind refereed open-access journals indexed with ISSN and Crossref DOIs."
        cta={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadJournals}
              isLoading={loading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Link href="/journals">
              <Button variant="outline" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                View All Journals
              </Button>
            </Link>
          </div>
        }
      />

      {/* SKELETON LOADER */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] animate-pulse p-6 space-y-4 shadow-md">
              <div className="h-6 w-1/3 rounded bg-[#F1DFC3]" />
              <div className="h-8 w-3/4 rounded bg-[#F1DFC3]" />
              <div className="h-16 rounded-xl bg-[#EAD3B0]" />
            </div>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && journals.length === 0 && (
        <div className="p-10 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] text-center space-y-3 shadow-md">
          <FileText className="w-8 h-8 text-[#C99A2E] mx-auto" />
          <p className="text-base font-bold text-[#2F241A] font-playfair">No Journals Available</p>
          <p className="text-xs text-[#73614C] max-w-sm mx-auto">
            Peer-reviewed open access journals will appear here once published by our editorial board.
          </p>
          <Button variant="outline" size="sm" onClick={loadJournals}>
            Try Refreshing
          </Button>
        </div>
      )}

      {/* JOURNALS GRID */}
      {!loading && journals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {journals.map((journal, idx) => {
            const categoryName = typeof journal.category === 'object' && journal.category?.name
              ? journal.category.name
              : 'Multi-Disciplinary';

            const issueCount = journal.issues?.length || 1;

            return (
              <motion.div
                key={journal.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
              >
                <div className="rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#C99A2E] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col justify-between h-full group cursor-pointer shadow-md">
                  {/* Clean Cover Image Header */}
                  <div className="h-44 bg-[#F8EEDC] relative flex items-center justify-center overflow-hidden border-b border-[#D4AC54]">
                    {journal.cover_image ? (
                      <Image
                        src={journal.cover_image}
                        alt={journal.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-6 text-center text-[#9E7A3B]">
                        <FileText className="w-10 h-10 mb-1 text-[#C99A2E]" />
                        <span className="text-[13px] font-semibold uppercase tracking-wider">Indexed Journal</span>
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-36 h-36 bg-gold-500/10 rounded-full blur-2xl pointer-events-none" />

                  </div>

                  {/* Journal Details Structured Below Image */}
                  <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                    <div className="flex flex-col gap-3">
                      {/* ISSN & Open Access Badges Below Image */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[13px] font-mono text-[#C99A2E] font-semibold bg-[#FFF2D9] border border-[#D4AC54] px-2.5 py-1 rounded-full shadow-sm">
                          ISSN: {journal.issn || '2456-7890'}
                        </span>
                        <Badge variant="Open Access">Open Access</Badge>
                      </div>

                      <h4 className="text-xl font-bold font-playfair text-[#2F241A] group-hover:text-[#C99A2E] transition-colors line-clamp-2 leading-snug">
                        {journal.title}
                      </h4>

                      <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] text-xs">
                        <div>
                          <span className="text-[13px] text-[#73614C] uppercase font-semibold">Discipline</span>
                          <p className="font-semibold text-[#C99A2E] text-xs truncate">{categoryName}</p>
                        </div>
                        <div>
                          <span className="text-[13px] text-[#73614C] uppercase font-semibold">Issues Published</span>
                          <p className="font-bold text-[#2F241A] text-xs">{issueCount} Issues</p>
                        </div>
                      </div>

                      <div className="text-xs text-[#73614C] flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>Peer Reviewed • Double-Blind Review</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-[#D4AC54]/70 gap-3">
                      <span className="text-[13px] font-mono text-[#73614C] font-semibold">
                        Annual Sub: ₹{parseFloat(String(journal.subscription_price_annual || '2999')).toLocaleString('en-IN')}
                      </span>
                      <Link href={`/journals/${journal.slug || journal.id}`}>
                        <Button variant="gold" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                          View Journal
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
};
