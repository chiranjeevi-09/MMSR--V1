import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  characterCount?: { current: number; max: number };
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      characterCount,
      id: customId,
      disabled,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = customId || generatedId;
    // Link the field to its inline error/helper text for assistive tech.
    const errorId = `${textareaId}-error`;
    const helperId = `${textareaId}-helper`;

    return (
      <div className="w-full flex flex-col gap-1.5 font-manrope">
        {label && (
          <div className="flex justify-between items-center text-xs font-medium text-text-muted">
            <label htmlFor={textareaId} className="cursor-pointer text-ivory-white/90">
              {label}
            </label>
            {characterCount && (
              <span
                className={cn(
                  'text-[13px]',
                  characterCount.current > characterCount.max
                    ? 'text-ruby-red'
                    : 'text-text-muted'
                )}
              >
                {characterCount.current}/{characterCount.max}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'w-full bg-[#FFF9F1]/80 text-ivory-white placeholder-text-muted/60 text-sm rounded-lg border px-3.5 py-2.5 transition-all duration-200 outline-none resize-y min-h-[90px]',
            'focus:border-gold-500 focus:ring-1 focus:ring-gold-500/50 focus:bg-[#F8EEDC]',
            error
              ? 'border-ruby-red focus:border-ruby-red focus:ring-ruby-red/30'
              : 'border-[#D4AC54]/60 hover:border-white/20',
            disabled && 'opacity-50 cursor-not-allowed bg-[#F8EEDC]/50',
            className
          )}
          {...props}
        />

        {error ? (
          <p id={errorId} role="alert" className="text-xs text-ruby-red mt-0.5">{error}</p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-text-muted mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
