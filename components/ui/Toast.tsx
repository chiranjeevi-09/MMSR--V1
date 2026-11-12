import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

export interface ToastProps extends ToastMessage {
  onDismiss: (id: string) => void;
}

export const ToastItem: React.FC<ToastProps> = ({
  id,
  type,
  title,
  description,
  duration = 4000,
  onDismiss,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-ruby-red shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
    info: <Info className="w-5 h-5 text-royal-blue shrink-0" />,
  };

  const borderClasses = {
    success: 'border-emerald-600/40 bg-[#FFF9F1]',
    error: 'border-red-600/40 bg-[#FFF9F1]',
    warning: 'border-amber-600/40 bg-[#FFF9F1]',
    info: 'border-[#C99A2E]/40 bg-[#FFF9F1]',
  };

  return (
    <div
      role="alert"
      className={cn(
        'w-full max-w-sm p-4 rounded-2xl border backdrop-blur-xl shadow-xl flex items-start gap-3 transition-all duration-300 animate-slide-up font-manrope',
        borderClasses[type]
      )}
    >
      {icons[type]}
      <div className="flex-1 flex flex-col gap-0.5">
        <h5 className="text-sm font-semibold text-[#2F241A]">{title}</h5>
        {description && <p className="text-xs text-[#73614C]">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="p-1 rounded text-[#73614C] hover:text-[#2F241A] hover:bg-[#F8EEDC] transition-colors"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-auto"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
