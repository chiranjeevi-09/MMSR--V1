'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BookMarked, FileText, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { useAuth } from '@/lib/context/AuthContext';
import { PolicyAgreement } from '@/components/policies/PolicyAgreement';
import { SubmissionHero } from '@/components/publish/SubmissionHero';
import { SubmissionProgressTracker } from '@/components/publish/SubmissionProgressTracker';
import { BookVolumeSelectorCard } from '@/components/publish/BookVolumeSelectorCard';
import { AuthorInformationSection, CorrespondingAuthorState, CoAuthorState } from '@/components/publish/AuthorInformationSection';
import { FileUploadSection } from '@/components/publish/FileUploadSection';
import { SubmissionSuccessScreen } from '@/components/publish/SubmissionSuccessScreen';
import { submitBookChapter, BookVolumeTarget, SubmissionResponseData } from '@/lib/services/submissionServices';

export default function PublishChapterPage() {
  const { tokens } = useAuth();

  // Selected Volume
  const [selectedVolume, setSelectedVolume] = useState<BookVolumeTarget | null>(null);

  // Card B: Chapter Information
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterSubtitle, setChapterSubtitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [researchDomain, setResearchDomain] = useState('Computer Science & Engineering');
  const [chapterLanguage, setChapterLanguage] = useState('English');
  const [estimatedPages, setEstimatedPages] = useState('15-25 Pages');
  const [acknowledgements, setAcknowledgements] = useState('');
  const [aiDisclosure, setAiDisclosure] = useState('No AI tools were used in writing or data generation.');
  const [conflictOfInterest, setConflictOfInterest] = useState('No conflict of interest');

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
  const [supplementaryFiles, setSupplementaryFiles] = useState<File[]>([]);
  const [additionalUploads, setAdditionalUploads] = useState<Record<string, File | null>>({});

  // Author agreement gate (Terms + Publication Policies, current published versions)
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);

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
    Boolean(selectedVolume) &&
    chapterTitle.trim().length >= 5 &&
    abstract.trim().length >= 50 &&
    keywords.trim().length >= 3 &&
    correspondingAuthor.fullName.trim() !== '' &&
    correspondingAuthor.email.trim() !== '' &&
    correspondingAuthor.phone.trim() !== '' &&
    manuscriptFile !== null &&
    agreedToPolicies;

  // Explicit, user-facing requirement checklist. Derived from the SAME conditions as
  // isFormValid so the two never drift. Lets the author see exactly what is still
  // missing instead of staring at a silently-disabled submit button.
  const requirementChecks: { label: string; met: boolean }[] = [
    { label: 'Select a target book volume (Card A)', met: Boolean(selectedVolume) },
    { label: 'Chapter title (at least 5 characters)', met: chapterTitle.trim().length >= 5 },
    { label: 'Abstract (at least 50 characters)', met: abstract.trim().length >= 50 },
    { label: 'At least one keyword', met: keywords.trim().length >= 3 },
    { label: 'Corresponding author full name', met: correspondingAuthor.fullName.trim() !== '' },
    { label: 'Corresponding author email', met: correspondingAuthor.email.trim() !== '' },
    { label: 'Corresponding author phone number', met: correspondingAuthor.phone.trim() !== '' },
    { label: 'Upload your chapter manuscript (PDF or DOCX)', met: manuscriptFile !== null },
    { label: 'Accept the Terms & Conditions and Publication Policies', met: agreedToPolicies },
  ];
  const unmetRequirements = requirementChecks.filter((r) => !r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!selectedVolume) {
      setServerError('Please select a target book volume in Card A before submitting.');
      return;
    }

    if (!manuscriptFile) {
      setServerError('Primary chapter manuscript file (PDF/DOCX) is required.');
      return;
    }

    if (!agreedToPolicies) {
      setServerError('You must read and accept the Terms & Conditions and Publication Policies & Ethics before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const accessToken = tokens?.access || '';
      const payload = {
        chapterTitle,
        chapterSubtitle,
        abstract,
        keywords,
        researchDomain,
        chapterLanguage,
        volumeTitle: selectedVolume.title,
        volumeId: selectedVolume.id,
        volumeIsbn: selectedVolume.isbn,
        estimatedPages,
        authorInfo: {
          corresponding: correspondingAuthor,
          coAuthors,
        },
        agreedToTerms: agreedToPolicies,
        agreedToPublicationPolicies: agreedToPolicies,
      };

      const result = await submitBookChapter(payload, manuscriptFile, supplementaryFiles, accessToken);
      setSuccessData(result);
    } catch (err: any) {
      setServerError(err?.message || 'Book chapter submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessData(null);
    setChapterTitle('');
    setAbstract('');
    setManuscriptFile(null);
    setSupplementaryFiles([]);
    setAgreedToPolicies(false);
  };

  return (
    <main className="min-h-screen bg-[#F8EEDC] text-[#6E5238] font-manrope pt-6 pb-24">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <Breadcrumb
          items={[
            { label: 'Publishing Services', href: '/services' },
            { label: 'Book Chapter Submission' },
          ]}
        />

        <SubmissionHero mode="chapter" />

        {!successData ? (
          <form onSubmit={handleSubmit} className="space-y-12">
            <SubmissionProgressTracker currentStep={selectedVolume ? 2 : 1} />

            {/* Error Banner */}
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

            {/* CARD A & CARD C: BOOK VOLUME SELECTOR */}
            <BookVolumeSelectorCard selectedVolume={selectedVolume} onSelectVolume={setSelectedVolume} />

            {/* CARD B: BOOK CHAPTER INFORMATION */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
              <div className="border-b border-[#E2C999] pb-3">
                <span className="text-[13px] font-extrabold uppercase tracking-widest text-[#8C6239] block mb-1">
                  Card B — Chapter Details
                </span>
                <h3 className="text-xl font-bold font-playfair text-[#5C4033] flex items-center gap-2">
                  <BookMarked className="w-5 h-5 text-[#C99A2E]" />
                  Book Chapter Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Chapter Title <span className="text-[#C53030]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={chapterTitle}
                    onChange={(e) => setChapterTitle(e.target.value)}
                    placeholder="Full academic title of your book chapter"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2.5 text-sm font-semibold text-[#5C4033] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">Chapter Subtitle</label>
                  <input
                    type="text"
                    value={chapterSubtitle}
                    onChange={(e) => setChapterSubtitle(e.target.value)}
                    placeholder="Secondary title or sub-theme"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Chapter Abstract <span className="text-[#C53030]">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={abstract}
                    onChange={(e) => setAbstract(e.target.value)}
                    placeholder="Comprehensive abstract outlining research scope, methodologies, findings, and conclusions (150-300 words)..."
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl p-4 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">
                    Keywords (Comma Separated) <span className="text-[#C53030]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    placeholder="e.g. Artificial Intelligence, Neural Networks, Machine Learning"
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
                    placeholder="e.g. Computer Science & AI"
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">Chapter Language</label>
                  <select
                    value={chapterLanguage}
                    onChange={(e) => setChapterLanguage(e.target.value)}
                    className="w-full bg-[#F8EEDC] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                  >
                    <option value="English">English</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Spanish">Spanish</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#5C4033] mb-1">Estimated Pages</label>
                  <input
                    type="text"
                    value={estimatedPages}
                    onChange={(e) => setEstimatedPages(e.target.value)}
                    placeholder="15-25 Pages"
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

            {/* CARD E: FILE UPLOAD SYSTEM */}
            <FileUploadSection
              primaryFile={manuscriptFile}
              onSelectPrimaryFile={setManuscriptFile}
              supplementaryFiles={supplementaryFiles}
              onAddSupplementaryFile={(files) => setSupplementaryFiles((prev) => [...prev, ...files])}
              onRemoveSupplementaryFile={(idx) => setSupplementaryFiles((prev) => prev.filter((_, i) => i !== idx))}
              additionalUploads={additionalUploads}
              onSelectAdditionalUpload={(key, file) => setAdditionalUploads((prev) => ({ ...prev, [key]: file }))}
            />

            {/* AUTHOR AGREEMENT — Terms & Conditions + Publication Policies */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft">
              <PolicyAgreement checked={agreedToPolicies} onChange={setAgreedToPolicies} id="chapter-policy-agreement" />
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
                  {isSubmitting ? 'Submitting Chapter...' : 'Submit Book Chapter Manuscript'}
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
