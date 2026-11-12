import type { Metadata } from 'next';
import { PolicyPage } from '@/components/policies/PolicyPage';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How MMSR Publications collects, uses, protects, and handles personal information across our website, academic portals, and publishing services.',
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      policyType="privacy"
      breadcrumb="Privacy Policy"
      eyebrow="MMSR Legal & Trust"
      titleFallback="Privacy Policy"
      icon="shield"
      intro="This Privacy Policy explains how Missile Man Scientific & Research Publications (“MMSR Publications”) collects, uses, protects, and handles your personal information across our website, academic portals, and publishing services."
    />
  );
}
