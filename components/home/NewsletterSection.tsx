'use client';

import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { subscribeEmail } from '@/lib/services/subscribers';
import { validateEmail } from '@/lib/validation';

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const res = subscribeEmail(email, 'Home Footer Newsletter');
    setMessage(res.message);
    setSubmitted(true);
    setEmail('');
    setTimeout(() => setSubmitted(false), 6000);
  };

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto font-manrope">
      <div className="p-8 sm:p-12 rounded-3xl bg-[#FFF9F1] border border-gold-500/40 backdrop-blur-2xl shadow-glass flex flex-col lg:flex-row items-center justify-between gap-8 relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col gap-2 max-w-lg text-center lg:text-left">
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">
            Call For Papers & Research Digest
          </span>
          <h3 className="text-2xl sm:text-3xl font-bold font-playfair text-[#3A2312]">
            Join the MMSR Academic Research Network
          </h3>
          <p className="text-sm text-text-muted leading-relaxed">
            Receive monthly updates on newly published edited books, call for journal papers, ISBN announcements, and academic conferences.
          </p>
          <div className="flex items-center gap-2 text-xs text-text-muted mt-2 justify-center lg:justify-start">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>We respect academic privacy. Unsubscribe anytime.</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="w-full lg:w-auto flex flex-col gap-3 min-w-[320px] sm:min-w-[380px]">
          {submitted ? (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-700 text-xs font-semibold flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{message || 'Thank you! Your academic email has been subscribed.'}</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  aria-label="Enter university or research email"
                  value={email}
                  aria-invalid={Boolean(error)}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                  placeholder="Enter university or research email..."
                  className="w-full bg-[#F8EEDC] border border-[#D4AC54]/60 focus:border-gold-500 rounded-xl pl-10 pr-4 py-3 text-xs text-[#3A2312] placeholder-text-muted outline-none transition-all"
                />
              </div>
              <Button type="submit" variant="gold" size="md" rightIcon={<Send className="w-4 h-4" />}>
                Subscribe
              </Button>
            </div>
          )}
          {error && (
            <p className="text-xs text-red-600 font-medium" role="alert">{error}</p>
          )}
        </form>
      </div>
    </section>
  );
};
