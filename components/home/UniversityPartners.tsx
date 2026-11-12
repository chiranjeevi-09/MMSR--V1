'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GraduationCap } from 'lucide-react';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getUniversityPartners, DEFAULT_UNIVERSITY_PARTNERS } from '@/lib/services/siteSettings';
import { fetchAdminTestimonials } from '@/lib/services/cms';

interface PartnerItem {
  id?: string;
  name: string;
  location: string;
  type: string;
}

export const UniversityPartners: React.FC = () => {
  const [partners, setPartners] = useState<PartnerItem[]>(DEFAULT_UNIVERSITY_PARTNERS);

  useEffect(() => {
    async function loadDynamicPartners() {
      const stored = getUniversityPartners();
      try {
        const testimonials = await fetchAdminTestimonials().catch(() => []);
        const extracted = testimonials
          .filter((t) => t.university || t.institution)
          .map((t) => ({
            name: t.university || t.institution || 'Academic Partner',
            location: t.country || 'Global',
            type: t.designation || 'Research Partner',
          }));

        if (extracted.length > 0) {
          const map = new Map<string, PartnerItem>();
          [...stored, ...extracted].forEach((p) => map.set(p.name, p));
          setPartners(Array.from(map.values()));
        } else {
          setPartners(stored);
        }
      } catch {
        setPartners(stored);
      }
    }
    loadDynamicPartners();
  }, []);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto font-manrope">
      <SectionHeader
        badge="Academic Alliances"
        title="University & Institutional Partners"
        subtitle="MMSR Publications collaborates with leading research institutions, universities, and academic libraries globally."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
        {partners.map((partner, idx) => (
          <motion.div
            key={partner.id || idx}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: idx * 0.04 }}
          >
            <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60 hover:border-gold-500 hover:shadow-gold-glow transition-all duration-300 flex flex-col items-start gap-3 group h-full">
              <div className="p-3 rounded-xl bg-gold-500/10 border border-[#D4AC54] group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-navy-900 transition-all">
                <GraduationCap className="w-6 h-6 text-gold-400 group-hover:text-navy-900 transition-colors" />
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-sm font-bold font-playfair text-[#3A2312] group-hover:text-gold-400 transition-colors leading-tight line-clamp-2">
                  {partner.name}
                </h4>
                <span className="text-[13px] text-[#C99A2E] mt-1 font-semibold">{partner.type}</span>
                <span className="text-[13px] text-[#73614C] mt-0.5">{partner.location}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

