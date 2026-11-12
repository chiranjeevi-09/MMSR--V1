'use client';

import React, { useState } from 'react';
import { Star, Send, CheckCircle2 } from 'lucide-react';
import { submitTestimonial } from '@/lib/services/cms';
import { HoneypotField } from '@/components/ui/HoneypotField';

export interface ReviewSectionProps {
  /** What is being reviewed */
  targetType: 'book' | 'journal';
  /** Backend PK of the specific title */
  targetId: number;
  /** Title shown in the section heading */
  targetTitle: string;
}

const MAX_WORDS = 50;

const FIELD_CLASS =
  'w-full bg-white border border-[#D4AC54]/40 rounded-xl px-3.5 py-2.5 text-sm text-[#3A2312] placeholder-[#8C6239]/50 focus:outline-none focus:border-[#C99A2E] transition-colors';
const LABEL_CLASS = 'block text-xs font-bold uppercase tracking-wider text-[#8C6239] mb-1.5';

export const ReviewSection: React.FC<ReviewSectionProps> = ({ targetType, targetId, targetTitle }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('');
  const [institution, setInstitution] = useState('');
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  // Bot trap (SECURITY-QA-REPORT M-4): off-screen input a real reviewer never sees.
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const overLimit = wordCount > MAX_WORDS;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overLimit) {
      setErrorMessage(`Please keep your review under ${MAX_WORDS} words (currently ${wordCount}).`);
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const detail = await submitTestimonial({
        name: name.trim(),
        email: email.trim(),
        designation: designation.trim(),
        institution: institution.trim(),
        rating,
        content: content.trim(),
        source: targetType,
        website: honeypot,
        ...(targetType === 'book' ? { book_id: targetId } : { journal_id: targetId }),
      });
      setSuccessMessage(detail);
      setName('');
      setEmail('');
      setDesignation('');
      setInstitution('');
      setRating(5);
      setContent('');
      setHoneypot('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="write-a-review" className="py-6 font-manrope scroll-mt-24">
      <div className="p-8 rounded-3xl bg-[#FFF9F1] border border-[#D4AC54] shadow-glass">
        <div className="mb-6">
          <p className="text-[13px] font-bold uppercase tracking-widest text-[#C99A2E] mb-1 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-[#C99A2E] text-[#C99A2E]" />
            Rate This {targetType === 'book' ? 'Book' : 'Journal'}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold font-playfair text-[#3A2312]">Write a Review</h2>
          <p className="text-xs text-[#8C6239] mt-1 max-w-2xl">
            Share your experience with{" "}
            <strong className="text-[#3A2312]">&ldquo;{targetTitle}&rdquo;</strong>. Reviews are sent to our
            editorial team for moderation and appear on the site once approved.
          </p>
        </div>

        {successMessage ? (
          <div className="p-6 rounded-2xl bg-white border border-[#D4AC54]/60 flex items-start gap-3 animate-fade-in">
            <CheckCircle2 className="w-6 h-6 text-[#C99A2E] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-[#3A2312]">Review Submitted</h3>
              <p className="text-xs text-[#8C6239] mt-1 leading-relaxed">{successMessage}</p>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="mt-3 text-xs font-bold text-[#8C6239] underline underline-offset-2 hover:text-[#3A2312] cursor-pointer"
              >
                Write another review
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HoneypotField value={honeypot} onChange={setHoneypot} />
            <div>
              <label className={LABEL_CLASS}>Your Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Dr. Sarah Jenkins"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Email *</label>
              <input
                type="email"
                required
                placeholder="you@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Designation (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Professor of Physics"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div>
              <label className={LABEL_CLASS}>Institution (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Stanford University"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className={FIELD_CLASS}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>Your Rating *</label>
              <div className="flex items-center gap-1.5 h-[42px]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    className="p-1 cursor-pointer transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating ? 'fill-[#C99A2E] text-[#C99A2E]' : 'fill-transparent text-[#D4AC54]/50'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-[#8C6239] ml-2">{rating} / 5</span>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className={LABEL_CLASS}>Your Review * (max {MAX_WORDS} words)</label>
              <textarea
                required
                rows={4}
                placeholder="What did you like or find valuable about this publication?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`${FIELD_CLASS} leading-relaxed resize-none`}
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className={`text-[13px] font-semibold ${overLimit ? 'text-red-600' : 'text-[#8C6239]/70'}`}>
                  {wordCount} / {MAX_WORDS} words
                </span>
                {errorMessage && <span className="text-[13px] font-semibold text-red-600">{errorMessage}</span>}
              </div>
            </div>

            <div className="sm:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || overLimit}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#C99A2E] to-[#8C6239] text-white text-sm font-bold shadow-md hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
};
