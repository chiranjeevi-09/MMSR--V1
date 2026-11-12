'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ChaptersRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/books');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-sm text-gray-500">
      Redirecting to Books management...
    </div>
  );
}
