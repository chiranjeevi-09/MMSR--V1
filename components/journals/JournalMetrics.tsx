'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Journal } from '@/lib/types/journal';
import { Award, Users, Library, Layers } from 'lucide-react';

const METRICS = [
  { label: 'Articles Published', key: 'articles', icon: Users },
  { label: 'Total Volumes', key: 'volumes', icon: Library },
  { label: 'Total Issues', key: 'issues', icon: Layers },
  { label: 'Impact Factor', key: 'impact', icon: Award },
] as const;

export const JournalMetrics: React.FC<{ journal: Journal }> = ({ journal }) => {
  const values: Record<string, string | number> = {
    articles: journal.articlesPublished ?? 0,
    volumes: journal.totalVolumes ?? 0,
    issues: journal.totalIssues ?? 0,
    impact: journal.impactMetric || '3.50',
  };

  return (
    <section className="py-8 font-manrope h-full flex flex-col">
      <div className="mb-6">
        <span className="text-xs font-bold uppercase tracking-widest text-[#B8860B]">
          Editorial Metrics & Statistics
        </span>
        <h3 className="text-2xl font-bold font-playfair text-[#3A2312] mt-1">
          Journal Performance Overview
        </h3>
      </div>

      {/* Single unified card styled to match the Academic Leadership box, animated in on scroll */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        whileHover={{ y: -6 }}
        className="p-6 min-h-[240px] rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] hover:border-[#8C6B1B] shadow-medium transition-all"
      >
        <div className="grid grid-cols-2 gap-6 h-full content-center">
          {METRICS.map((m) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-[#C99A2E]/15 border border-[#D4AC54] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#B8860B]" />
                  </span>
                  <span className="text-[13px] font-semibold text-[#73614C] uppercase tracking-wider">
                    {m.label}
                  </span>
                </div>
                <span className="text-2xl font-bold font-playfair text-[#2F241A]">{values[m.key]}</span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
};
