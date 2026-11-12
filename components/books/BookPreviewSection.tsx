'use client';

import React, { useState } from 'react';
import { Download, FileText, Eye, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Book } from '@/lib/types/book';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export const BookPreviewSection: React.FC<{ book: Book }> = ({ book }) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const hasSample = Boolean(book.samplePdfUrl);

  const handleOpenPdf = () => {
    if (book.samplePdfUrl) {
      window.open(book.samplePdfUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownload = () => {
    if (book.samplePdfUrl) {
      const link = document.createElement('a');
      link.href = book.samplePdfUrl;
      link.target = '_blank';
      link.download = `${book.slug || 'sample'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!hasSample) {
    return (
      <section className="py-8 font-manrope">
        <div className="p-8 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54]/60 backdrop-blur-xl shadow-glass flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-left">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-[#D4AC54]/60 flex items-center justify-center text-text-muted shrink-0">
              <FileText className="w-7 h-7" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-bold font-playfair text-ivory-white">Sample Preview Unavailable</h3>
              <p className="text-xs text-text-muted">
                A public sample PDF preview is currently not attached to this title by the publisher.
              </p>
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white/5 border border-[#D4AC54]/60 text-xs text-text-muted flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-gold-400" />
            <span>Full Specs Available Below</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 font-manrope">
      <div className="p-8 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] backdrop-blur-xl shadow-glass flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-left">
          <div className="w-14 h-14 rounded-2xl bg-gold-500/10 border border-[#D4AC54] flex items-center justify-center text-gold-400 shrink-0 shadow-gold-glow">
            <FileText className="w-7 h-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-bold font-playfair text-ivory-white">Sample Chapter Preview</h3>
            <p className="text-xs text-text-muted">
              Download or read the preliminary sample chapter, table of contents, and introductory preface.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            variant="outline"
            size="lg"
            onClick={handleOpenPdf}
            leftIcon={<Eye className="w-4 h-4 text-gold-400" />}
          >
            Read Sample PDF
          </Button>
          <Button
            variant="gold"
            size="lg"
            onClick={handleDownload}
            leftIcon={<Download className="w-4 h-4 text-navy-900" />}
          >
            Download PDF
          </Button>
        </div>
      </div>
    </section>
  );
};

