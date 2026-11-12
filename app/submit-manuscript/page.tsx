'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useAuth } from '@/lib/context/AuthContext';
import { PolicyAgreement } from '@/components/policies/PolicyAgreement';
import { SubmissionHero } from '@/components/publish/SubmissionHero';
import { SubmissionProgressTracker } from '@/components/publish/SubmissionProgressTracker';
import { JournalSelectorCard } from '@/components/publish/JournalSelectorCard';
import { AuthorInformationSection, CorrespondingAuthorState, CoAuthorState } from '@/components/publish/AuthorInformationSection';
import { FileUploadSection } from '@/components/publish/FileUploadSection';
import { SubmissionSuccessScreen } from '@/components/publish/SubmissionSuccessScreen';
import { submitJournalManuscript, JournalTarget, SubmissionResponseData } from '@/lib/services/submissionServices';

export default function SubmitManuscriptPage() {
  const { tokens } = useAuth();

  // Selected Journal
  const [selectedJournal, setSelectedJournal] = useState<JournalTarget | null>(null);

  // Card B: Manuscript Information
  const [manuscriptTitle, setManuscriptTitle] = useState('');
  const [runningTitle, setRunningTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [researchDomain, setResearchDomain] = useState('Computer Science & Artificial Intelligence');
  const [manuscriptType, setManuscriptType] = useState('Original Research');
  const [language, setLanguage] = useState('English');

  // Card C metadata & Card D preferences removed per simplified submission flow.

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

  // Card E: Files
  const [manuscriptFile, setManuscriptFile] = useState<File | null>(null);
  const [supplementaryFiles] = useState<File[]>([]);

  // Author agreement gate (Terms + Publication Policies, current published versions)
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<SubmissionResponseData | null>(null);

  // Handlers for Co-authors
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

  // Validation
  const isFormValid =
    Boolean(selectedJournal) &&
    manuscriptTitle.trim().length >= 5 &&
    abstract.trim().length >= 50 &&
    keywords.trim().length >= 3 &&
    correspondingAuthor.fullName.trim() !== '' &&
    correspondingAuthor.email.trim() !== '' &&
    correspondingAuthor.phone.trim() !== '' &&
    manuscriptFile !== null &&
    acceptedTerms;

  // Explicit, user-facing requirement checklist. Derived from the SAME conditions as
  // isFormValid so the two never drift. Lets the author see exactly what is still
  // missing instead of staring at a silently-disabled submit button.
  const requirementChecks: { label: string; met: boolean }[] = [
    { label: 'Select a target journal (Card A)', met: Boolean(selectedJournal) },
    { label: 'Manuscript title (at least 5 characters)', met: manuscriptTitle.trim().length >= 5 },
    { label: 'Abstract (at least 50 characters)', met: abstract.trim().length >= 50 },
    { label: 'At least one keyword', met: keywords.trim().length >= 3 },
    { label: 'Corresponding author full name', met: correspondingAuthor.fullName.trim() !== '' },
    { label: 'Corresponding author email', met: correspondingAuthor.email.trim() !== '' },
    { label: 'Corresponding author phone number', met: correspondingAuthor.phone.trim() !== '' },
    { label: 'Upload your manuscript (PDF or DOCX)', met: manuscriptFile !== null },
    { label: 'Accept the Terms & Conditions and Publication Policies', met: acceptedTerms },
  ];
  const unmetRequirements = requirementChecks.filter((r) => !r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!selectedJournal) {
      setServerError('Please select a target journal in Card A.');
      return;
    }

    if (!manuscriptFile) {
      setServerError('Primary manuscript PDF or DOCX file is required.');
      return;
    }

    if (!acceptedTerms) {
      setServerError('You must accept the terms and conditions before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const accessToken = tokens?.access || '';
      const payload = {
        manuscriptTitle,
        runningTitle,
        abstract,
        keywords,
        researchDomain,
        manuscriptType,
        language,
        journalTitle: selectedJournal.title,
        journalIssn: selectedJournal.issn,
        authorInfo: {
          corresponding: correspondingAuthor,
          coAuthors,
        },
        agreedToTerms: acceptedTerms,
        agreedToPublicationPolicies: acceptedTerms,
      };

      const result = await submitJournalManuscript(payload, manuscriptFile, supplementaryFiles, accessToken);
      setSuccessData(result);
    } catch (err: any) {
      setServerError(err?.message || 'Journal manuscript submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
    setManuscriptTitle('');
    setAbstract('');
    setManuscriptFile(null);
    setAcceptedTerms(false);
  };

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-[#6E5238] font-manrope pt-6 pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <Breadcrumb
          items={[
            { label: 'Publishing Services', href: '/services' },
            { label: 'Journal Manuscript Submission' },
          ]}
        />

        <SubmissionHero mode="journal" />

        {!successData ? (
          <form onSubmit={handleSubmit} className="space-y-12">
            <SubmissionProgressTracker currentStep={selectedJournal ? 2 : 1} />

            {serverError && (
              <div className="p-4 rounded-2xl bg-[#C53030]/10 border border-[#C53030]/30 flex items-center justify-between text-xs text-[#C53030] font-semibold">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{serverError}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setServerError(null)}>
                  Dismiss
                </Button>
              </div>
            )}

            {/* CARD A & CARD C: JOURNAL SELECTOR */}
            <JournalSelectorCard selectedJournal={selectedJournal} onSelectJournal={setSelectedJournal} />

            {/* CARD B: MANUSCRIPT INFORMATION */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
              <div className="border-b border-[#E2C999] pb-3">
                <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block mb-1">
                  Card B — Manuscript Information
                </span>
                <h3 className="text-xl font-bold font-playfair text-[#5C4033] flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#C99A2E]" />
                  Manuscript Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Manuscript Title <span className="text-[#C53030]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={manuscriptTitle}
                    onChange={(e) => setManuscriptTitle(e.target.value)}
                    placeholder="Full manuscript title"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#5C4033] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">Short Title (Optional)</label>
                  <input
                    type="text"
                    value={runningTitle}
                    onChange={(e) => setRunningTitle(e.target.value)}
                    placeholder="A brief title shown on published page headers (max 50 chars)"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Manuscript Type <span className="text-[#C53030]">*</span>
                  </label>
                  <select
                    value={manuscriptType}
                    onChange={(e) => setManuscriptType(e.target.value)}
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  >
                    <option value="Original Research">Original Research Paper</option>
                    <option value="Review Article">Comprehensive Review Article</option>
                    <option value="Survey Paper">Survey Paper</option>
                    <option value="Short Communication">Short Communication</option>
                    <option value="Technical Note">Technical Note</option>
                    <option value="Case Study">Case Study</option>
                    <option value="Editorial">Editorial</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Abstract <span className="text-[#C53030]">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={abstract}
                    onChange={(e) => setAbstract(e.target.value)}
                    placeholder="Structured or unstructured abstract (150-250 words)..."
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl p-4 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Keywords <span className="text-[#C53030]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="e.g. Deep Learning, Image Segmentation, Bio-informatics"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Research Domain <span className="text-[#C53030]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={researchDomain}
                    onChange={(e) => setResearchDomain(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* AUTHOR INFORMATION */}
            <AuthorInformationSection
              correspondingAuthor={correspondingAuthor}
              onUpdateCorrespondingAuthor={setCorrespondingAuthor}
              coAuthors={coAuthors}
              onAddCoAuthor={handleAddCoAuthor}
              onRemoveCoAuthor={handleRemoveCoAuthor}
              onUpdateCoAuthor={handleUpdateCoAuthor}
            />

            {/* CARD E: FILE UPLOADS */}
            <FileUploadSection
              primaryFile={manuscriptFile}
              onSelectPrimaryFile={setManuscriptFile}
              supplementaryFiles={[]}
              onAddSupplementaryFile={() => {}}
              onRemoveSupplementaryFile={() => {}}
            />

            {/* AUTHOR AGREEMENT — Terms & Conditions + Publication Policies */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft">
              <PolicyAgreement checked={acceptedTerms} onChange={setAcceptedTerms} />
            </div>

            {/* REQUIREMENT CHECKLIST + SUBMIT BUTTON */}
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
                          req.met ? 'text-[#2F855A] line-through decoration-[#2F855A]/40' : 'text-[#C53030]'
                        }`}
                      >
                        <span
                          className={`inline-flex w-4 h-4 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                            req.met ? 'bg-[#2F855A] text-white' : 'bg-[#C53030]/15 text-[#C53030] border border-[#C53030]/40'
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
                  disabled={!isFormValid || isSubmitting}
                  isLoading={isSubmitting}
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                >
                  {isSubmitting ? 'Submitting Manuscript...' : 'Submit Journal Manuscript'}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <SubmissionSuccessScreen data={successData} onReset={handleReset} />
        )}
      </div>
    </main>
  );
}
