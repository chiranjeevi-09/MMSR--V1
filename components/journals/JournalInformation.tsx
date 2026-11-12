'use client';

import React, { useState } from 'react';
import { Journal } from '@/lib/types/journal';
import { cn } from '@/lib/utils/cn';
import { BookOpen, Target, ShieldCheck, FileSpreadsheet } from 'lucide-react';

export type JournalInfoTab = 'about' | 'scope' | 'policy' | 'details';

export const JournalInformation: React.FC<{ journal: Journal }> = ({ journal }) => {
  const [activeTab, setActiveTab] = useState<JournalInfoTab>('about');

  const tabs = [
    { id: 'about' as JournalInfoTab, label: 'About the Journal', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'scope' as JournalInfoTab, label: 'Aims & Scope', icon: <Target className="w-4 h-4" /> },
    { id: 'policy' as JournalInfoTab, label: 'Editorial Policy', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'details' as JournalInfoTab, label: 'Publication Details', icon: <FileSpreadsheet className="w-4 h-4" /> },
  ];

  return (
    <section className="py-8 font-manrope">
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
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none',
                  isActive
                    ? 'bg-gradient-gold text-[#2A180B] shadow-md border border-[#967018]'
                    : 'text-[#6E5238] hover:text-[#3A2312] hover:bg-[#F8EEDC]'
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: About */}
        {activeTab === 'about' && (
          <div className="flex flex-col gap-4 text-sm text-[#5C4033] leading-relaxed animate-fade-in font-medium">
            <h3 className="text-xl font-bold font-playfair text-[#B8860B]">About {journal.title}</h3>
            <p className="text-[#3A2312]">{journal.description}</p>
          </div>
        )}

        {/* Tab 2: Aims & Scope */}
        {activeTab === 'scope' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold font-playfair text-[#B8860B] mb-1">Aims & Scope</h3>
            <p className="text-sm text-[#5C4033] font-medium leading-relaxed">{journal.aims}</p>

            <h4 className="text-sm font-bold font-playfair text-[#3A2312] mt-2">Key Research Topics Covered:</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#5C4033]">
              {journal.scope.map((topic, idx) => (
                <li key={idx} className="p-3 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex items-center gap-2 text-[#3A2312] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B8860B] shrink-0" />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tab 3: Editorial Policy */}
        {activeTab === 'policy' && (
          <div className="flex flex-col gap-4 text-xs text-[#5C4033] font-medium leading-relaxed animate-fade-in">
            <h3 className="text-xl font-bold font-playfair text-[#B8860B]">Editorial & Peer Review Policy</h3>
            <p className="text-sm text-[#3A2312]">
              {journal.title} adheres strictly to Committee on Publication Ethics (COPE) guidelines. Every paper undergoes preliminary plagiarism checking before double-blind peer evaluation.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60">
                <span className="font-bold text-[#B8860B] block mb-1 text-sm">Double-Blind Review</span>
                <span className="text-[#6E5238]">Author and reviewer identities are masked throughout evaluation.</span>
              </div>
              <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60">
                <span className="font-bold text-[#B8860B] block mb-1 text-sm">Plagiarism Verification</span>
                <span className="text-[#6E5238]">Turnitin similarity reports generated prior to editor review.</span>
              </div>
              <div className="p-4 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60">
                <span className="font-bold text-[#B8860B] block mb-1 text-sm">Open Access Terms</span>
                <span className="text-[#6E5238]">Distributed under Creative Commons Attribution CC-BY 4.0 license.</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Publication Details */}
        {activeTab === 'details' && (
          <div className="flex flex-col gap-4 animate-fade-in">
            <h3 className="text-xl font-bold font-playfair text-[#B8860B] mb-1">Publication Specifications</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex justify-between">
                <span className="text-[#6E5238] font-medium">Publication Frequency</span>
                <span className="font-bold text-[#3A2312]">{journal.frequency}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex justify-between">
                <span className="text-[#6E5238] font-medium">Language</span>
                <span className="font-bold text-[#3A2312]">English</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex justify-between">
                <span className="text-[#6E5238] font-medium">Publisher</span>
                <span className="font-bold text-[#3A2312]">{journal.publisher}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8EEDC] border border-[#D4AC54]/60 flex justify-between">
                <span className="text-[#6E5238] font-medium">Access Type</span>
                <span className="font-bold text-[#2E6B34]">
                  {/subscription/i.test(journal.accessType || '') ? 'Subscribed' : /hybrid/i.test(journal.accessType || '') ? 'Hybrid' : 'Open'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
