'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen, FileText, Layers, Presentation, Link as LinkIcon, Hash,
  PenTool, Edit3, ShieldCheck, Users, Award, Lightbulb,
  Send, ClipboardCheck, CheckCircle2, Globe, ChevronDown, ChevronUp, Home, ChevronRight
} from 'lucide-react';
import { PUBLISHING_PROCESS_STEPS, getPublishingServices } from '@/lib/services/publishingServices';
import { getImpactMetrics, ImpactMetricsConfig, DEFAULT_METRICS } from '@/lib/services/siteSettings';
import { getContactFAQs } from '@/lib/services/contact';
import { PublishingService, ServiceCategory } from '@/lib/types/service';
import { ContactFAQ } from '@/lib/types/contact';

// ─── Icon Map ────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="w-6 h-6 shrink-0" />,
  FileText: <FileText className="w-6 h-6 shrink-0" />,
  Layers: <Layers className="w-6 h-6 shrink-0" />,
  Presentation: <Presentation className="w-6 h-6 shrink-0" />,
  Link: <LinkIcon className="w-6 h-6 shrink-0" />,
  Hash: <Hash className="w-6 h-6 shrink-0" />,
  PenTool: <PenTool className="w-6 h-6 shrink-0" />,
  Edit3: <Edit3 className="w-6 h-6 shrink-0" />,
  ShieldCheck: <ShieldCheck className="w-6 h-6 shrink-0" />,
  Users: <Users className="w-6 h-6 shrink-0" />,
  Award: <Award className="w-6 h-6 shrink-0" />,
  Lightbulb: <Lightbulb className="w-6 h-6 shrink-0" />,
  Send: <Send className="w-6 h-6 shrink-0" />,
  ClipboardCheck: <ClipboardCheck className="w-6 h-6 shrink-0" />,
  CheckCircle2: <CheckCircle2 className="w-6 h-6 shrink-0" />,
  Globe: <Globe className="w-6 h-6 shrink-0" />,
};

const CATEGORIES: { label: string; value: ServiceCategory | 'all' }[] = [
  { label: 'All Services', value: 'all' },
  { label: 'Publication', value: 'Publication' },
  { label: 'Editorial', value: 'Editorial' },
  { label: 'Technical', value: 'Technical' },
  { label: 'Certification', value: 'Certification' },
  { label: 'Research Support', value: 'Research Support' },
];

const WHY_MMSR = [
  { icon: 'ShieldCheck', title: 'Double-Blind Peer Review', description: 'All manuscripts undergo rigorous double-blind peer review coordinated by our editorial team.' },
  { icon: 'Link', title: 'Crossref DOI Registration', description: 'Every published work receives a permanent Digital Object Identifier via Crossref membership.' },
  { icon: 'Hash', title: 'ISBN Assignment', description: 'Books and edited volumes receive internationally recognized ISBN through our publishing services.' },
  { icon: 'Globe', title: 'Global Digital Distribution', description: "Publications are globally accessible through MMSR's digital catalogue and partner networks." },
  { icon: 'Edit3', title: 'Academic Editorial Workflow', description: 'Our editorial process follows established academic publishing standards and scholarly conventions.' },
  { icon: 'Award', title: 'Publication Certificates', description: 'Authors receive official publication certificates on MMSR letterhead for institutional records.' },
];

