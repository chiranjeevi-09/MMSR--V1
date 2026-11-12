'use client';

import React from 'react';
import { cn } from '@/lib/utils/cn';
import { HONEYPOT_FIELD, honeypotValue } from '@/lib/utils/spamGuard';

export interface HoneypotFieldProps {
  /** Current value of the trap. Genuine visitors never touch it. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Hidden bot trap for the anonymous public forms (contact, reviews, newsletter).
 *
 * SECURITY-QA-REPORT M-4. Rendered off-screen instead of `display:none` or
 * `type="hidden"` because naive scrapers skip inputs they cannot see in the
 * DOM, while the field still has to be submitted with the rest of the payload.
 * It is removed from the tab order and labelled for machines only, so keyboard
 * and screen-reader users never encounter it; the backend treats any non-empty
 * value as automation and discards the submission.
 */
export const HoneypotField: React.FC<HoneypotFieldProps> = ({ value, onChange, className }) => (
  <div
    aria-hidden="true"
    className={cn('absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden', className)}
  >
    <label htmlFor={`hp-${HONEYPOT_FIELD}`}>Website (leave this field empty)</label>
    <input
      id={`hp-${HONEYPOT_FIELD}`}
      name={HONEYPOT_FIELD}
      type="text"
      tabIndex={-1}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(honeypotValue(e.target.value))}
    />
  </div>
);
