import { redirect } from 'next/navigation';

// Old hardcoded legal URL — replaced by the DB-driven canonical Terms & Conditions page.
// Kept as a redirect so historic links keep working.
export default function LegacyTermsPage() {
  redirect('/terms-and-conditions');
}
