'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, FileText, ArrowRight, LayoutDashboard, Copy, Share2, Sparkles, Clock, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SubmissionResponseData } from '@/lib/services/submissionServices';

interface SubmissionSuccessScreenProps {
  data: SubmissionResponseData;
  onReset: () => void;
  onDownloadInvoice?: () => void;
  invoiceBusy?: boolean;
}

export function SubmissionSuccessScreen({ data, onReset, onDownloadInvoice, invoiceBusy }: SubmissionSuccessScreenProps) {
  const handleCopyRef = () => {
    navigator.clipboard.writeText(data.referenceNumber);
    alert(`Reference ID ${data.referenceNumber} copied to clipboard!`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto p-8 sm:p-12 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-large text-center space-y-8"
    >
      {/* Animated Success Badge */}
      <div className="flex flex-col items-center justify-center gap-3">
        <div className="w-20 h-20 rounded-3xl bg-[#C99A2E]/15 border border-[#C99A2E]/40 flex items-center justify-center text-[#C99A2E] shadow-gold-glow animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <span className="px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest bg-[#C99A2E]/15 text-[#8C6239] border border-[#C99A2E]/40">
          Submission Received Successfully
        </span>
      </div>

      {/* Main Heading & Subtitle */}
      <div className="space-y-2">
        <h2 className="text-3xl sm:text-4xl font-extrabold font-playfair text-[#5C4033]">
          Thank You! Your Submission Has Been Recorded.
        </h2>
        <p className="text-sm text-[#6E5238] max-w-xl mx-auto leading-relaxed">
          Your research work has been registered in the MMSR Publications editorial desk. An email confirmation has been sent to the corresponding author.
        </p>
      </div>

      {/* Reference Card Details */}
      <div className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#E2C999] text-left space-y-4 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2C999] pb-4">
          <div>
            <span className="text-[13px] font-extrabold uppercase tracking-wider text-[#8A6A4A]">
              Official Reference ID
            </span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xl font-bold text-[#8C6239]">{data.referenceNumber}</span>
              <button
                type="button"
                onClick={handleCopyRef}
                className="p-1.5 rounded-lg bg-[#FFF9F1] border border-[#E2C999] text-[#5C4033] hover:text-[#C99A2E] transition-all"
                title="Copy Reference ID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="text-[13px] font-extrabold uppercase tracking-wider text-[#8A6A4A]">Status</span>
            <span className="block text-xs font-bold text-[#C99A2E] bg-[#FFF9F1] px-3 py-1 rounded-full border border-[#C99A2E]/40 w-fit sm:ml-auto">
              {data.status}
            </span>
          </div>
        </div>

        {/* Detailed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-[#8A6A4A] block mb-0.5">Publication Target</span>
            <span className="font-bold text-[#5C4033] block">{data.targetName}</span>
          </div>

          <div>
            <span className="text-[#8A6A4A] block mb-0.5">ISBN / ISSN Identifier</span>
            <span className="font-mono font-semibold text-[#5C4033] block">{data.isbnOrIssn || 'N/A'}</span>
          </div>

          <div className="sm:col-span-2">
            <span className="text-[#8A6A4A] block mb-0.5">Submission Title</span>
            <span className="font-bold text-[#5C4033] block text-sm italic">&quot;{data.title}&quot;</span>
          </div>

          <div>
            <span className="text-[#8A6A4A] block mb-0.5">Submission Date</span>
            <span className="font-semibold text-[#5C4033] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#C99A2E]" />
              {data.submittedAt}
            </span>
          </div>

          <div>
            <span className="text-[#8A6A4A] block mb-0.5">Estimated Review Time</span>
            <span className="font-semibold text-[#5C4033] flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-[#C99A2E]" />
              {data.estimatedReviewTime}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
        <Link href="/dashboard/submissions">
          <Button variant="gold" size="lg" leftIcon={<LayoutDashboard className="w-4 h-4" />}>
            Go to Author Dashboard
          </Button>
        </Link>

        <Link href={`/dashboard/submissions/${data.id}`}>
          <Button variant="secondary" size="lg" leftIcon={<FileText className="w-4 h-4" />}>
            View Submission Details
          </Button>
        </Link>

        {onDownloadInvoice && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onDownloadInvoice}
            isLoading={invoiceBusy}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download Invoice
          </Button>
        )}

        <Button variant="outline" size="lg" onClick={onReset}>
          Submit Another Document
        </Button>
      </div>
    </motion.div>
  );
}
