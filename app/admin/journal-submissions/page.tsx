'use client';

import { SubmissionReviewWorkspace } from '@/components/admin/SubmissionReviewWorkspace';

export default function AdminJournalSubmissionsPage() {
  return (
    <SubmissionReviewWorkspace
      title="Journal Submissions"
      subtitle="Audit, screen, assign peer review and process journal manuscript submissions."
      submissionTypes={['journal_article']}
    />
  );
}
