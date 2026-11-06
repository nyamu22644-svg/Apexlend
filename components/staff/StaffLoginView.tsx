'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBrand } from '@/lib/brand-context';
import { BrandLogo } from '@/components/shared/BrandLogo';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  ShieldAlert,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';

export function StaffLoginView({ onSuccess }: { onSuccess?: () => void }) {
  const { signInStaff, error: authError, clearError, isConfigured } = useAuth();
  const { brand, setActivePortal } = useBrand();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email.trim()) {
      setLocalError('Please enter your institutional staff email');
      return;
    }
    if (!password) {
      setLocalError('Please enter your staff password');
      return;
    }

    setIsLoading(true);
    try {
      const res = await signInStaff(email, password);
      if (res.success) {
        onSuccess?.();
      } else if (res.error) {
        setLocalError(res.error);
      }
    } catch (err: any) {
      setLocalError(err.message || 'Staff authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickFill = (staffEmail: string) => {
    setEmail(staffEmail);
    setPassword('DemoStaffPass2025!');
  };

  return (
    <div className="w-full max-w-md mx-auto py-10 px-4">
      <div className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-sm space-y-6">
        {/* Brand Lockup */}
        <div className="text-center space-y-2 border-b border-slate-100 pb-5">
          <div className="flex justify-center">
            <BrandLogo variant="dark" size="md" />
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-[#167D78] font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>Staff Operations Gateway</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Authorized personnel only. Sessions are cryptographically signed and logged.
          </p>
        </div>

        {/* Error Notification */}
        {(localError || authError) && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 text-[11px] leading-relaxed">
              {localError || authError}
            </div>
          </div>
        )}

        {/* Staff Login Form */}
        <form onSubmit={handleStaffLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Staff Corporate Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@institution.co.ke"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                disabled={isLoading}
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                disabled={isLoading}
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[#101C2C] hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <span>Sign In to Staff Operations</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security & Access Policy Notice */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#101C2C]">
            <HelpCircle className="w-3.5 h-3.5 text-[#167D78]" />
            <span>Staff Account Provisioning</span>
          </div>
          <p className="text-[10px] leading-relaxed">
            Staff accounts cannot be registered publicly. To request access or reset credentials, submit an IT provisioning ticket to your institutional administrator.
          </p>
        </div>

        {/* Quick Testing Accounts Helper (When in local dev mode) */}
        {!isConfigured && (
          <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 text-xs space-y-2">
            <p className="text-[11px] font-bold text-amber-900">Dev Testing Credential Shortcuts:</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@institution.co.ke')}
                className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-[10px] font-medium text-slate-700 hover:bg-amber-100/50 cursor-pointer"
              >
                Super Admin (Johnstone)
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('credit@institution.co.ke')}
                className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-[10px] font-medium text-slate-700 hover:bg-amber-100/50 cursor-pointer"
              >
                Credit Underwriter (Caroline)
              </button>
            </div>
          </div>
        )}

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => setActivePortal('customer')}
            className="text-xs text-slate-500 hover:text-[#167D78] font-semibold transition-colors cursor-pointer"
          >
            ← Switch to Customer Portal
          </button>
        </div>
      </div>
    </div>
  );
}
