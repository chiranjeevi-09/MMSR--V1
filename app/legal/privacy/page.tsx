import { redirect } from 'next/navigation';

// Old hardcoded legal URL — replaced by the DB-driven canonical Privacy Policy page.
// Kept as a redirect so historic links keep working.
export default function LegacyPrivacyPolicyPage() {
  redirect('/privacy-policy');
}
