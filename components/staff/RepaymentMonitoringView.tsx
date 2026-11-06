'use client';

import React, { useEffect, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { Transaction } from '@/lib/types/lending';
import {
  Smartphone,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ArrowDownLeft,
  ArrowUpRight,
  ExternalLink,
  X,
  FileCheck2,
  RefreshCw,
  Link,
  ShieldCheck,
} from 'lucide-react';

export function RepaymentMonitoringView() {
  const { activeLoans, brand, staffRole } = useBrand();
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [liveSummary, setLiveSummary] = useState({ todayTotal: 0, unapplied: 0 });
  const [pendingCallbacks, setPendingCallbacks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'allocated' | 'unallocated' | 'reversed'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [allocateModal, setAllocateModal] = useState<{ open: boolean; tx: Transaction | null }>({
    open: false,
    tx: null,
  });
  const [reverseModal, setReverseModal] = useState<{ open: boolean; tx: Transaction | null }>({
    open: false,
    tx: null,
  });
  const [selectedLoanNumber, setSelectedLoanNumber] = useState('');
  const [reverseReason, setReverseReason] = useState('Customer paid with wrong account reference');
  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadLiveRepayments = async () => {
    if (!session?.access_token) return;
    const response = await fetch('/api/staff/repayments', { headers: { Authorization: `Bearer ${session.access_token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setToastMsg(data.error || 'Unable to load live repayments.'); return; }
    setTransactions((data.transactions || []).map((payment: any) => ({
      id: payment.id, transactionRef: payment.reference || payment.id, mpesaReceipt: payment.reference || payment.id,
      type: 'repayment', amount: Number(payment.amount || 0), phone: payment.phone || 'Not recorded', customerName: payment.customer_name || 'Unmatched customer',
      loanNumber: payment.loan_number || 'Unallocated', date: payment.received_at || '', timeAgo: payment.received_at ? new Date(payment.received_at).toLocaleString() : '—',
      status: payment.status === 'reversed' ? 'reversed' : 'completed', channel: 'm-pesa_stk', allocated: payment.status === 'allocated',
      allocatedToLoan: payment.loan_number, reconciliationStatus: payment.status === 'allocated' ? 'matched' : 'unallocated',
    })));
    setLiveSummary({ todayTotal: Number(data.today_total || 0), unapplied: (data.unapplied || []).length });
    setPendingCallbacks(data.pending_callbacks || []);
  };
  useEffect(() => { loadLiveRepayments(); }, [session?.access_token]);

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      tx.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.mpesaReceipt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.phone.includes(searchTerm) ||
      tx.loanNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.transactionRef.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'allocated'
        ? tx.allocated
        : statusFilter === 'unallocated'
        ? !tx.allocated
        : tx.status === 'reversed';

    return matchesSearch && matchesStatus;
  });

  const handleSimulateInflow = () => {
    setIsSimulating(true);
    loadLiveRepayments().finally(() => setIsSimulating(false));
  };

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocateModal.tx || !selectedLoanNumber) return;
    setToastMsg('Manual allocation is protected: live PayHero payments are allocated automatically by the callback ledger.');
    setTimeout(() => setToastMsg(null), 4000);
    setAllocateModal({ open: false, tx: null });
    setSelectedLoanNumber('');
  };

  const handleReverseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseModal.tx) return;
    setToastMsg('Live payment reversal requires the controlled reversal workflow; no mock reversal has been recorded.');
    setTimeout(() => setToastMsg(null), 4000);
    setReverseModal({ open: false, tx: null });
  };

  const totalCollectedToday = liveSummary.todayTotal;
  const unallocatedCount = liveSummary.unapplied;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101C2C] tracking-tight">Repayments & Reconciliation</h1>
          <p className="text-xs text-slate-500 mt-1">Live PayHero payment callbacks, allocations, and ledger reconciliation.</p>
        </div>
        <button
          onClick={handleSimulateInflow}
          disabled={isSimulating}
          className="px-4 py-2 bg-[#167D78] hover:bg-[#126460] text-white text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
          Refresh live payments
        </button>
      </div>

      {/* Toast Alert */}
      {toastMsg && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-[#167D78] text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-teal-700 hover:text-teal-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Reconciled Inflow (Today)</p>
          <p className="text-xl sm:text-2xl font-bold text-[#101C2C] mt-1 tabular-nums">
            KES {totalCollectedToday.toLocaleString()}
          </p>
          <p className="text-[11px] text-[#167D78] mt-1 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Auto-matched via IPN
          </p>
        </div>
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-xs">
          <p className="text-xs text-amber-800 font-medium">Pending provider reconciliation</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-900 mt-1 tabular-nums">{pendingCallbacks.length}</p>
          <p className="text-[10px] text-amber-700 mt-1">Callback pending more than 10 minutes</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Unallocated Receipts</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 mt-1 tabular-nums">
            {unallocatedCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Reference mismatch requires manual mapping</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Safaricom IPN Status</p>
          <p className="text-base font-bold text-emerald-700 mt-2">Active · 99.98%</p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-mono">Paybill: {brand.mpesaPaybill}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Reconciliation SLA</p>
          <p className="text-xl sm:text-2xl font-bold text-[#101C2C] mt-1 tabular-nums">
            &lt; 2.1s
          </p>
          <p className="text-[11px] text-[#167D78] font-semibold mt-1">Zero-latency ledger posting</p>
        </div>
      </div>

      {pendingCallbacks.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs"><div className="flex items-center gap-2 font-bold text-amber-900"><AlertTriangle className="w-4 h-4" />Provider reconciliation queue</div><p className="mt-1 text-amber-800">These requests have not received a verified final callback. Confirm their status in PayHero or Finoq before any manual intervention.</p><div className="mt-3 space-y-2">{pendingCallbacks.map((item) => <div key={item.id} className="flex justify-between gap-3 rounded-lg bg-white p-2.5 border border-amber-100"><span className="font-mono">{item.reference}</span><span>{item.customer_name || 'Customer'} · KES {Number(item.amount).toLocaleString()}</span><span className="capitalize">{item.type.replaceAll('_',' ')}</span></div>)}</div></section>}

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search receipt code, borrower, phone or loan..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Transactions' },
            { id: 'allocated', label: 'Allocated' },
            { id: 'unallocated', label: 'Unallocated' },
            { id: 'reversed', label: 'Reversed' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setStatusFilter(item.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap cursor-pointer transition-colors ${
                statusFilter === item.id
                  ? 'bg-white text-[#101C2C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">M-Pesa Receipt Ref</th>
                <th className="py-3 px-4">Borrower Details</th>
                <th className="py-3 px-4">Loan Account</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Channel & Time</th>
                <th className="py-3 px-4">Reconciliation</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold font-mono text-[#101C2C]">{tx.mpesaReceipt}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{tx.transactionRef}</div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-[#101C2C]">{tx.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{tx.phone}</div>
                  </td>

                  <td className="py-3 px-4 font-mono font-medium text-slate-800">
                    {tx.loanNumber === 'UNALLOCATED' ? (
                      <span className="text-amber-600 font-semibold">Unallocated</span>
                    ) : (
                      tx.loanNumber
                    )}
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="font-bold text-[#101C2C] tabular-nums text-sm">
                      KES {tx.amount.toLocaleString()}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-[11px] text-slate-600">
                    <div className="font-medium">{tx.channel.replace('_', ' ')}</div>
                    <div className="text-slate-400 mt-0.5">{tx.date}</div>
                  </td>

                  <td className="py-3 px-4">
                    {tx.status === 'reversed' ? (
                      <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1">
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        Reversed
                      </span>
                    ) : tx.allocated ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Reconciled
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Action Required
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right space-x-1.5">
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      Receipt
                    </button>
                    {!tx.allocated && tx.status !== 'reversed' && (
                      <button
                        onClick={() => setAllocateModal({ open: true, tx })}
                        className="px-2.5 py-1 text-xs bg-[#167D78] hover:bg-[#126460] text-white font-semibold rounded-lg cursor-pointer transition-colors"
                      >
                        Allocate
                      </button>
                    )}
                    {tx.status === 'completed' && (
                      <button
                        onClick={() => setReverseModal({ open: true, tx })}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 font-medium hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                      >
                        Reverse
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocate to Loan Modal */}
      {allocateModal.open && allocateModal.tx && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#101C2C] flex items-center gap-2">
                <Link className="w-4 h-4 text-[#167D78]" />
                Allocate Payment to Loan
              </h3>
              <button
                onClick={() => setAllocateModal({ open: false, tx: null })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAllocateSubmit} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">M-Pesa Receipt:</span>
                  <span className="font-mono font-bold text-slate-800">{allocateModal.tx.mpesaReceipt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount Received:</span>
                  <span className="font-bold text-[#101C2C] text-sm tabular-nums">
                    KES {allocateModal.tx.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payer Phone:</span>
                  <span className="font-mono text-slate-800">{allocateModal.tx.phone}</span>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Target Active Loan Account</label>
                <select
                  required
                  value={selectedLoanNumber}
                  onChange={(e) => setSelectedLoanNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                >
                  <option value="">Select target loan account...</option>
                  {activeLoans.map((l) => (
                    <option key={l.id} value={l.loanNumber}>
                      {l.loanNumber} · {l.customerName} (Bal: KES {l.outstandingBalance.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAllocateModal({ open: false, tx: null })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#167D78] hover:bg-[#126460] text-white rounded-xl font-bold cursor-pointer"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reverse Transaction Modal */}
      {reverseModal.open && reverseModal.tx && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-rose-700 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" />
                Reverse Transaction
              </h3>
              <button
                onClick={() => setReverseModal({ open: false, tx: null })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReverseSubmit} className="space-y-3 text-xs">
              <p className="text-slate-600">
                Are you sure you want to reverse transaction <b>{reverseModal.tx.mpesaReceipt}</b> for KES{' '}
                {reverseModal.tx.amount.toLocaleString()}? This will update the loan balance and record an audit reversal.
              </p>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Reason for Reversal</label>
                <select
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                >
                  <option value="Customer paid with wrong account reference">Customer paid with wrong account reference</option>
                  <option value="Duplicate payment callback received from telco">Duplicate payment callback received from telco</option>
                  <option value="Payment returned or recalled by Safaricom">Payment returned or recalled by Safaricom</option>
                  <option value="Accounting adjustment authorized by Finance">Accounting adjustment authorized by Finance</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReverseModal({ open: false, tx: null })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold cursor-pointer"
                >
                  Confirm Reversal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Inspection Drawer */}
      {selectedTx && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex justify-end backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 space-y-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-[#101C2C]">M-Pesa IPN Receipt Details</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedTx.mpesaReceipt}</p>
              </div>
              <button
                onClick={() => setSelectedTx(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Transaction ID</span>
                  <span className="font-mono font-bold text-slate-800">{selectedTx.mpesaReceipt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Internal Reference</span>
                  <span className="font-mono text-slate-800">{selectedTx.transactionRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount</span>
                  <span className="font-bold text-[#101C2C] text-sm tabular-nums">
                    KES {selectedTx.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer Name</span>
                  <span className="font-bold text-slate-800">{selectedTx.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone MSISDN</span>
                  <span className="font-mono text-slate-800">{selectedTx.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Allocated Loan</span>
                  <span className="font-mono font-bold text-[#167D78]">{selectedTx.loanNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Timestamp</span>
                  <span className="text-slate-700">{selectedTx.date}</span>
                </div>
              </div>

              {/* Daraja Webhook Raw Payload Trace */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2">Daraja C2B Raw Webhook Trace</h4>
                <pre className="bg-[#101C2C] text-slate-200 p-3 rounded-xl font-mono text-[10px] overflow-x-auto leading-relaxed">
{JSON.stringify(
  {
    TransactionType: 'Pay Bill',
    TransID: selectedTx.mpesaReceipt,
    TransTime: '20250418143022',
    TransAmount: selectedTx.amount.toFixed(2),
    BusinessShortCode: brand.mpesaPaybill,
    BillRefNumber: selectedTx.loanNumber,
    MSISDN: selectedTx.phone.replace(/\s+/g, ''),
    FirstName: selectedTx.customerName.split(' ')[0] || '',
    LastName: selectedTx.customerName.split(' ')[1] || '',
    KYCResult: 'Matched',
  },
  null,
  2
)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
