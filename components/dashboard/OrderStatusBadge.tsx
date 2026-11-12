'use client';

import React from 'react';
import {
  Clock,
  CheckCircle2,
  Truck,
  Package,
  XCircle,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export type OrderStatusType =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_MAP: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  pending: {
    label: 'Pending Payment',
    color: 'text-[#8C6B1B]',
    bg: 'bg-[#FFF2D9] border-[#D4AC54]',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  paid: {
    label: 'Payment Verified',
    color: 'text-emerald-800',
    bg: 'bg-emerald-50 border-emerald-300',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  processing: {
    label: 'Order Processing',
    color: 'text-[#8C6B1B]',
    bg: 'bg-[#FFF2D9] border-[#D4AC54]',
    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
  },
  shipped: {
    label: 'Shipped',
    color: 'text-[#5C4033]',
    bg: 'bg-[#F8EEDC] border-[#D4AC54]',
    icon: <Truck className="w-3.5 h-3.5" />,
  },
  delivered: {
    label: 'Delivered',
    color: 'text-[#C99A2E]',
    bg: 'bg-[#FFF2D9] border-[#D4AC54]',
    icon: <Package className="w-3.5 h-3.5" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-[#DC2626]',
    bg: 'bg-red-50 border-[#DC2626]/40',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  refund_pending: {
    label: 'Refund Pending',
    color: 'text-[#8C6B1B]',
    bg: 'bg-[#FFF2D9] border-[#D4AC54]',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  refunded: {
    label: 'Refunded',
    color: 'text-[#73614C]',
    bg: 'bg-[#F8EEDC] border-[#D4AC54]',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = (status || '').toLowerCase().trim();
  const config = STATUS_MAP[normalized] ?? {
    label: status || 'Unknown',
    color: 'text-[#73614C]',
    bg: 'bg-[#F8EEDC] border-[#D4AC54]',
    icon: <Clock className="w-3.5 h-3.5" />,
  };

  const sizeClasses =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-xs gap-2'
      : size === 'md'
      ? 'px-3 py-1 text-xs gap-1.5'
      : 'px-2.5 py-0.5 text-[13px] gap-1';

  return (
    <span
      className={`inline-flex items-center font-bold border rounded-full font-manrope ${config.bg} ${config.color} ${sizeClasses}`}
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
};
