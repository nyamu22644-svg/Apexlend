'use client';

import React from 'react';
import { Modal } from '@/components/shared/Modal';
import { useBrand } from '@/lib/brand-context';
import { ShieldAlert, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';

interface KycGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartKyc: () => void;
}

export function KycGateModal({ isOpen, onClose, onStartKyc }: KycGateModalProps) {
  const { customer } = useBrand();

  const sections = [
    { label: 'Personal Information (Name, DoB, National ID)', done: customer.personal?.completed },
    { label: 'Contact Details (Verified Phone & Residential Address)', done: customer.contact?.completed },
    { label: 'Employment & Income Assessment', done: customer.employment?.completed },
    { label: 'Identity Verification (ID Front/Back & KRA PIN)', done: customer.identity?.completed },
    { label: 'Payment Information (M-Pesa Disbursement Channel)', done: customer.payment?.completed },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Identity Verification Required"
      subtitle="Central Bank of Kenya Digital Credit Providers Regulation 2022"
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        <div className="bg-[#FAF4E9] p-3.5 rounded-2xl border border-[#F4E3C1] flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#101C2C]">Regulatory KYC Incomplete</p>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Before submitting a formal loan application, Kenyan law requires digital credit providers to verify
              your legal identity, tax PIN, and income capacity.
            </p>
          </div>
        </div>

        {/* Progress Checklist */}
        <div className="space-y-2 border border-slate-200 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-slate-700">Verification Progress</span>
            <span className="font-mono font-bold text-[#167D78]">
              {customer.profileCompletionPercentage}% Complete
            </span>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-[#167D78] rounded-full transition-all"
              style={{ width: `${customer.profileCompletionPercentage}%` }}
            />
          </div>

          <div className="space-y-2">
            {sections.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                <span className={s.done ? 'text-slate-700' : 'text-slate-500'}>{s.label}</span>
                {s.done ? (
                  <CheckCircle2 className="w-4 h-4 text-[#167D78] shrink-0" />
                ) : (
                  <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 rounded-full bg-amber-50">
                    Required
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
          >
            Explore Dashboard
          </button>
          <button
            type="button"
            onClick={onStartKyc}
            className="flex-2 py-3 bg-[#167D78] hover:bg-[#126561] text-white font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Start KYC (5 Mins)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
