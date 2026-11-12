'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Search, CheckCircle2, XCircle, Clock, RefreshCw, X, User, Calendar,
  Download, Check, AlertTriangle, RotateCcw, Send, Save, MessageSquare,
  Award, AlertCircle, FileCheck, BookOpenCheck, Filter, SortDesc,
  ChevronRight, Mail, Hash, Layers, Info, Eye,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/lib/context/AuthContext';
import { downloadSubmissionDocument } from '@/lib/services/protectedFiles';
import { Button } from '@/components/ui/Button';
import { ToastContainer, type ToastMessage } from '@/components/ui/Toast';
import {
  AdminSubmission,
  NoticePdfPayload,
  fetchAdminSubmissions,
  generateNoticePdf,
  updateAdminSubmission,
} from '@/lib/services/cms';
import { EmailTemplatePreview } from '@/components/admin/EmailTemplatePreview';
import { EMAIL_TEMPLATES } from '@/lib/services/notifications';
import { SITE_DOMAIN } from '@/lib/config/site';
import { displayReference, searchableRefs } from '@/lib/utils/publicId';
import { PublicId } from '@/components/ui/PublicId';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterStatus =
  | 'all' | 'pending' | 'editorial_screening' | 'under_review'
  | 'revision_requested' | 'accepted' | 'published' | 'rejected';
type SortKey = 'newest' | 'oldest' | 'status' | 'author';
type FetchState = 'idle' | 'loading' | 'success' | 'error';

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending:             { label: 'Pending Review',      color: 'text-[#8C6239]',   bg: 'bg-[#8C6239]/10 border-[#8C6239]/30',   icon: <Clock className="w-3.5 h-3.5" /> },
  editorial_screening: { label: 'Editorial Screening', color: 'text-[#A97917]',   bg: 'bg-[#C99A2E]/10 border-[#C99A2E]/30',   icon: <FileCheck className="w-3.5 h-3.5" /> },
  under_review:        { label: 'Under Review',        color: 'text-[#5C4033]',   bg: 'bg-[#5C4033]/10 border-[#5C4033]/30',   icon: <Search className="w-3.5 h-3.5" /> },
  revision_requested:  { label: 'Revision Requested',  color: 'text-[#B45309]',   bg: 'bg-[#D97706]/10 border-[#D97706]/30',   icon: <RotateCcw className="w-3.5 h-3.5" /> },
  revision_required:   { label: 'Revision Required',   color: 'text-[#B45309]',   bg: 'bg-[#D97706]/10 border-[#D97706]/30',   icon: <RotateCcw className="w-3.5 h-3.5" /> },
  accepted:            { label: 'Accepted',            color: 'text-[#1B4332]',   bg: 'bg-[#2F6B4F]/10 border-[#2F6B4F]/30',   icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:            { label: 'Rejected',            color: 'text-[#DC2626]',   bg: 'bg-[#DC2626]/10 border-[#DC2626]/30',   icon: <XCircle className="w-3.5 h-3.5" /> },
  published:           { label: 'Published',           color: 'text-[#8A6A1B]',   bg: 'bg-[#D4AC54]/15 border-[#D4AC54]/60',   icon: <BookOpenCheck className="w-3.5 h-3.5" /> },
};

function getStatusConfig(status?: string) {
  if (!status) return STATUS_CONFIG.pending;
  return STATUS_CONFIG[status.toLowerCase()] ?? {
    label: status, color: 'text-[#8B7B68]', bg: 'bg-[#FFF8EE] border-[#E9DFCF]',
    icon: <Clock className="w-3.5 h-3.5" />,
  };
}

// ─── Editorial Decision Footer ────────────────────────────────────────────────

// Editorial workflow pipeline order. Stages before the current one are already
// "crossed" and the current stage is "present" — both render green. Upcoming
// stages stay in a single neutral colour. Reject is terminal and renders red.
const STAGE_ORDER = ['editorial_screening', 'under_review', 'revision_required', 'accepted', 'published'] as const;

// Single neutral style for not-yet-reached stages (one colour, not many).
const NEUTRAL_BTN = 'bg-[#FFF8EE] border border-[#E9DFCF] text-[#8B7B68] hover:bg-[#F3E9D7] focus-visible:ring-[#C9A66B]';
// Completed / crossed stage — light green.
const DONE_BTN = 'bg-[#57B37E] border border-[#57B37E] text-white shadow-sm focus-visible:ring-[#57B37E]';
// Current stage the submission is at — light green, ringed to mark "present".
const CURRENT_BTN = 'bg-[#57B37E] border border-[#57B37E] text-white shadow-md ring-2 ring-[#57B37E]/40 focus-visible:ring-[#57B37E]';
// Rejected decision — mild red, only when it is the active status.
const REJECT_ACTIVE_BTN = 'bg-[#E57373] border border-[#E57373] text-white shadow-md ring-2 ring-[#E57373]/40 focus-visible:ring-[#E57373]';

// Both 'revision_requested' (legacy data) and 'revision_required' map to the
// Revision decision button so the highlight matches either stored value.
function normalizeDecisionStatus(status?: string) {
  const s = (status || '').toLowerCase();
  return s === 'revision_requested' ? 'revision_required' : s;
}

// Colour for a workflow button based on how far the submission has progressed:
// green once a stage is present or already crossed, red only for an active
// rejection, and the single neutral colour for everything not yet reached.
function decisionButtonClass(key: string, currentDecision: string) {
  if (key === 'rejected') {
    return currentDecision === 'rejected' ? REJECT_ACTIVE_BTN : NEUTRAL_BTN;
  }
  if (currentDecision === 'rejected') return NEUTRAL_BTN;
  const curIdx = STAGE_ORDER.indexOf(currentDecision as (typeof STAGE_ORDER)[number]);
  const keyIdx = STAGE_ORDER.indexOf(key as (typeof STAGE_ORDER)[number]);
  if (curIdx === -1 || keyIdx === -1) return NEUTRAL_BTN;
  if (keyIdx < curIdx) return DONE_BTN;      // crossed / completed stage
  if (keyIdx === curIdx) return CURRENT_BTN; // stage the submission is at
  return NEUTRAL_BTN;                        // upcoming stage
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: '2-digit' });
}

// Humanize raw enum values like 'book_chapter' → 'book chapter' for display.
function formatTypeLabel(type?: string) {
  return type ? type.replace(/_/g, ' ') : type;
}

// Target publication shown in the list/drawer: journal name, or the selected
// book / legacy volume for chapter submissions.
function targetName(sub: AdminSubmission) {
  return sub.target_journal || sub.book_title || sub.volume_title || '';
}

// Displayed manuscript reference: the standardized MMSR public ID first, then
// any legacy reference the record still carries. Never the internal PK and
// never a padded fabrication (Phase 5 spec §11).
function refIdOf(sub: AdminSubmission) {
  return displayReference(sub, sub.reference_id ?? null);
}

// ─── Publication Notice document ──────────────────────────────────────────────
// The notice is rendered as a formal PDF-style letter (letterhead with logo,
// reference block, addressee, subject, body, detail table, signature). All
// content comes from the submission record; fields with no value are skipped
// entirely, so nothing is ever fabricated.
function buildNoticeModel(sub: AdminSubmission) {
  const isJournal = sub.submission_type === 'journal_article';
  return {
    isJournal,
    heading: 'Manuscript Publication Notice',
    refNo: refIdOf(sub),
    issuedOn: new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: '2-digit' }),
    author: sub.author_name || 'Author',
    email: sub.author_email || '',
    affiliation: sub.author_affiliation || '',
    workKind: sub.submission_type ? sub.submission_type.replace(/_/g, ' ') : 'work',
    title: sub.title || '',
    target: targetName(sub),
    idLabel: isJournal ? 'ISSN' : 'ISBN',
    idValue: (isJournal ? sub.journal_issn : sub.book_isbn) || '',
    volume: sub.volume_title || '',
    doi: sub.doi || '',
    status: sub.status_display || '',
    // Letterhead contact block — editable defaults, pre-filled from house values.
    contactEmail: `editorial@${SITE_DOMAIN}`,
    contactSite: `www.${SITE_DOMAIN}`,
  };
}

