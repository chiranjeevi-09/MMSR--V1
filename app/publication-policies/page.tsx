import type { Metadata } from 'next';
import { PolicyPage } from '@/components/policies/PolicyPage';

export const metadata: Metadata = {
  title: 'Publication Policies & Ethics',
  description:
    'Editorial policies, peer-review standards, publication ethics, authorship, plagiarism, conflicts of interest, and retraction procedures at MMSR Publications.',
};

export default function PublicationPoliciesPage() {
  return (
    <PolicyPage
      policyType="publication_policies"
      breadcrumb="Publication Policies & Ethics"
      eyebrow="MMSR Editorial Standards"
      titleFallback="Publication Policies & Ethics"
      icon="book"
      intro="These Publication Policies & Ethics define the editorial standards, peer-review process, author responsibilities, and integrity safeguards that apply to every manuscript submitted to MMSR Publications journals and edited books."
    />
  );
}
