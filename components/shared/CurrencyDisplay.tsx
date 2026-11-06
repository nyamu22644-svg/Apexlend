'use client';

import React from 'react';

interface CurrencyDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  showCurrency?: boolean;
  prefix?: string;
  className?: string;
}

export function CurrencyDisplay({
  amount,
  size = 'md',
  showCurrency = true,
  prefix = '',
  className = '',
}: CurrencyDisplayProps) {
  const formatted = new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: 0,
  }).format(amount);

  const sizeClasses = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-xl font-bold',
    xl: 'text-2xl font-bold',
    hero: 'text-3xl font-extrabold tracking-tight',
  };

  return (
    <span className={`inline-flex items-baseline gap-1 font-mono tabular-nums ${sizeClasses[size]} ${className}`}>
      {prefix && <span>{prefix}</span>}
      {showCurrency && <span className="text-[0.8em] font-medium opacity-85">KES</span>}
      <span>{formatted}</span>
    </span>
  );
}
