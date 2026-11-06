'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  growth?: string;
  growthType?: 'up' | 'down';
  icon?: React.ReactNode;
  iconBg?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  growth,
  growthType = 'up',
  icon,
  iconBg = 'bg-[#E7F3F2] text-[#167D78]',
  subtitle,
  className = '',
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs transition-all hover:border-slate-300 ${
        onClick ? 'cursor-pointer hover:shadow-sm' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        {icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500 tracking-wide">{title}</p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-2xl font-bold tracking-tight text-[#101C2C] font-mono tabular-nums">
            {value}
          </p>
          {growth && (
            <span
              className={`inline-flex items-center text-xs font-semibold ${
                growthType === 'up' ? 'text-[#167D78]' : 'text-rose-600'
              }`}
            >
              {growthType === 'up' ? (
                <ArrowUpRight className="w-3.5 h-3.5 inline mr-0.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 inline mr-0.5" />
              )}
              {growth}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}
