import { redirect } from 'next/navigation';

// The standalone Payments admin page was consolidated into Orders + Dashboard
// (module audit, Oct 2026). Every payment detail it displayed (transaction
// reference, Razorpay IDs, method, GST invoice) is available in the Orders
// drawer, and revenue analytics come from the server-side /api/commerce/stats/
// aggregate used by the dashboard. This route is kept as a redirect so old
// bookmarks resolve; no backend endpoints, fields, or records were removed.
export default function AdminPaymentsRedirectPage() {
  redirect('/admin/orders');
}