function noticeRows(m: ReturnType<typeof buildNoticeModel>): Array<[string, string]> {
  return [
    [m.isJournal ? 'Article Title' : 'Chapter / Book Title', m.title],
    ['Published In', m.target],
    [m.idLabel, m.idValue],
    ['Volume / Issue', m.volume],
    ['DOI', m.doi],
    ['Reference No', m.refNo],
    ['Publication Status', m.status],
  ].filter((r): r is [string, string] => Boolean(r[1]));
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Type of the editable notice draft — same shape as the record-derived model.
type NoticeModel = ReturnType<typeof buildNoticeModel>;

// Maps the editable notice draft to the backend PDF payload, so the attached
// author PDF is generated from exactly what the editor shows on screen.
function noticePayloadOf(d: NoticeModel): NoticePdfPayload {
  return {
    heading: d.heading,
    ref_no: d.refNo,
    issued_on: d.issuedOn,
    author: d.author,
    email: d.email,
    affiliation: d.affiliation,
    work_kind: d.workKind,
    title: d.title,
    target: d.target,
    id_label: d.idLabel,
    id_value: d.idValue,
    volume: d.volume,
    doi: d.doi,
    status: d.status,
    contact_email: d.contactEmail,
    contact_site: d.contactSite,
  };
}

// Opens the same notice in a print-ready window styled as an A4 document, so
// the browser's "Save as PDF" destination produces a professional PDF.
function openNoticePrintView(m: NoticeModel) {
  const esc = escapeHtml;
  const logoUrl = `${window.location.origin}/logos/mmsr-logo.png`;
  const sealUrl = `${window.location.origin}/logos/mmsr-seal.png`;
  const rowsHtml = noticeRows(m)
    .map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Publication Notice ${esc(m.refNo)}</title>
<style>
@page { size: A4; margin: 18mm; }
body { font-family: Georgia, 'Times New Roman', serif; color:#2F241A; margin:0; padding:24px 28px; }
.head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
.head img { height:56px; width:auto; }
.brand { display:flex; align-items:center; gap:12px; }
.org { font-size:20px; font-weight:700; letter-spacing:2px; color:#16305F; }
.rule { border-top:2px solid #16305F; margin-top:10px; }
.rule-gold { border-top:1px solid #C9A66B; margin-top:2px; }
.contact { font-size:9px; color:#6B6B6B; text-align:right; line-height:1.6; }
.meta { text-align:right; font-size:10.5px; margin-top:14px; }
h1 { text-align:center; font-size:13px; letter-spacing:2px; text-transform:uppercase; color:#16305F; margin:22px 0 6px; }
.underline { width:110px; height:2px; background:#C9A66B; margin:0 auto; }
p { font-size:10.5px; line-height:1.65; margin:8px 0; }
.addr { margin-top:16px; }
table { width:100%; border-collapse:collapse; margin-top:14px; font-size:10.5px; }
td { padding:6px 8px; border-bottom:1px solid #E9DFCF; vertical-align:top; }
td.k { width:32%; font-weight:700; color:#A97917; text-transform:uppercase; font-size:9px; letter-spacing:1px; }
.sig { margin-top:34px; display:flex; align-items:flex-end; gap:22px; }
.sig .close { text-align:left; line-height:1.6; }
.seal { height:82px; width:82px; object-fit:contain; transform:rotate(2deg); }
.foot { margin-top:26px; padding-top:6px; border-top:1px solid #E9DFCF; text-align:center; font-size:8px; color:#8B7B68; }
</style></head><body>
<div class="head">
  <div class="brand"><img src="${logoUrl}" alt="MMSR Publications"/>
    <div class="org">MMSR PUBLICATIONS</div>
  </div>
  <div class="contact">${esc(m.contactEmail) || '&nbsp;'}<br/>${esc(m.contactSite)}</div>
</div>
<div class="rule"></div><div class="rule-gold"></div>
<h1>${esc(m.heading)}</h1>
<div class="underline"></div>
<div class="meta">Ref No: <b>${esc(m.refNo)}</b><br/>Date: ${esc(m.issuedOn)}</div>
<div class="addr"><p>To,</p><p><b>${esc(m.author)}</b>${m.affiliation ? '<br/>' + esc(m.affiliation) : ''}${m.email ? '<br/>' + esc(m.email) : ''}</p></div>
<p><b>Subject:</b> Formal publication notice of your submitted ${esc(m.workKind)}</p>
<p>Dear ${esc(m.author)},</p>
<p style="text-align:justify;">We are pleased to inform you that your ${esc(m.workKind)} entitled &ldquo;${esc(m.title)}&rdquo; has been officially recorded for publication${m.target ? ' in <b>' + esc(m.target) + '</b>' : ''} by <b>MMSR Publications</b>. This notice confirms that your work has been accepted and entered into the publication records of the editorial office.</p>
<table><tbody>${rowsHtml}</tbody></table>
<p style="text-align:justify;">We thank you for choosing MMSR Publications for your research dissemination and congratulate you on this accomplishment.</p>
<div class="sig"><div class="close"><b>With regards,</b><div style="height:5px"></div><b>MMSR Publications</b><br/><span style="color:#6B6B6B;">Editorial Office</span></div><img class="seal" src="${sealUrl}" alt="Official Seal"/></div>
<div class="foot">${esc(m.contactEmail)} &middot; ${esc(m.contactSite)} &middot; Generated from the submission record on file.</div>
</body></html>`;
  const win = window.open('', '_blank', 'width=920,height=1100');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Wait until every image (logo + official seal) has finished loading before
  // invoking the print dialog — otherwise the large seal renders blank in the PDF.
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try { win.focus(); win.print(); } catch { /* popup blocked */ }
  };
  const images = Array.from(win.document.images || []);
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) {
    setTimeout(doPrint, 400);
  } else {
    let remaining = pending.length;
    pending.forEach((img) => {
      img.onload = img.onerror = () => { if (--remaining <= 0) setTimeout(doPrint, 250); };
    });
    setTimeout(doPrint, 3000); // safety fallback so the dialog always opens
  }
}

function PublicationNoticeCard({ draft }: { draft: NoticeModel }) {
  const m = draft;
  const rows = noticeRows(m);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold">Official Notice Document</p>
        <button
          type="button"
          onClick={() => openNoticePrintView(m)}
          className="px-3 py-1.5 rounded-lg bg-[#FFF2D9] text-[#C9A66B] border border-[#E9DFCF] text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#FBEad0] shrink-0"
          aria-label="Download publication notice as PDF"
        >
          <Download className="w-3 h-3" /> Download PDF
        </button>
      </div>

      {/* A4-style sheet */}
      <div className="bg-white border border-[#E9DFCF] shadow-md rounded-sm px-8 py-7 font-serif text-[#2F241A]">
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/mmsr-logo.png" alt="MMSR Publications logo" className="h-14 w-auto object-contain" />
            <p className="text-xl font-bold tracking-[0.12em] text-[#16305F] leading-none">MMSR PUBLICATIONS</p>
          </div>
          <p className="text-right text-[12px] leading-relaxed text-[#6B6B6B]">
            {m.contactEmail}<br />{m.contactSite}
          </p>
        </div>
        <div className="mt-3 border-t-2 border-[#16305F]" />
        <div className="mt-0.5 border-t border-[#C9A66B]" />

        {/* Title */}
        <p className="mt-5 text-center text-[13px] font-bold uppercase tracking-[0.18em] text-[#16305F]">
          {m.heading}
        </p>
        <div className="mx-auto mt-1.5 h-0.5 w-28 bg-[#C9A66B]" />

        {/* Ref / Date */}
        <div className="mt-4 text-right text-[13px] leading-relaxed">
          <p>Ref No: <span className="font-mono font-bold">{m.refNo}</span></p>
          <p>Date: {m.issuedOn}</p>
        </div>

        {/* Addressee */}
        <div className="mt-5 text-[13px] leading-relaxed">
          <p>To,</p>
          <p className="font-bold">{m.author}</p>
          {m.affiliation && <p>{m.affiliation}</p>}
          {m.email && <p className="text-[#6B6B6B]">{m.email}</p>}
        </div>

        <p className="mt-4 text-[13px] leading-relaxed">
          <span className="font-bold">Subject:</span> Formal publication notice of your submitted {m.workKind}
        </p>
        <p className="mt-3 text-[13px]">Dear {m.author},</p>
        <p className="mt-2 text-[13px] leading-relaxed text-justify">
          We are pleased to inform you that your {m.workKind} entitled &ldquo;{m.title}&rdquo; has been
          officially recorded for publication{m.target ? <> in <b>{m.target}</b></> : null} by
          <b> MMSR Publications</b>. This notice confirms that your work has been accepted and entered
          into the publication records of the editorial office.
        </p>

        {/* Detail table — only rows with real values are rendered */}
        <table className="mt-4 w-full border-collapse text-[13px]">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-[#E9DFCF]">
                <td className="py-1.5 pr-3 font-bold text-[#A97917] uppercase tracking-wider text-[12px] whitespace-nowrap w-1/3 align-top">
                  {label}
                </td>
                <td className="py-1.5 font-semibold align-top break-words">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 text-[13px] leading-relaxed text-justify">
          We thank you for choosing MMSR Publications for your research dissemination and congratulate
          you on this accomplishment.
        </p>

        {/* Closing & Official Seal */}
        <div className="mt-8 text-[13px]">
          <div className="flex items-end justify-start gap-6">
            <div className="text-left leading-relaxed">
              <p className="font-bold">With regards,</p>
              <p className="mt-0.5 font-bold">MMSR Publications</p>
              <p className="text-[#6B6B6B]">Editorial Office</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/mmsr-seal.png"
              alt="MMSR Publications official seal"
              className="h-20 w-20 object-contain"
              style={{ transform: 'rotate(2deg)' }}
            />
          </div>
        </div>

        {/* Document footer */}
        <div className="mt-6 pt-2 border-t border-[#E9DFCF] text-center text-[12px] text-[#8B7B68]">
          {m.contactEmail} · {m.contactSite} · Generated from the submission record on file.
        </div>
      </div>
    </div>
  );
}

// Single labeled text input used by the notice editor panel.
function NoticeFieldInput({ label, value, onChange, mono = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2.5 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] ${mono ? 'font-mono' : ''}`}
      />
    </div>
  );
}

// Editor for the publication notice, mirroring the Email Author Panel pattern:
// every value the letter shows can be adjusted here and is reflected live in
// the document below and in the downloaded PDF. Nothing is written back to the
// author's submission record.
function NoticeDetailsEditor({ draft, onChange, onReset, onSave, saving }: {
  draft: NoticeModel;
  onChange: (key: Exclude<keyof NoticeModel, 'isJournal'>, value: string) => void;
  onReset: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Edit Notice Details
        </p>
        <button
          type="button"
          onClick={onReset}
          className="text-[13px] font-bold text-[#8B7B68] hover:text-[#C9A66B] flex items-center gap-1"
          aria-label="Reset notice fields to the submission record"
        >
          <RefreshCw className="w-3 h-3" /> Reset to record
        </button>
      </div>
      <p className="text-[13px] text-[#8B7B68] flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        Edits preview live in the notice document below. Press Save to store them and refresh the downloadable PDF.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <NoticeFieldInput label="Notice Heading" value={draft.heading} onChange={(v) => onChange('heading', v)} />
        </div>
        <NoticeFieldInput label="Reference No" value={draft.refNo} mono onChange={(v) => onChange('refNo', v)} />
        <NoticeFieldInput label="Issue Date" value={draft.issuedOn} onChange={(v) => onChange('issuedOn', v)} />
        <NoticeFieldInput label="Author Name" value={draft.author} onChange={(v) => onChange('author', v)} />
        <NoticeFieldInput label="Author Email" value={draft.email} onChange={(v) => onChange('email', v)} />
        <div className="sm:col-span-2">
          <NoticeFieldInput label="Affiliation / Institution" value={draft.affiliation} onChange={(v) => onChange('affiliation', v)} />
        </div>
        <div className="sm:col-span-2">
          <NoticeFieldInput label={draft.isJournal ? 'Article Title' : 'Chapter / Book Title'} value={draft.title} onChange={(v) => onChange('title', v)} />
        </div>
        <NoticeFieldInput label="Published In (journal / book)" value={draft.target} onChange={(v) => onChange('target', v)} />
        <NoticeFieldInput label={draft.idLabel} value={draft.idValue} onChange={(v) => onChange('idValue', v)} />
        <NoticeFieldInput label="Volume / Issue" value={draft.volume} onChange={(v) => onChange('volume', v)} />
        <NoticeFieldInput label="DOI" value={draft.doi} onChange={(v) => onChange('doi', v)} />
        <NoticeFieldInput label="Status" value={draft.status} onChange={(v) => onChange('status', v)} />
        <NoticeFieldInput label="Letterhead Email" value={draft.contactEmail} onChange={(v) => onChange('contactEmail', v)} />
        <NoticeFieldInput label="Letterhead Website" value={draft.contactSite} onChange={(v) => onChange('contactSite', v)} />
      </div>
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#C9A66B] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#B8935A] disabled:opacity-50"
          aria-label="Save notice changes"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────────

function SubmissionTableSkeleton() {
  return (
    <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-hidden animate-pulse">
      <div className="h-11 bg-[#FFFBF7] border-b border-[#E9DFCF]" />
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="px-4 py-4 border-b border-[#E9DFCF]/60 flex items-center gap-4">
          <div className="h-4 bg-[#FFF8EE] rounded w-20 shrink-0" />
          <div className="h-4 bg-[#FFF8EE] rounded flex-1 max-w-[280px]" />
          <div className="h-4 bg-[#FFF8EE] rounded w-24 hidden sm:block" />
          <div className="h-5 bg-[#FFF8EE] rounded-full w-24 shrink-0" />
          <div className="h-4 bg-[#FFF8EE] rounded w-20 hidden md:block" />
          <div className="h-7 bg-[#FFF8EE] rounded-xl w-20 ml-auto shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ReviewDrawerSkeleton() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="h-5 bg-[#FFF8EE] rounded w-3/4" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-[#FFF8EE] rounded-xl" />)}
      </div>
      <div className="h-32 bg-[#FFF8EE] rounded-xl" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-[#FFF8EE] rounded-full w-16" />)}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface SubmissionReviewWorkspaceProps {
  /** Page heading shown in the admin layout (defaults to the combined view). */
  title?: string;
  subtitle?: string;
  /** When set, only submissions with these submission_type values are shown. */
  submissionTypes?: string[];
}

export function SubmissionReviewWorkspace({
  title = 'Manuscript Review & Editorial Screening',
  subtitle = 'Audit, screen, assign peer review, and process open access manuscript submissions.',
  submissionTypes,
}: SubmissionReviewWorkspaceProps) {
  const { tokens } = useAuth();
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  // Drawer state
  const [selectedSub, setSelectedSub] = useState<AdminSubmission | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [editorialNotes, setEditorialNotes] = useState('');
  const [updatingState, setUpdatingState] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingCert, setSavingCert] = useState(false);

  // Confirmation modal
  const [pendingConfirmation, setPendingConfirmation] = useState<{ status: string; label: string } | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const drawerRef = useRef<HTMLDivElement>(null);

  // ─── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((type: ToastMessage['type'], title: string, description?: string) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, title, description, duration: 4000 }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── Load submissions ───────────────────────────────────────────────────────
  const loadSubmissions = useCallback(async () => {
    if (!tokens?.access) return;
    setFetchState('loading');
    setErrorMsg(null);
    try {
      const list = await fetchAdminSubmissions(tokens.access);
      setSubmissions(
        submissionTypes?.length
          ? list.filter((s) => submissionTypes.includes((s.submission_type || '').toLowerCase()))
          : list
      );
      setFetchState('success');
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'Failed to load submissions.');
      setSubmissions([]);
      setFetchState('error');
    }
  }, [tokens?.access, submissionTypes]);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  // ─── ESC key closes drawer ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingConfirmation(null);
        setSelectedSub(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Email Author Panel State
  const [drawerTab, setDrawerTab] = useState<'details' | 'email' | 'notice'>('details');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('submission_received');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');

  // Editable draft of the publication notice; seeded from the record when the
  // drawer opens so the editor starts with the real values.
  const [noticeDraft, setNoticeDraft] = useState<NoticeModel | null>(null);

  // Persisting the notice (Save button) re-renders the attached PDF from the
  // current editor values; this flag drives the button's disabled/spinner state.
  const [savingNotice, setSavingNotice] = useState(false);

  // Substitute a submission's real values into template tokens so the
  // editable fields (and the sent email) never show raw {{...}} placeholders.
  const fillTemplate = (text: string, sub: AdminSubmission | null): string => {
    if (!sub) return text;
    return text
      .replace(/\{\{author_name\}\}/g, sub.author_name || 'Author')
      .replace(/\{\{paper_title\}\}/g, sub.title || 'your manuscript')
      .replace(/\{\{submission_id\}\}/g, refIdOf(sub))
      .replace(/\{\{journal_name\}\}/g, targetName(sub) || 'MMSR Publications');
  };

  // ─── Open drawer ────────────────────────────────────────────────────────────
  const openReviewDrawer = (sub: AdminSubmission) => {
    setSelectedSub(sub);
    setEditorialNotes(
      typeof sub.editorial_notes === 'string'
        ? sub.editorial_notes
        : ''
    );
    setPendingConfirmation(null);
    setDrawerTab('details');
    setNoticeDraft(buildNoticeModel(sub));

    const tpl = EMAIL_TEMPLATES[0];
    setSelectedTemplateId(tpl.id);
    setEmailSubject(fillTemplate(tpl.subject, sub));
    setEmailBody(fillTemplate(tpl.body, sub));
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const found = EMAIL_TEMPLATES.find((t) => t.id === templateId);
    if (found) {
      setEmailSubject(fillTemplate(found.subject, selectedSub));
      setEmailBody(fillTemplate(found.body, selectedSub));
    }
  };

  // Live-edit a single field of the notice draft (editor panel above the sheet).
  const handleNoticeFieldChange = (key: Exclude<keyof NoticeModel, 'isJournal'>, value: string) => {
    setNoticeDraft((prev) => (prev ? ({ ...prev, [key]: value } as NoticeModel) : prev));
  };

  const handleSendEmailClick = () => {
    if (!selectedSub) return;
    const to = (selectedSub.author_email || selectedSub.corresponding_email || '').trim();
    if (!to) {
      addToast('error', 'No Author Email', 'This submission has no author email address on record, so there is nothing to address the message to.');
      return;
    }
    // Substitute real submission values into the template tokens (never fake data).
    const authorName = selectedSub.author_name || 'Author';
    const paperTitle = selectedSub.title || 'your manuscript';
    const refId = refIdOf(selectedSub);
    const journalName = targetName(selectedSub) || 'MMSR Publications';
    const fill = (text: string) => text
      .replace(/\{\{author_name\}\}/g, authorName)
      .replace(/\{\{paper_title\}\}/g, paperTitle)
      .replace(/\{\{submission_id\}\}/g, refId)
      .replace(/\{\{journal_name\}\}/g, journalName);
    const subject = fill(emailSubject || '');
    const body = fill(emailBody || '');
    const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast('success', 'Email Client Opened', `Your email app opened with this message addressed to ${to}. Press send there to deliver it.`);
  };

  const closeReviewDrawer = () => {
    setSelectedSub(null);
    setPendingConfirmation(null);
  };

  // Decision the submission currently sits at (used to highlight the matching
  // button in the drawer footer). Recomputed whenever selectedSub changes.
  const currentDecision = normalizeDecisionStatus(selectedSub?.status);

  // ─── Execute status update ──────────────────────────────────────────────────
  const executeStatusUpdate = async (targetStatus: string) => {
    if (!selectedSub || !tokens?.access) return;
    setUpdatingState(true);
    try {
      const updated = await updateAdminSubmission(tokens.access, selectedSub.id, {
        status: targetStatus,
        editorial_notes: editorialNotes,
      });
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setSelectedSub((prev) => prev ? { ...prev, ...updated } : null);
      setPendingConfirmation(null);
      addToast('success', 'Status Updated', `Manuscript moved to "${targetStatus.replace(/_/g, ' ').toUpperCase()}"`);
      setTimeout(() => loadSubmissions(), 500);
    } catch (err: unknown) {
      addToast('error', 'Update Failed', (err as Error)?.message || 'Could not update submission status.');
    } finally {
      setUpdatingState(false);
    }
  };

  // ─── Save notes only ────────────────────────────────────────────────────────
  const saveEditorialNotes = async () => {
    if (!selectedSub || !tokens?.access) return;
    setSavingNotes(true);
    try {
      const updated = await updateAdminSubmission(tokens.access, selectedSub.id, {
        editorial_notes: editorialNotes,
      });
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setSelectedSub((prev) => prev ? { ...prev, ...updated } : null);
      addToast('success', 'Notes Saved', 'Editorial notes have been saved successfully.');
    } catch (err: unknown) {
      addToast('error', 'Save Failed', (err as Error)?.message || 'Could not save editorial notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  // ─── Issue / revoke certificate ─────────────────────────────────────────────
  const toggleCertificate = async () => {
    if (!selectedSub || !tokens?.access) return;
    const next = !selectedSub.certificate_issued;
    setSavingCert(true);
    try {
      let updated = await updateAdminSubmission(tokens.access, selectedSub.id, {
        certificate_issued: next,
      });
      // On issue, render the notice document (exactly as edited above) into a
      // PDF and attach it so the author gets a real downloadable file.
      let genError: string | null = null;
      if (next) {
        try {
          const draft = noticeDraft ?? buildNoticeModel(selectedSub);
          updated = await generateNoticePdf(tokens.access, selectedSub.id, noticePayloadOf(draft));
        } catch (errGen: unknown) {
          genError = (errGen as Error)?.message || 'Notice PDF generation failed.';
        }
      }
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setSelectedSub((prev) => prev ? { ...prev, ...updated } : null);
      if (next && genError) {
        addToast('error', 'Issued — PDF Not Attached', `The notice was issued but its PDF failed to generate (${genError}). Press "Attach Notice PDF" to retry.`);
      } else {
        addToast('success', next ? 'Publication Notice Issued' : 'Notice Revoked', next
          ? 'The notice PDF is attached — the author can download it from their submission page.'
          : 'The notice has been hidden from the author side.');
      }
    } catch (err: unknown) {
      addToast('error', 'Update Failed', (err as Error)?.message || 'Could not update certificate status.');
    } finally {
      setSavingCert(false);
    }
  };

  // Re-renders the notice PDF from the current editor values and re-attaches
  // it, so late edits can be pushed to the author copy without revoking.
  const attachNoticePdf = async () => {
    if (!selectedSub || !tokens?.access) return;
    setSavingCert(true);
    try {
      const draft = noticeDraft ?? buildNoticeModel(selectedSub);
      const updated = await generateNoticePdf(tokens.access, selectedSub.id, noticePayloadOf(draft));
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setSelectedSub((prev) => prev ? { ...prev, ...updated } : null);
      addToast('success', 'Notice PDF Attached', 'The author download now reflects the values currently in the editor.');
    } catch (err: unknown) {
      addToast('error', 'Generation Failed', (err as Error)?.message || 'Could not generate the notice PDF.');
    } finally {
      setSavingCert(false);
    }
  };

  // Author manuscripts, cover letters and notice PDFs are no longer readable
  // off a public /media path — the API hands out an authorised endpoint per
  // document, so the staff download fetches it with the admin bearer token and
  // saves the blob (SECURITY-QA-REPORT C-1 / H-2).
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const handleDownloadDocument = async (key: 'certificate' | 'manuscript' | 'supplementary', path?: string | null) => {
    if (!path || !tokens?.access) return;
    setDownloadingDoc(key);
    try {
      const label = selectedSub?.public_id || selectedSub?.id || 'submission';
      await downloadSubmissionDocument(path, tokens.access, `${key}_${label}`);
      addToast('success', 'Download started', 'The file was fetched through the authorised document endpoint.');
    } catch (err: unknown) {
      addToast('error', 'Download Failed', (err as Error)?.message || 'Could not download this document.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Saves the current notice editor values by rendering them into the attached
  // PDF (heading included), so the downloadable author copy matches the preview.
  const handleSaveNotice = async () => {
    if (!selectedSub || !tokens?.access) return;
    setSavingNotice(true);
    try {
      const draft = noticeDraft ?? buildNoticeModel(selectedSub);
      const updated = await generateNoticePdf(tokens.access, selectedSub.id, noticePayloadOf(draft));
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      setSelectedSub((prev) => prev ? { ...prev, ...updated } : null);
      addToast('success', 'Notice Saved', 'The publication notice was saved and its downloadable PDF refreshed.');
    } catch (err: unknown) {
      addToast('error', 'Save Failed', (err as Error)?.message || 'Could not save the publication notice.');
    } finally {
      setSavingNotice(false);
    }
  };

  // ─── Decision click (confirm for destructive) ───────────────────────────────
  const handleDecisionClick = (targetStatus: string, label: string) => {
    if (targetStatus === 'published' || targetStatus === 'rejected') {
      setPendingConfirmation({ status: targetStatus, label });
    } else {
      executeStatusUpdate(targetStatus);
    }
  };

  // ─── Filter + Sort ──────────────────────────────────────────────────────────
  const filteredSubmissions = useMemo(() => {
    let list = [...submissions];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => {
        // Match on real identifiers only, so the "Not assigned yet" display
        // placeholder never turns into a search hit.
        const refId = searchableRefs(s.public_id, s.reference_id);
        return (
          s.title.toLowerCase().includes(q) ||
          (s.author_name || '').toLowerCase().includes(q) ||
          (s.author_email || '').toLowerCase().includes(q) ||
          refId.includes(q) ||
          targetName(s).toLowerCase().includes(q) ||
          (s.category || '').toLowerCase().includes(q)
        );
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((s) => {
        const norm = (s.status || '').toLowerCase();
        if (statusFilter === 'revision_requested') return norm === 'revision_requested' || norm === 'revision_required';
        return norm === statusFilter;
      });
    }

    // Sort
    list.sort((a, b) => {
      if (sortKey === 'newest') return new Date(b.submitted_at || b.created_at || 0).getTime() - new Date(a.submitted_at || a.created_at || 0).getTime();
      if (sortKey === 'oldest') return new Date(a.submitted_at || a.created_at || 0).getTime() - new Date(b.submitted_at || b.created_at || 0).getTime();
      if (sortKey === 'status') return (a.status || '').localeCompare(b.status || '');
      if (sortKey === 'author') return (a.author_name || '').localeCompare(b.author_name || '');
      return 0;
    });

    return list;
  }, [submissions, searchQuery, statusFilter, sortKey]);

  // ─── Filter pill count helpers ──────────────────────────────────────────────
  const getCount = (status: string) => {
    if (status === 'all') return submissions.length;
    if (status === 'revision_requested') return submissions.filter((s) => ['revision_requested', 'revision_required'].includes(s.status?.toLowerCase())).length;
    return submissions.filter((s) => s.status?.toLowerCase() === status).length;
  };

  const STATUS_PILLS: { id: FilterStatus; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'editorial_screening', label: 'Screening' },
    { id: 'under_review', label: 'Under Review' },
    { id: 'revision_requested', label: 'Revision' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'published', label: 'Published' },
    { id: 'rejected', label: 'Rejected' },
  ];

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <AdminLayout
      title={title}
      subtitle={subtitle}
    >
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Controls Row ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8B7B68] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search title, author, ref ID, journal, conference…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-[#E9DFCF] rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B] transition-colors"
              aria-label="Search submissions"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <SortDesc className="w-4 h-4 text-[#8B7B68] shrink-0" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-white border border-[#E9DFCF] rounded-xl px-3 py-2.5 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] transition-colors"
              aria-label="Sort submissions"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="status">By Status</option>
              <option value="author">By Author</option>
            </select>
          </div>

          <Button
            type="button" variant="outline" size="sm"
            onClick={loadSubmissions} isLoading={fetchState === 'loading'}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Filter by status">
          {STATUS_PILLS.map((pill) => {
            const isActive = statusFilter === pill.id;
            const count = getCount(pill.id);
            return (
              <button
                key={pill.id} type="button"
                onClick={() => setStatusFilter(pill.id)}
                aria-pressed={isActive}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-[#C9A66B] text-white border-gold-500 font-bold shadow-sm'
                    : 'bg-white text-[#8B7B68] border-[#E9DFCF] hover:border-[#E9DFCF] hover:text-[#5C4B3A]'
                }`}
              >
                {pill.label}
                {pill.id !== 'all' && count > 0 && (
                  <span className={`text-[13px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/30 text-white' : 'bg-[#FFF8EE] text-[#8B7B68]'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[#8B7B68]">
          Showing <strong className="text-[#5C4B3A]">{filteredSubmissions.length}</strong> of <strong className="text-[#5C4B3A]">{submissions.length}</strong> manuscripts
        </p>
      </div>

      {/* ── Loading Skeleton ─────────────────────────────────────────────── */}
      {fetchState === 'loading' && <SubmissionTableSkeleton />}

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {fetchState === 'error' && (
        <div className="p-8 rounded-2xl bg-red-500/8 border border-red-500/20 text-center space-y-3">
          <XCircle className="w-8 h-8 text-[#DC2626] mx-auto" />
          <p className="text-sm font-bold text-[#5C4B3A]">Failed to Load Submissions</p>
          <p className="text-xs text-[#8B7B68]">{errorMsg}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadSubmissions}>Retry</Button>
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────────────── */}
      {fetchState === 'success' && filteredSubmissions.length === 0 && (
        <div className="p-10 rounded-2xl bg-white border border-[#E9DFCF] text-center space-y-3">
          <FileText className="w-8 h-8 text-[#C9A66B] mx-auto" />
          <p className="text-sm font-bold text-[#5C4B3A] font-playfair">No Manuscripts Found</p>
          <p className="text-xs text-[#8B7B68] max-w-sm mx-auto">
            {searchQuery || statusFilter !== 'all'
              ? 'No manuscripts match your active filter parameters.'
              : 'Author submissions will appear here once submitted.'}
          </p>
          {(searchQuery || statusFilter !== 'all') && (
            <Button type="button" variant="outline" size="sm" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* ── Submissions Table (conference-style) ───────────────────────── */}
      {fetchState === 'success' && filteredSubmissions.length > 0 && (
        <div className="rounded-2xl bg-white border border-[#E9DFCF] overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead>
              <tr className="bg-[#FFFBF7] border-b border-[#E9DFCF] text-[#8B7B68] uppercase tracking-wider text-[13px]">
                <th className="px-4 py-3 font-bold">Reference</th>
                <th className="px-4 py-3 font-bold">Manuscript / Author</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Target</th>
                <th className="px-4 py-3 font-bold">Status</th>
                <th className="px-4 py-3 font-bold">Submitted</th>
                <th className="px-4 py-3 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubmissions.map((sub) => {
                const sc = getStatusConfig(sub.status);
                return (
                  <tr
                    key={sub.id}
                    className="border-b border-[#E9DFCF]/60 hover:bg-[#FFFBF7] transition-colors cursor-pointer"
                    onClick={() => openReviewDrawer(sub)}
                  >
                    <td className="px-4 py-3 font-mono text-[#8C6239] whitespace-nowrap">
                      {refIdOf(sub)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#5C4B3A] line-clamp-1 max-w-[280px]">{sub.title}</p>
                      <p className="text-[13px] text-[#8B7B68]">{sub.author_name || sub.author_email || 'Scholar'}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap capitalize text-[#5C4B3A]">
                      {formatTypeLabel(sub.submission_type) || 'Research Paper'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#5C4B3A] max-w-[200px]">
                      <span className="block truncate" title={targetName(sub) || undefined}>{targetName(sub) || '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[13px] font-bold border ${sc.bg} ${sc.color}`}>
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[#8B7B68]">{formatDate(sub.submitted_at || sub.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openReviewDrawer(sub); }}
                          className="p-2 rounded-xl bg-white border border-[#E9DFCF] text-[#5C4B3A] hover:bg-[#FFF8EE] cursor-pointer"
                          title="Open review & screening"
                          aria-label={`Review ${sub.title}`}
                        >
                          <Eye className="w-4 h-4 text-[#C9A66B]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          REVIEW DRAWER
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedSub && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeReviewDrawer}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-50"
              aria-hidden="true"
            />

            {/* Drawer Panel */}
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Editorial Review Drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 bottom-0 right-0 w-full max-w-xl bg-white border-l border-[#E9DFCF] z-50 flex flex-col overflow-hidden"
            >
              {/* ── Header ─────────────────────────────────────────────── */}
              <div className="p-5 border-b border-[#E9DFCF] flex items-center justify-between shrink-0">
                <div>
                  <PublicId
                    value={selectedSub.public_id}
                    legacy={selectedSub.reference_id ?? null}
                    label="REF"
                    tone="light"
                    size="sm"
                    className="mb-1.5"
                  />
                  <h3 className="text-base font-bold font-playfair text-[#5C4B3A]">
                    {drawerTab === 'details' ? 'Editorial Review & Screening' : drawerTab === 'notice' ? 'Publication Notice' : 'Email Author Panel'}
                  </h3>
                </div>
                <button
                  type="button" onClick={closeReviewDrawer}
                  className="p-2 rounded-xl bg-[#FFF8EE] text-[#8B7B68] hover:text-[#5C4B3A] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                  aria-label="Close review drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* ── Tabs Navigation Bar ──────────────────────────────── */}
              <div className="flex border-b border-[#E9DFCF] bg-white px-5 pt-2">
                <button
                  type="button"
                  onClick={() => setDrawerTab('details')}
                  className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition-colors flex items-center gap-2 ${
                    drawerTab === 'details'
                      ? 'border-gold-400 text-[#C9A66B]'
                      : 'border-transparent text-[#8B7B68] hover:text-[#2F241A]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> Review & Screening
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('email')}
                  className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition-colors flex items-center gap-2 ${
                    drawerTab === 'email'
                      ? 'border-gold-400 text-[#C9A66B]'
                      : 'border-transparent text-[#8B7B68] hover:text-[#2F241A]'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email Author Panel
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('notice')}
                  className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition-colors flex items-center gap-2 ${
                    drawerTab === 'notice'
                      ? 'border-gold-400 text-[#C9A66B]'
                      : 'border-transparent text-[#8B7B68] hover:text-[#2F241A]'
                  }`}
                >
                  <BookOpenCheck className="w-3.5 h-3.5" /> Publication Notice
                </button>
              </div>

              {/* ── Scrollable Body ─────────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {drawerLoading ? (
                  <ReviewDrawerSkeleton />
                ) : drawerTab === 'notice' ? (
                  <>
                    <NoticeDetailsEditor
                      draft={noticeDraft ?? buildNoticeModel(selectedSub)}
                      onChange={handleNoticeFieldChange}
                      onReset={() => setNoticeDraft(buildNoticeModel(selectedSub))}
                      onSave={handleSaveNotice}
                      saving={savingNotice}
                    />
                    <PublicationNoticeCard draft={noticeDraft ?? buildNoticeModel(selectedSub)} />
                    {/* ── PUBLICATION CERTIFICATE PANEL (moved from Review & Screening) ── */}
                    <div className="p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5" /> Publication Certificate
                        </p>
                        {/* Enable / disable switch — mirrors the Django admin checkbox */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!selectedSub.certificate_issued}
                          aria-label={selectedSub.certificate_issued ? 'Revoke certificate' : 'Issue certificate'}
                          onClick={toggleCertificate}
                          disabled={savingCert}
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#C99A2E] ${
                            selectedSub.certificate_issued
                              ? 'bg-[#C99A2E] border-[#C99A2E]'
                              : 'bg-[#F8EEDC] border-[#E9DFCF]'
                          }`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            selectedSub.certificate_issued ? 'translate-x-6' : 'translate-x-1'
                          }`} />
                        </button>
                      </div>

                      {selectedSub.certificate_issued ? (
                        <>
                          <p className="text-xs text-[#1B4332] font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Issued — the author can download the notice PDF from their submission page.
                          </p>
                          {selectedSub.certificate_file ? (
                            <div className="p-3 rounded-xl bg-white border border-[#E9DFCF] flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-[#C9A66B] shrink-0" />
                                <span className="text-[#5C4B3A] font-medium truncate">Publication Notice (PDF)</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDownloadDocument('certificate', selectedSub.certificate_file)}
                                disabled={downloadingDoc !== null}
                                className="px-3 py-1 rounded-lg bg-[#FFF2D9] text-[#C9A66B] border border-[#E9DFCF] text-[13px] font-bold flex items-center gap-1 hover:bg-[#FFF2D9] shrink-0 ml-2 disabled:opacity-60"
                                aria-label="Download certificate"
                              >
                                <Download className="w-3 h-3" /> {downloadingDoc === 'certificate' ? 'Preparing…' : 'Download'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-[13px] text-[#B45309] flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              No notice PDF attached yet — press "Attach Notice PDF" below to generate it from the values in the editor above.
                            </p>
                          )}

                          <button
                            type="button"
                            onClick={attachNoticePdf}
                            disabled={savingCert}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-[#E9DFCF] text-[13px] font-bold text-[#C9A66B] hover:bg-[#FFF2D9] flex items-center justify-center gap-1.5 disabled:opacity-50"
                            aria-label="Regenerate notice PDF from current editor values"
                          >
                            <RefreshCw className="w-3 h-3" /> {selectedSub.certificate_file ? 'Refresh Notice PDF from Editor' : 'Attach Notice PDF'}
                          </button>
                        </>
                      ) : (
                        <p className="text-[13px] text-[#8B7B68]">
                          Toggle on to issue this notice to the author: the document shown above is rendered as a PDF and attached, and the author side immediately shows the download.
                        </p>
                      )}
                    </div>
                  </>
                ) : drawerTab === 'email' ? (
                  /* TASK 3 — Email Author Panel */
                  <div className="space-y-5">
                    {/* Informational Banner */}
                    <div className="p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-[#C9A66B] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-[#2F241A]">Author Email</p>
                        <p className="text-[13px] text-[#8B7B68] mt-0.5 leading-relaxed">
                          Pick a template, edit the subject and message, then press send — this opens your email app with the message addressed and ready to deliver to the author.
                        </p>
                      </div>
                    </div>

                    {/* Template Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block">
                        Select Email Template
                      </label>
                      <select
                        value={selectedTemplateId}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2.5 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B]"
                      >
                        {EMAIL_TEMPLATES.filter((tpl) => tpl.id !== 'published').map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name} ({tpl.category})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Editable Subject */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block">
                        Email Subject Line
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl px-3 py-2 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] font-mono"
                      />
                    </div>

                    {/* Editable Body */}
                    <div className="space-y-1.5">
                      <label className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block">
                        Message Body Content
                      </label>
                      <textarea
                        rows={7}
                        value={emailBody}
                        onChange={(e) => setEmailBody(e.target.value)}
                        className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-xs text-[#5C4B3A] focus:outline-none focus:border-[#C9A66B] resize-none font-sans leading-relaxed"
                      />
                    </div>

                    {/* Live Template Preview */}
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block">
                        Live Email Render Preview
                      </span>
                      <EmailTemplatePreview
                        subject={emailSubject}
                        body={emailBody}
                        recipientName={selectedSub.author_name || selectedSub.author_email || 'Dr. Author'}
                        referenceId={refIdOf(selectedSub)}
                        journalName={targetName(selectedSub) || 'MMSR Publications'}
                        templateName={EMAIL_TEMPLATES.find((t) => t.id === selectedTemplateId)?.name || 'Custom Email'}
                      />
                    </div>

                    {/* Send Button */}
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleSendEmailClick}
                      className="w-full bg-[#C9A66B] hover:bg-gold-400 text-white font-bold text-xs"
                      leftIcon={<Send className="w-3.5 h-3.5" />}
                    >
                      Send Author Email
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Current Status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const sc = getStatusConfig(selectedSub.status);
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${sc.bg} ${sc.color}`}>
                            {sc.icon} {sc.label}
                          </span>
                        );
                      })()}
                      {selectedSub.certificate_issued && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#FFF2D9] border border-[#E9DFCF] text-[#C9A66B]">
                          <Award className="w-3.5 h-3.5" /> Certificate Issued
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div className="space-y-1">
                      <span className="text-[13px] uppercase tracking-wider text-[#8B7B68] font-bold block">Manuscript Title</span>
                      <h4 className="text-base font-bold font-playfair text-[#5C4B3A] leading-snug">
                        {selectedSub.title}
                      </h4>
                    </div>

                    {/* Author Information */}
                    <div className="p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] space-y-3">
                      <p className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Author Information
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[#8B7B68] block text-[13px]">Full Name</span>
                          <span className="font-semibold text-[#5C4B3A]">{selectedSub.author_name || '—'}</span>
                        </div>
                        <div>
                          <span className="text-[#8B7B68] block text-[13px]">Email</span>
                          <span className="text-[#5C4B3A] font-mono text-[13px] break-all">{selectedSub.author_email || '—'}</span>
                        </div>
                        {selectedSub.phone_number && (
                          <div>
                            <span className="text-[#8B7B68] block text-[13px]">Phone</span>
                            <span className="font-semibold text-[#5C4B3A]">{selectedSub.phone_number}</span>
                          </div>
                        )}
                        {selectedSub.country && (
                          <div>
                            <span className="text-[#8B7B68] block text-[13px]">Country</span>
                            <span className="font-semibold text-[#5C4B3A]">{selectedSub.country}</span>
                          </div>
                        )}
                        {selectedSub.author_affiliation && (
                          <div className="sm:col-span-2">
                            <span className="text-[#8B7B68] block text-[13px]">Affiliation / Institution</span>
                            <span className="font-semibold text-[#5C4B3A]">{selectedSub.author_affiliation}</span>
                          </div>
                        )}
                        {selectedSub.co_authors && (
                          <div className="sm:col-span-2">
                            <span className="text-[#8B7B68] block text-[13px]">Co-Authors</span>
                            <span className="text-[#5C4B3A] whitespace-pre-line leading-relaxed">{selectedSub.co_authors}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Manuscript Metadata */}
                    <div className="space-y-2">
                      <p className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Manuscript Information
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {selectedSub.submission_type && (
                          <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF]">
                            <span className="text-[#8B7B68] block text-[13px]">Submission Type</span>
                            <span className="font-semibold text-[#5C4B3A] capitalize">{formatTypeLabel(selectedSub.submission_type)}</span>
                          </div>
                        )}
                        {selectedSub.research_domain && (
                          <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF]">
                            <span className="text-[#8B7B68] block text-[13px]">Research Domain</span>
                            <span className="font-semibold text-[#5C4B3A]">{selectedSub.research_domain}</span>
                          </div>
                        )}
                        {(targetName(selectedSub) || selectedSub.book_title) && (
                          <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] col-span-2">
                            <span className="text-[#8B7B68] block text-[13px]">Target Journal / Book</span>
                            <span className="font-semibold text-[#5C4B3A]">{targetName(selectedSub)}</span>
                          </div>
                        )}
                        {selectedSub.category && (
                          <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF]">
                            <span className="text-[#8B7B68] block text-[13px]">Category</span>
                            <span className="font-semibold text-[#5C4B3A]">{selectedSub.category}</span>
                          </div>
                        )}
                        <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF]">
                          <span className="text-[#8B7B68] block text-[13px]">Submission Date</span>
                          <span className="font-semibold text-[#5C4B3A]">{formatDate(selectedSub.submitted_at || selectedSub.created_at)}</span>
                        </div>
                        {selectedSub.doi && (
                          <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] col-span-2">
                            <span className="text-[#8B7B68] block text-[13px]">DOI</span>
                            <a href={`https://doi.org/${selectedSub.doi}`} target="_blank" rel="noopener noreferrer"
                              className="font-mono text-[#C9A66B] hover:underline text-xs">{selectedSub.doi}</a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Abstract */}
                    {selectedSub.abstract && (
                      <div className="space-y-2">
                        <span className="text-[13px] uppercase tracking-wider text-[#8B7B68] font-bold block">Abstract</span>
                        <div className="p-4 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs text-[#5C4B3A]/90 leading-relaxed font-serif max-h-40 overflow-y-auto">
                          {selectedSub.abstract}
                        </div>
                      </div>
                    )}

                    {/* Keywords */}
                    {selectedSub.keywords && (
                      <div className="space-y-2">
                        <span className="text-[13px] uppercase tracking-wider text-[#8B7B68] font-bold block">Keywords</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedSub.keywords.split(',').map((kw, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-[#FFF2D9] border border-[#E9DFCF] text-[#A98042] text-xs font-mono">
                              {kw.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Files */}
                    <div className="space-y-2">
                      <span className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5" /> Submitted Files
                      </span>

                      {(selectedSub.file_manuscript || selectedSub.file_url) ? (
                        <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#C9A66B] shrink-0" />
                            <span className="text-[#5C4B3A] font-medium">Primary Manuscript</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument('manuscript', selectedSub.file_manuscript || selectedSub.file_url)}
                            disabled={downloadingDoc !== null}
                            className="px-3 py-1 rounded-lg bg-[#FFF2D9] text-[#C9A66B] border border-[#E9DFCF] text-[13px] font-bold flex items-center gap-1 hover:bg-[#FFF2D9] disabled:opacity-60"
                            aria-label="Download manuscript"
                          >
                            <Download className="w-3 h-3" /> {downloadingDoc === 'manuscript' ? 'Preparing…' : 'Download'}
                          </button>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] text-xs text-[#8B7B68] italic flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          No manuscript file URL available from backend.
                        </div>
                      )}

                      {selectedSub.file_supplementary && (
                        <div className="p-3 rounded-xl bg-[#FFF8EE] border border-[#E9DFCF] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#A97917] shrink-0" />
                            <span className="text-[#5C4B3A] font-medium">Supplementary File</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument('supplementary', selectedSub.file_supplementary)}
                            disabled={downloadingDoc !== null}
                            className="px-3 py-1 rounded-lg bg-[#C99A2E]/10 text-[#A97917] border border-[#C99A2E]/30 text-[13px] font-bold flex items-center gap-1 hover:bg-[#C99A2E]/20 disabled:opacity-60"
                            aria-label="Download supplementary file"
                          >
                            <Download className="w-3 h-3" /> {downloadingDoc === 'supplementary' ? 'Preparing…' : 'Download'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── EDITORIAL NOTES PANEL ────────────────────────────── */}
                    <div className="space-y-3 pt-4 border-t border-[#E9DFCF]">
                      <label
                        htmlFor="editorial-notes-textarea"
                        className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block flex items-center gap-1.5"
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Editorial Remarks & Reviewer Notes
                      </label>

                      {/* Editor — single editable field, prefilled with the saved remarks.
                          Editing the text and saving updates the same note (no separate copy). */}
                      <div className="relative">
                        <textarea
                          id="editorial-notes-textarea"
                          rows={4}
                          value={editorialNotes}
                          onChange={(e) => setEditorialNotes(e.target.value)}
                          placeholder="Enter editorial screening remarks, revision instructions, peer review comments…"
                          className="w-full bg-white border border-[#E9DFCF] rounded-xl p-3 text-xs text-[#5C4B3A] placeholder-text-muted/60 focus:outline-none focus:border-[#C9A66B] resize-none"
                          aria-label="Editorial notes editor"
                        />
                        <span className="absolute bottom-2 right-3 text-[13px] text-[#8B7B68] pointer-events-none">
                          {editorialNotes.length} chars
                        </span>
                      </div>

                      <Button
                        type="button" variant="outline" size="sm"
                        onClick={saveEditorialNotes} isLoading={savingNotes}
                        leftIcon={<Save className="w-3.5 h-3.5" />}
                        className="w-full"
                      >
                        Save Notes
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* ── Action Footer ────────────────────────────────────────── */}
              <div className="p-5 border-t border-[#E9DFCF] bg-white space-y-3 shrink-0">
                <span className="text-[13px] uppercase tracking-wider text-[#C9A66B] font-bold block">
                  Editorial Decisions
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button" disabled={updatingState}
                    onClick={() => handleDecisionClick('editorial_screening', 'Move to Editorial Screening')}
                    aria-pressed={currentDecision === 'editorial_screening'}
                    className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 focus-visible:ring-2 ${decisionButtonClass('editorial_screening', currentDecision)}`}
                    aria-label="Move to Editorial Screening"
                  >
                    <FileCheck className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Screening</span>
                  </button>

                  <button
                    type="button" disabled={updatingState}
                    onClick={() => handleDecisionClick('under_review', 'Send for Peer Review')}
                    aria-pressed={currentDecision === 'under_review'}
                    className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 focus-visible:ring-2 ${decisionButtonClass('under_review', currentDecision)}`}
                    aria-label="Send for Peer Review"
                  >
                    <Search className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Peer Review</span>
                  </button>

                  <button
                    type="button" disabled={updatingState}
                    onClick={() => handleDecisionClick('revision_required', 'Request Revision')}
                    aria-pressed={currentDecision === 'revision_required'}
                    className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 focus-visible:ring-2 ${decisionButtonClass('revision_required', currentDecision)}`}
                    aria-label="Request Revision"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Revision</span>
                  </button>

                  <button
                    type="button" disabled={updatingState}
                    onClick={() => handleDecisionClick('accepted', 'Accept Manuscript')}
                    aria-pressed={currentDecision === 'accepted'}
                    className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 focus-visible:ring-2 ${decisionButtonClass('accepted', currentDecision)}`}
                    aria-label="Accept Manuscript"
                  >
                    <Check className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Accept</span>
                  </button>

                  <button
                    type="button" disabled={updatingState}
                    onClick={() => handleDecisionClick('published', 'Publish Manuscript')}
                    aria-pressed={currentDecision === 'published'}
                    className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 focus-visible:ring-2 ${decisionButtonClass('published', currentDecision)}`}
                    aria-label="Publish Manuscript"
                  >
                    <Send className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Publish</span>
                  </button>

                  <button
                    type="button" disabled={updatingState}
                    onClick={() => handleDecisionClick('rejected', 'Reject Manuscript')}
                    aria-pressed={currentDecision === 'rejected'}
                    className={`px-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50 focus-visible:ring-2 ${decisionButtonClass('rejected', currentDecision)}`}
                    aria-label="Reject Manuscript"
                  >
                    <XCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Reject</span>
                  </button>
                </div>

                {updatingState && (
                  <p className="text-xs text-[#8B7B68] text-center animate-pulse">Updating manuscript status…</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          CONFIRMATION MODAL (Publish / Reject)
      ════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {pendingConfirmation && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/80 backdrop-blur-md z-[60]"
              aria-hidden="true"
            />
            <motion.div
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white border border-[#E9DFCF] rounded-2xl p-6 shadow-2xl z-[61] space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  pendingConfirmation.status === 'published'
                    ? 'bg-[#FFF2D9] text-[#C9A66B] border border-[#E9DFCF]'
                    : 'bg-red-500/20 text-[#DC2626] border border-red-500/30'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="confirm-title" className="text-sm font-bold text-[#5C4B3A] font-playfair">
                    Confirm: {pendingConfirmation.label}
                  </h3>
                  <p className="text-xs text-[#8B7B68] mt-0.5">
                    Mark <strong className="text-[#5C4B3A]">{selectedSub?.title?.substring(0, 40)}…</strong> as{' '}
                    <strong className="text-[#5C4B3A] capitalize">{pendingConfirmation.status}</strong>?
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#8B7B68] bg-[#FFF8EE] border border-[#E9DFCF] rounded-xl p-3">
                {pendingConfirmation.status === 'published'
                  ? 'This will mark the manuscript as officially published. The DOI and certificate will be eligible for assignment.'
                  : 'This will permanently reject the manuscript. The author will be notified.'}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setPendingConfirmation(null)} disabled={updatingState}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant={pendingConfirmation.status === 'published' ? 'gold' : 'danger'}
                  size="sm"
                  isLoading={updatingState}
                  onClick={() => executeStatusUpdate(pendingConfirmation.status)}
                >
                  Confirm Decision
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
