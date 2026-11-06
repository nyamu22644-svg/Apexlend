'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { LoanAccount } from '@/lib/types/lending';
import {
  Wallet,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  Calculator,
  RefreshCw,
  FileText,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export function LoanAccountsView() {
  const { staffRole } = useBrand();
  const { session } = useAuth();
  const [activeLoans, setActiveLoans] = useState<LoanAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'in_arrears' | 'settled' | 'written_off'>('all');
  const [selectedLoan, setSelectedLoan] = useState<LoanAccount | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRestructureModal, setShowRestructureModal] = useState(false);
  const [showWriteOffModal, setShowWriteOffModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [newTenor, setNewTenor] = useState(12);
  const [justification, setJustification] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const loadLoans = useCallback(async () => {
    if (!session?.access_token) return;
    try { const response = await fetch('/api/staff/loans',{headers:{Authorization:`Bearer ${session.access_token}`}}); const body=await response.json().catch(()=>({})); if(!response.ok) throw new Error(body.error||'Unable to load loans');
      setActiveLoans((body.loans||[]).map((loan:any):LoanAccount=>({ id:loan.id,loanNumber:loan.loan_number,customerId:loan.customer_id,customerName:loan.customer_name,phone:loan.phone||'',nationalId:'Restricted',productId:'',productName:loan.product_name,principalAmount:Number(loan.principal_amount||0),totalRepayable:Number(loan.principal_amount||0),disbursedAmount:Number(loan.disbursed_amount||0),outstandingBalance:Number(loan.outstanding_balance||0),outstandingPrincipal:Number(loan.outstanding_principal||0),outstandingInterest:Number(loan.outstanding_interest||0),totalPaidAmount:Number(loan.total_paid||0),interestRate:Number(loan.interest_rate||0),termMonths:Number(loan.term_months||0),monthlyInstallment:Number(loan.monthly_installment||0),repaymentFrequency:'monthly',disbursedAt:loan.disbursed_at||'Not disbursed',maturityDate:'Not available',nextRepaymentDueDate:loan.next_due||'No unpaid installment',nextRepaymentAmount:0,daysUntilDue:0,status:loan.status==='active'?(Number(loan.days_in_arrears||0)>0?'in_arrears':'active'):loan.status,daysInArrears:Number(loan.days_in_arrears||0),installments:(loan.installments||[]).map((item:any)=>({installmentNumber:item.installment_number,dueDate:item.due_date,principalDue:Number(item.principal||0),interestDue:Number(item.interest||0),totalDue:Number(item.total_due||0),status:item.status})),repaymentSchedule:(loan.installments||[]).map((item:any)=>({installmentNumber:item.installment_number,dueDate:item.due_date,principal:Number(item.principal||0),interest:Number(item.interest||0),totalDue:Number(item.total_due||0),status:item.status})) }))); }
    catch(error){setFeedbackMsg(error instanceof Error?error.message:'Unable to load loans');}
  },[session?.access_token]);
  useEffect(()=>{void loadLoans();},[loadLoans]);

  const filteredLoans = activeLoans.filter((loan) => {
    const matchesSearch =
      loan.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loan.productName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPortfolio = activeLoans.reduce((acc, l) => acc + l.outstandingBalance, 0);
  const activeCount = activeLoans.filter((l) => l.status === 'active').length;
  const inArrearsCount = activeLoans.filter((l) => l.status === 'in_arrears').length;

  const handleRestructureSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    setFeedbackMsg(`Restructure request for ${selectedLoan.loanNumber} is pending an approved maker-checker servicing policy.`);
    setTimeout(() => setFeedbackMsg(null), 4000);
    setShowRestructureModal(false);
    setSelectedLoan(null);
  };

  const handleWriteOffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;
    setFeedbackMsg(`Write-off request for ${selectedLoan.loanNumber} is unavailable until the approved maker-checker servicing policy is configured.`);
    setTimeout(() => setFeedbackMsg(null), 4000);
    setShowWriteOffModal(false);
    setSelectedLoan(null);
  };

  // Calculate early settlement discount
  const getSettlementQuote = (loan: LoanAccount) => {
    const unearnedInterestDiscount = Math.round(loan.outstandingBalance * 0.08); // 8% interest rebate
    const netSettlement = loan.outstandingBalance - unearnedInterestDiscount;
    return {
      outstanding: loan.outstandingBalance,
      unearnedInterestDiscount,
      netSettlement,
      validUntil: '5 calendar days from quotation date',
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101C2C] tracking-tight">Loan Accounts Workspace</h1>
          <p className="text-xs text-slate-500 mt-1">
            Active credit facilities, repayment schedules, interest amortization, and portfolio health.
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-[#167D78] text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-teal-700 hover:text-teal-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Gross Loan Portfolio</p>
          <p className="text-xl sm:text-2xl font-bold text-[#101C2C] mt-1 tabular-nums">
            KES {(totalPortfolio / 1000).toFixed(1)}k
          </p>
          <p className="text-[11px] text-[#167D78] mt-1 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Earning interest
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Active Accounts</p>
          <p className="text-xl sm:text-2xl font-bold text-[#101C2C] mt-1 tabular-nums">
            {activeCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Performing in good standing</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">In Arrears (PAR)</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1 tabular-nums">
            {inArrearsCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Under collections follow-up</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Repayment Discipline</p>
          <p className="text-xl sm:text-2xl font-bold text-[#101C2C] mt-1 tabular-nums">
            96.8%
          </p>
          <p className="text-[11px] text-[#167D78] mt-1 font-semibold">On-time collection rate</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by loan account, borrower name, or product..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {(['all', 'active', 'in_arrears', 'settled', 'written_off'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === st
                  ? 'bg-white text-[#101C2C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Loan Accounts Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Loan Account</th>
                <th className="py-3 px-4">Borrower & Product</th>
                <th className="py-3 px-4 text-right">Disbursed</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-right">Installment</th>
                <th className="py-3 px-4">Next Due</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold font-mono text-[#101C2C]">{loan.loanNumber}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Disbursed {loan.disbursementDate || loan.disbursedAt}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-[#101C2C]">{loan.customerName}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{loan.productName}</div>
                  </td>

                  <td className="py-3 px-4 text-right font-medium text-slate-700 tabular-nums">
                    KES {loan.disbursedAmount.toLocaleString()}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="font-bold text-[#101C2C] tabular-nums">
                      KES {loan.outstandingBalance.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Paid: KES {loan.totalPaidAmount.toLocaleString()}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right tabular-nums text-slate-800 font-medium">
                    KES {loan.monthlyInstallment.toLocaleString()}
                  </td>

                  <td className="py-3 px-4 text-slate-600 text-[11px]">
                    <div className="font-medium text-slate-800">{loan.nextRepaymentDate || loan.nextRepaymentDueDate}</div>
                    {(loan.daysInArrears || 0) > 0 && (
                      <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                        {loan.daysInArrears} days past due
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {loan.status === 'active' && (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Active
                      </span>
                    )}
                    {loan.status === 'in_arrears' && (
                      <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        In Arrears
                      </span>
                    )}
                    {loan.status === 'settled' && (
                      <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-slate-400" />
                        Settled
                      </span>
                    )}
                    {loan.status === 'written_off' && (
                      <span className="text-[11px] font-semibold text-rose-800 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 text-rose-800" />
                        Written Off
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right space-x-1.5">
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setShowScheduleModal(true);
                      }}
                      className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      Schedule
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setShowQuoteModal(true);
                      }}
                      className="px-2.5 py-1 text-xs text-[#167D78] hover:text-[#126460] font-semibold hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                    >
                      Quote
                    </button>
                    <button
                      onClick={() => {
                        setSelectedLoan(loan);
                        setShowRestructureModal(true);
                      }}
                      className="px-2.5 py-1 text-xs text-amber-700 hover:text-amber-900 font-semibold hover:bg-amber-50 rounded-lg cursor-pointer transition-colors"
                    >
                      Restructure
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Repayment Schedule Modal */}
      {showScheduleModal && selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-base text-[#101C2C] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#167D78]" />
                  Amortization Schedule: {selectedLoan.loanNumber}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedLoan.customerName} · {selectedLoan.productName}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedLoan(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="py-2 px-3">Inst #</th>
                    <th className="py-2 px-3">Due Date</th>
                    <th className="py-2 px-3 text-right">Principal</th>
                    <th className="py-2 px-3 text-right">Interest</th>
                    <th className="py-2 px-3 text-right">Total Due</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {(
                    (selectedLoan.repaymentSchedule && selectedLoan.repaymentSchedule.length > 0
                      ? selectedLoan.repaymentSchedule
                      : (selectedLoan.installments || []).map((ins) => ({
                          installmentNumber: ins.installmentNumber,
                          dueDate: ins.dueDate,
                          principal: ins.principalDue || Math.round(ins.totalDue * 0.8),
                          interest: ins.interestDue || Math.round(ins.totalDue * 0.2),
                          totalDue: ins.totalDue,
                          status: ins.status,
                        }))
                    ) as Array<{
                      installmentNumber: number;
                      dueDate: string;
                      principal: number;
                      interest: number;
                      totalDue: number;
                      status: string;
                    }>
                  ).map((inst) => (
                    <tr key={inst.installmentNumber}>
                      <td className="py-2.5 px-3 font-mono font-medium">{inst.installmentNumber}</td>
                      <td className="py-2.5 px-3">{inst.dueDate}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">KES {inst.principal.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">KES {inst.interest.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#101C2C] tabular-nums">
                        KES {inst.totalDue.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[11px] font-semibold capitalize ${
                            inst.status === 'paid'
                              ? 'text-emerald-700'
                              : inst.status === 'overdue'
                              ? 'text-rose-700'
                              : 'text-slate-600'
                          }`}
                        >
                          {inst.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                Interest Method: Reducing Balance (Amortized Monthly)
              </span>
              <button
                onClick={() => {
                  setShowScheduleModal(false);
                  setSelectedLoan(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Early Settlement Quotation Modal */}
      {showQuoteModal && selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#101C2C] flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#167D78]" />
                Early Settlement Quotation
              </h3>
              <button
                onClick={() => {
                  setShowQuoteModal(false);
                  setSelectedLoan(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const quote = getSettlementQuote(selectedLoan);
              return (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Loan Account</span>
                      <span className="font-mono font-bold text-slate-800">{selectedLoan.loanNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross Outstanding Balance</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        KES {quote.outstanding.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-medium">Unearned Interest Rebate (Waiver)</span>
                      <span className="font-bold tabular-nums">- KES {quote.unearnedInterestDiscount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                      <span className="font-bold text-[#101C2C]">Net Settlement Payoff</span>
                      <span className="font-bold text-[#167D78] tabular-nums">
                        KES {quote.netSettlement.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Quote is generated under Kenya Consumer Protection Regulations. Unearned forward interest is rebated upon immediate payoff.
                  </p>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowQuoteModal(false);
                        setSelectedLoan(null);
                      }}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      onClick={() => {
                        setShowQuoteModal(false);
                        setSelectedLoan(null);
                        setFeedbackMsg(`Official early payoff statement generated for ${selectedLoan.loanNumber}.`);
                        setTimeout(() => setFeedbackMsg(null), 3000);
                      }}
                      className="px-4 py-2 bg-[#167D78] hover:bg-[#126460] text-white rounded-xl font-bold cursor-pointer"
                    >
                      Print Statement
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Restructure Modal */}
      {showRestructureModal && selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#101C2C] flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-amber-600" />
                Restructure Loan Facility
              </h3>
              <button
                onClick={() => {
                  setShowRestructureModal(false);
                  setSelectedLoan(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRestructureSubmit} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <p><b>Loan:</b> {selectedLoan.loanNumber} ({selectedLoan.customerName})</p>
                <p><b>Current Balance:</b> KES {selectedLoan.outstandingBalance.toLocaleString()}</p>
                <p><b>Current Tenor:</b> {selectedLoan.termMonths} months</p>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">New Tenor (Months)</label>
                <select
                  value={newTenor}
                  onChange={(e) => setNewTenor(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                >
                  <option value={6}>6 Months</option>
                  <option value={9}>9 Months</option>
                  <option value={12}>12 Months</option>
                  <option value={18}>18 Months</option>
                  <option value={24}>24 Months</option>
                </select>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Restructure Justification & Terms</label>
                <textarea
                  required
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="e.g. Borrower experienced cashflow shock. Tenor extended to lower monthly installment from KES 8,000 to KES 4,200."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowRestructureModal(false);
                    setShowWriteOffModal(true);
                  }}
                  className="text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Write-off Option
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRestructureModal(false);
                      setSelectedLoan(null);
                    }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
                  >
                    Apply Restructure
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Write-off Modal */}
      {showWriteOffModal && selectedLoan && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-700" />
                Write-Off Loan Account
              </h3>
              <button
                onClick={() => {
                  setShowWriteOffModal(false);
                  setSelectedLoan(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleWriteOffSubmit} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Are you sure you want to write off loan <b>{selectedLoan.loanNumber}</b> (KES{' '}
                {selectedLoan.outstandingBalance.toLocaleString()})? This will mark the asset as non-performing and transfer to loan loss reserve.
              </p>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Board Committee Resolution / Reason</label>
                <textarea
                  required
                  rows={3}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Provide board approval minute number or recovery exhaustion evidence..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowWriteOffModal(false);
                    setSelectedLoan(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Confirm Write-Off
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
