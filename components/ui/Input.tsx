import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  success?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  characterCount?: { current: number; max: number };
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      success,
      leftIcon,
      rightIcon,
      characterCount,
      id: customId,
      disabled,
      value,
      type = 'text',
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId || generatedId;
    // Stable ids so screen readers can associate the field with its inline
    // validation message / helper text (audit a11y: errors were not linked).
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full flex flex-col gap-1.5 font-manrope">
        {label && (
          <div className="flex justify-between items-center text-xs font-medium text-text-muted">
            <label htmlFor={inputId} className="cursor-pointer text-ivory-white/90">
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

        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-text-muted pointer-events-none flex items-center justify-center">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            value={value}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full bg-[#FFFFFF] text-[#2F241A] placeholder-[#73614C]/60 text-sm rounded-lg border px-3.5 py-2.5 transition-all duration-200 outline-none',
              'focus:border-[#C9962A] focus:ring-1 focus:ring-[#C9962A]/50 focus:bg-[#FFFFFF]',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-ruby-red focus:border-ruby-red focus:ring-ruby-red/30'
                : success
                ? 'border-emerald-accent focus:border-emerald-accent'
                : 'border-[#E7DCC8] hover:border-[#C9962A]',
              disabled && 'opacity-50 cursor-not-allowed bg-[#F1EBDF]',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <span className="absolute right-3 text-text-muted flex items-center justify-center">
              {rightIcon}
            </span>
          )}
        </div>

        {error ? (
          <p id={errorId} role="alert" className="text-xs text-ruby-red mt-0.5">{error}</p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-text-muted mt-0.5">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
