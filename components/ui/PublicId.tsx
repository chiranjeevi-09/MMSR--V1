'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { isPublicId } from '@/lib/utils/publicId';

export interface PublicIdProps {
  /** The public ID exactly as the API returned it (never derived from a PK). */
  value?: string | null;
  /**
   * Historical reference kept on the record (e.g. an order's legacy
   * `custom_order_id`). Shown only when the row has no public ID yet, so old
   * documents stay readable without ever exposing an internal primary key.
   */
  legacy?: string | null;
  /** Label rendered before the value, e.g. "Order ID". Omitted when blank. */
  label?: string;
  /** Text used when the record has no public ID yet — never an empty box. */
  fallback?: string;
  /** 'dark' for the navy surfaces, 'light' for the ivory invoice card. */
  tone?: 'dark' | 'light';
  size?: 'sm' | 'md';
  /** Offer copy-to-clipboard. Only appears when there is a real reference. */
  copyable?: boolean;
  className?: string;
}

/**
 * Standard display of an MMSR public ID (Phase 5).
 *
 * One component keeps every surface on the same label/typography/copy
 * behaviour, and — crucially — renders a placeholder instead of `undefined`
 * or an internal primary key when a record has no public ID.
 */
export const PublicId: React.FC<PublicIdProps> = ({
  value,
  legacy,
  label,
  fallback = 'Not assigned yet',
  tone = 'dark',
  size = 'sm',
  copyable = true,
  className,
}) => {
  const [copied, setCopied] = useState(false);
  const valid = isPublicId(value);
  const legacyText = legacy && legacy.trim() ? legacy.trim() : null;
  const text = valid ? (value as string) : (legacyText ?? fallback);
  const copyableValue = valid ? (value as string) : legacyText;

  const handleCopy = () => {
    if (typeof window === 'undefined' || !copyableValue || !navigator.clipboard) return;
    navigator.clipboard.writeText(copyableValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tones = {
    dark: {
      shell: 'bg-white/5 border-[#D4AC54]/60 text-ivory-white',
      label: 'text-text-muted',
      fallback: 'text-text-muted italic',
      button: 'text-gold-400 hover:text-gold-300',
    },
    light: {
      shell: 'bg-[#FFF9F1] border-[#D4AC54]/60 text-[#2F241A]',
      label: 'text-[#73614C]',
      fallback: 'text-[#73614C] italic',
      button: 'text-[#8C6B1B] hover:text-[#C99A2E]',
    },
  }[tone];

  const sizes = {
    sm: 'text-[13px] px-2 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-2',
  };

  return (
    <span
      data-testid="public-id"
      className={cn(
        'inline-flex items-center rounded-lg border select-none',
        tones.shell,
        sizes[size],
        className,
      )}
      title={valid ? `${text} — MMSR public reference` : text}
    >
      {label && (
        <span className={cn('font-semibold uppercase tracking-wider', tones.label)}>
          {label}:
        </span>
      )}
      <span className={cn('font-mono font-bold break-all', !copyableValue && tones.fallback)}>
        {text}
      </span>
      {copyable && copyableValue && (
        <button
          type="button"
          onClick={handleCopy}
          title={`Copy ${label || 'reference'}`}
          aria-label={`Copy ${label || 'reference'} ${text}`}
          className={cn('p-0.5 rounded transition-colors', tones.button)}
        >
          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </span>
  );
};

export default PublicId;
