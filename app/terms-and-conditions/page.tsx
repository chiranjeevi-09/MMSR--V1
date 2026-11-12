import type { Metadata } from 'next';
import { PolicyPage } from '@/components/policies/PolicyPage';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'Official Terms & Conditions governing the use of MMSR Publications websites, manuscript portals, and academic publishing services.',
};

export default function TermsAndConditionsPage() {
  return (
    <PolicyPage
      policyType="terms"
      breadcrumb="Terms & Conditions"
      eyebrow="MMSR Terms of Service"
      titleFallback="Terms & Conditions"
      icon="scale"
      intro="These Terms & Conditions govern your access to and use of Missile Man Scientific & Research Publications (“MMSR Publications”) websites, manuscript portals, and academic publishing services. By using our website or submitting content, you agree to comply with these terms."
    />
  );
}
