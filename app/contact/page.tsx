'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Mail, Edit3, UserCheck, BookOpen, Presentation,
  ChevronDown, ChevronUp, Home, ChevronRight, Send,
  CheckCircle2, AlertCircle, Loader2, Users, HelpCircle
} from 'lucide-react';
import {
  CONTACT_INFO, submitContactForm, getContactDepartments, getContactFAQs
} from '@/lib/services/contact';
import { ContactFormData, EnquiryType, ContactSubmissionResult, ContactInfo, ContactFAQ } from '@/lib/types/contact';
import { HoneypotField } from '@/components/ui/HoneypotField';
import { required, textLength, validateEmail, lettersOnly, validateName } from '@/lib/validation';
import { SITE_DOMAIN } from '@/lib/config/site';

// ─── Icon Map ────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail className="w-5 h-5" />,
  Edit3: <Edit3 className="w-5 h-5" />,
  UserCheck: <UserCheck className="w-5 h-5" />,
  BookOpen: <BookOpen className="w-5 h-5" />,
  Presentation: <Presentation className="w-5 h-5" />,
};

const ENQUIRY_TYPES: EnquiryType[] = [
  'General Enquiry',
  'Editorial Enquiry',
  'Author Support',
  'Publishing Enquiry',
  'Conference Enquiry',
  'Technical Support',
  'Other',
];

