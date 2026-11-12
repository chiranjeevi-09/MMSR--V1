'use client';

import { SubmissionReviewWorkspace } from '@/components/admin/SubmissionReviewWorkspace';

export default function AdminBookSubmissionsPage() {
  return (
    <SubmissionReviewWorkspace
      title="Book Chapter Submissions"
      subtitle="Audit, screen and process book chapter submissions received from authors."
      submissionTypes={['book_chapter', 'full_book']}
    />
  );
}
