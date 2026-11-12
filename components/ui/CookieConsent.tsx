'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Cookie, X, Check } from 'lucide-react';
import { Button } from './Button';

const COOKIE_CONSENT_KEY = 'mmsr_v2_cookie_consent';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        const timer = setTimeout(() => setIsVisible(true), 1200);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleAccept = (type: 'all' | 'essential') => {
    try {
      localStorage.setItem(
        COOKIE_CONSENT_KEY,
        JSON.stringify({
          accepted: true,
          type,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // ignore
    }
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie Consent Banner"
      className="fixed bottom-4 left-4 right-4 md:left-6 md:right-auto md:max-w-md z-50 p-5 rounded-2xl bg-navy-950/95 border border-[#D4AC54] shadow-2xl backdrop-blur-xl animate-fade-in space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-gold-500/10 border border-[#D4AC54] text-gold-400 shrink-0">
            <Cookie className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-sm font-bold text-text-main tracking-wide">Privacy & Cookie Settings</h4>
            <p className="text-[13px] text-gold-400 font-mono">MMSR Academic Security Standard</p>
          </div>
        </div>
        <button
          onClick={() => handleAccept('essential')}
          className="p-1 text-text-muted hover:text-white rounded-lg transition-colors"
          aria-label="Close cookie consent banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-text-muted leading-relaxed">
        We use essential cookies for secure session authentication, peer review management, and platform security. Optional performance analytics help us refine research dissemination.
      </p>

      <div className="flex items-center justify-end space-x-2.5 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAccept('essential')}
          className="text-xs border-[#D4AC54]/60 hover:border-white/20 text-text-muted hover:text-white"
        >
          Essential Only
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => handleAccept('all')}
          className="text-xs bg-gold-500 hover:bg-gold-400 text-navy-950 font-bold"
          leftIcon={<Check className="w-3.5 h-3.5" />}
        >
          Accept All
        </Button>
      </div>
    </div>
  );
};