// ─── Contact Form ─────────────────────────────────────────────────────────────
const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: '',
    email: '',
    organization: '',
    subject: '',
    enquiryType: 'General Enquiry',
    message: '',
    honeypot: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ContactSubmissionResult | null>(null);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ContactFormData, string>> = {};
    const nameErr = validateName(formData.fullName, 'Full name');
    if (nameErr) newErrors.fullName = nameErr;
    const emailErr = validateEmail(formData.email);
    if (emailErr) newErrors.email = emailErr;
    const subjectErr = required(formData.subject, 'Subject');
    if (subjectErr) newErrors.subject = subjectErr;
    const messageErr = textLength(formData.message, 20, 5000, 'Message');
    if (messageErr) newErrors.message = messageErr;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    // Full name never contains digits — strip them as the user types.
    const next = name === 'fullName' ? lettersOnly(value) : value;
    setFormData((prev) => ({ ...prev, [name]: next }));
    if (errors[name as keyof ContactFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    try {
      const res = await submitContactForm(formData);
      setResult(res);
    } catch {
      setResult({ success: false, message: 'An unexpected error occurred. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (result?.success) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4 py-12 px-8 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-accent" />
        </div>
        <h3 className="font-playfair text-xl font-bold text-ivory-white">Enquiry Received</h3>
        <p className="text-text-muted text-sm max-w-md leading-relaxed">{result.message}</p>
        {result.referenceId && (
          <p className="text-xs text-gold-400 font-mono">Reference ID: {result.referenceId}</p>
        )}
        <button
          onClick={() => { setResult(null); setFormData({ fullName: '', email: '', organization: '', subject: '', enquiryType: 'General Enquiry', message: '', honeypot: '' }); }}
          className="mt-2 px-5 py-2.5 rounded-xl bg-[#FFF9F1] border border-[#D4AC54]/60 text-ivory-white text-sm hover:border-gold-500/40 transition-all"
        >
          Send Another Enquiry
        </button>
      </motion.div>
    );
  }

  const inputClass = (field: keyof ContactFormData) =>
    `w-full px-4 py-3 h-12 rounded-xl bg-[#FFF9F1] border-2 text-[#3A2312] font-medium placeholder:text-[#8A6A4A] text-sm focus:outline-none focus:ring-2 transition-all ${
      errors[field]
        ? 'border-red-500/80 focus:border-red-600 focus:ring-red-500/20'
        : 'border-[#D4AC54] focus:border-[#B8860B] focus:ring-[#D4AC54]/30 hover:border-[#8C6B1B]'
    }`;

  return (
    <form onSubmit={handleSubmit} noValidate className="relative flex flex-col gap-5">
      {/* Bot trap (SECURITY-QA-REPORT M-4): off-screen, never filled by a person. */}
      <HoneypotField
        value={formData.honeypot || ''}
        onChange={(v) => setFormData((prev) => ({ ...prev, honeypot: v }))}
      />
      {result && !result.success && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 text-sm font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="fullName" className="block text-xs font-bold text-[#3A2312] mb-1.5 uppercase tracking-wider">
            Full Name <span className="text-red-600">*</span>
          </label>
          <input
            id="fullName" name="fullName" type="text" required
            value={formData.fullName} onChange={handleChange}
            placeholder="Dr. Priya Sharma"
            className={inputClass('fullName')}
          />
          {errors.fullName && <p className="text-xs text-red-600 font-medium mt-1">{errors.fullName}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-xs font-bold text-[#3A2312] mb-1.5 uppercase tracking-wider">
            Email Address <span className="text-red-600">*</span>
          </label>
          <input
            id="email" name="email" type="email" required
            value={formData.email} onChange={handleChange}
            placeholder="your@institution.edu"
            className={inputClass('email')}
          />
          {errors.email && <p className="text-xs text-red-600 font-medium mt-1">{errors.email}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="organization" className="block text-xs font-bold text-[#3A2312] mb-1.5 uppercase tracking-wider">
          Organization / Institution <span className="text-[#8A6A4A] font-normal">(Optional)</span>
        </label>
        <input
          id="organization" name="organization" type="text"
          value={formData.organization} onChange={handleChange}
          placeholder="University of Technology, Dept. of Research"
          className={inputClass('organization')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="enquiryType" className="block text-xs font-bold text-[#3A2312] mb-1.5 uppercase tracking-wider">
            Enquiry Type <span className="text-red-600">*</span>
          </label>
            <select
              id="enquiryType" name="enquiryType" required
              value={formData.enquiryType} onChange={handleChange}
              className={`${inputClass('enquiryType')} cursor-pointer font-bold`}
            >
              {ENQUIRY_TYPES.map((type) => (
                <option key={type} value={type} className="bg-[#FFF9F1] text-[#3A2312] font-semibold py-1">
                  {type}
                </option>
              ))}
            </select>
        </div>
        <div>
          <label htmlFor="subject" className="block text-xs font-bold text-[#3A2312] mb-1.5 uppercase tracking-wider">
            Subject <span className="text-red-600">*</span>
          </label>
          <input
            id="subject" name="subject" type="text" required
            value={formData.subject} onChange={handleChange}
            placeholder="e.g. Manuscript Submission Inquiry"
            className={inputClass('subject')}
          />
          {errors.subject && <p className="text-xs text-red-600 font-medium mt-1">{errors.subject}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="message" className="block text-xs font-bold text-[#3A2312] mb-1.5 uppercase tracking-wider">
          Message <span className="text-red-600">*</span>
        </label>
        <textarea
          id="message" name="message" required rows={5}
          value={formData.message} onChange={handleChange}
          placeholder="Please describe your enquiry in detail..."
          className={inputClass('message') + ' resize-none'}
        />
        <div className="flex items-center justify-between mt-1">
          {errors.message ? (
            <p className="text-xs text-red-600 font-medium">{errors.message}</p>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-[#8A6A4A] font-semibold">{formData.message.length} chars</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-gradient-to-r from-[#D4AC54] to-[#C99A2E] text-[#2A180B] font-extrabold text-sm border-2 border-[#967018] shadow-md hover:border-[#3A2312] hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(212,172,84,0.4)] disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 transition-all cursor-pointer"
      >
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Sending Enquiry...</>
        ) : (
          <><Send className="w-4 h-4" /> Send Enquiry</>
        )}
      </button>

      <p className="text-[13px] text-text-muted text-center leading-relaxed">
        By submitting this form, your information is processed in accordance with our{' '}
        <Link href="/privacy-policy" className="text-gold-400 underline hover:text-gold-300">Privacy Policy</Link>
        {' '}and{' '}
        <Link href="/terms-and-conditions" className="text-gold-400 underline hover:text-gold-300">Terms & Conditions</Link>.
      </p>
    </form>
  );
};

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
const FAQItem: React.FC<{ faq: ContactFAQ; isOpen: boolean; onToggle: () => void }> = ({ faq, isOpen, onToggle }) => (
  <div className="rounded-xl border border-[#D4AC54]/60 bg-[#FFF9F1] overflow-hidden">
    <button
      onClick={onToggle}
      aria-expanded={isOpen}
      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition-colors"
    >
      <span className={`text-sm font-semibold ${isOpen ? 'text-gold-400' : 'text-ivory-white'}`}>{faq.question}</span>
      {isOpen ? <ChevronUp className="w-4 h-4 text-gold-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />}
    </button>
    {isOpen && (
      <div className="px-5 pb-4 text-sm text-text-muted leading-relaxed border-t border-[#D4AC54]/40 pt-3">
        {faq.answer}
      </div>
    )}
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ContactPage() {
  const [openFAQ, setOpenFAQ] = useState<string | null>(null);
  const [departments, setDepartments] = useState<ContactInfo[]>([]);
  const [faqs, setFaqs] = useState<ContactFAQ[]>([]);

  React.useEffect(() => {
    setDepartments(getContactDepartments());
    setFaqs(getContactFAQs());
  }, []);

  const editorialDept = departments.find(
    (d) => d.title.toLowerCase().includes('editorial') || d.id === 'ci-2'
  );
  const editorialEmail = editorialDept?.email || `editorial@${SITE_DOMAIN}`;

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-ivory-white font-manrope pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-16 pt-6">

        {/* ── Breadcrumb ── */}
        <nav aria-label="Breadcrumb" className="flex items-center text-xs text-text-muted">
          <ol className="flex items-center gap-1.5">
            <li><Link href="/home" className="flex items-center gap-1 hover:text-gold-400 transition-colors"><Home className="w-3.5 h-3.5" /><span>Home</span></Link></li>
            <li className="flex items-center gap-1.5"><ChevronRight className="w-3 h-3" /><span className="font-semibold text-gold-400" aria-current="page">Contact</span></li>
          </ol>
        </nav>

        {/* ── Hero ── */}
        <section className="relative rounded-3xl bg-[#FFF9F1] border border-gold-500/25 p-8 sm:p-12 overflow-hidden shadow-glass">
          <div className="absolute -top-20 right-0 w-72 h-72 bg-gold-500/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-4 max-w-2xl">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest bg-gold-500/10 text-gold-400 border border-[#D4AC54] w-fit">
              <Mail className="w-3.5 h-3.5" />
              Get in Touch
            </span>
            <h1 className="font-playfair text-3xl sm:text-5xl font-bold text-ivory-white leading-tight">
              Contact{' '}
              <span className="gradient-gold-text">MMSR Publications</span>
            </h1>
            <p className="text-text-muted text-sm sm:text-base leading-relaxed">
              Our editorial and support teams are available to assist with manuscript enquiries, publishing services, conference proceedings, and author support. Please select the appropriate contact category for the fastest response.
            </p>
          </div>
        </section>

        {/* ── Contact Info Cards with Hover Effects ── */}
        <section className="space-y-5">
          <h2 className="font-playfair text-2xl font-bold text-ivory-white">Contact Departments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {departments.map((info) => (
              <motion.div
                key={info.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -6, scale: 1.02 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="p-6 rounded-2xl bg-[#FFF9F1] border-2 border-[#D4AC54]/60 hover:border-[#C99A2E] shadow-sm hover:shadow-[0_10px_25px_rgba(201,154,46,0.25)] transition-all flex flex-col gap-4 group cursor-pointer"
              >
                <div className="w-12 h-12 rounded-xl bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-[#C99A2E] group-hover:bg-[#D4AC54] group-hover:text-[#2A180B] transition-colors shrink-0">
                  {ICON_MAP[info.icon] || <Mail className="w-6 h-6 shrink-0" />}
                </div>
                <div>
                  <h3 className="font-playfair font-bold text-ivory-white text-base group-hover:text-gold-400 transition-colors">{info.title}</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">{info.description}</p>
                </div>
                <div className="pt-3 border-t border-[#D4AC54]/40 flex flex-col gap-1.5 mt-auto">
                  <a
                    href={`mailto:${info.email}`}
                    className="text-xs font-mono text-gold-400 hover:text-gold-300 font-bold transition-colors break-all flex items-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{info.email}</span>
                  </a>
                  {info.responseTime && (
                    <p className="text-[13px] text-[#73614C] font-medium">Response Time: <span className="text-[#3A2312] font-bold">{info.responseTime}</span></p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Contact Form + Editorial Support ── */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Form */}
          <div className="lg:col-span-8">
            <div className="p-8 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60">
              <h2 className="font-playfair text-2xl font-bold text-ivory-white mb-6">Send an Enquiry</h2>
              <ContactForm />
            </div>
          </div>

          {/* Editorial Support Panel */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <div className="p-6 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54] flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-400">
                <Edit3 className="w-5 h-5" />
              </div>
              <h3 className="font-playfair font-bold text-ivory-white">Editorial Support</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                For manuscript submissions, peer review status, editorial decisions, and author revision guidance, contact our editorial team directly.
              </p>
              <div className="flex flex-col gap-2 text-xs">
                <div className="flex items-center gap-2 text-text-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />
                  <span>Manuscript Submission Guidance</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />
                  <span>Review Status Updates</span>
                </div>
                <div className="flex items-center gap-2 text-text-muted">
                  <CheckCircle2 className="w-3.5 h-3.5 text-gold-400" />
                  <span>Publication Certificate Requests</span>
                </div>
              </div>
              <a
                href={`mailto:${editorialEmail}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D4AC54] text-gold-400 text-xs font-semibold hover:bg-gold-500/10 transition-all text-center justify-center break-all"
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                {editorialEmail}
              </a>
            </div>

            <div className="p-5 rounded-2xl bg-[#FFF9F1] border border-[#D4AC54]/60">
              <h3 className="font-playfair font-bold text-ivory-white text-sm mb-3">Enquiry Response Times</h3>
              <div className="flex flex-col gap-2 text-xs divide-y divide-[#D4AC54]/30">
                {departments.map((info) => (
                  <div key={info.id} className="flex items-center justify-between pt-1.5 first:pt-0">
                    <span className="text-text-muted font-medium">{info.title}</span>
                    <span className="text-ivory-white font-bold text-right">{info.responseTime || 'Within 2–3 business days'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQs ── */}
        <section className="space-y-5">
          <h2 className="font-playfair text-2xl font-bold text-ivory-white flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gold-500/15 border border-[#D4AC54] flex items-center justify-center text-gold-400">
              <HelpCircle className="w-4 h-4" />
            </span>
            Frequently Asked Questions
          </h2>
          <div className="flex flex-col gap-2 max-w-3xl">
            {faqs
              .filter((faq) => {
                // FAQs live on the Contact or Publishing Services pages only.
                const target = faq.pageTarget || 'Contact';
                return target === 'Contact' || target === 'Publishing Services';
              })
              .map((faq) => (
              <FAQItem
                key={faq.id}
                faq={faq}
                isOpen={openFAQ === faq.id}
                onToggle={() => setOpenFAQ(openFAQ === faq.id ? null : faq.id)}
              />
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
