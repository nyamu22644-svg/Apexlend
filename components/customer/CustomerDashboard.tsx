'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, CreditCard, History, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useBrand } from '@/lib/brand-context';
import { CustomerHeader } from './CustomerHeader';

type Loan = { id: string; loan_number: string; status: string; principal: number; interest: number; fees: number; installments: { due_date: string; principal_due: number; interest_due: number; fee_due: number; status: string }[] };
type App = { id: string; application_number: string; status: string; product_name: string };
const money = (value: number) => `KES ${Number(value || 0).toLocaleString()}`;

async function getLoans(token: string) {
  const response = await fetch('/api/customer/loans', { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load loans');
  return body;
}

export function CustomerDashboard() {
  const { session } = useAuth();
  const { customer, setCustomerView } = useBrand();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!session?.access_token) return;
    try { const data = await getLoans(session.access_token); setLoans(data.loans || []); setApps(data.applications || []); }
    finally { setLoading(false); }
  }, [session?.access_token]);
  useEffect(() => { load(); }, [load]);
  const activeLoans = loans.filter((loan) => loan.status === 'active' || loan.status === 'pending_disbursement');
  const next = activeLoans.flatMap((loan) => loan.installments.map((item) => ({ ...item, loanNumber: loan.loan_number }))).filter((item) => item.status !== 'paid').sort((a,b) => a.due_date.localeCompare(b.due_date))[0];
  const outstanding = activeLoans.reduce((total, loan) => total + loan.principal + loan.interest + loan.fees, 0);
  const pending = apps.find((app) => !['approved', 'declined', 'cancelled'].includes(app.status));

  return <div className="space-y-4 pb-20">
    <CustomerHeader />
    {customer.profileCompletionPercentage < 100 && <div className="bg-[#FAF4E9] rounded-2xl p-4 border border-[#F4E3C1]"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-[#B7791F]" /><div><p className="text-xs font-bold text-[#101C2C]">Profile {customer.profileCompletionPercentage}% Complete</p><p className="text-[11px] text-slate-600">Complete identity verification to unlock lending.</p></div></div><button onClick={() => setCustomerView('kyc-wizard')} className="px-3 py-1.5 bg-[#167D78] text-white text-[11px] font-semibold rounded-lg">Verify Now</button></div></div>}
    <div className="bg-[#101C2C] text-white rounded-3xl p-6 relative overflow-hidden"><div className="flex items-center justify-between"><div><h2 className="text-xl font-bold">Hello, {customer.fullName.split(' ')[0] || 'Borrower'}</h2><p className="text-xs text-slate-300 mt-0.5">Welcome back!</p></div><div className="w-10 h-10 rounded-full bg-[#167D78] text-white flex items-center justify-center"><Check className="w-4 h-4" /></div></div></div>
    {pending && <div className="bg-white rounded-2xl p-4 border border-slate-200 flex justify-between"><div className="flex gap-3"><Clock className="w-4 h-4 text-amber-700" /><div><p className="text-xs font-bold">{pending.product_name}</p><p className="text-[11px] text-slate-500">Status: {pending.status.replaceAll('_', ' ')}</p></div></div><button onClick={() => setCustomerView('loans')} className="text-xs font-bold text-[#167D78]">Track →</button></div>}
    <div className="bg-white rounded-2xl p-5 border border-slate-200 space-y-4"><div><p className="text-xs text-slate-500">Available Loan Limit</p><p className="text-2xl font-extrabold font-mono">{customer.kycVerified ? money(customer.availableLoanLimit) : 'Complete KYC'}</p><p className="text-[11px] text-slate-500 mt-1">Calculated from the current staff-configured credit policy.</p></div><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E7F3F2] text-[#167D78]">{customer.accountStatus}</span><button onClick={() => setCustomerView('apply')} className="w-full py-3.5 bg-[#167D78] text-white text-sm font-semibold rounded-xl">Apply for a Loan</button></div>
    <div className="grid grid-cols-2 gap-3"><div className="bg-white rounded-2xl p-4 border border-slate-200"><p className="text-[11px] text-slate-500">Total Outstanding</p><p className="text-lg font-bold font-mono mt-1">{money(outstanding)}</p><span className="text-[10px] text-slate-400">Across {activeLoans.length} active loan{activeLoans.length===1?'':'s'}</span></div><div className="bg-white rounded-2xl p-4 border border-slate-200"><p className="text-[11px] text-slate-500">Next Repayment</p><p className="text-lg font-bold font-mono mt-1">{next ? money(next.principal_due + next.interest_due + next.fee_due) : '—'}</p><span className="text-[10px] text-slate-400">{next?.loanNumber || 'No repayment due'}</span><button onClick={() => setCustomerView('payments')} className="block text-[11px] font-semibold text-[#167D78] mt-1">View payments →</button></div></div>
    <div className="grid grid-cols-2 gap-3"><button onClick={() => setCustomerView('payments')} className="p-3 bg-white border border-slate-200 rounded-xl flex gap-2 text-left"><CreditCard className="w-4 h-4 text-emerald-700" /><div><p className="text-xs font-bold">Pay Loan</p><p className="text-[10px] text-slate-500">Payment options</p></div></button><button onClick={() => setCustomerView('loans')} className="p-3 bg-white border border-slate-200 rounded-xl flex gap-2 text-left"><History className="w-4 h-4 text-blue-700" /><div><p className="text-xs font-bold">Schedule</p><p className="text-[10px] text-slate-500">View installments</p></div></button></div>
    <div className="bg-white rounded-2xl p-5 border border-slate-200"><div className="flex justify-between"><h3 className="text-sm font-bold">Recent Transactions</h3><button onClick={() => setCustomerView('payments')} className="text-xs text-[#167D78]">View All</button></div><p className="pt-4 text-xs text-slate-500">{loading ? 'Loading account activity…' : 'Use Payments to see verified payment activity.'}</p></div>
  </div>;
}
