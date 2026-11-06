'use client';

import React from 'react';
import { CheckCircle2, Clock, AlertCircle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const norm = status.toLowerCase();

  const isApproved = norm.includes('approved') || norm.includes('good standing') || norm.includes('settled') || norm.includes('active') || norm.includes('completed');
  const isPending = norm.includes('under review') || norm.includes('pending') || norm.includes('draft');
  const isOverdue = norm.includes('overdue') || norm.includes('arrears') || norm.includes('rejected') || norm.includes('failed');

  let style = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Clock;

  if (isApproved) {
    style = 'bg-[#E7F3F2] text-[#167D78] border-[#D0E9E7]';
    Icon = CheckCircle2;
  } else if (isPending) {
    style = 'bg-[#FAF4E9] text-[#B7791F] border-[#F4E3C1]';
    Icon = Clock;
  } else if (isOverdue) {
    style = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = AlertCircle;
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border whitespace-nowrap ${style} ${padding} ${className}`}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{status}</span>
    </span>
  );
}