// ─── Service Card ─────────────────────────────────────────────────────────────
const ServiceCard: React.FC<{ service: PublishingService }> = ({ service }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6, scale: 1.02 }}
      viewport={{ once: true }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="rounded-2xl bg-[#FFF9F1] border-2 border-[#D4AC54]/60 hover:border-[#C99A2E] shadow-sm hover:shadow-[0_10px_25px_rgba(201,154,46,0.2)] transition-all flex flex-col overflow-hidden group cursor-pointer"
    >
      <div className="p-6 flex-1 flex flex-col gap-4">
        {/* Icon + Category */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-[#C99A2E] group-hover:bg-[#D4AC54] group-hover:text-[#2A180B] transition-colors shrink-0">
            {ICON_MAP[service.icon] || <BookOpen className="w-6 h-6 shrink-0" />}
          </div>
          <span className="text-[13px] font-semibold text-text-muted uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/5 border border-[#D4AC54]/60">
            {service.category}
          </span>
        </div>

        <div>
          <h3 className="font-playfair font-bold text-[#2F241A] text-base group-hover:text-gold-400 transition-colors">{service.title}</h3>
          <p className="text-text-muted text-xs leading-relaxed mt-1">{service.shortDescription}</p>
        </div>

        {/* Benefits */}
        <ul className="flex flex-col gap-1.5">
          {service.benefits.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-xs text-text-muted">
              <CheckCircle2 className="w-3.5 h-3.5 text-gold-400 shrink-0" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* Turnaround */}
        {service.turnaround && (
          <p className="text-xs text-text-muted">
            <span className="text-gold-400 font-semibold">Turnaround:</span> {service.turnaround}
          </p>
        )}

        {/* Expand/collapse full description */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition-colors self-start cursor-pointer font-semibold"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Less' : 'Learn more'}
        </button>

        {expanded && (
          <p className="text-xs text-text-muted leading-relaxed border-t border-[#D4AC54]/60 pt-3">
            {service.fullDescription}
          </p>
        )}
      </div>

      {/* Tags */}
      {service.tags && (
        <div className="px-6 pb-4 flex flex-wrap gap-1.5">
          {service.tags.map((tag) => (
            <span key={tag} className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-gold-500/8 text-gold-400 border border-[#D4AC54]">
              {tag}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
const FAQItem: React.FC<{ faq: ContactFAQ; isOpen: boolean; onToggle: () => void }> = ({ faq, isOpen, onToggle }) => (
  <div className="rounded-xl border border-[#D4AC54]/60 bg-[#FFF9F1] overflow-hidden">
    <button
      onClick={onToggle}
      aria-expanded={isOpen}
      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors cursor-pointer"
    >
      <span className={`text-sm font-semibold ${isOpen ? 'text-gold-400' : 'text-[#2F241A]'}`}>
        {faq.question}
      </span>
      {isOpen ? <ChevronUp className="w-4 h-4 text-gold-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />}
    </button>
    {isOpen && (
      <div className="px-5 pb-4 text-sm text-text-muted leading-relaxed border-t border-[#D4AC54]/40 pt-3">
        {faq.answer}
      </div>
    )}
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ServicesPage() {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory | 'all'>('all');
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<ImpactMetricsConfig>(DEFAULT_METRICS);
  const [services, setServices] = useState<PublishingService[]>([]);
  const [faqs, setFaqs] = useState<ContactFAQ[]>([]);

  useEffect(() => {
    setMetrics(getImpactMetrics());
    setServices(getPublishingServices());

    const allFaqs = getContactFAQs();
    const serviceFaqs = allFaqs.filter(
      (f) =>
        !f.pageTarget ||
        f.pageTarget.toLowerCase() === 'publishing services' ||
        f.pageTarget.toLowerCase() === 'general'
    );
    setFaqs(serviceFaqs.length > 0 ? serviceFaqs : allFaqs);
  }, []);

  // Scroll to the in-page section referenced by the URL hash (e.g. /services#doi-isbn)
  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace('#', '');
      if (!id) return;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    // Defer so the sections are mounted, then react to later hash changes too
    const t = setTimeout(scrollToHash, 120);
    window.addEventListener('hashchange', scrollToHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', scrollToHash);
    };
  }, [services]);

  const filteredServices = activeCategory === 'all'
    ? services
    : services.filter((s) => s.category === activeCategory);

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-[#2F241A] font-manrope pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-16 pt-6">

        {/* ── Breadcrumb ── */}
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-text-muted">
          <ol className="flex items-center gap-1.5">
            <li><Link href="/home" className="flex items-center gap-1 hover:text-gold-400 transition-colors"><Home className="w-3.5 h-3.5" /><span>Home</span></Link></li>
            <li className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /><span className="font-semibold text-gold-400" aria-current="page">Publishing Services</span></li>
          </ol>
        </nav>

        {/* ── Hero (Section 1) ── */}
        <section className="relative rounded-3xl bg-[#FFF9F1] border border-gold-500/25 p-8 sm:p-12 overflow-hidden shadow-glass">
          <div className="absolute -top-20 right-0 w-72 h-72 bg-gold-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex flex-col gap-5 max-w-2xl">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-gold-500/10 text-gold-400 border border-[#D4AC54] w-fit">
                <BookOpen className="w-3.5 h-3.5" />
                Academic Publishing Services
              </span>
              <h1 className="font-playfair text-3xl sm:text-5xl font-bold text-[#2F241A] leading-tight">
                Professional{' '}
                <span className="gradient-gold-text">Academic Publishing</span>
                <br />Support Services
              </h1>
              <p className="text-text-muted text-sm sm:text-base leading-relaxed max-w-xl">
                From manuscript submission to global publication — MMSR Publications provides comprehensive academic publishing services for researchers, scholars, and institutions worldwide.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href="/contact"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-gold border-2 border-[#967018] text-navy-900 font-bold text-sm shadow-gold-glow hover:scale-[1.02] hover:border-[#2A180B] transition-all"
                >
                  <Send className="w-4 h-4" />
                  Contact Editorial Team
                </Link>
                <Link
                  href="/submit-manuscript"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#F8EEDC] border-2 border-[#D4AC54] text-[#2F241A] font-semibold text-sm hover:border-[#C99A2E] hover:scale-[1.02] transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Submit Manuscript
                </Link>
              </div>
            </div>

            {/* Quick Stats Card (Admin Editable Dynamic Values) */}
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-full lg:w-72 p-5 rounded-2xl bg-[#F8EEDC] border-2 border-[#D4AC54]/80 hover:border-[#C99A2E] flex flex-col gap-3 shadow-sm transition-all"
            >
              <p className="text-xs font-bold text-[#2F241A] uppercase tracking-wider border-b border-[#D4AC54]/60 pb-2">Quick Stats</p>
              {[
                { label: 'Total Services', value: metrics.servicesTotalText || '12+' },
                { label: 'Published Works', value: metrics.servicesWorksText || '500+' },
                { label: 'Peer Review Standard', value: metrics.servicesReviewText || 'Double-Blind' },
                { label: 'Identifier System', value: metrics.servicesIdText || 'Crossref DOI' },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="text-text-muted font-medium">{s.label}</span>
                  <span className="font-bold text-[#C99A2E]">{s.value}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Section 2: Category Filter & Admin Editable Service Cards ── */}
        <section id="all-services" className="space-y-6 scroll-mt-24">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all cursor-pointer ${
                  activeCategory === cat.value
                    ? 'bg-gold-500/15 text-gold-400 border-[#D4AC54]'
                    : 'bg-[#FFF9F1] text-text-muted border-[#D4AC54]/60 hover:border-[#C99A2E] hover:text-[#2F241A]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Service Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>

        {/* ── Section 3: Publication Process with Hover Effects ── */}
        <section id="peer-review" className="space-y-8 scroll-mt-24">
          <div className="text-center">
            <h2 className="font-playfair text-3xl font-bold text-[#2F241A]">
              Our <span className="gradient-gold-text">Publication Process</span>
            </h2>
            <p className="text-text-muted text-sm mt-2 max-w-xl mx-auto">
              A structured, transparent workflow from initial enquiry to final publication and certification.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PUBLISHING_PROCESS_STEPS.map((step) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -6, scale: 1.02 }}
                viewport={{ once: true }}
                transition={{ delay: step.step * 0.08, type: 'spring', stiffness: 300, damping: 20 }}
                className="p-6 rounded-2xl bg-[#FFF9F1] border-2 border-[#D4AC54]/60 hover:border-[#C99A2E] shadow-sm hover:shadow-[0_10px_25px_rgba(201,154,46,0.2)] transition-all flex flex-col gap-3 group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center text-navy-900 font-bold text-sm shadow-gold-glow group-hover:scale-105 transition-transform shrink-0">
                    {step.step}
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 group-hover:bg-[#C99A2E] group-hover:text-[#2A180B] transition-colors shrink-0">
                    {ICON_MAP[step.icon] || <BookOpen className="w-5 h-5 shrink-0" />}
                  </div>
                </div>
                <h3 className="font-playfair font-bold text-[#2F241A] text-sm group-hover:text-gold-400 transition-colors">{step.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Why Choose MMSR ── */}
        <section id="doi-isbn" className="rounded-3xl bg-[#FFF9F1] border-2 border-[#D4AC54] p-8 sm:p-12 space-y-8 scroll-mt-24">
          <div>
            <h2 className="font-playfair text-3xl font-bold text-[#2F241A]">Why Choose <span className="gradient-gold-text">MMSR Publications</span></h2>
            <p className="text-text-muted text-sm mt-2 max-w-xl">
              Built on academic integrity and scholarly publishing standards.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WHY_MMSR.map((item) => (
              <motion.div
                key={item.title}
                whileHover={{ y: -4, scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col gap-3 p-5 rounded-2xl bg-[#F8EEDC]/60 border border-[#D4AC54]/40 hover:border-[#C99A2E] transition-all group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400 group-hover:bg-[#C99A2E] group-hover:text-[#2A180B] transition-colors shrink-0">
                  {ICON_MAP[item.icon] || <BookOpen className="w-5 h-5 shrink-0" />}
                </div>
                <h3 className="font-playfair font-bold text-[#2F241A] text-sm group-hover:text-gold-400 transition-colors">{item.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── FAQs (Admin Managed & Filtered) ── */}
        <section className="space-y-5">
          <h2 className="font-playfair text-2xl font-bold text-[#2F241A]">Frequently Asked Questions</h2>
          <div className="flex flex-col gap-2 max-w-3xl">
            {faqs.map((faq) => (
              <FAQItem
                key={faq.id}
                faq={faq}
                isOpen={openFAQ === faq.id}
                onToggle={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)}
              />
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}

