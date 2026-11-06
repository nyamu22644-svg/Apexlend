'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBrand } from '@/lib/brand-context';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { ShieldAlert, Lock, AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredUserType?: 'customer' | 'staff';
  requiredPermission?: string;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({
  children,
  requiredUserType,
  requiredPermission,
  fallback,
}: ProtectedRouteProps) {
  const { profile, session, isLoading, isConfigured } = useAuth();
  const { brand, setActivePortal } = useBrand();

  // 1. Session Loading State
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 space-y-4 text-center">
        <div className="w-10 h-10 border-3 border-[#167D78] border-t-transparent rounded-full animate-spin" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#101C2C] uppercase tracking-wider">
            Securing Session
          </p>
          <p className="text-[11px] text-slate-400">Verifying institutional credentials...</p>
        </div>
      </div>
    );
  }

  // 2. Account Suspension Check
  if (profile?.isSuspended) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl border border-rose-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[#101C2C]">Account Suspended</h3>
          <p className="text-xs text-slate-500">
            {profile.suspensionReason ||
              'Your access has been restricted by the institutional compliance desk under CBK regulations.'}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-600 font-mono">
          Ref: {profile.id} • {brand.cbkLicenseNumber}
        </div>
        <div className="pt-2">
          <a
            href={`mailto:${brand.supportEmail}?subject=Suspended Account Inquiry - ${profile.email}`}
            className="inline-block px-4 py-2 bg-[#101C2C] text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Contact Compliance Desk
          </a>
        </div>
      </div>
    );
  }

  // 3. User Type Authorization Check
  if (requiredUserType) {
    if (!session || !profile) {
      return fallback ? <>{fallback}</> : null;
    }
    const activeType = profile?.userType ?? (session ? 'customer' : null);

    // If staff access is required but user is a customer
    if (requiredUserType === 'staff' && activeType === 'customer') {
      if (fallback) return <>{fallback}</>;
      return (
        <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl border border-amber-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#101C2C]">Staff Authorization Required</h3>
            <p className="text-xs text-slate-500">
              This module is strictly restricted to authorized lending operations personnel. Customer accounts
              cannot be granted staff privileges.
            </p>
          </div>
          <div className="p-3 bg-amber-50/60 rounded-xl text-[11px] text-amber-800 text-left space-y-1">
            <p className="font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Administrative Security Policy
            </p>
            <p className="text-[10px] text-amber-700">
              Staff accounts must be created and granted by your institution administrator. Modifying client metadata or URL parameters does not grant operational access.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => setActivePortal('customer')}
              className="px-4 py-2 bg-[#167D78] text-white rounded-xl text-xs font-semibold hover:bg-[#12635F] transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Customer Portal
            </button>
          </div>
        </div>
      );
    }
  }

  if (requiredPermission && !profile?.permissions.includes(requiredPermission)) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl border border-amber-200 shadow-sm text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[#101C2C]">Permission Required</h3>
          <p className="text-xs text-slate-500">Your current staff role is not authorized for this operation.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
