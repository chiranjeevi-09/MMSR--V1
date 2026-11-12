'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Globe, GraduationCap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { LandingPanel } from './LandingPanel';

export const BrandIntro: React.FC = () => {
  const brandValues = [
    {
      icon: <GraduationCap className="w-8 h-8 text-[#7A5A2E]" />,
      title: 'Research Excellence',
      description:
        'Fostering high-impact scientific inquiry and multidisciplinary academic studies across international research communities.',
    },
    {
      icon: <Globe className="w-8 h-8 text-[#7A5A2E]" />,
      title: 'Global Visibility',
      description:
        'Maximizing reach with Crossref DOIs, Google Scholar indexing, and worldwide Open Access distribution networks.',
    },
    {
      icon: <ShieldAlert className="w-8 h-8 text-[#7A5A2E]" />,
      title: 'Peer Reviewed Publishing',
      description:
        'Double-blind rigorous peer review conducted by distinguished editorial boards to ensure highest scientific integrity.',
    },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto relative z-10 font-manrope">
      <LandingPanel innerClassName="px-6 py-12 sm:px-10 sm:py-16">
        <div className="text-center max-w-2xl mx-auto mb-16 relative z-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#7A5A2E] bg-[#C99A2E]/15 px-3 py-1 rounded-full border border-[#8C6239]/40">
            Core Publishing Pillars
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-playfair text-[#3E2A1A] mt-3">
            Uncompromised Quality & Vision
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        {brandValues.map((value, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: idx * 0.2 }}
          >
            <Card className="p-8 flex flex-col gap-5 h-full group cursor-pointer bg-white/45 backdrop-blur-xl border-[#8C6239]/20 hover:border-[#8C6239]/50 hover:bg-white/70 hover:shadow-gold-glow transition-all">
              <div className="w-16 h-16 rounded-2xl bg-[#C99A2E]/15 border border-[#8C6239]/30 flex items-center justify-center group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-[#241708] transition-all duration-300">
                {value.icon}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-2xl font-bold font-playfair text-[#3E2A1A] group-hover:text-[#8C6239] transition-colors">
                  {value.title}
                </h3>
                <p className="text-sm text-[#4A3626] leading-relaxed">
                  {value.description}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
      </LandingPanel>
    </section>
  );
};
