import React from 'react';
import { PackageOpen } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = <PackageOpen className="w-12 h-12 text-gold-400/60" />,
  title,
  description,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full p-8 sm:p-12 rounded-2xl bg-[#FFF9F1]/40 border border-[#D4AC54]/40 flex flex-col items-center justify-center text-center font-manrope my-4',
        className
      )}
    >
      <div className="w-20 h-20 rounded-full bg-[#F8EEDC] border border-[#D4AC54] flex items-center justify-center mb-5 shadow-medium">
        {icon}
      </div>

      <h3 className="text-xl sm:text-2xl font-bold font-playfair text-ivory-white mb-2">
        {title}
      </h3>

      <p className="text-sm text-text-muted max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {secondaryActionLabel && (
            <Button variant="outline" size="md" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
          {primaryActionLabel && (
            <Button variant="gold" size="md" onClick={onPrimaryAction}>
              {primaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
