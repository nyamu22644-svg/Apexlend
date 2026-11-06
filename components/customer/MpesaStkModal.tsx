'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { useBrand } from '@/lib/brand-context';
import { Smartphone, CheckCircle, ShieldCheck, Loader2 } from 'lucide-react';

interface MpesaStkModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAmount?: number;
  loanId?: string;
  onPaymentSuccess?: (receipt: string, amount: number) => void;
}

export function MpesaStkModal({
  isOpen,
  onClose,
  defaultAmount = 5000,
  loanId = 'LN-2025-0891',
  onPaymentSuccess,
}: MpesaStkModalProps) {
  const { brand, customer, makeMpesaRepayment } = useBrand();
  const [phoneNumber, setPhoneNumber] = useState(customer.phone);
  const [amount, setAmount] = useState(defaultAmount);
  const [stage, setStage] = useState<'input' | 'push_sent' | 'pin_prompt' | 'success'>('input');
  const [pin, setPin] = useState('');
  const [receipt, setReceipt] = useState('');
  const [countdown, setCountdown] = useState(30);

  const handleInitiateStk = () => {
    setStage('push_sent');
    setCountdown(20);
    // Simulate push reaching Safaricom phone in 1.2s
    setTimeout(() => {
      setStage('pin_prompt');
    }, 1200);
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) return;

    const result = makeMpesaRepayment(amount, phoneNumber, loanId);
    setReceipt(result.receipt);
    setStage('success');
    if (onPaymentSuccess) {
      onPaymentSuccess(result.receipt, amount);
    }
  };

  const handleReset = () => {
    setStage('input');
    setPin('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReset}
      title="M-Pesa Express Repayment"
      subtitle={`Paybill: ${brand.mpesaPaybill} • Account: ${brand.mpesaAccountPrefix}-${loanId}`}
      maxWidth="md"
    >
      {stage === 'input' && (
        <div className="space-y-4">
          <div className="bg-[#FAF4E9] p-3.5 rounded-xl border border-[#F4E3C1] flex items-start gap-3">
            <Smartphone className="w-5 h-5 text-[#B7791F] shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 space-y-1">
              <p className="font-semibold text-[#101C2C]">Simulated M-Pesa STK Push</p>
              <p>
                An interactive prompt will be dispatched to your Safaricom mobile line. You will be asked
                to confirm with your M-Pesa PIN.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Safaricom Mobile Number
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
              placeholder="07XX XXX XXX"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Repayment Amount (KES)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-lg font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
              min={100}
              step={100}
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setAmount(5000)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Full Installment (KES 5,000)
              </button>
              <button
                type="button"
                onClick={() => setAmount(2500)}
                className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Half (KES 2,500)
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleInitiateStk}
              className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white font-medium rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <span>Initiate M-Pesa STK Push</span>
            </button>
          </div>
        </div>
      )}

      {stage === 'push_sent' && (
        <div className="py-8 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#167D78] animate-spin mx-auto" />
          <div>
            <h4 className="text-base font-bold text-[#101C2C]">Sending Prompt to {phoneNumber}...</h4>
            <p className="text-xs text-slate-500 mt-1">
              Establishing handshake with Safaricom Daraja API gateway.
            </p>
          </div>
        </div>
      )}

      {stage === 'pin_prompt' && (
        <form onSubmit={handleConfirmPin} className="space-y-4">
          {/* Simulated Mobile SIM Tool Kit Pop-up */}
          <div className="bg-[#101C2C] text-white rounded-xl p-5 border border-slate-700 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-300 border-b border-slate-800 pb-2">
              <span className="font-semibold tracking-wide">M-PESA SIM TOOLKIT</span>
              <span className="text-[11px] text-[#D6A85F]">STK Push</span>
            </div>
            <p className="text-sm font-mono leading-relaxed">
              Do you want to pay <span className="text-[#D6A85F] font-bold">KES {amount.toLocaleString()}</span> to{' '}
              <span className="font-bold">{brand.institutionName}</span> Paybill {brand.mpesaPaybill} Account{' '}
              {brand.mpesaAccountPrefix}-{loanId}?
            </p>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">Enter 4-digit PIN:</label>
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded text-center tracking-[0.5em] text-lg font-mono text-emerald-400 focus:outline-none focus:border-[#167D78]"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStage('input')}
              className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pin.length < 4}
              className="flex-1 py-2.5 bg-[#167D78] hover:bg-[#126561] disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors"
            >
              Confirm & Authorize
            </button>
          </div>
        </form>
      )}

      {stage === 'success' && (
        <div className="py-4 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#E7F3F2] text-[#167D78] flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <h4 className="text-lg font-bold text-[#101C2C]">Payment Confirmed!</h4>
            <p className="text-xs text-slate-500 mt-1">
              M-Pesa transaction received and credited to your loan ledger.
            </p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs space-y-2 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">M-Pesa Receipt:</span>
              <span className="font-bold text-[#101C2C]">{receipt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Amount Paid:</span>
              <span className="font-bold text-[#167D78]">KES {amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sender Phone:</span>
              <span>{phoneNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Paybill Ref:</span>
              <span>{brand.mpesaPaybill}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date & Time:</span>
              <span>{new Date().toLocaleTimeString()} EAT</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-[#167D78] font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>Instant Reconciliation Complete</span>
          </div>

          <button
            onClick={handleReset}
            className="w-full py-2.5 bg-[#101C2C] hover:bg-[#18283E] text-white font-medium rounded-xl text-sm transition-colors"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
