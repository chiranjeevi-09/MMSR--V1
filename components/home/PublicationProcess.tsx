'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  SearchCheck,
  ShieldCheck,
  FileCheck,
  BookOpen,
  Award,
  Globe,
  TrendingUp,
} from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';

export const PublicationProcess: React.FC = () => {
  const steps = [
    { num: '01', title: 'Submission', desc: 'Online portal upload', icon: <Upload className="w-5 h-5 text-gold-400" /> },
    { num: '02', title: 'Editorial Screening', desc: 'Scope & similarity check', icon: <SearchCheck className="w-5 h-5 text-gold-400" /> },
    { num: '03', title: 'Peer Review', desc: 'Double-blind evaluation', icon: <ShieldCheck className="w-5 h-5 text-gold-400" /> },
    { num: '04', title: 'Author Revision', desc: 'Refinement & approval', icon: <FileCheck className="w-5 h-5 text-gold-400" /> },
    { num: '05', title: 'Publication', desc: 'Book / Issue release', icon: <BookOpen className="w-5 h-5 text-gold-400" /> },
    { num: '06', title: 'Certificate Issue', desc: 'Digital author badge', icon: <Award className="w-5 h-5 text-gold-400" /> },
    { num: '07', title: 'DOI Assignment', desc: 'Crossref registration', icon: <Globe className="w-5 h-5 text-gold-400" /> },
    { num: '08', title: 'Global Indexing', desc: 'Worldwide dissemination', icon: <TrendingUp className="w-5 h-5 text-gold-400" /> },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <SectionHeader
        badge="Transparent Workflow"
        title="8-Step Publication Journey"
        subtitle="From initial submission to international DOI assignment, our streamlined process ensures academic rigour and speed."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
        {steps.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: idx * 0.08 }}
          >
            <div className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] hover:border-gold-500 hover:shadow-gold-glow transition-all duration-300 flex flex-col justify-between h-full group relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold font-playfair text-gold-400/40 group-hover:text-gold-400 transition-colors">
                  {step.num}
                </span>
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-center group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-navy-900 transition-all">
                  {step.icon}
                </div>
              </div>

              <div className="flex flex-col">
                <h4 className="text-base font-bold font-playfair text-[#3A2312] group-hover:text-gold-400 transition-colors">
                  {step.title}
                </h4>
                <p className="text-xs text-text-muted mt-1">{step.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
