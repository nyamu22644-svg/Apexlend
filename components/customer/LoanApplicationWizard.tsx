'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import { calculateLoanQuote } from '@/lib/brand-config';
import { getAvailableLoanProducts, getLoanQuote, LiveLoanProduct, LiveLoanQuote, submitLoanApplication } from '@/lib/loan-api';
import { useAuth } from '@/lib/auth-context';
import {
  ArrowLeft,
  Info,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  Building2,
  Phone,
  FileText,
} from 'lucide-react';

export function LoanApplicationWizard() {
  const { customer, loanProducts, brand, submitNewApplication, setCustomerView } = useBrand();
  const { session, isConfigured } = useAuth();
  const [liveProducts, setLiveProducts] = useState<LiveLoanProduct[]>([]);
  const [liveError, setLiveError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveQuote, setLiveQuote] = useState<LiveLoanQuote | null>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedProductId, setSelectedProductId] = useState<string>(loanProducts[0]?.id || 'prod-01');
  const [amount, setAmount] = useState<number>(30000);
  const [tenorMonths, setTenorMonths] = useState<number>(6);
  const [purpose, setPurpose] = useState<string>('Stock Purchase / Inventory');
  const [crbConsent, setCrbConsent] = useState<boolean>(true);
  const [termsConsent, setTermsConsent] = useState<boolean>(true);
  const [submittedAppId, setSubmittedAppId] = useState<string>('');
  const submissionIdempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isConfigured || !session?.access_token) return;
    getAvailableLoanProducts(session.access_token).then((products) => {
      setLiveProducts(products);
      if (products[0]) { setSelectedProductId(products[0].product_version_id); setAmount(products[0].terms.min_amount); setTenorMonths(products[0].terms.min_term_months); }
    }).catch((error) => setLiveError(error instanceof Error ? error.message : 'Unable to load loan products'));
  }, [isConfigured, session?.access_token]);

  const liveProduct = liveProducts.find((p) => p.product_version_id === selectedProductId);
  const currentProduct = !isConfigured ? (loanProducts.find((p) => p.id === selectedProductId) || loanProducts[0]) : undefined;
  const minAmount = liveProduct?.terms.min_amount || currentProduct?.minAmount || 1000;
  const maxAmount = liveProduct?.terms.max_amount || currentProduct?.maxAmount || 100000;
  const minTerm = liveProduct?.terms.min_term_months || currentProduct?.minTermMonths || 1;
  const maxTerm = liveProduct?.terms.max_term_months || currentProduct?.maxTermMonths || 12;
  const rate = liveProduct?.terms.interest_rate_per_month || currentProduct?.interestRatePerMonth || 0;
  const browserQuote = calculateLoanQuote({
    amount,
    termMonths: tenorMonths,
    interestRatePerMonth: rate,
    method: currentProduct?.interestCalculationMethod || 'reducing_balance',
  });
  const quote = liveQuote ? { ...browserQuote, monthlyInstallment: Number(liveQuote.monthly_installment), totalInterest: Number(liveQuote.total_interest), baseProcessingFee: Number(liveQuote.processing_fee), exciseDuty: Number(liveQuote.excise_duty), totalFees: Number(liveQuote.total_fees), totalRepayable: Number(liveQuote.total_repayable) } : browserQuote;

  useEffect(() => {
    if (!isConfigured || !session?.access_token || !liveProduct) { setLiveQuote(null); return; }
    let cancelled = false;
    getLoanQuote(session.access_token, liveProduct.product_version_id, amount, tenorMonths)
      .then((nextQuote) => { if (!cancelled) setLiveQuote(nextQuote); })
      .catch(() => { if (!cancelled) setLiveQuote(null); });
    return () => { cancelled = true; };
  }, [isConfigured, session?.access_token, liveProduct?.product_version_id, amount, tenorMonths]);

  const purposes = [
    'Stock Purchase / Inventory',
    'Working Capital / Cashflow',
    'Equipment & Machinery',
    'Agricultural Inputs & Feeds',
    'Medical or Personal Emergency',
    'School Fees & Education',
  ];

  const handleNext = async () => {
    if (step === 1) {
      if (isConfigured && !liveProducts.length) { setLiveError('KYC approval and an active loan product are required before applying.'); return; }
      if (!isConfigured && !customer.isKycCompleteForLending && customer.profileCompletionPercentage < 80) {
        setCustomerView('kyc-wizard');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (!isConfigured && !customer.isKycCompleteForLending && customer.profileCompletionPercentage < 80) {
        setCustomerView('kyc-wizard');
        return;
      }
      if (isConfigured) {
        if (!session?.access_token || !liveProduct) { setLiveError('Your session or loan product is unavailable. Refresh and try again.'); return; }
        setIsSubmitting(true);
        try {
          const idempotencyKey = submissionIdempotencyKey.current || crypto.randomUUID();
          submissionIdempotencyKey.current = idempotencyKey;
          const result = await submitLoanApplication(session.access_token, liveProduct.product_version_id, amount, tenorMonths, purpose, crbConsent, termsConsent, idempotencyKey);
          if (!result.application?.application_number) throw new Error('The application was accepted but no reference was returned. Please try again.');
          setSubmittedAppId(result.application.application_number);
          submissionIdempotencyKey.current = null;
          setStep(4);
        }
        catch (error) { setLiveError(error instanceof Error ? error.message : 'Unable to submit application'); }
        finally { setIsSubmitting(false); }
        return;
      }
      if (!currentProduct) { setLiveError('No loan product is available.'); return; }
      const app = submitNewApplication({
        amount,
        termMonths: tenorMonths,
        purpose,
        productId: currentProduct.id,
      });
      setSubmittedAppId(app.applicationId);
      setStep(4);
    }
  };

  const handleBack = () => {
    if (step > 1 && step < 4) {
      setStep((step - 1) as 1 | 2 | 3);
    } else {
      setCustomerView('dashboard');
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-5 pb-24">
      {/* Top Header with Back button matching reference image phone 2 */}
      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
        <button
          onClick={handleBack}
          className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-[#101C2C]">Loan Application</h2>
      </div>

      {/* 4-Step Progress Indicator (Exact match to reference image phone 2) */}
      <div className="py-2">
        <div className="flex items-center justify-between relative">
          {/* Background connecting line */}
          <div className="absolute left-6 right-6 top-4 h-0.5 bg-slate-200 -z-0" />
          {/* Active progress track */}
          <div
            className="absolute left-6 top-4 h-0.5 bg-[#167D78] transition-all duration-300 -z-0"
            style={{ width: `${((step - 1) / 3) * 85}%` }}
          />

          {[
            { num: 1, label: 'Details' },
            { num: 2, label: 'Review' },
            { num: 3, label: 'Consent' },
            { num: 4, label: 'Submit' },
          ].map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCurrent
                      ? 'bg-[#167D78] text-white shadow-sm'
                      : isCompleted
                      ? 'bg-[#167D78] text-white'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span
                  className={`text-[11px] font-medium mt-1.5 ${
                    isCurrent ? 'text-[#101C2C] font-semibold' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STEP 1: Details (Exact match to reference image phone 2) */}
      {step === 1 && (
        <div className="space-y-6 pt-2">
          {liveError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{liveError}</div>}
          {isConfigured && liveProducts.length > 0 && <div className="space-y-2"><label className="text-xs font-semibold">Loan product</label><select value={selectedProductId} onChange={(e) => { const product = liveProducts.find((item) => item.product_version_id === e.target.value); setSelectedProductId(e.target.value); if (product) { setAmount(product.terms.min_amount); setTenorMonths(product.terms.min_term_months); } }} className="w-full rounded-xl border border-slate-200 p-3 text-xs">{liveProducts.map((product) => <option key={product.product_version_id} value={product.product_version_id}>{product.name} ({product.code})</option>)}</select></div>}
          {/* Select Loan Amount */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Select Loan Amount
            </label>
            <div className="text-2xl font-extrabold tracking-tight text-[#101C2C] font-mono tabular-nums">
              KES {amount.toLocaleString()}
            </div>

            {/* Range Slider */}
            <div className="space-y-1.5">
              <input
                type="range"
                min={minAmount}
                max={maxAmount}
                step={Math.max(100, Math.round((maxAmount - minAmount) / 100))}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#167D78]"
              />
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>KES {minAmount.toLocaleString()}</span>
                <span>KES {maxAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Repayment Period Chips */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Repayment Period
            </label>
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: maxTerm - minTerm + 1 }, (_, index) => minTerm + index).map((m) => {
                const isSelected = tenorMonths === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTenorMonths(m)}
                    className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#167D78] text-white border-[#167D78] shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {m} mths
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estimated Monthly Payment Callout (Exact match to reference phone 2) */}
          <div className="bg-[#E7F3F2] rounded-2xl p-4 border border-[#D0E9E7] flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-full bg-white text-[#167D78] flex items-center justify-center shrink-0 shadow-xs">
              <Info className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-600 font-medium">Estimated Monthly Payment</p>
              <p className="text-lg font-bold text-[#101C2C] font-mono tabular-nums">
                KES {quote.monthlyInstallment.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Loan Purpose Dropdown */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Loan Purpose
            </label>
            <div className="relative">
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
              >
                {purposes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Continue Button (Exact Teal styling) */}
          <button
            type="button"
            onClick={handleNext}
            className="w-full py-3.5 bg-[#167D78] hover:bg-[#126561] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Continue
          </button>
        </div>
      )}

      {/* STEP 2: Review Financial Breakdown */}
      {step === 2 && (
        <div className="space-y-5 pt-2">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">Requested Principal:</span>
              <span className="font-bold text-[#101C2C]">KES {amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tenor:</span>
              <span className="font-bold text-[#101C2C]">{tenorMonths} Months</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Monthly Interest Rate:</span>
              <span className="font-bold text-[#167D78]">{rate}% per month</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Interest Payable:</span>
              <span className="font-bold text-[#101C2C]">KES {quote.totalInterest.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">One-off Processing Fee (3%):</span>
              <span className="font-bold text-[#101C2C]">KES {quote.baseProcessingFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Kenya Excise Duty (20% on fee):</span>
              <span className="font-bold text-[#101C2C]">KES {quote.exciseDuty.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
              <span className="font-bold text-slate-700">Total Repayable:</span>
              <span className="font-extrabold text-[#167D78]">KES {quote.totalRepayable.toLocaleString()}</span>
            </div>
            <div className="flex justify-between bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-700">Monthly Installment:</span>
              <span className="font-extrabold text-[#101C2C]">KES {quote.monthlyInstallment.toLocaleString()}</span>
            </div>
          </div>

          <div className="bg-[#FAF4E9] p-3 rounded-xl border border-[#F4E3C1] text-xs text-slate-700 flex items-start gap-2.5">
            <Phone className="w-4 h-4 text-[#B7791F] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[#101C2C]">M-Pesa Disbursement Destination</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Funds will be disbursed instantly via B2C to registered phone: <span className="font-mono font-bold">{customer.phone}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="flex-2 py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Confirm Terms & Disclosures
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Mandatory Regulatory Disclosures & Consent */}
      {step === 3 && (
        <div className="space-y-4 pt-2">
          {liveError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{liveError}</div>}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#101C2C] border-b border-slate-200 pb-2">
              <ShieldCheck className="w-4 h-4 text-[#167D78]" />
              <span>Central Bank of Kenya (CBK) Pre-Contractual Disclosure</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Pursuant to the Central Bank of Kenya (Digital Credit Providers) Regulations 2022, you are hereby advised
              of the Total Cost of Credit of <span className="font-bold text-slate-900">KES {(quote.totalInterest + quote.totalFees).toLocaleString()}</span>.
              Late payment fee is 1.5% per month after a 5-day grace period.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={crbConsent}
                onChange={(e) => setCrbConsent(e.target.checked)}
                className="mt-0.5 rounded text-[#167D78] focus:ring-[#167D78]"
              />
              <span className="text-slate-700 leading-normal">
                I hereby authorize <span className="font-semibold">{brand.institutionName}</span> to query my credit report
                from licensed Credit Reference Bureaus (Metropol, TransUnion, CreditInfo).
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={termsConsent}
                onChange={(e) => setTermsConsent(e.target.checked)}
                className="mt-0.5 rounded text-[#167D78] focus:ring-[#167D78]"
              />
              <span className="text-slate-700 leading-normal">
                I agree to the Digital Lending Master Agreement and consent to electronic communication via SMS and M-Pesa.
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!crbConsent || !termsConsent || isSubmitting}
              onClick={handleNext}
              className="flex-2 py-3 bg-[#167D78] hover:bg-[#126561] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Loan Application'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Application Submitted & Tracking */}
      {step === 4 && (
        <div className="py-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#E7F3F2] text-[#167D78] flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-[#101C2C]">Application Submitted!</h3>
            <p className="text-xs text-slate-500 mt-1">
              Your request has been routed to automated underwriting and credit assessment.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left font-mono text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Application Ref:</span>
              <span className="font-bold text-[#101C2C]">{submittedAppId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Requested Amount:</span>
              <span className="font-bold text-[#167D78]">KES {amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Tenor:</span>
              <span>{tenorMonths} Months</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Est. Monthly Repayment:</span>
              <span>KES {quote.monthlyInstallment.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="text-amber-600 font-bold">Under Review</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => setCustomerView('loans')}
              className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Track Active Loans & Schedules
            </button>
            <button
              type="button"
              onClick={() => setCustomerView('dashboard')}
              className="w-full py-2.5 text-slate-600 hover:text-slate-900 text-xs font-medium"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
