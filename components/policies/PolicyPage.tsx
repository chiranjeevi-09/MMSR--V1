'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Scale, ShieldCheck, BookOpen, AlertCircle, ArrowLeft } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { PolicyMarkdown } from '@/components/policies/PolicyMarkdown';
import { fetchPublicPolicy, PublicPolicy, PolicyType } from '@/lib/services/policies';

/**
 * Shared public policy page shell.
 * Reads ONLY the latest published version from the backend, shows loading and
 * "unavailable" states, and renders content through the safe Markdown renderer.
 * Drafts and admin metadata are never requested or displayed here.
 */

export interface PolicyPageProps {
  policyType: PolicyType;
  eyebrow: string;
  titleFallback: string;
  intro: string;
  breadcrumb: string;
  icon?: 'scale' | 'shield' | 'book';
}

/** Slug must stay in sync with the heading ids produced by PolicyMarkdown. */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractToc(content: string): { id: string; title: string }[] {
  const items: { id: string; title: string }[] = [];
  for (const line of (content || '').replace(/\r\n/g, '\n').split('\n')) {
    const m = /^##\s+(.*)$/.exec(line.trim());
    if (m) {
      const title = m[1].replace(/[*_]/g, '').trim();
      items.push({ id: slugify(title), title });
    }
  }
  return items;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

const ICONS = {
  scale: Scale,
  shield: ShieldCheck,
  book: BookOpen,
};

export const PolicyPage: React.FC<PolicyPageProps> = ({
  policyType,
  eyebrow,
  titleFallback,
  intro,
  breadcrumb,
  icon = 'scale',
}) => {
  const HeroIcon = ICONS[icon];
  const [policy, setPolicy] = useState<PublicPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicPolicy(policyType).then((data) => {
      if (!cancelled) {
        setPolicy(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [policyType]);

  const toc = useMemo(() => (policy ? extractToc(policy.content) : []), [policy]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope pt-6 pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <Breadcrumb items={[{ label: 'Legal & Policies' }, { label: breadcrumb }]} />

        {/* Hero Header */}
        <section className="relative rounded-3xl bg-[#F8EEDC] border border-[#D4AC54] p-8 sm:p-12 overflow-hidden shadow-glass">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-gold-500/10 text-gold-400 border border-[#D4AC54] shadow-gold-glow">
              <HeroIcon className="w-3.5 h-3.5" />
              {eyebrow}
            </span>

            <h1 className="text-3xl sm:text-5xl font-extrabold font-playfair tracking-tight text-ivory-white leading-tight">
              {policy?.title || titleFallback}
            </h1>

            <p className="text-sm sm:text-base text-text-muted leading-relaxed">{intro}</p>

            {!loading && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted pt-2 border-t border-[#D4AC54]/60">
                {policy ? (
                  <>
                    <span>Effective Date: <strong className="text-gold-400">{formatDate(policy.effective_date)}</strong></span>
                    <span>•</span>
                    <span>Version: <strong className="text-ivory-white">v{policy.version}</strong></span>
                    <span>•</span>
                    <span>Published: <strong className="text-ivory-white">{formatDate(policy.published_at)}</strong></span>
                  </>
                ) : (
                  <span className="text-ruby-red font-semibold">Status: <strong>Currently unavailable</strong></span>
                )}
              </div>
            )}
          </div>
        </section>

        {loading ? (
          /* Loading state */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start" role="status" aria-live="polite">
            <aside className="lg:col-span-4 p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 space-y-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-8 rounded-lg bg-[#F8EEDC] animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
              ))}
            </aside>
            <div className="lg:col-span-8 p-6 sm:p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 space-y-4">
              <div className="h-8 w-2/3 rounded-lg bg-[#F8EEDC] animate-pulse" />
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-4 rounded bg-[#F8EEDC] animate-pulse" style={{ width: `${95 - (i % 4) * 12}%` }} />
              ))}
              <span className="sr-only">Loading policy content…</span>
            </div>
          </div>
        ) : !policy ? (
          /* Unavailable state — no published version exists */
          <section className="p-8 sm:p-12 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-center space-y-4 max-w-2xl mx-auto">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-gold-400" />
            </div>
            <h2 className="text-xl font-bold font-playfair text-ivory-white">
              {titleFallback} Temporarily Unavailable
            </h2>
            <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
              The latest official version of this policy is not currently published. Please check back shortly,
              or contact our editorial office if you need this information urgently.
            </p>
            <div className="pt-2 flex items-center justify-center gap-4">
              <Link href="/contact" className="inline-flex items-center gap-2 text-xs font-bold text-gold-400 hover:text-gold-300 transition-colors">
                <FileText className="w-4 h-4" /> Contact Editorial Office
              </Link>
              <Link href="/home" className="inline-flex items-center gap-2 text-xs font-bold text-text-muted hover:text-gold-400 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </Link>
            </div>
          </section>
        ) : (
          /* Main content layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {toc.length > 0 && (
              <aside className="lg:col-span-4 sticky top-28 hidden lg:block p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 space-y-4 max-h-[80vh] overflow-y-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-gold-400 block border-b border-[#D4AC54]/60 pb-2">
                  Policy Table of Contents
                </span>
                <nav className="flex flex-col gap-1 text-xs" aria-label="Policy sections">
                  {toc.map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => scrollToSection(sec.id)}
                      className={`text-left px-3 py-2 rounded-lg transition-all ${
                        activeSection === sec.id
                          ? 'bg-gold-500/15 text-gold-400 font-bold border border-[#D4AC54]'
                          : 'text-text-muted hover:text-ivory-white hover:bg-white/5'
                      }`}
                    >
                      {sec.title}
                    </button>
                  ))}
                </nav>
              </aside>
            )}

            <article className={toc.length > 0 ? 'lg:col-span-8 p-6 sm:p-10 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60' : 'col-span-full lg:col-span-8 lg:col-start-5 p-6 sm:p-10 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60'}>
              <PolicyMarkdown content={policy.content} />
            </article>
          </div>
        )}
      </div>
    </main>
  );
};

export default PolicyPage;
