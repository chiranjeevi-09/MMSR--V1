import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success' | 'gold';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  roundedPill?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      roundedPill = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center cursor-pointer font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9962A] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8F5EE] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variantStyles = {
      primary:
        'bg-[#C9962A] text-white border border-[#C9962A] hover:bg-[#A97917] hover:shadow-md',
      secondary:
        'bg-[#FFFFFF] text-[#2F241A] border border-[#E7DCC8] hover:border-[#C9962A] hover:bg-[#FFF9EF]',
      outline:
        'bg-transparent text-[#2F241A] border border-[#C9962A] hover:bg-[#FFF9EF] hover:border-[#A97917] hover:text-[#C9962A]',
      ghost:
        'bg-transparent text-[#73614C] hover:text-[#2F241A] hover:bg-[#FFF9EF]',
      danger:
        'bg-[#DC2626] text-white hover:bg-red-700 hover:shadow-lg hover:shadow-[#DC2626]/20',
      success:
        'bg-[#16A34A] text-white hover:bg-emerald-700 hover:shadow-lg hover:shadow-[#16A34A]/20',
      gold:
        'bg-[#C9962A] text-white font-semibold hover:bg-[#A97917] hover:shadow-md',
    };

    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-md',
      md: 'text-sm px-4 py-2 gap-2 rounded-lg',
      lg: 'text-base px-6 py-3 gap-2.5 rounded-xl',
      xl: 'text-lg px-8 py-4 gap-3 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          roundedPill && 'rounded-full',
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
