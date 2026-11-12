'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Calendar,
  User,
  Users,
  FileText,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReviewSubmissionPanelProps {
  data: Record<string, any>;
  paperFileName: string | null;
  serverError: string | null;
  isSubmitting: boolean;
  submissionFee?: number;
  showSimulateFallback?: boolean;
  onBackToEdit: () => void;
  onConfirm: () => void;
  onSimulate?: () => void;
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  const empty = value === undefined || value === null || value === '';
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-[#E2C999]/60 last:border-0">
      <span className="text-[13px] font-bold uppercase tracking-wider text-[#8A6A4A]">{label}</span>
      <span className="text-sm font-semibold text-[#5C4033] break-words">
        {empty ? <span className="text-[#B99B6B] italic font-normal">Not provided</span> : value}
      </span>
    </div>
  );
}

export function ReviewSubmissionPanel({
  data,
  paperFileName,
  serverError,
  isSubmitting,
  submissionFee = 0,
  showSimulateFallback = false,
  onBackToEdit,
  onConfirm,
  onSimulate,
}: ReviewSubmissionPanelProps) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const corresponding = data?.authorInfo?.corresponding || {};
  const coAuthors: any[] = data?.authorInfo?.coAuthors || [];
  const fee = Number(submissionFee || 0);
  const requiresPayment = fee > 0;

  return (
    <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
      <div className="border-b border-[#E2C999] pb-3">
        <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block mb-1">
          Review Before Submission
        </span>
        <h3 className="text-xl font-bold font-playfair text-[#5C4033] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#C99A2E]" />
          Please confirm your submission details
        </h3>
        <p className="text-xs text-[#6E5238] mt-1">
          Review everything below. Go back to edit if needed — nothing is submitted until you confirm.
        </p>
      </div>

      {serverError && (
        <div className="p-4 rounded-2xl bg-[#DC2626]/10 border border-[#DC2626]/30 flex items-start gap-2 text-xs text-[#B42318] font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Conference */}
      <section className="space-y-2">
        <h4 className="text-sm font-bold text-[#5C4033] flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#C99A2E]" /> Target Conference
        </h4>
        <div className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#E2C999]">
          <Row label="Conference" value={data?.conferenceTitle} />
          {data?.conferenceAcronym ? <Row label="Acronym" value={data?.conferenceAcronym} /> : null}
          {data?.selectedTrack ? <Row label="Research Track" value={data?.selectedTrack} /> : null}
        </div>
      </section>

      {/* Paper */}
      <section className="space-y-2">
        <h4 className="text-sm font-bold text-[#5C4033] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#C99A2E]" /> Paper Details
        </h4>
        <div className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#E2C999]">
          <Row label="Title" value={data?.paperTitle} />
          {data?.subtitle ? <Row label="Subtitle" value={data?.subtitle} /> : null}
          <Row label="Keywords" value={data?.keywords} />
          <Row label="Abstract" value={data?.abstract} />
          <Row label="Full Paper" value={paperFileName} />
        </div>
      </section>

      {/* Corresponding author */}
      <section className="space-y-2">
        <h4 className="text-sm font-bold text-[#5C4033] flex items-center gap-2">
          <User className="w-4 h-4 text-[#C99A2E]" /> Applicant / Corresponding Author
        </h4>
        <div className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#E2C999]">
          <Row label="Full Name" value={corresponding.fullName} />
          <Row label="Email" value={corresponding.email} />
          <Row label="Phone" value={corresponding.phone} />
          <Row label="Institution" value={corresponding.institution} />
          {corresponding.department ? <Row label="Department" value={corresponding.department} /> : null}
          {corresponding.designation ? <Row label="Designation" value={corresponding.designation} /> : null}
          <Row label="Country" value={corresponding.country} />
        </div>
      </section>

      {/* Co-authors */}
      <section className="space-y-2">
        <h4 className="text-sm font-bold text-[#5C4033] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#C99A2E]" /> Co-authors ({coAuthors.length})
        </h4>
        {coAuthors.length === 0 ? (
          <p className="text-xs text-[#8A6A4A] italic">No additional co-authors listed.</p>
        ) : (
          <div className="space-y-2">
            {coAuthors.map((a, idx) => (
              <div key={a.id || idx} className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#E2C999]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-[#C99A2E] text-white text-xs font-bold flex items-center justify-center">
                    {idx + 2}
                  </span>
                  <span className="text-sm font-bold text-[#5C4033]">{a.fullName || 'Unnamed co-author'}</span>
                </div>
                <div className="text-xs text-[#6E5238] space-y-0.5">
                  {a.email ? <p>{a.email}</p> : null}
                  {a.institution ? <p>{a.institution}{a.department ? ` — ${a.department}` : ''}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment notice */}
      {requiresPayment && (
        <div className="p-4 rounded-2xl bg-[#C99A2E]/10 border border-[#C99A2E]/30 flex items-start gap-2 text-xs text-[#8C6239]">
          <CreditCard className="w-5 h-5 shrink-0 text-[#C99A2E]" />
          <span>
            This conference charges a one-time submission fee of{' '}
            <strong>₹{fee.toLocaleString('en-IN')}</strong>. You will complete a
            secure payment after your paper is recorded. An invoice will be emailed on success.
          </span>
        </div>
      )}

      {/* Accept Terms & Conditions — gates the confirm action */}
      <label
        className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none ${
          acceptedTerms
            ? 'bg-[#F8EEDC] border-[#C99A2E] shadow-xs'
            : 'bg-[#F8EEDC]/40 border-[#E2C999] hover:bg-[#F8EEDC]/80'
        }`}
      >
        <input
          type="checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          className="mt-1 w-4 h-4 rounded border-[#E2C999] text-[#C99A2E] focus:ring-[#C99A2E] accent-[#C99A2E] cursor-pointer"
        />
        <div className="space-y-0.5">
          <span className="text-sm font-bold text-[#5C4033] block">
            Accept Terms and Conditions <span className="text-ruby-red">*</span>
          </span>
          <span className="text-xs text-[#6E5238] leading-relaxed block">
            I confirm this paper is original, is not under review elsewhere, that all co-authors consent to this
            submission, and I agree to the MMSR Publications peer-review, presentation, and publication terms.
          </span>
        </div>
      </label>

      {/* Actions */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onBackToEdit}
          disabled={isSubmitting}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Edit
        </Button>
        {showSimulateFallback && onSimulate && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onSimulate}
            disabled={isSubmitting || !acceptedTerms}
          >
            Simulate test payment
          </Button>
        )}
        <Button
          type="button"
          variant="gold"
          size="lg"
          onClick={onConfirm}
          disabled={isSubmitting || !acceptedTerms}
          isLoading={isSubmitting}
          rightIcon={<ArrowRight className="w-5 h-5" />}
        >
          {isSubmitting
            ? requiresPayment
              ? 'Processing Payment...'
              : 'Submitting Conference Paper...'
            : requiresPayment
            ? `Pay & Submit — ₹${fee.toLocaleString('en-IN')}`
            : 'Submit Paper'}
        </Button>
      </div>
    </div>
  );
}
