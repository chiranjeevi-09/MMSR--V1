'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Please Confirm',
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isBusy = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isBusy ? () => undefined : onCancel}
      title={title}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm} isLoading={isBusy}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex items-start gap-3 font-manrope">
        <span className="w-9 h-9 shrink-0 rounded-full bg-red-50 border border-[#DC2626]/25 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </span>
        <div className="text-sm text-[#5C4B3A] leading-relaxed pt-1">{message}</div>
      </div>
    </Modal>
  );
};
