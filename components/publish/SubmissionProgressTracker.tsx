'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Users, Upload, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface SubmissionProgressTrackerProps {
  currentStep: number; // 1 to 5
}

const STEPS = [
  { id: 1, label: 'Publication Details', icon: BookOpen },
  { id: 2, label: 'Author Information', icon: Users },
  { id: 3, label: 'Upload Documents', icon: Upload },
  { id: 4, label: 'Declaration', icon: ShieldCheck },
  { id: 5, label: 'Submit Successfully', icon: CheckCircle2 },
];

export function SubmissionProgressTracker({ currentStep }: SubmissionProgressTrackerProps) {
  return (
    <div className="w-full bg-[#FFF9F1] border border-[#E2C999] rounded-2xl p-4 sm:p-6 shadow-soft">
      <div className="flex items-center gap-4 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <React.Fragment key={step.id}>
              {/* Step Chip / Card */}
              <div className="flex items-center gap-3 z-10 shrink-0">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.08 : 1,
                    backgroundColor: isCompleted ? '#C99A2E' : isCurrent ? '#8C6239' : '#F8EEDC',
                  }}
                  transition={{ duration: 0.3 }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border font-bold text-sm shrink-0 shadow-sm ${
                    isCompleted
                      ? 'border-[#C99A2E] text-white'
                      : isCurrent
                      ? 'border-[#8C6239] text-white'
                      : 'border-[#E2C999] text-[#6E5238]'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-4 h-4" />}
                </motion.div>

                <div className="flex flex-col">
                  <span className="text-[13px] uppercase font-bold tracking-wider text-[#8A6A4A] whitespace-nowrap">
                    Step 0{step.id}
                  </span>
                  <span
                    className={`text-xs font-bold leading-tight whitespace-nowrap ${
                      isCurrent ? 'text-[#5C4033]' : isCompleted ? 'text-[#8C6239]' : 'text-[#8A6A4A]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              </div>

              {/* Connecting Bar (Desktop) */}
              {index < STEPS.length - 1 && (
                <div className="hidden md:block flex-1 h-[2px] bg-[#E2C999] relative overflow-hidden mx-2 min-w-[16px]">
                  <motion.div
                    initial={{ width: '0%' }}
                    animate={{ width: isCompleted ? '100%' : '0%' }}
                    transition={{ duration: 0.4 }}
                    className="h-full bg-[#C99A2E]"
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
