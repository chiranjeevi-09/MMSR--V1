'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, Phone, MapPin, Newspaper, FileText, ArrowRight, GraduationCap, CheckCircle2, Send } from 'lucide-react';
import { subscribeEmail } from '@/lib/services/subscribers';
import { Button } from '@/components/ui/Button';
import { SiteLogo } from '@/components/ui/SiteLogo';
import { validateEmail } from '@/lib/validation';


// Social Icon Inline SVGs for 100% Reliability
const SocialIcons = {
  LinkedIn: () => (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.25V10.9H6.46M7.86 6.78a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
    </svg>
  ),
  Instagram: () => (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  ),
  Facebook: () => (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  YouTube: () => (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  WhatsApp: () => (
    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.301-.15-1.785-.881-2.062-.982-.276-.101-.477-.15-.677.15-.199.299-.775.982-.95 1.183-.175.201-.351.226-.652.076-.301-.15-1.27-.468-2.42-1.494-.896-.798-1.502-1.784-1.677-2.084-.175-.301-.019-.464.131-.614.136-.135.301-.351.451-.526.15-.175.201-.299.301-.501.101-.201.05-.376-.025-.526-.075-.15-.677-1.631-.927-2.233-.243-.587-.49-.508-.677-.517-.175-.008-.376-.01-.576-.01-.2 0-.526.075-.802.376-.276.301-1.052 1.028-1.052 2.508 0 1.48 1.077 2.908 1.227 3.109.15.201 2.119 3.236 5.134 4.538.717.31 1.277.495 1.713.634.721.229 1.377.196 1.895.119.578-.086 1.785-.729 2.036-1.431.25-.702.25-1.304.175-1.43-.075-.126-.276-.201-.577-.352z" />
    </svg>
  ),
};

export const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError('');
    subscribeEmail(email.trim(), 'Site Footer');
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 5000);
  };


  return (
    <footer className="bg-[#5C4033] border-t border-[#C99A2E]/30 text-[#E8DCC7] font-manrope relative overflow-hidden">
      {/* Subtle Background Glow Accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-px bg-gradient-to-r from-transparent via-[#C99A2E]/50 to-transparent" />

      {/* Main Footer Container */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
        {/* Newsletter Banner */}
        <div className="mb-16 p-8 sm:p-10 rounded-[24px] bg-[#4A3328] border border-[#C99A2E]/40 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-2 max-w-xl text-center lg:text-left">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#C99A2E]">
              Stay Informed with Academic Updates
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold font-playfair text-[#FFF9F1]">
              Subscribe to MMSR Research Alerts
            </h3>
            <p className="text-sm text-[#E8DCC7]/80">
              Get notified about call for papers, newly published book chapters, and peer-reviewed journals.
            </p>
          </div>

          <form
            onSubmit={handleSubscribe}
            className="w-full lg:w-auto flex flex-col sm:flex-row gap-3 min-w-[320px] sm:min-w-[420px]"
          >
            {subscribed ? (
              <div className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm font-semibold">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Thank you! You have subscribed to MMSR alerts.</span>
              </div>
            ) : (
              <>
                <div className="relative flex-1">
                  <Mail className="w-4 h-4 text-[#E8DCC7]/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    aria-label="Enter your academic email"
                    value={email}
                    aria-invalid={Boolean(emailError)}
                    onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                    placeholder="Enter your academic email..."
                    className="w-full bg-[#3E2A20] border border-[#D4AC54]/40 focus:border-[#C99A2E] rounded-xl pl-10 pr-4 py-3 text-sm text-[#FFF9F1] placeholder-[#E8DCC7]/50 outline-none transition-all"
                  />
                  {emailError && (
                    <p className="absolute left-0 -bottom-5 text-[13px] text-red-400 font-medium" role="alert">{emailError}</p>
                  )}
                </div>
                <Button type="submit" variant="gold" size="lg" rightIcon={<Send className="w-4 h-4" />}>
                  Subscribe
                </Button>
              </>
            )}
          </form>
        </div>

        {/* 4-Column Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 mb-16">
          {/* Column 1: Brand Info */}
          <div className="flex flex-col gap-4">
            <Link href="/home" className="flex items-center gap-3 group" aria-label="MMSR Publications Home">
              <SiteLogo className="w-10 h-10 shadow-sm" />
              <span className="text-lg font-bold font-playfair text-[#FFF9F1] group-hover:text-[#F2D47A] transition-colors">
                MMSR Publications
              </span>
            </Link>
            <p className="text-xs text-[#E8DCC7]/80 leading-relaxed">
              Missile Man Scientific & Research Publications is a premier global publisher dedicated to high-impact peer-reviewed journals, edited academic books, and interdisciplinary scientific research.
            </p>
          </div>

          {/* Column 2: Explore */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-bold font-playfair text-[#C99A2E] uppercase tracking-wider">
              Explore Catalogue
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-[#E8DCC7]/80">
              <li>
                <Link href="/home" className="hover:text-[#F2D47A] transition-colors">Home Page</Link>
              </li>
              <li>
                <Link href="/books" className="hover:text-[#F2D47A] transition-colors">Books & Chapters</Link>
              </li>
              <li>
                <Link href="/journals" className="hover:text-[#F2D47A] transition-colors">Academic Journals</Link>
              </li>
              <li>
                <Link href="/conference" className="hover:text-[#F2D47A] transition-colors">Scientific Conferences</Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Publishing Services */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-bold font-playfair text-[#C99A2E] uppercase tracking-wider">
              Publishing Services
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-[#E8DCC7]/80">
              <li>
                <Link href="/services" className="hover:text-[#F2D47A] transition-colors">All Publishing Services</Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-[#F2D47A] transition-colors">DOI & ISBN Registration</Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-[#F2D47A] transition-colors">Peer Review & Editing</Link>
              </li>
              <li>
                <Link href="/services" className="hover:text-[#F2D47A] transition-colors">Academic Indexing</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Account & Legal */}
          <div className="flex flex-col gap-4">
            <h4 className="text-sm font-bold font-playfair text-[#C99A2E] uppercase tracking-wider">
              Account & Legal
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-[#E8DCC7]/80">
              <li>
                <Link href="/login" className="hover:text-[#F2D47A] transition-colors">Author & Reader Sign In</Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-[#F2D47A] transition-colors">Create Account</Link>
              </li>
              <li>
                <Link href="/submit-manuscript" className="hover:text-[#F2D47A] transition-colors">Submit Manuscript</Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#F2D47A] transition-colors">Contact Editorial Office</Link>
              </li>
              <li>
                <Link href="/privacy-policy" className="hover:text-[#F2D47A] transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms-and-conditions" className="hover:text-[#F2D47A] transition-colors">Terms & Conditions</Link>
              </li>
              <li>
                <Link href="/publication-policies" className="hover:text-[#F2D47A] transition-colors">Publication Policies & Ethics</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="pt-8 border-t border-[#C99A2E]/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#E8DCC7]/70">
          <p>© {new Date().getFullYear()} MMSR Publications. All Rights Reserved.</p>

          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/company/missile-man-scientific-and-research-publications/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-[#4A3328] hover:bg-[#C99A2E] hover:text-[#5C4033] transition-all duration-300 text-[#E8DCC7]"
              aria-label="LinkedIn"
            >
              <SocialIcons.LinkedIn />
            </a>
            <a
              href="https://www.instagram.com/mmsrpublications/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-[#4A3328] hover:bg-[#C99A2E] hover:text-[#5C4033] transition-all duration-300 text-[#E8DCC7]"
              aria-label="Instagram"
            >
              <SocialIcons.Instagram />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-[#4A3328] hover:bg-[#C99A2E] hover:text-[#5C4033] transition-all duration-300 text-[#E8DCC7]"
              aria-label="Facebook"
            >
              <SocialIcons.Facebook />
            </a>
            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-[#4A3328] hover:bg-[#C99A2E] hover:text-[#5C4033] transition-all duration-300 text-[#E8DCC7]"
              aria-label="YouTube"
            >
              <SocialIcons.YouTube />
            </a>
            <a
              href="https://whatsapp.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-[#4A3328] hover:bg-[#C99A2E] hover:text-[#5C4033] transition-all duration-300 text-[#E8DCC7]"
              aria-label="WhatsApp"
            >
              <SocialIcons.WhatsApp />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
