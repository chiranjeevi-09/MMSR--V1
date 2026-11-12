import React from 'react';
import { BookMarked, FileText, Calendar, Sparkles, Award, ShieldCheck, CheckCircle2, Globe, Bookmark } from 'lucide-react';

export type SubmissionMode = 'chapter' | 'journal' | 'conference';

interface SubmissionHeroProps {
  mode: SubmissionMode;
}

export function SubmissionHero({ mode }: SubmissionHeroProps) {
  const config = {
    chapter: {
      badge: 'Book Chapter Submission',
      icon: BookMarked,
      title: 'Publish Your Research Chapter in an Edited Volume',
      subtitle:
        'Publish your research chapter in an edited academic volume with ISBN, DOI eligibility, peer review, and global academic distribution.',
      badges: ['ISBN Volume', 'Peer Reviewed', 'DOI Eligible', 'Edited Book'],
    },
    journal: {
      badge: 'Journal Manuscript Submission',
      icon: FileText,
      title: 'Submit Your Manuscript for Academic Publication',
      subtitle:
        'Submit your manuscript for editorial screening, peer review, DOI publication, and indexing opportunities through MMSR Publications.',
      badges: ['Peer Reviewed', 'Open Access', 'DOI Publication', 'Indexed Journal'],
    },
    conference: {
      badge: 'Conference Paper Submission',
      icon: Calendar,
      title: 'Submit Your Paper for Conference Proceedings',
      subtitle:
        'Submit your conference paper for peer review, conference presentation, ISBN proceedings publication, and journal special issue consideration.',
      badges: ['Conference Proceedings', 'Peer Reviewed', 'ISBN Publication', 'Presentation Certificate'],
    },
  }[mode];

  const Icon = config.icon;

  return (
    <section className="relative rounded-3xl bg-[#FFF9F1] border border-[#E2C999] p-8 sm:p-12 overflow-hidden shadow-soft">
      {/* Decorative Golden Background Glows */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#C99A2E]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-[#8C6239]/5 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl space-y-6">
        {/* Publication Type Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest bg-[#C99A2E]/15 text-[#8C6239] border border-[#C99A2E]/40 shadow-sm">
          <Icon className="w-4 h-4 text-[#C99A2E]" />
          <span>{config.badge}</span>
        </div>

        {/* Page Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold font-playfair tracking-tight leading-tight text-[#5C4033]">
          {config.title}
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#6E5238] leading-relaxed max-w-3xl">
          {config.subtitle}
        </p>

        {/* 4 Reusable Progress / Feature Badges */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {config.badges.map((badge, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#F8EEDC] border border-[#E2C999] text-xs font-semibold text-[#5C4033] shadow-xs hover:border-[#C99A2E] transition-all"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[#C99A2E]" />
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
