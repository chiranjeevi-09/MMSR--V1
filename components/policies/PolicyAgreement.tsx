'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { fetchPublicPolicySummaries, PublicPolicySummary } from '@/lib/services/policies';

/**
 * Author submission agreement gate.
 *
 * Loads the CURRENT published Terms & Conditions and Publication Policies & Ethics
 * versions from the backend and renders a single initially-unchecked checkbox with
 * links to both policy pages. If either policy is not published, the gate shows an
 * unavailability warning and cannot be checked (the backend rejects submissions
 * without published policies anyway — acceptance versions are resolved server-side).
 */

export interface PolicyAgreementProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible id for the checkbox input. */
  id?: string;
}

interface PolicyLinkInfo {
  label: string;
  href: string;
  version: string;
  effective: string;
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export const PolicyAgreement: React.FC<PolicyAgreementProps> = ({ checked, onChange, id = 'policy-agreement' }) => {
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyLinkInfo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPublicPolicySummaries().then((summaries: PublicPolicySummary[]) => {
      if (cancelled) return;
      const needed = summaries.filter(
        (s) => s.policy_type === 'terms' || s.policy_type === 'publication_policies'
      );
      if (needed.length === 2) {
        // Deterministic order for the sentence: Terms first, then Publication Policies.
        const order: Record<string, number> = { terms: 0, publication_policies: 1 };
        needed.sort((a, b) => order[a.policy_type] - order[b.policy_type]);
        setPolicies(
          needed.map((s) => ({
            label: s.title,
            href: s.canonical_route,
            version: s.version,
            effective: fmtDate(s.effective_date),
          }))
        );
      } else {
        setPolicies(null);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-[#8C6239]" role="status" aria-live="polite">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading the current policy versions…
      </div>
    );
  }

  if (!policies) {
    return (
      <div
        className="flex items-start gap-2.5 p-4 rounded-2xl text-xs font-semibold"
        role="alert"
        style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#b91c1c' }}
      >
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Required policies are temporarily unavailable.</p>
          <p className="font-normal leading-relaxed">
            The Terms &amp; Conditions or the Publication Policies &amp; Ethics are not currently published, so new
            submissions cannot be accepted. Please check back shortly or contact the editorial office.
          </p>
        </div>
      </div>
    );
  }

  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer select-none ${
        checked
          ? 'bg-[#F8EEDC] border-[#C99A2E] shadow-xs'
          : 'bg-[#F8EEDC]/40 border-[#E2C999] hover:bg-[#F8EEDC]/80'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 rounded border-[#E2C999] text-[#C99A2E] focus:ring-[#C99A2E] accent-[#C99A2E] cursor-pointer"
      />
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#8C6239] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="text-sm font-bold text-[#5C4033] block">
            Author Agreement <span className="text-ruby-red">*</span>
          </span>
          <span className="text-xs text-[#6E5238] leading-relaxed block">
            I have read and agree to the{' '}
            {policies.map((p, idx) => (
              <React.Fragment key={p.href}>
                <Link
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#8C6239] underline underline-offset-2 hover:text-[#C99A2E]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.label} (v{p.version}, effective {p.effective})
                </Link>
                {idx === 0 ? ' and the ' : '. '}
              </React.Fragment>
            ))}
            I confirm that this submission is original work, is not under review elsewhere, and that all co-authors
            consent to this submission.
          </span>
        </div>
      </div>
    </label>
  );
};

export default PolicyAgreement;
