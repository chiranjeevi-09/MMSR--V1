/**
 * MMSR Publications V2 — Policy Management API Service
 * Public consumers read published policy content only; admins manage drafts/versions/
 * publishing and inspect immutable acceptance records. Mirrors the cms.ts conventions
 * (API_BASE_URL + Bearer token + parseCmsError-style error handling).
 */

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export type PolicyType = 'terms' | 'privacy' | 'publication_policies';
export type PolicyVersionStatus = 'draft' | 'published' | 'unpublished' | 'archived';

export interface PublicPolicy {
  id: string;
  title: string;
  version: string;
  content: string;
  content_format: string;
  effective_date: string | null;
  published_at: string | null;
}

export interface PublicPolicySummary {
  policy_type: PolicyType;
  title: string;
  canonical_route: string;
  version: string;
  effective_date: string | null;
  published_at: string | null;
}

export interface AdminPolicy {
  id: number;
  /** Standardized MMSR public ID (MMSR-POL-1931-NNNNNN). */
  public_id?: string | null;
  policy_type: PolicyType;
  policy_type_display: string;
  title: string;
  is_archived: boolean;
  canonical_route: string;
  current_version_number: string | null;
  current_version_id: string | null;
  current_effective_date: string | null;
  current_published_at: string | null;
  latest_version_id: string | null;
  latest_status: PolicyVersionStatus | null;
  versions_count: number;
  last_updated_by_email: string | null;
  has_draft: boolean;
  draft_version_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminPolicyVersion {
  id: string;
  /** Standardized MMSR public ID (MMSR-PLV-1931-NNNNNN). */
  public_id?: string | null;
  policy: number;
  version: string;
  title: string;
  content: string;
  content_format: string;
  status: PolicyVersionStatus;
  effective_date: string | null;
  published_at: string | null;
  change_summary: string;
  created_by: number | null;
  created_by_email: string | null;
  last_edited_by: number | null;
  last_edited_by_email: string | null;
  acceptance_count: number;
  created_at: string;
  updated_at: string;
}

export interface PolicyAcceptanceRecord {
  id: string;
  /** Standardized MMSR public ID (MMSR-PLA-1931-NNNNNN). */
  public_id?: string | null;
  user: number;
  user_email: string;
  user_name: string | null;
  user_public_id?: string | null;
  submission: number | null;
  submission_id: number | null;
  submission_public_id?: string | null;
  policy: number;
  policy_title: string;
  policy_type: PolicyType;
  policy_type_display: string;
  policy_version: string | null;
  policy_version_public_id?: string | null;
  version_number: string;
  content_snapshot: string;
  agreement_text: string;
  accepted_at: string;
}

export interface PolicyDraftPayload {
  content: string;
  title?: string;
  effective_date?: string | null;
  change_summary?: string;
}

// ─── Error helper ─────────────────────────────────────────────────────────────

async function parsePolicyError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data.detail && typeof data.detail === 'string') return data.detail;
    if (data.error && typeof data.error === 'string') return data.error;
    if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
      return data.non_field_errors.join(' ');
    }
    return `Policy request failed (HTTP ${response.status})`;
  } catch {
    return `Server returned error code ${response.status}.`;
  }
}

function authHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

// ─── Public endpoints (published content only) ────────────────────────────────

export async function fetchPublicPolicy(policyType: PolicyType): Promise<PublicPolicy | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/policies/public/${encodeURIComponent(policyType)}/`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchPublicPolicySummaries(): Promise<PublicPolicySummary[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/policies/public/`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data.results ?? [];
  } catch {
    return [];
  }
}

// ─── Admin: policies & versions ───────────────────────────────────────────────

export async function fetchAdminPolicies(accessToken: string): Promise<AdminPolicy[]> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function fetchAdminPolicyVersions(accessToken: string, policyId: number): Promise<AdminPolicyVersion[]> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/versions/`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : data.results ?? [];
}

export async function fetchAdminPolicyVersion(accessToken: string, versionId: string): Promise<AdminPolicyVersion> {
  const res = await fetch(`${API_BASE_URL}/api/policies/versions/${versionId}/`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  return await res.json();
}

export async function savePolicyDraft(
  accessToken: string,
  policyId: number,
  payload: PolicyDraftPayload
): Promise<AdminPolicyVersion> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/draft/`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  return await res.json();
}

export async function publishPolicyVersion(
  accessToken: string,
  policyId: number,
  versionId?: string
): Promise<AdminPolicyVersion> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/publish/`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(versionId ? { version_id: versionId } : {}),
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  return await res.json();
}

export async function unpublishPolicy(accessToken: string, policyId: number): Promise<AdminPolicy> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/unpublish/`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  return await res.json();
}

export async function restorePolicyVersion(
  accessToken: string,
  policyId: number,
  versionId: string
): Promise<AdminPolicyVersion> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/restore/`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ version_id: versionId }),
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  return await res.json();
}

export async function archivePolicy(accessToken: string, policyId: number): Promise<AdminPolicy> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/archive/`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  return await res.json();
}

export async function unarchivePolicy(accessToken: string, policyId: number): Promise<AdminPolicy> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/unarchive/`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  return await res.json();
}

export async function deletePolicyDraft(accessToken: string, policyId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/policies/policies/${policyId}/delete-draft/`, {
    method: 'DELETE',
    headers: authHeaders(accessToken),
  });
  if (!res.ok && res.status !== 204) throw new Error(await parsePolicyError(res));
}

// ─── Admin: acceptance records (read-only audit) ──────────────────────────────

export interface PolicyAcceptancePage {
  records: PolicyAcceptanceRecord[];
  count: number;
  hasMore: boolean;
}

export async function fetchPolicyAcceptances(
  accessToken: string,
  params: {
    user?: number | string;
    policy_type?: string;
    submission?: number | string;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
  } = {}
): Promise<PolicyAcceptancePage> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && String(val) !== '') qs.set(key, String(val));
  });
  const query = qs.toString();
  const res = await fetch(`${API_BASE_URL}/api/policies/acceptances/${query ? '?' + query : ''}`, {
    headers: authHeaders(accessToken),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));
  const data = await res.json();
  if (Array.isArray(data)) {
    return { records: data, count: data.length, hasMore: false };
  }
  const records: PolicyAcceptanceRecord[] = data.results ?? [];
  return {
    records,
    count: typeof data.count === 'number' ? data.count : records.length,
    hasMore: Boolean(data.next),
  };
}

// Download the exact accepted policy snapshot for one record as a Markdown file.
// Server-side endpoint streams the stored immutable snapshot with an audit header;
// the client never reconstructs the content itself.
export async function downloadPolicyAcceptanceRecord(
  recordId: string,
  accessToken: string,
  fallbackFilename: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/policies/acceptances/${recordId}/download/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parsePolicyError(res));

  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1]?.trim() || fallbackFilename;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
