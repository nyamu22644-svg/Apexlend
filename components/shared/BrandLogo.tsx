'use client';

import React from 'react';
import { useBrand } from '@/lib/brand-context';

interface BrandLogoProps {
  variant?: 'light' | 'dark' | 'auto';
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export function BrandLogo({
  variant = 'auto',
  showTagline = false,
  size = 'md',
  className = '',
  onClick,
}: BrandLogoProps) {
  const { brand } = useBrand();

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-xl font-bold',
  };

  const isDarkSurface = variant === 'light'; // Light text on dark surface
  const titleColor = isDarkSurface ? 'text-white' : 'text-[#101C2C]';
  const taglineColor = isDarkSurface ? 'text-slate-400' : 'text-slate-500';

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* High-fidelity geometric ribbon mark from the authoritative visual spec */}
      <div className={`relative shrink-0 ${iconSizes[size]}`}>
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Left Teal Ribbon */}
          <path
            d="M9 28L18 10C18.6 8.8 19.8 8 21.2 8H23L14 26C13.4 27.2 12.2 28 10.8 28H9Z"
            fill={brand.primaryColor || '#167D78'}
          />
          {/* Right Muted Gold Ribbon */}
          <path
            d="M19 32L28 14C28.6 12.8 29.8 12 31.2 12H33L24 30C23.4 31.2 22.2 32 20.8 32H19Z"
            fill={brand.accentColor || '#D6A85F'}
          />
        </svg>
      </div>

      <div className="flex flex-col leading-tight">
        <span className={`tracking-tight ${textSizes[size]} ${titleColor}`}>
          {brand.institutionName}
        </span>
        {showTagline && (
          <span className={`text-[11px] font-normal truncate max-w-[200px] ${taglineColor}`}>
            {brand.tagline}
          </span>
        )}
      </div>
    </div>
  );
}
