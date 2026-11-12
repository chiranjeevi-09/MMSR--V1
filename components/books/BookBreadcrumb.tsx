import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface BookBreadcrumbItem {
  label: string;
  href?: string;
}

export const BookBreadcrumb: React.FC<{ items: BookBreadcrumbItem[]; className?: string }> = ({
  items,
  className,
}) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-xs font-manrope', className)}>
      <ol className="flex items-center flex-wrap gap-1.5 text-text-muted">
        <li className="flex items-center">
          <Link href="/home" className="flex items-center gap-1 hover:text-gold-400 transition-colors">
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
        </li>
        <li className="flex items-center gap-1.5">
          <ChevronRight className="w-3 h-3 text-text-muted/60 shrink-0" />
          <Link href="/books" className="hover:text-gold-400 transition-colors">
            Books
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="flex items-center gap-1.5">
              <ChevronRight className="w-3 h-3 text-text-muted/60 shrink-0" />
              {isLast || !item.href ? (
                <span className="font-semibold text-gold-400 truncate max-w-[240px]" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-gold-400 transition-colors truncate max-w-[160px]">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
