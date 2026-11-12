'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookMarked,
  FileText,
  BookOpen,
  Sparkles,
  Globe,
  Hash,
  ShieldCheck,
  Edit3,
  Layout,
  Award,
  ArrowRight,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';

export const PublishingServices: React.FC = () => {
  const services = [
    {
      icon: <BookMarked className="w-6 h-6 text-gold-400" />,
      title: 'Full Book Publishing',
      desc: 'Complete editorial & publishing services for single or co-authored academic books with ISBN & global distribution.',
      link: '/services/book-publishing',
    },
    {
      icon: <FileText className="w-6 h-6 text-gold-400" />,
      title: 'Book Chapter Publishing',
      desc: 'Publish peer-reviewed research chapters in curated edited volumes with individual Crossref DOI allocation.',
      link: '/publish-chapter',
    },
    {
      icon: <BookOpen className="w-6 h-6 text-gold-400" />,
      title: 'Journal Paper Publishing',
      desc: 'Submit research papers to indexed peer-reviewed journals with double-blind review and fast publication cycles.',
      link: '/submit-manuscript',
    },
    {
      icon: <Sparkles className="w-6 h-6 text-gold-400" />,
      title: 'Conference Proceedings',
      desc: 'Partner with MMSR to publish international conference proceedings in dedicated indexed volumes.',
      link: '/services/proceedings',
    },
    {
      icon: <Globe className="w-6 h-6 text-gold-400" />,
      title: 'DOI Registration Service',
      desc: 'Official Crossref DOI assignment for preprints, journal articles, books, and published chapters.',
      link: '/services/doi',
    },
    {
      icon: <Hash className="w-6 h-6 text-gold-400" />,
      title: 'ISBN Assignment',
      desc: 'Official 13-digit ISBN registration for physical print and digital eBook publications.',
      link: '/services/isbn',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-gold-400" />,
      title: 'Plagiarism Check & Report',
      desc: 'Comprehensive Turnitin similarity index check with detailed line-by-line editorial feedback.',
      link: '/services/plagiarism',
    },
    {
      icon: <Edit3 className="w-6 h-6 text-gold-400" />,
      title: 'Language & Copy Editing',
      desc: 'Professional English grammar, academic vocabulary, and editorial refinement by native editors.',
      link: '/services/editing',
    },
    {
      icon: <Layout className="w-6 h-6 text-gold-400" />,
      title: 'Manuscript Formatting',
      desc: 'Formatting manuscripts to strict LaTeX, IEEE, or APA publishing guidelines and layout templates.',
      link: '/services/formatting',
    },
    {
      icon: <Award className="w-6 h-6 text-gold-400" />,
      title: 'Digital Certificate Issue',
      desc: 'Verifiable digital author, reviewer, and editor certificates with QR code verification.',
      link: '/services/certificate',
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <SectionHeader
        badge="End-to-End Solutions"
        title="Comprehensive Publishing Services"
        subtitle="From manuscript preparation to global indexing, MMSR provides turnkey support for authors and research institutions."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {services.map((service, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
          >
            <Link
              href={service.link}
              className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 hover:border-gold-500 hover:shadow-gold-glow hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between h-full group cursor-pointer"
            >
              <div className="flex flex-col gap-3">
                <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-center group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-navy-900 transition-all">
                  {service.icon}
                </div>
                <h4 className="text-base font-bold font-playfair text-[#3A2312] group-hover:text-gold-400 transition-colors">
                  {service.title}
                </h4>
                <p className="text-xs text-text-muted leading-relaxed">
                  {service.desc}
                </p>
              </div>

              <div className="flex items-center text-xs font-semibold text-gold-400 mt-4 pt-3 border-t border-[#D4AC54]/40">
                <span>Learn More</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
