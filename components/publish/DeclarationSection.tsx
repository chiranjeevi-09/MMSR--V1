'use client';

import React from 'react';
import { ShieldCheck, CheckSquare, AlertCircle } from 'lucide-react';

interface DeclarationSectionProps {
  declarations: {
    originalWork: boolean;
    notSubmittedElsewhere: boolean;
    allAuthorsApproved: boolean;
    agreeToPeerReview: boolean;
    agreeToEthics: boolean;
    agreeToCopyright: boolean;
    authorWillPresent?: boolean; // For conference only
  };
  onToggleDeclaration: (key: string, value: boolean) => void;
  isConference?: boolean;
}

export function DeclarationSection({
  declarations,
  onToggleDeclaration,
  isConference = false,
}: DeclarationSectionProps) {
  const items = [
    {
      key: 'originalWork',
      label: 'Original & Un-plagiarized Work',
      desc: 'I declare that this submitted manuscript/chapter is our original academic research and contains no plagiarized, fabricated, or uncredited content.',
    },
    {
      key: 'notSubmittedElsewhere',
      label: 'Not Submitted Elsewhere',
      desc: 'I confirm that this submission is not currently under consideration, peer review, or accepted for publication by any other journal, book volume, or conference proceedings.',
    },
    {
      key: 'allAuthorsApproved',
      label: 'All Co-Authors Approved',
      desc: 'All listed co-authors have thoroughly reviewed, contributed to, and explicitly consented to the submission of this final manuscript.',
    },
    {
      key: 'agreeToPeerReview',
      label: 'Agreement to Peer Review Process',
      desc: 'We agree to cooperate with the editorial board and independent peer reviewers, providing revisions or supplementary clarifications when requested.',
    },
    {
      key: 'agreeToEthics',
      label: 'Publication Ethics Compliance',
      desc: 'We strictly adhere to COPE (Committee on Publication Ethics) standards regarding data integrity, authorship credits, and conflict disclosures.',
    },
    {
      key: 'agreeToCopyright',
      label: 'Copyright & Open Access Terms',
      desc: 'We agree to the publication rights, Creative Commons attribution licensing, and institutional repository archival policies of MMSR Publications.',
    },
    ...(isConference
      ? [
          {
            key: 'authorWillPresent',
            label: 'Mandatory Conference Presentation Commitment',
            desc: 'At least one author agrees to register for the conference and present the accepted paper (Oral, Poster, or Virtual mode) during the scheduled conference dates.',
          },
        ]
      : []),
  ];

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
      <div className="border-b border-[#E2C999] pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#C99A2E]/15 border border-[#C99A2E]/40 flex items-center justify-center text-[#8C6239]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold font-playfair text-[#5C4033]">
              Author Declarations & Publication Integrity <span className="text-ruby-red">*</span>
            </h3>
            <p className="text-xs text-[#6E5238]">
              You must confirm and check all mandatory declaration statements before submitting your work.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const checked = (declarations as any)[item.key] ?? false;
          return (
            <label
              key={item.key}
              className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer select-none ${
                checked
                  ? 'bg-[#F8EEDC] border-[#C99A2E] shadow-xs'
                  : 'bg-[#F8EEDC]/40 border-[#E2C999] hover:bg-[#F8EEDC]/80'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggleDeclaration(item.key, e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-[#E2C999] text-[#C99A2E] focus:ring-[#C99A2E] accent-[#C99A2E] cursor-pointer"
              />
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-[#5C4033] block">{item.label}</span>
                <span className="text-xs text-[#6E5238] leading-relaxed block">{item.desc}</span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
