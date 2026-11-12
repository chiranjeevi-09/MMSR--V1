'use client';

import React from 'react';
import { User, Plus, Trash2, Mail, Phone, Building2, MapPin, Globe, Award, ShieldCheck, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { lettersOnly } from '@/lib/validation';

export interface CorrespondingAuthorState {
  fullName: string;
  email: string;
  phone: string;
  designation: string;
  institution: string;
  department: string;
  university: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  googleScholar: string;
  researchGate: string;
  linkedIn: string;
}

export interface CoAuthorState {
  id: string;
  fullName: string;
  email: string;
  designation: string;
  institution: string;
  department: string;
  country: string;
  googleScholar: string;
  isCorresponding: boolean;
}

interface AuthorInformationSectionProps {
  correspondingAuthor: CorrespondingAuthorState;
  onUpdateCorrespondingAuthor: (updated: CorrespondingAuthorState) => void;
  coAuthors: CoAuthorState[];
  onAddCoAuthor: () => void;
  onRemoveCoAuthor: (id: string) => void;
  onUpdateCoAuthor: (id: string, updated: Partial<CoAuthorState>) => void;
  errors?: Record<string, string>;
  /** Conference mode: applicant-focused wording, academic profile fields hidden. */
  isConference?: boolean;
}

export const DESIGNATION_OPTIONS = [
  'UG Student',
  'PG Student',
  'Research Scholar',
  'Assistant Professor',
  'Associate Professor',
  'Professor',
  'Industry Professional',
  'Scientist',
  'Independent Researcher',
];

export const COUNTRY_OPTIONS = [
  'India',
  'United States',
  'United Kingdom',
  'Canada',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'China',
  'Brazil',
  'South Africa',
  'Saudi Arabia',
  'United Arab Emirates',
  'Singapore',
  'Malaysia',
  'Other / International',
];

export function AuthorInformationSection({
  correspondingAuthor,
  onUpdateCorrespondingAuthor,
  coAuthors,
  onAddCoAuthor,
  onRemoveCoAuthor,
  onUpdateCoAuthor,
  errors = {},
  isConference = false,
}: AuthorInformationSectionProps) {
  const handleChangeCorresponding = (field: keyof CorrespondingAuthorState, value: string) => {
    onUpdateCorrespondingAuthor({
      ...correspondingAuthor,
      [field]: value,
    });
  };

  return (
    <div className="space-y-8">
      {/* ── 1. CORRESPONDING AUTHOR (REQUIRED) ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
        <div className="border-b border-[#E2C999] pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C99A2E]/15 border border-[#C99A2E]/40 flex items-center justify-center text-[#8C6239]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-playfair text-[#5C4033]">
                {isConference
                  ? 'Applicant / Corresponding Author Information '
                  : 'Corresponding Author Information '}
                <span className="text-ruby-red">*</span>
              </h3>
              <p className="text-xs text-[#6E5238]">
                {isConference
                  ? 'Details of the person submitting this paper. Students, teachers, researchers, and industry professionals are all welcome to apply — the primary contact for review updates and conference communications.'
                  : 'Primary contact author responsible for editorial communications, proof corrections, and publication notifications.'}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-[13px] font-extrabold uppercase tracking-wider bg-[#8C6239] text-white">
            Required
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Full Name */}
          <div>
            <label htmlFor="corresponding-fullname" className="block text-xs font-bold text-[#5C4033] mb-1">
              Full Name <span className="text-ruby-red">*</span>
            </label>
            <input
              id="corresponding-fullname"
              type="text"
              required
              value={correspondingAuthor.fullName}
              onChange={(e) => handleChangeCorresponding('fullName', lettersOnly(e.target.value))}
              placeholder="Dr. John Doe"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
            {errors['authorInfo.fullName'] && (
              <p className="text-xs text-ruby-red mt-1">{errors['authorInfo.fullName']}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="corresponding-email" className="block text-xs font-bold text-[#5C4033] mb-1">
              Email Address <span className="text-ruby-red">*</span>
            </label>
            <input
              id="corresponding-email"
              type="email"
              required
              value={correspondingAuthor.email}
              onChange={(e) => handleChangeCorresponding('email', e.target.value)}
              placeholder="author@university.edu"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
            {errors['authorInfo.email'] && (
              <p className="text-xs text-ruby-red mt-1">{errors['authorInfo.email']}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="corresponding-phone" className="block text-xs font-bold text-[#5C4033] mb-1">
              Phone Number <span className="text-ruby-red">*</span>
            </label>
            <input
              id="corresponding-phone"
              type="tel"
              required
              inputMode="tel"
              maxLength={17}
              aria-invalid={Boolean(errors['authorInfo.phone'])}
              value={correspondingAuthor.phone}
              // Identifiers keep their written form here (international authors
              // are supported), so only reject letters/obvious junk symbols at
              // entry; the backend serializer enforces the authoritative rule.
              onChange={(e) => handleChangeCorresponding('phone', e.target.value.replace(/[^\d+\-()\s]/g, ''))}
              placeholder="+91 98765 43210"
              className={`w-full bg-[#F8EEDC] border ${
                errors['authorInfo.phone'] ? 'border-ruby-red' : 'border-[#E2C999] focus:border-[#C99A2E]'
              } rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all`}
            />
            {errors['authorInfo.phone'] && (
              <p className="text-xs text-ruby-red mt-1">{errors['authorInfo.phone']}</p>
            )}
          </div>

          {/* Designation */}
          <div>
            <label htmlFor="corresponding-designation" className="block text-xs font-bold text-[#5C4033] mb-1">
              Designation <span className="text-ruby-red">*</span>
            </label>
            <select
              id="corresponding-designation"
              aria-label="Designation"
              value={correspondingAuthor.designation}
              onChange={(e) => handleChangeCorresponding('designation', e.target.value)}
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] outline-none transition-all"
            >
              <option value="">Select Designation</option>
              {DESIGNATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Institution / Organization */}
          <div>
            <label htmlFor="corresponding-institution" className="block text-xs font-bold text-[#5C4033] mb-1">
              Institution / Organization <span className="text-ruby-red">*</span>
            </label>
            <input
              id="corresponding-institution"
              type="text"
              required
              value={correspondingAuthor.institution}
              onChange={(e) => handleChangeCorresponding('institution', e.target.value)}
              placeholder="e.g., IIT Madras / Stanford University"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
          </div>

          {/* Department */}
          <div>
            <label htmlFor="corresponding-department" className="block text-xs font-bold text-[#5C4033] mb-1">
              Department <span className="text-ruby-red">*</span>
            </label>
            <input
              id="corresponding-department"
              type="text"
              required
              value={correspondingAuthor.department}
              onChange={(e) => handleChangeCorresponding('department', e.target.value)}
              placeholder="Dept of Computer Science"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
          </div>

          {/* University / Organization */}
          {!isConference && (
          <div>
            <label className="block text-xs font-bold text-[#5C4033] mb-1">
              University / Organization <span className="text-ruby-red">*</span>
            </label>
            <input
              type="text"
              required
              value={correspondingAuthor.university}
              onChange={(e) => handleChangeCorresponding('university', e.target.value)}
              placeholder="Full University Name"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
          </div>
          )}

          {/* City */}
          <div>
            <label htmlFor="corresponding-city" className="block text-xs font-bold text-[#5C4033] mb-1">
              City <span className="text-ruby-red">*</span>
            </label>
            <input
              id="corresponding-city"
              type="text"
              required
              value={correspondingAuthor.city}
              onChange={(e) => handleChangeCorresponding('city', lettersOnly(e.target.value))}
              placeholder="e.g., Chennai"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
          </div>

          {/* State */}
          <div>
            <label htmlFor="corresponding-state" className="block text-xs font-bold text-[#5C4033] mb-1">
              State / Province <span className="text-ruby-red">*</span>
            </label>
            <input
              id="corresponding-state"
              type="text"
              required
              value={correspondingAuthor.state}
              onChange={(e) => handleChangeCorresponding('state', lettersOnly(e.target.value))}
              placeholder="e.g., Tamil Nadu"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
          </div>

          {/* Country */}
          <div>
            <label htmlFor="corresponding-country" className="block text-xs font-bold text-[#5C4033] mb-1">
              Country <span className="text-ruby-red">*</span>
            </label>
            <select
              id="corresponding-country"
              aria-label="Country"
              value={correspondingAuthor.country}
              onChange={(e) => handleChangeCorresponding('country', e.target.value)}
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] outline-none transition-all"
            >
              <option value="">Select Country</option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Postal Code */}
          <div>
            <label htmlFor="corresponding-postalcode" className="block text-xs font-bold text-[#5C4033] mb-1">Postal Code</label>
            <input
              id="corresponding-postalcode"
              type="text"
              value={correspondingAuthor.postalCode}
              onChange={(e) => handleChangeCorresponding('postalCode', e.target.value)}
              placeholder="600036"
              className="w-full bg-[#F8EEDC] border border-[#E2C999] focus:border-[#C99A2E] rounded-xl px-4 py-2.5 text-sm text-[#5C4033] placeholder-[#8A6A4A] outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── 2. DYNAMIC CO-AUTHORS SECTION ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E2C999] pb-4">
          <div>
            <h3 className="text-lg font-bold font-playfair text-[#5C4033] flex items-center gap-2">
              <User className="w-5 h-5 text-[#C99A2E]" />
              {isConference ? 'Co-Authors / Additional Contributors' : 'Co-Authors Information'}
            </h3>
            <p className="text-xs text-[#6E5238]">
              {isConference
                ? 'Add any students, teachers, researchers, or professionals who contributed to this paper, in the order they should appear in the conference proceedings.'
                : 'Add all contributing authors in the exact order they should appear in the final published manuscript/volume.'}
            </p>
          </div>

          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={onAddCoAuthor}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Co-Author
          </Button>
        </div>

        {coAuthors.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#F8EEDC]/60 border border-dashed border-[#E2C999] text-center text-xs text-[#8A6A4A]">
            No co-authors added yet. Click &quot;+ Add Co-Author&quot; above if {isConference ? 'your paper has' : 'your manuscript has'} multiple contributors.
          </div>
        ) : (
          <div className="space-y-6">
                          {coAuthors.map((author, index) => (
                <div
                  key={author.id}
                  className="p-6 rounded-2xl bg-[#F8EEDC] border border-[#E2C999] space-y-4 relative fade-in"
                >
                  <div className="flex items-center justify-between border-b border-[#E2C999] pb-3">
                    <span className="text-xs font-bold text-[#8C6239] uppercase tracking-wider">
                      Co-Author #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveCoAuthor(author.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-ruby-red hover:text-red-700 font-semibold transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-bold text-[#5C4033] mb-1">
                        Full Name <span className="text-ruby-red">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={author.fullName}
                        onChange={(e) => onUpdateCoAuthor(author.id, { fullName: lettersOnly(e.target.value) })}
                        placeholder="Co-author full name"
                        className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-[#5C4033] mb-1">
                        Email Address <span className="text-ruby-red">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={author.email}
                        onChange={(e) => onUpdateCoAuthor(author.id, { email: e.target.value })}
                        placeholder="coauthor@domain.com"
                        className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                      />
                    </div>

                    {/* Designation */}
                    <div>
                      <label htmlFor={`coauthor-${author.id}-designation`} className="block text-xs font-bold text-[#5C4033] mb-1">
                        Designation <span className="text-ruby-red">*</span>
                      </label>
                      <select
                        id={`coauthor-${author.id}-designation`}
                        aria-label="Co-Author Designation"
                        value={author.designation}
                        onChange={(e) => onUpdateCoAuthor(author.id, { designation: e.target.value })}
                        className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                      >
                        <option value="">Select Designation</option>
                        {DESIGNATION_OPTIONS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Institution */}
                    <div>
                      <label className="block text-xs font-bold text-[#5C4033] mb-1">
                        Institution <span className="text-ruby-red">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={author.institution}
                        onChange={(e) => onUpdateCoAuthor(author.id, { institution: e.target.value })}
                        placeholder="University / Organization"
                        className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                      />
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-xs font-bold text-[#5C4033] mb-1">
                        Department <span className="text-ruby-red">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={author.department}
                        onChange={(e) => onUpdateCoAuthor(author.id, { department: e.target.value })}
                        placeholder="Department name"
                        className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                      />
                    </div>

                    {/* Country */}
                    <div>
                      <label htmlFor={`coauthor-${author.id}-country`} className="block text-xs font-bold text-[#5C4033] mb-1">
                        Country <span className="text-ruby-red">*</span>
                      </label>
                      <select
                        id={`coauthor-${author.id}-country`}
                        aria-label="Co-Author Country"
                        value={author.country}
                        onChange={(e) => onUpdateCoAuthor(author.id, { country: e.target.value })}
                        className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                      >
                        <option value="">Select Country</option>
                        {COUNTRY_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Scholar URL */}
                    {!isConference && (
                    <div>
                      <label className="block text-xs font-bold text-[#5C4033] mb-1">Google Scholar URL</label>
                      <input
                        type="url"
                        value={author.googleScholar}
                        onChange={(e) => onUpdateCoAuthor(author.id, { googleScholar: e.target.value })}
                        placeholder="Scholar link"
                        className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-xl px-4 py-2 text-xs text-[#5C4033] outline-none"
                      />
                    </div>
                    )}
                  </div>
                </div>
              ))}
                      </div>
        )}
      </div>
    </div>
  );
}
