'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { CollectionRecord } from '@/lib/types/lending';
import {
  ShieldAlert,
  PhoneCall,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertOctagon,
  Calendar,
  User,
  Search,
  Filter,
  X,
  FileText,
  UserCheck,
} from 'lucide-react';

export function CollectionsArrearsView() {
  const { staffRole } = useBrand();
  const { session } = useAuth();
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [metrics, setMetrics] = useState({par_1_30:0,par_31_60:0,par_61_90:0,non_performing_ratio:null as number|null,portfolio_balance:0});
  const [searchQuery, setSearchQuery] = useState('');
  const [bucketFilter, setBucketFilter] = useState<string>('all');
  const [selectedRecord, setSelectedRecord] = useState<CollectionRecord | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpChannel, setFollowUpChannel] = useState('Phone Call');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [followUpOutcome, setFollowUpOutcome] = useState('Promise to Pay Secured');
  const [promiseAmount, setPromiseAmount] = useState<number>(0);
  const [promiseDate, setPromiseDate] = useState('');
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [newOfficerName, setNewOfficerName] = useState('Mercy Aoko');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const loadCollections = useCallback(async()=>{if(!session?.access_token)return;try{const response=await fetch('/api/staff/collections',{headers:{Authorization:`Bearer ${session.access_token}`}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'Unable to load collections');setMetrics(body.metrics||{par_1_30:0,par_31_60:0,par_61_90:0,non_performing_ratio:null,portfolio_balance:0});setCollections((body.cases||[]).map((item:any):CollectionRecord=>({id:item.id,loanNumber:item.loan_number,customerId:item.loan_id,customerName:item.customer_name,phone:item.phone||'',totalOutstanding:Number(item.overdue_arrears||0),overdueArrears:Number(item.overdue_arrears||0),daysPastDue:Number(item.days_past_due||0),ageingBucket:item.ageing_bucket,assignedOfficer:item.assigned_officer||'Unassigned',lastContactDate:item.last_contact_date||'No contact logged',nextFollowUpDate:item.next_follow_up_date||'Not scheduled',status:'active_followup',promiseToPayAmount:item.promise_to_pay?.amount?Number(item.promise_to_pay.amount):undefined,promiseToPayDate:item.promise_to_pay?.date,contactHistory:[]})));}catch(error){setToastMsg(error instanceof Error?error.message:'Unable to load collections');}},[session?.access_token]);
  useEffect(()=>{void loadCollections();},[loadCollections]);

  const filtered = collections.filter((c) => {
    const matchesSearch =
      c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.loanNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    const matchesBucket = bucketFilter === 'all' || c.ageingBucket === bucketFilter;
    return matchesSearch && matchesBucket;
  });

  const totalOverdue = collections.reduce((acc, c) => acc + c.overdueArrears, 0);

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (!session?.access_token) return;
    void fetch('/api/staff/collections',{method:'PATCH',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({loanAccountId:selectedRecord.customerId,channel:followUpChannel,outcome:followUpOutcome,notes:followUpNotes,promiseAmount:promiseAmount>0?promiseAmount:null,promiseDate:promiseDate||null})}).then(async response=>{if(!response.ok)throw new Error((await response.json()).error);setToastMsg(`Follow-up recorded for ${selectedRecord.customerName}.`);await loadCollections();}).catch(error=>setToastMsg(error.message));
    setTimeout(() => setToastMsg(null), 4000);
    setIsFollowUpModalOpen(false);
    setFollowUpNotes('');
    setPromiseAmount(0);
    setPromiseDate('');
    setSelectedRecord(null);
  };

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setToastMsg(`Assignment is pending the configured collections write workflow for ${selectedRecord.loanNumber}.`);
    setTimeout(() => setToastMsg(null), 4000);
    setIsReassignModalOpen(false);
    setSelectedRecord(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101C2C] tracking-tight">
            Collections & Arrears Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Portfolio at Risk (PAR) aging buckets, automated borrower reminders, and remediation.
          </p>
        </div>
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

      {/* PAR Aging Buckets Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">PAR 1-30 Days</p>
          <p className="text-xl sm:text-2xl font-bold text-[#101C2C] mt-1 tabular-nums">
            KES {Number(metrics.par_1_30).toLocaleString()}
          </p>
          <p className="text-[11px] text-amber-600 font-semibold mt-1">{metrics.portfolio_balance>0?`${((metrics.par_1_30/metrics.portfolio_balance)*100).toFixed(1)}% of Portfolio`:'No active portfolio'}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">PAR 31-60 Days</p>
          <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-1 tabular-nums">
            KES {Number(metrics.par_31_60).toLocaleString()}
          </p>
          <p className="text-[11px] text-amber-700 font-semibold mt-1">{metrics.portfolio_balance>0?`${((metrics.par_31_60/metrics.portfolio_balance)*100).toFixed(1)}% of Portfolio`:'No active portfolio'}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">PAR 61-90 Days</p>
          <p className="text-xl sm:text-2xl font-bold text-rose-600 mt-1 tabular-nums">
            KES {Number(metrics.par_61_90).toLocaleString()}
          </p>
          <p className="text-[11px] text-rose-600 font-semibold mt-1">{metrics.portfolio_balance>0?`${((metrics.par_61_90/metrics.portfolio_balance)*100).toFixed(1)}% of Portfolio`:'No active portfolio'}</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Non-Performing Ratio</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1 tabular-nums">
            {metrics.non_performing_ratio === null ? '—' : `${Number(metrics.non_performing_ratio).toLocaleString()}%`}
          </p>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">{metrics.non_performing_ratio === null?'No active portfolio': 'Live 90+ days overdue ratio'}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search delinquent borrower, phone or loan..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Delinquencies' },
            { id: 'PAR 1-30', label: '1-30 Days' },
            { id: 'PAR 31-60', label: '31-60 Days' },
            { id: 'PAR 61-90', label: '61-90 Days' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setBucketFilter(item.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap cursor-pointer transition-colors ${
                bucketFilter === item.id
                  ? 'bg-white text-[#101C2C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Collections Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Borrower & Loan</th>
                <th className="py-3 px-4 text-right">Overdue Arrears</th>
                <th className="py-3 px-4">Days Overdue & Bucket</th>
                <th className="py-3 px-4">Assigned Officer</th>
                <th className="py-3 px-4">Promise to Pay</th>
                <th className="py-3 px-4">Last Contact</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#101C2C]">{item.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {item.loanNumber} · {item.phone}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right font-bold text-rose-600 tabular-nums text-sm">
                    KES {item.overdueArrears.toLocaleString()}
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800">{item.daysPastDue} days</div>
                    <div className="text-[11px] text-amber-700 font-medium mt-0.5">
                      {item.ageingBucket}
                    </div>
                  </td>

                  <td className="py-3 px-4 text-[11px] text-slate-700 font-medium">
                    {item.assignedOfficer}
                  </td>

                  <td className="py-3 px-4 text-[11px]">
                    {item.promiseToPayAmount ? (
                      <div>
                        <span className="font-bold text-[#167D78] tabular-nums">
                          KES {item.promiseToPayAmount.toLocaleString()}
                        </span>
                        <div className="text-slate-400 text-[10px]">By {item.promiseToPayDate}</div>
                      </div>
                    ) : (
                      <span className="text-slate-400">None Recorded</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-[11px] text-slate-500">
                    <div>{item.lastContactDate}</div>
                    <div className="text-slate-400 text-[10px]">Follow up: {item.nextFollowUpDate}</div>
                  </td>

                  <td className="py-3 px-4 text-right space-x-1.5">
                    <button
                      onClick={() => setSelectedRecord(item)}
                      className="px-2.5 py-1 text-xs text-slate-700 hover:text-slate-900 font-medium hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                    >
                      History
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRecord(item);
                        setIsFollowUpModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs bg-[#167D78] hover:bg-[#126460] text-white font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      Log Contact
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Contact & Promise-to-Pay Modal */}
      {isFollowUpModalOpen && selectedRecord && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#101C2C] flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-[#167D78]" />
                Log Collections Contact
              </h3>
              <button
                onClick={() => {
                  setIsFollowUpModalOpen(false);
                  setSelectedRecord(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFollowUpSubmit} className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <p><b>Borrower:</b> {selectedRecord.customerName} ({selectedRecord.phone})</p>
                <p><b>Overdue Arrears:</b> KES {selectedRecord.overdueArrears.toLocaleString()}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Contact Channel</label>
                  <select
                    value={followUpChannel}
                    onChange={(e) => setFollowUpChannel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  >
                    <option value="Phone Call">Phone Call</option>
                    <option value="SMS Reminder">SMS Reminder</option>
                    <option value="Demand Notice">Statutory Demand Notice</option>
                    <option value="Field Visit">Field Officer Visit</option>
                  </select>
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Call Outcome</label>
                  <select
                    value={followUpOutcome}
                    onChange={(e) => setFollowUpOutcome(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  >
                    <option value="Promise to Pay Secured">Promise to Pay Secured</option>
                    <option value="Borrower Requested Restructure">Borrower Requested Restructure</option>
                    <option value="Unreachable / Switched Off">Unreachable / Switched Off</option>
                    <option value="Disputed Balance">Disputed Balance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 block mb-1">Discussion Notes & Detail</label>
                <textarea
                  required
                  rows={2}
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Record summary of discussion with borrower..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
              </div>

              {followUpOutcome === 'Promise to Pay Secured' && (
                <div className="grid grid-cols-2 gap-2 p-3 bg-teal-50 rounded-xl border border-teal-200">
                  <div>
                    <label className="font-bold text-[#167D78] block mb-1">Promised Amount (KES)</label>
                    <input
                      type="number"
                      required
                      value={promiseAmount || ''}
                      onChange={(e) => setPromiseAmount(Number(e.target.value))}
                      placeholder="e.g. 8500"
                      className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-[#167D78] block mb-1">Target Pay Date</label>
                    <input
                      type="date"
                      required
                      value={promiseDate}
                      onChange={(e) => setPromiseDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsFollowUpModalOpen(false);
                    setSelectedRecord(null);
                  }}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#167D78] hover:bg-[#126460] text-white rounded-xl font-bold cursor-pointer"
                >
                  Save Follow-Up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Drawer */}
      {selectedRecord && !isFollowUpModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex justify-end backdrop-blur-xs">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 space-y-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-base text-[#101C2C]">Collections Dossier</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedRecord.customerName} · {selectedRecord.loanNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 flex-1 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Overdue Arrears</span>
                  <span className="font-bold text-rose-600 text-sm tabular-nums">
                    KES {selectedRecord.overdueArrears.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Days Past Due</span>
                  <span className="font-bold text-slate-800">{selectedRecord.daysPastDue} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ageing Bucket</span>
                  <span className="font-bold text-amber-700">{selectedRecord.ageingBucket}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Assigned Officer</span>
                  <span className="font-medium text-slate-800">{selectedRecord.assignedOfficer}</span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 mb-2">Chronological Contact Logs</h4>
                <div className="space-y-2">
                  {selectedRecord.contactHistory?.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-slate-800">{item.channel}</span>
                        <span className="text-slate-400">{item.timestamp}</span>
                      </div>
                      <p className="text-slate-700">{item.notes}</p>
                      <div className="text-[10px] text-[#167D78] font-semibold">
                        Outcome: {item.outcome}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => setIsFollowUpModalOpen(true)}
                className="px-4 py-2 bg-[#167D78] hover:bg-[#126460] text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Log Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
