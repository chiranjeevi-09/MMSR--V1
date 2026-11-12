'use client';

import React from 'react';
import { Mail, Globe, Sparkles } from 'lucide-react';
import { SITE_DOMAIN } from '@/lib/config/site';

interface EmailTemplatePreviewProps {
  subject: string;
  body: string;
  recipientName?: string;
  referenceId?: string;
  journalName?: string;
  templateName?: string;
}

export const EmailTemplatePreview: React.FC<EmailTemplatePreviewProps> = ({
  subject,
  body,
  recipientName = 'Dr. Author',
  referenceId = 'SUB-2026-0891',
  journalName = 'MMSR Journal of Advanced Science',
  templateName = 'Email Preview',
}) => {
  // Process template placeholders if present
  const processedSubject = subject
    .replace(/\{\{author_name\}\}/g, recipientName)
    .replace(/\{\{submission_id\}\}/g, referenceId)
    .replace(/\{\{journal_name\}\}/g, journalName)
    .replace(/\{\{paper_title\}\}/g, 'Quantum Dynamics in Heterogeneous Nanostructures');

  const processedBody = body
    .replace(/\{\{author_name\}\}/g, recipientName)
    .replace(/\{\{submission_id\}\}/g, referenceId)
    .replace(/\{\{journal_name\}\}/g, journalName)
    .replace(/\{\{paper_title\}\}/g, 'Quantum Dynamics in Heterogeneous Nanostructures');

  const paragraphs = processedBody.split('\n\n');

  return (
    <div className="w-full rounded-2xl overflow-hidden border shadow-xl transition-all duration-300" style={{ backgroundColor: '#FFFFFF', borderColor: '#E9DFCF' }}>
      {/* Top Preview Header / Toolbar */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ backgroundColor: '#3E2E22', borderColor: 'rgba(201,166,107,0.3)' }}>
        <div className="flex items-center space-x-2 text-xs" style={{ color: '#F7F3EB' }}>
          <Mail className="w-4 h-4" style={{ color: '#C9A66B' }} />
          <span className="font-mono uppercase tracking-wider font-semibold" style={{ color: '#C9A66B' }}>{templateName}</span>
          <span>•</span>
          <span style={{ color: '#8B7B68' }}>Live Render</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
        </div>
      </div>

      {/* Email Container (Simulated Email Window) */}
      <div className="p-4 sm:p-6" style={{ backgroundColor: '#F7F3EB' }}>
        {/* Email Header Envelope Meta */}
        <div className="rounded-xl p-3 sm:p-4 mb-5 space-y-2 text-xs" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1" style={{ color: '#8B7B68' }}>
            <div>
              <span className="font-semibold" style={{ color: '#C9A66B' }}>From:</span> MMSR Publications Editorial Office &lt;editorial@{SITE_DOMAIN}&gt;
            </div>
            <div className="font-mono text-[13px]">Date: Today, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div style={{ color: '#8B7B68' }}>
            <span className="font-semibold" style={{ color: '#C9A66B' }}>To:</span> {recipientName} &lt;author@university.edu&gt;
          </div>
          <div className="font-medium text-sm pt-1 flex items-start gap-2" style={{ borderTop: '1px solid #E9DFCF', color: '#5C4B3A' }}>
            <span className="font-semibold shrink-0" style={{ color: '#C9A66B' }}>Subject:</span>
            <span className="font-mono break-words" style={{ color: '#3E2E22' }}>{processedSubject || '(No Subject Specified)'}</span>
          </div>
        </div>

        {/* Email Content Canvas */}
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E9DFCF' }}>
          {/* Header Banner with MMSR Logo */}
          <div className="p-6 text-center relative" style={{ backgroundColor: '#3E2E22', borderBottom: '1px solid #E9DFCF' }}>
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: '#C9A66B' }}></div>
            <div className="inline-flex items-center justify-center space-x-2 mb-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold font-serif text-lg"
                style={{ backgroundColor: 'rgba(201,166,107,0.2)', border: '1px solid #C9A66B', color: '#C9A66B' }}>
                M
              </div>
              <span className="font-serif font-bold text-lg tracking-widest uppercase" style={{ color: '#F7F3EB' }}>
                MMSR <span style={{ color: '#C9A66B' }}>Publications</span>
              </span>
            </div>
            <p className="text-xs font-mono tracking-wider uppercase" style={{ color: '#C9A66B' }}>International Peer-Reviewed Open Access Journals</p>
          </div>

          {/* Email Body Content */}
          <div className="p-6 sm:p-8 space-y-4 text-sm leading-relaxed font-sans" style={{ color: '#5C4B3A' }}>
            {paragraphs.map((p, idx) => (
              <p key={idx} className="whitespace-pre-wrap">
                {p}
              </p>
            ))}
          </div>

          {/* Email Footer Banner */}
          <div className="p-6 text-center text-xs space-y-3" style={{ backgroundColor: '#FFF8EE', borderTop: '1px solid #E9DFCF', color: '#8B7B68' }}>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <span className="flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" style={{ color: '#C9A66B' }} /> www.{SITE_DOMAIN}
              </span>
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" style={{ color: '#C9A66B' }} /> support@{SITE_DOMAIN}
              </span>
            </div>
            <div className="text-[13px] pt-2 font-mono" style={{ color: '#A98042' }}>
              © {new Date().getFullYear()} MMSR Publications. All Rights Reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
