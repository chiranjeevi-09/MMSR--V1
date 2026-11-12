import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { Badge, BadgeVariant } from './Badge';

// Base Card
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({
  className,
  hoverEffect = true,
  glass = false,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        'rounded-[24px] border transition-all duration-300 overflow-hidden font-manrope',
        glass
          ? 'bg-[#FFF9F1] backdrop-blur-xl border-[#D4AC54] shadow-md'
          : 'bg-[#FFF9F1] border-[#D4AC54] shadow-md',
        hoverEffect &&
          'hover:-translate-y-1.5 hover:border-[#C99A2E] hover:bg-[#FFF8EE] hover:shadow-xl',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Glass Card
export const GlassCard: React.FC<CardProps> = ({ className, ...props }) => {
  return <Card glass={true} className={cn('glass-card', className)} {...props} />;
};

// Feature Card
export interface FeatureCardProps extends CardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  tag?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  tag,
  className,
  ...props
}) => {
  return (
    <Card className={cn('p-7 flex flex-col justify-between h-full w-full gap-5 group cursor-pointer border-[#D4AC54]', className)} {...props}>
      <div className="flex justify-between items-start">
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-[#F8EEDC] border border-[#D4AC54] flex items-center justify-center text-[#C99A2E] group-hover:scale-110 group-hover:bg-[#C99A2E] group-hover:text-[#FFFDF8] transition-all duration-300">
            {icon}
          </div>
        )}
        {tag && <Badge variant="gold" size="sm">{tag}</Badge>}
      </div>

      <div className="flex flex-col gap-2.5 flex-1 justify-center">
        <h3 className="text-xl font-bold font-playfair text-[#2F241A] group-hover:text-[#C99A2E] transition-colors leading-snug">
          {title}
        </h3>
        <p className="text-sm text-[#73614C] font-medium leading-relaxed">
          {description}
        </p>
      </div>
    </Card>
  );
};

// Stat Card
export interface StatCardProps extends CardProps {
  number: string | number;
  label: string;
  change?: string;
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  number,
  label,
  change,
  icon,
  className,
  ...props
}) => {
  return (
    <Card className={cn('p-5 flex flex-col justify-between gap-3 relative overflow-hidden h-full min-h-[110px]', className)} {...props}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#73614C] uppercase tracking-wider line-clamp-1">
          {label}
        </span>
        {icon && <div className="text-[#C99A2E] shrink-0">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold font-playfair text-[#2F241A] break-words">
          {number}
        </span>
        {change && (
          <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
            {change}
          </span>
        )}
      </div>
    </Card>
  );
};

// Publication Card
export interface PublicationCardProps extends CardProps {
  title: string;
  authors?: string;
  category?: string;
  badgeText?: string;
  badgeVariant?: BadgeVariant;
  year?: string | number;
  doi?: string;
  coverImage?: string;
  coverImageWebp?: string;
}

export const PublicationCard: React.FC<PublicationCardProps> = ({
  title,
  authors,
  category,
  badgeText = 'Published',
  badgeVariant = 'Published',
  year,
  doi,
  coverImage,
  coverImageWebp,
  className,
  ...props
}) => {
  const imageSource = coverImageWebp || coverImage;
  return (
    <Card className={cn('flex flex-col h-full group cursor-pointer', className)} {...props}>
      {imageSource ? (
        <div className="h-48 w-full relative overflow-hidden bg-[#F8EEDC]">
          <Image
            src={imageSource}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            loading="lazy"
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute top-3 right-3">
            <Badge variant={badgeVariant}>{badgeText}</Badge>
          </div>
        </div>
      ) : (
        <div className="p-4 border-b border-[#D4AC54] flex justify-between items-center bg-[#F8EEDC]/40">
          <span className="text-xs text-[#C99A2E] font-mono font-medium">
            {category || 'Academic Journal'}
          </span>
          <Badge variant={badgeVariant}>{badgeText}</Badge>
        </div>
      )}

      <div className="p-6 flex flex-col flex-1 justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h4 className="text-lg font-semibold font-playfair text-[#2F241A] group-hover:text-[#C99A2E] transition-colors line-clamp-2">
            {title}
          </h4>
          {authors && (
            <p className="text-xs text-[#73614C] line-clamp-1">
              By <span className="text-[#2F241A] font-medium">{authors}</span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-[#73614C] pt-3 border-t border-[#D4AC54]/60">
          {year && <span>Year: {year}</span>}
          {doi && <span className="font-mono text-[13px] truncate max-w-[150px]">DOI: {doi}</span>}
        </div>
      </div>
    </Card>
  );
};

// Info Card
export interface InfoCardProps extends CardProps {
  title: string;
  content: string;
  actionText?: string;
  onAction?: () => void;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  content,
  actionText,
  onAction,
  className,
  ...props
}) => {
  return (
    <Card className={cn('p-6 bg-[#FFF9F1] border-[#D4AC54]', className)} {...props}>
      <h4 className="text-lg font-semibold font-playfair text-[#C99A2E] mb-2">{title}</h4>
      <p className="text-sm text-[#73614C] leading-relaxed mb-4">{content}</p>
      {actionText && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-[#C99A2E] hover:text-[#A97917] underline underline-offset-4 transition-colors"
        >
          {actionText} →
        </button>
      )}
    </Card>
  );
};

