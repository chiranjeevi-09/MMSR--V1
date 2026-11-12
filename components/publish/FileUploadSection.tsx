'use client';

import React, { useState } from 'react';
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react';

interface FileUploadSectionProps {
  primaryFile: File | null;
  onSelectPrimaryFile: (file: File | null) => void;
  supplementaryFiles: File[];
  onAddSupplementaryFile: (files: File[]) => void;
  onRemoveSupplementaryFile: (index: number) => void;
  additionalUploads?: Record<string, File | null>;
  onSelectAdditionalUpload?: (key: string, file: File | null) => void;
  error?: string;
  /** Conference mode: only the full paper upload is shown (PDF/DOC/DOCX, 10 MB). */
  isConference?: boolean;
}

export function FileUploadSection({
  primaryFile,
  onSelectPrimaryFile,
  supplementaryFiles,
  onAddSupplementaryFile,
  onRemoveSupplementaryFile,
  additionalUploads = {},
  onSelectAdditionalUpload,
  error,
  isConference = false,
}: FileUploadSectionProps) {
  const [primaryDragActive, setPrimaryDragActive] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const validatePrimary = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = isConference ? ['pdf', 'doc', 'docx'] : ['pdf', 'doc', 'docx', 'tex'];
    const maxSizeMb = isConference ? 10 : 25;
    if (!ext || !validExts.includes(ext)) {
      alert(
        isConference
          ? 'Invalid file format. Please upload your full paper as PDF, DOC, or DOCX.'
          : 'Invalid file format. Please upload PDF, DOC, DOCX, or TEX files only.'
      );
      return false;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      alert(`File size exceeds the ${maxSizeMb} MB limit for the primary file.`);
      return false;
    }
    return true;
  };

  const handlePrimaryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setPrimaryDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validatePrimary(file)) {
        onSelectPrimaryFile(file);
      }
    }
  };

  const handlePrimaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validatePrimary(file)) {
        onSelectPrimaryFile(file);
      }
    }
  };

  return (
    <div className="space-y-8">
      {/* ── 1. PRIMARY MANUSCRIPT UPLOAD (REQUIRED) ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-[#FFF9F1] border border-[#E2C999] shadow-soft space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2C999] pb-3">
          <div>
            <h3 className="text-lg font-bold font-playfair text-[#5C4033] flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#C99A2E]" />
              <label htmlFor="primary-manuscript-file" className="cursor-pointer">
                {isConference ? 'Upload Full Paper' : 'Primary Manuscript File'} <span className="text-ruby-red">*</span>
              </label>
            </h3>
            <p className="text-xs text-[#6E5238]">
              {isConference
                ? 'Upload the complete conference paper. Accepted formats: PDF, DOC, DOCX (Maximum file size: 10 MB)'
                : 'Accepted formats: PDF, DOC, DOCX, TEX (Maximum file size: 25 MB)'}
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-[13px] font-extrabold uppercase tracking-wider bg-[#8C6239] text-white">
            Required
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-ruby-red/10 border border-ruby-red/30 flex items-center gap-2 text-xs text-ruby-red font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!primaryFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setPrimaryDragActive(true);
            }}
            onDragLeave={() => setPrimaryDragActive(false)}
            onDrop={handlePrimaryDrop}
            className={`p-8 sm:p-10 rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer relative ${
              primaryDragActive
                ? 'border-[#C99A2E] bg-[#C99A2E]/10 scale-[1.01]'
                : 'border-[#E2C999] bg-[#F8EEDC]/60 hover:border-[#C99A2E] hover:bg-[#F8EEDC]'
            }`}
          >
            <input
              id="primary-manuscript-file"
              aria-label={isConference ? "Upload full conference paper" : "Upload primary manuscript file"}
              type="file"
              accept={isConference ? '.pdf,.doc,.docx' : '.pdf,.doc,.docx,.tex'}
              onChange={handlePrimaryChange}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF9F1] border border-[#E2C999] flex items-center justify-center text-[#C99A2E] shadow-sm">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#5C4033]">
                  {isConference
                    ? 'Drag and drop your full paper here'
                    : 'Drag and drop your primary manuscript file here'}
                </p>
                <p className="text-xs text-[#8A6A4A] mt-1">or click to browse from your device</p>
              </div>
              <span className="px-3 py-1 rounded-md text-[13px] font-mono bg-[#FFF9F1] text-[#8C6239] border border-[#E2C999]">
                {isConference ? 'PDF • DOC • DOCX (Max 10 MB)' : 'PDF • DOC • DOCX • TEX (Max 25 MB)'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-[#F8EEDC] border border-[#C99A2E] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#C99A2E] text-white flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#5C4033] line-clamp-1">{primaryFile.name}</p>
                <p className="text-xs text-[#8A6A4A]">{formatSize(primaryFile.size)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectPrimaryFile(null)}
              className="p-2 rounded-xl bg-[#FFF9F1] border border-[#E2C999] text-[#DC2626] hover:bg-[#DC2626] hover:text-white transition-all"
              title="Remove File"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
