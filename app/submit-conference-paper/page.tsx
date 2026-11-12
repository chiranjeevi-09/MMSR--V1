'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { Calendar, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useAuth } from '@/lib/context/AuthContext';
import { SubmissionHero } from '@/components/publish/SubmissionHero';
import { SubmissionProgressTracker } from '@/components/publish/SubmissionProgressTracker';
import { ConferenceSelectorCard } from '@/components/publish/ConferenceSelectorCard';
import { AuthorInformationSection, CorrespondingAuthorState, CoAuthorState } from '@/components/publish/AuthorInformationSection';
import { FileUploadSection } from '@/components/publish/FileUploadSection';
import { SubmissionSuccessScreen } from '@/components/publish/SubmissionSuccessScreen';
import { ReviewSubmissionPanel } from '@/components/publish/ReviewSubmissionPanel';
import { submitConferencePaper, payConferenceSubmission, simulateConferencePayment, deleteConferenceSubmission, downloadConferenceInvoice, ConferenceTarget, SubmissionResponseData } from '@/lib/services/submissionServices';

export default function SubmitConferencePaperPage() {
  const { tokens, refreshAccessToken } = useAuth();

  // Selected Conference
  const [selectedConference, setSelectedConference] = useState<ConferenceTarget | null>(null);

  // Conference presentation defaults (auto-sent with the submission)
  const [presentationMode] = useState('Oral');
  const [researchTrack, setResearchTrack] = useState('Track 1: Computer Science & Intelligent Systems');
  const [sessionPreference] = useState('Morning Technical Session');

  // Paper Details
  const [paperTitle, setPaperTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [researchDomain, setResearchDomain] = useState('Computer Science');
  const [language, setLanguage] = useState('English');

  // Author Information
  const [correspondingAuthor, setCorrespondingAuthor] = useState<CorrespondingAuthorState>({
    fullName: '',
    email: '',
    phone: '',
    designation: 'Assistant Professor',
    institution: '',
    department: '',
    university: '',
    city: '',
    state: '',
    country: 'India',
    postalCode: '',
    googleScholar: '',
    researchGate: '',
    linkedIn: '',
  });

  const [coAuthors, setCoAuthors] = useState<CoAuthorState[]>([]);

  // Files
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [supplementaryFiles] = useState<File[]>([]);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SubmissionResponseData | null>(null);

  // Payment-flow state (paid conferences)
  const [paidInvoiceId, setPaidInvoiceId] = useState<string | number | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const pendingSubmissionRef = useRef<string | number | null>(null);
  const pendingResultRef = useRef<SubmissionResponseData | null>(null);

  // Review-before-submit flow (TASK 2) + stable idempotency key for this form session
  const [phase, setPhase] = useState<'edit' | 'review'>('edit');
  const clientReferenceRef = useRef<string>(
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `CR-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const handleAddCoAuthor = () => {
    setCoAuthors((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        fullName: '',
        email: '',
        designation: 'Research Scholar',
        institution: '',
        department: '',
        country: 'India',
        googleScholar: '',
        isCorresponding: false,
      },
    ]);
  };

  const handleRemoveCoAuthor = (id: string) => {
    setCoAuthors((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateCoAuthor = (id: string, updated: Partial<CoAuthorState>) => {
    setCoAuthors((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
  };

  const isFormValid =
    Boolean(selectedConference) &&
    paperTitle.trim().length >= 5 &&
    abstract.trim().length >= 50 &&
    keywords.trim().length >= 3 &&
    correspondingAuthor.fullName.trim() !== '' &&
    correspondingAuthor.email.trim() !== '' &&
    correspondingAuthor.phone.trim() !== '' &&
    paperFile !== null;

  // Explicit, user-facing requirement checklist. Derived from the SAME conditions as
  // isFormValid so the two never drift. Lets the author see exactly what is still
  // missing instead of staring at a silently-disabled submit button.
  const requirementChecks: { label: string; met: boolean }[] = [
    { label: 'Select a target conference (Step 1)', met: Boolean(selectedConference) },
    { label: 'Paper title (at least 5 characters)', met: paperTitle.trim().length >= 5 },
    { label: 'Abstract (at least 50 characters)', met: abstract.trim().length >= 50 },
    { label: 'At least one keyword', met: keywords.trim().length >= 3 },
    { label: 'Corresponding author full name', met: correspondingAuthor.fullName.trim() !== '' },
    { label: 'Corresponding author email', met: correspondingAuthor.email.trim() !== '' },
    { label: 'Corresponding author phone number', met: correspondingAuthor.phone.trim() !== '' },
    { label: 'Upload your full paper (PDF or DOCX)', met: paperFile !== null },
  ];
  const unmetRequirements = requirementChecks.filter((r) => !r.met);

  const validateForm = (): string | null => {
    if (!selectedConference) return 'Please select a target conference first.';
    if (paperTitle.trim().length < 5) return 'Paper title must be at least 5 characters.';
    if (abstract.trim().length < 50) return 'Abstract must be at least 50 characters.';
    if (keywords.trim().length < 3) return 'Please provide at least one keyword.';
    if (!correspondingAuthor.fullName.trim()) return 'Corresponding author full name is required.';
    if (!correspondingAuthor.email.trim()) return 'Corresponding author email is required.';
    if (!correspondingAuthor.phone.trim()) return 'Corresponding author phone number is required.';
    if (!paperFile) return 'Please upload your full paper (PDF or DOCX).';
    return null;
  };

  const buildPayload = (): Record<string, any> => ({
    conferenceId: selectedConference?.id,
    conferenceTitle: selectedConference?.title,
    conferenceAcronym: selectedConference?.acronym,
    clientReference: clientReferenceRef.current,
    paperTitle,
    subtitle,
    abstract,
    keywords,
    researchDomain,
    language,
    selectedTrack: researchTrack,
    presentationMode,
    sessionPreference,
    authorInfo: {
      corresponding: correspondingAuthor,
      coAuthors,
    },
  });

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) {
      setServerError(err);
      return;
    }
    setServerError(null);
    setPhase('review');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const doSubmit = async () => {
    const err = validateForm();
    if (err) {
      setServerError(err);
      setPhase('edit');
      return;
    }
    if (!paperFile) return;
    setIsSubmitting(true);
    setServerError(null);
    setShowSimulate(false);
    try {
      // Obtain a fresh access token: the JWT can expire while the author spends
      // time filling this long form, which would otherwise 401 the create call and
      // (previously) silently bounce the user back to the edit form.
      const fresh = await refreshAccessToken();
      const accessToken = fresh || tokens?.access || '';
      const result = await submitConferencePaper(buildPayload(), paperFile, supplementaryFiles, accessToken);
      const raw = (result.extraDetails || {}) as Record<string, any>;
      const needsPayment = raw.status === 'pending_payment' || (raw.submission_fee != null && Number(raw.submission_fee) > 0);

      if (!needsPayment) {
        // Free conference — direct success
        setPaidInvoiceId(null);
        setSuccessData(result);
        return;
      }

      // Paid conference: run the Razorpay leg against the just-created record
      const submissionId = result.id;
      pendingSubmissionRef.current = submissionId;
      pendingResultRef.current = result;
      const prefill = {
        name: correspondingAuthor.fullName,
        email: correspondingAuthor.email,
        phone: correspondingAuthor.phone,
        title: paperTitle,
        conferenceTitle: selectedConference?.title || result.targetName || '',
      };
      try {
        await payConferenceSubmission(submissionId, accessToken, prefill);
        finalizePaidResult(result);
      } catch (payErr: any) {
        await handlePaymentFailure(submissionId, payErr?.message || '', accessToken);
      }
    } catch (error: any) {
      // Submission creation failed (e.g. server validation / auth). Stay on the
      // review panel with a clear message instead of dumping the author back to the
      // form — this is the "returned to the previous page" behavior we must avoid.
      setServerError(error?.message || 'Conference paper submission failed. Please review the details and try again.');
      setPhase('review');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark a paid submission as successfully submitted + enable invoice download
  const finalizePaidResult = (result: SubmissionResponseData) => {
    setPaidInvoiceId(result.id);
    setSuccessData({ ...result, status: 'Submitted' });
    pendingSubmissionRef.current = null;
    pendingResultRef.current = null;
    setShowSimulate(false);
  };

  const discardSubmission = async (submissionId: string | number, accessToken?: string) => {
    try {
      await deleteConferenceSubmission(submissionId, accessToken || tokens?.access || '');
    } catch {
      /* best-effort discard */
    }
    pendingSubmissionRef.current = null;
    pendingResultRef.current = null;
  };

  const isDevLocalhost = () => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    try {
      const host = new URL(apiBase).hostname;
      return host === 'localhost' || host === '127.0.0.1' || host === '::1';
    } catch {
      return false;
    }
  };

  const handlePaymentFailure = async (submissionId: string | number, message: string, accessToken?: string) => {
    // User dismissed the checkout window → discard per product decision
    if (message === 'PAYMENT_CANCELLED') {
      await discardSubmission(submissionId, accessToken);
      setServerError('Payment was cancelled, so your paper was not submitted. Please review and try again.');
      setPhase('review');
      return;
    }
    // Dev convenience: gateway unavailable on localhost → keep the pending record so the
    // visible "Simulate test payment" fallback can complete it.
    if (isDevLocalhost() && /not configured|not be configured|Authentication failed|test keys|widget|not found/i.test(message)) {
      setShowSimulate(true);
      setServerError('Payment gateway is unavailable in this environment. Use “Simulate test payment” to continue (development only).');
      setPhase('review');
      return;
    }
    // Any other gateway/verify failure → discard
    await discardSubmission(submissionId, accessToken);
    setServerError(`Payment failed: ${message || 'Please try again.'}`);
    setPhase('review');
  };

  const handleSimulate = async () => {
    const submissionId = pendingSubmissionRef.current;
    const baseResult = pendingResultRef.current;
    if (!submissionId || !baseResult) return;
    setIsSubmitting(true);
    setServerError(null);
    try {
      const fresh = await refreshAccessToken();
      const accessToken = fresh || tokens?.access || '';
      await simulateConferencePayment(submissionId, accessToken);
      finalizePaidResult(baseResult);
    } catch (simErr: any) {
      await discardSubmission(submissionId);
      pendingResultRef.current = null;
      setServerError(simErr?.message || 'Simulated payment failed. Please try again.');
      setShowSimulate(false);
      setPhase('review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!paidInvoiceId) return;
    setInvoiceBusy(true);
    try {
      await downloadConferenceInvoice(paidInvoiceId, tokens?.access || '');
    } catch (e: any) {
      setServerError(e?.message || 'Invoice download failed.');
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
    setPaidInvoiceId(null);
    setShowSimulate(false);
    pendingSubmissionRef.current = null;
    pendingResultRef.current = null;
    setPhase('edit');
    setPaperTitle('');
    setAbstract('');
    setPaperFile(null);
    clientReferenceRef.current =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `CR-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-[#6E5238] font-manrope pt-6 pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <Breadcrumb
          items={[
            { label: 'Publishing Services', href: '/services' },
            { label: 'Conference Paper Submission' },
          ]}
        />

        <SubmissionHero mode="conference" />

        {successData ? (
          <SubmissionSuccessScreen
            data={successData}
            onReset={handleReset}
            onDownloadInvoice={paidInvoiceId ? handleDownloadInvoice : undefined}
            invoiceBusy={invoiceBusy}
          />
        ) : phase === 'review' ? (
          <ReviewSubmissionPanel
            data={buildPayload()}
            paperFileName={paperFile?.name ?? null}
            serverError={serverError}
            isSubmitting={isSubmitting}
            submissionFee={Number(selectedConference?.submissionFee || 0)}
            showSimulateFallback={showSimulate}
            onBackToEdit={() => setPhase('edit')}
            onConfirm={doSubmit}
            onSimulate={handleSimulate}
          />
        ) : (
          <form onSubmit={handleProceedToReview} className="space-y-12">
            <SubmissionProgressTracker currentStep={selectedConference ? 2 : 1} />

            {serverError && (
              <div className="p-4 rounded-2xl bg-ruby-red/10 border border-ruby-red/30 flex items-center justify-between text-xs text-ruby-red font-semibold">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{serverError}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setServerError(null)}>
                  Dismiss
                </Button>
              </div>
            )}

            {/* TARGET CONFERENCE SELECTION */}
            <ConferenceSelectorCard
              selectedConference={selectedConference}
              onSelectConference={(conf) => {
                setSelectedConference(conf);
                if (conf.tracks && conf.tracks.length > 0) {
                  setResearchTrack(conf.tracks[0].title);
                }
              }}
            />

            {/* PAPER DETAILS */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
              <div className="border-b border-[#E2C999] pb-3">
                <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block mb-1">
                  Step 2 — Paper Details
                </span>
                <h3 className="text-xl font-bold font-playfair text-[#5C4033] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#C99A2E]" />
                  Conference Paper Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="paper-title" className="block text-xs font-bold text-[#5C4033] mb-1">
                    Paper Title <span className="text-ruby-red">*</span>
                  </label>
                  <input
                    id="paper-title"
                    type="text"
                    required
                    value={paperTitle}
                    onChange={(e) => setPaperTitle(e.target.value)}
                    placeholder="Full title of your conference paper"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#5C4033] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="paper-subtitle" className="block text-xs font-bold text-[#5C4033] mb-1">Subtitle</label>
                  <input
                    id="paper-subtitle"
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Secondary subtitle if applicable"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="paper-abstract" className="block text-xs font-bold text-[#5C4033] mb-1">
                    Abstract <span className="text-ruby-red">*</span>
                  </label>
                  <textarea
                    id="paper-abstract"
                    required
                    rows={4}
                    value={abstract}
                    onChange={(e) => setAbstract(e.target.value)}
                    placeholder="Conference paper abstract (150-250 words)..."
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl p-4 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="paper-keywords" className="block text-xs font-bold text-[#5C4033] mb-1">
                    Keywords <span className="text-ruby-red">*</span>
                  </label>
                  <input
                    id="paper-keywords"
                    type="text"
                    required
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="e.g. AI, Neural Networks, Edge Computing"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                {selectedConference?.tracks && selectedConference.tracks.length > 0 && (
                  <div>
                    <label htmlFor="research-track" className="block text-xs font-bold text-[#5C4033] mb-1">
                      Conference Track <span className="text-ruby-red">*</span>
                    </label>
                    <select
                      id="research-track"
                      aria-label="Conference Track"
                      value={researchTrack}
                      onChange={(e) => setResearchTrack(e.target.value)}
                      className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                    >
                      {selectedConference.tracks.map((t) => (
                        <option key={t.id} value={t.title}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* APPLICANT & CO-AUTHOR INFORMATION */}
            <AuthorInformationSection
              correspondingAuthor={correspondingAuthor}
              onUpdateCorrespondingAuthor={setCorrespondingAuthor}
              coAuthors={coAuthors}
              onAddCoAuthor={handleAddCoAuthor}
              onRemoveCoAuthor={handleRemoveCoAuthor}
              onUpdateCoAuthor={handleUpdateCoAuthor}
              isConference
            />

            {/* FULL PAPER UPLOAD */}
            <FileUploadSection
              primaryFile={paperFile}
              onSelectPrimaryFile={setPaperFile}
              supplementaryFiles={supplementaryFiles}
              onAddSupplementaryFile={() => {}}
              onRemoveSupplementaryFile={() => {}}
              isConference
            />

            {/* SUBMIT BUTTON + REQUIREMENT CHECKLIST */}
            <div className="pt-4 space-y-4">
              {unmetRequirements.length > 0 && (
                <div className="rounded-2xl bg-[#FFF9F1] border border-[#E2C999] p-4 sm:p-5">
                  <p className="text-xs font-bold text-[#8C6239] mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    Please complete the following before continuing:
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    {requirementChecks.map((req) => (
                      <li
                        key={req.label}
                        className={`flex items-center gap-2 text-xs font-semibold ${
                          req.met ? 'text-[#2F855A] line-through decoration-[#2F855A]/40' : 'text-ruby-red'
                        }`}
                      >
                        <span
                          className={`inline-flex w-4 h-4 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                            req.met ? 'bg-[#2F855A] text-white' : 'bg-ruby-red/15 text-ruby-red border border-ruby-red/40'
                          }`}
                        >
                          {req.met ? '✓' : '!'}
                        </span>
                        {req.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="gold"
                  size="xl"
                  disabled={!isFormValid}
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                >
                  Review Submission
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
