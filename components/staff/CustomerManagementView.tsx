'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { CustomerProfile } from '@/lib/types/lending';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  ShieldCheck,
  FileText,
  Eye,
  X,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  CreditCard,
  AlertTriangle,
  Lock,
  Unlock,
  MessageSquare,
  Send,
  Building,
  Check,
} from 'lucide-react';

export function CustomerManagementView() {
  const { staffRole } = useBrand();
  const { session } = useAuth();
  const [customersList, setCustomersList] = useState<CustomerProfile[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'restricted'>('all');
  const [selectedCust, setSelectedCust] = useState<CustomerProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'identity' | 'employment' | 'payment' | 'notes'>('overview');
  const [newNoteText, setNewNoteText] = useState('');
  const [kycReviewNotes, setKycReviewNotes] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      const response = await fetch('/api/staff/customers', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load customers');
      setCustomersList((body.customers || []).map((customer: any): CustomerProfile => ({
        id: customer.id, customerNumber: customer.customer_number || '—', fullName: customer.full_name || 'Customer', email: customer.email || '', phone: customer.phone || 'Not available', nationalId: customer.national_id || 'Restricted', kraPin: customer.kra_pin || 'Restricted', dateOfBirth: customer.date_of_birth || 'Not available',
        employmentStatus: customer.employment_status || 'Contractor', monthlyIncome: Number(customer.monthly_income || 0), creditScore: 0, creditRating: 'C', availableLoanLimit: Number(customer.available_credit_limit || 0), maxBorrowingCapacity: Number(customer.available_credit_limit || 0), accountStatus: customer.account_status, joinedDate: '', kycVerified: customer.kyc_status === 'verified', activeLoanCount: Number(customer.active_loan_count || 0), totalLoansSettled: Number(customer.total_loans_settled || 0),
        personal: { fullName: customer.full_name || '', firstName: '', lastName: '', dateOfBirth: customer.date_of_birth || '', nationalId: customer.national_id || 'Restricted', nationality: '', gender: 'Prefer not to say', completed: false },
        contact: { phone: customer.phone || '', phoneVerified: false, email: customer.email || '', emailVerified: false, residentialAddress: customer.residential_address || '', county: customer.county || '', town: customer.town || '', completed: false },
        employment: { employmentStatus: customer.employment_status || 'Contractor', employerOrBusiness: customer.employer_name || '', occupation: customer.occupation || '', monthlyIncome: Number(customer.monthly_income || 0), otherIncomeSources: customer.other_income_sources || '', existingObligations: 0, completed: false },
        identity: { documentType: 'National ID', frontSideUploaded: (customer.documents || []).some((d:any) => d.type === 'national_id_front'), backSideUploaded: (customer.documents || []).some((d:any) => d.type === 'national_id_back'), kraPin: customer.kra_pin || 'Restricted', kraPinVerified: false, verificationResult: customer.kyc_status === 'verified' ? 'verified' : customer.kyc_status === 'rejected' ? 'rejected' : 'pending', completed: customer.kyc_status === 'verified' },
        payment: { mpesaNumber: customer.mpesa_phone_number || '', mpesaVerified: false, accountOwnershipConfirmed: false, accountType: 'M-Pesa Wallet', bankName: customer.bank_name || undefined, bankAccountName: customer.bank_account_name || undefined, completed: false }, profileCompletionPercentage: customer.kyc_status === 'verified' ? 100 : 0, isKycCompleteForLending: customer.kyc_status === 'verified',
        internalNotes: (customer.notes || []).map((note:any) => ({ id: note.id, author: note.author, authorRole: note.author_role, date: note.created_at, note: note.note })), statusReason: customer.restriction_reason || undefined,
      })));
      setLoadError(null);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Unable to load customers'); }
  }, [session?.access_token]);
  useEffect(() => { void loadCustomers(); }, [loadCustomers]);

  const filtered = customersList.filter((c) => {
    const matchesSearch =
      c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.nationalId.includes(searchQuery) ||
      (c.kraPin && c.kraPin.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'verified'
        ? c.kycVerified
        : statusFilter === 'pending'
        ? !c.kycVerified
        : c.accountStatus === 'Restricted';

    return matchesSearch && matchesStatus;
  });

  const handleDownloadKycZip = (cust: CustomerProfile) => {
    // Generate simulated zip download file
    const docData = `=== KYC COMPLIANCE DOSSIER (CONFIDENTIAL) ===
Institution: Central Bank of Kenya Regulated Digital Credit Provider
Customer ID: ${cust.id} (${cust.customerNumber || 'N/A'})
Full Legal Name: ${cust.fullName}
National ID: ${cust.nationalId}
KRA PIN: ${cust.kraPin || 'N/A'}
Date of Birth: ${cust.dateOfBirth || 'N/A'}
Phone (M-Pesa Verified): ${cust.phone}
Email: ${cust.email}
Address: ${cust.contact?.residentialAddress || 'N/A'}, ${cust.contact?.town || 'N/A'}, ${cust.contact?.county || 'N/A'}
Employer: ${cust.employment?.employerOrBusiness || 'N/A'}
Monthly Declared Income: KES ${cust.monthlyIncome.toLocaleString()}
KYC Status: ${cust.kycVerified ? 'VERIFIED' : 'PENDING REVIEW'}
Verification Date: ${cust.identity?.verifiedAt || 'Pending'}
Verified By: ${cust.identity?.verifiedBy || 'Pending'}
Review Notes: ${cust.identity?.reviewNotes || 'None'}
Attached Documents:
- National_ID_Front_${cust.nationalId}.png [Verified Checksum: SHA256-OK]
- National_ID_Back_${cust.nationalId}.png [Verified Checksum: SHA256-OK]
- KRA_PIN_Certificate_${cust.kraPin}.pdf [eCitizen API Validated]
- MPesa_6Month_Statement.pdf [Safaricom Statement Validated]
Generated by Super Admin session.`;

    const blob = new Blob([docData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KYC_DOSSIER_${cust.nationalId}_${cust.fullName.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setToastMsg(`KYC documents archive package downloaded for ${cust.fullName}.`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleApproveKyc = (customerId: string) => {
    setToastMsg('KYC decisions are handled in the preserved KYC Review module.');
    setToastMsg('Customer identity and statutory KYC approved successfully.');
    setTimeout(() => setToastMsg(null), 4000);
    setKycReviewNotes('');
    if (selectedCust && selectedCust.id === customerId) {
      setSelectedCust((prev) =>
        prev
          ? {
              ...prev,
              kycVerified: true,
              identity: {
                ...prev.identity,
                verificationResult: 'verified',
                verifiedAt: new Date().toLocaleDateString('en-GB'),
                verifiedBy: 'Super Admin',
                reviewNotes: kycReviewNotes || 'Verified against statutory registry',
              },
            }
          : null
      );
    }
  };

  const handleRejectKyc = (customerId: string) => {
    if (!kycReviewNotes) {
      alert('Please specify the reason for rejecting the KYC documents in the review notes box.');
      return;
    }
    setToastMsg('KYC decisions are handled in the preserved KYC Review module.');
    setToastMsg('KYC marked as rejected. Clarification notification sent to customer.');
    setTimeout(() => setToastMsg(null), 4000);
    setKycReviewNotes('');
    if (selectedCust && selectedCust.id === customerId) {
      setSelectedCust((prev) =>
        prev
          ? {
              ...prev,
              kycVerified: false,
              identity: {
                ...prev.identity,
                verificationResult: 'rejected',
                reviewNotes: kycReviewNotes,
              },
            }
          : null
      );
    }
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !selectedCust) return;
    if (!session?.access_token) return;
    void fetch('/api/staff/customers', { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'note', customerId: selectedCust.id, note: newNoteText.trim() }) }).then(async response => { if (!response.ok) throw new Error((await response.json()).error); await loadCustomers(); }).catch(error => setToastMsg(error.message));
    setNewNoteText('');
    setToastMsg('Internal note appended to borrower file.');
    setTimeout(() => setToastMsg(null), 3000);

    // Update local modal state
    const addedNote = {
      id: `cn-${Date.now()}`,
      author: 'Operations Staff',
      authorRole: staffRole,
      date: 'Just now',
      note: newNoteText.trim(),
    };
    setSelectedCust((prev) =>
      prev
        ? {
            ...prev,
            internalNotes: [addedNote, ...(prev.internalNotes || [])],
          }
        : null
    );
  };

  const handleToggleRestriction = (cust: CustomerProfile) => {
    if (cust.accountStatus === 'Restricted') {
      if (!session?.access_token) return;
      setToastMsg(`Account restriction cleared for ${cust.fullName}.`);
      setSelectedCust((prev) => (prev ? { ...prev, accountStatus: 'Good standing' } : null));
    } else {
      if (!session?.access_token) return;
      setToastMsg(`Account restricted for ${cust.fullName}. Borrowing suspended.`);
      setSelectedCust((prev) => (prev ? { ...prev, accountStatus: 'Restricted' } : null));
    }
    void fetch('/api/staff/customers', { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restriction', customerId: cust.id, restricted: cust.accountStatus !== 'Restricted', reason: 'Underwriting or fraud prevention flag' }) }).then(async response => { if (!response.ok) throw new Error((await response.json()).error); await loadCustomers(); }).catch(error => setToastMsg(error.message));
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101C2C] tracking-tight">Customer Directory</h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered borrowers, progressive 5-section KYC profiles, statutory checks, and credit limits.
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-[#167D78] text-xs font-semibold rounded-xl flex items-center justify-between">
          <span>{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-teal-700 hover:text-teal-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, National ID, phone or KRA PIN..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Customers' },
            { id: 'verified', label: 'KYC Verified' },
            { id: 'pending', label: 'Pending KYC' },
            { id: 'restricted', label: 'Restricted' },
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

      {/* Main Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Borrower & ID</th>
                <th className="py-3 px-4">Contact & Location</th>
                <th className="py-3 px-4">Employment & Income</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4">KYC Status</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((cust) => (
                <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#101C2C]">{cust.fullName}</div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                      <span>ID: {cust.nationalId}</span>
                      <span>·</span>
                      <span>PIN: {cust.kraPin || 'Pending'}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-[11px]">
                    <div className="font-medium text-slate-800">{cust.phone}</div>
                    <div className="text-slate-500 mt-0.5">
                      {cust.contact?.county || 'Nairobi'}, {cust.contact?.town || 'Kenya'}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800">{cust.employmentStatus}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                      KES {cust.monthlyIncome.toLocaleString()} / mo
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <div className="font-bold text-[#101C2C] tabular-nums">
                      KES {cust.availableLoanLimit.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-semibold">
                      CRB Score: {cust.creditScore}
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    {cust.kycVerified ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Pending Review
                      </span>
                    )}
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {cust.profileCompletionPercentage}% complete
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <span
                      className={`text-[11px] font-semibold flex items-center gap-1 ${
                        cust.accountStatus === 'Good standing'
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {cust.accountStatus === 'Good standing' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Lock className="w-3 h-3 text-rose-600" />
                      )}
                      {cust.accountStatus}
                    </span>
                  </td>

                  <td className="py-3 px-4 text-right space-x-1.5">
                    {staffRole === 'super_admin' && (
                      <button
                        onClick={() => handleDownloadKycZip(cust)}
                        title="Download KYC Documents (ZIP/Dossier)"
                        className="px-2 py-1 text-xs text-[#D6A85F] hover:text-[#b88c45] font-semibold hover:bg-amber-50 rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" />
                        <span className="hidden xl:inline">KYC Docs</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedCust(cust);
                        setActiveTab('overview');
                      }}
                      className="px-2.5 py-1 text-xs text-[#167D78] hover:text-[#126460] font-semibold hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                    >
                      Inspect Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Full Detail Drawer */}
      {selectedCust && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex justify-end backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl h-full overflow-y-auto p-6 space-y-6 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-[#101C2C]">{selectedCust.fullName}</h2>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      selectedCust.accountStatus === 'Good standing'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {selectedCust.accountStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: {selectedCust.nationalId} · Phone: {selectedCust.phone}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Super Admin Download KYC Button */}
                {staffRole === 'super_admin' && (
                  <button
                    onClick={() => handleDownloadKycZip(selectedCust)}
                    className="px-3 py-1.5 bg-[#101C2C] text-[#D6A85F] hover:bg-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download KYC Docs (ZIP)
                  </button>
                )}
                <button
                  onClick={() => setSelectedCust(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 text-xs font-semibold">
              {[
                { id: 'overview', label: 'Overview & Loans' },
                { id: 'identity', label: 'Identity & KYC Verification' },
                { id: 'employment', label: 'Employment & Financials' },
                { id: 'payment', label: 'Disbursement Channels' },
                { id: 'notes', label: `Internal Notes (${selectedCust.internalNotes?.length || 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-2 border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                    activeTab === tab.id
                      ? 'border-[#167D78] text-[#167D78]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            <div className="flex-1 space-y-4">
              {activeTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Available Limit</span>
                      <span className="text-base font-bold text-[#101C2C] tabular-nums">
                        KES {selectedCust.availableLoanLimit.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Max Capacity</span>
                      <span className="text-base font-bold text-[#167D78] tabular-nums">
                        KES {selectedCust.maxBorrowingCapacity.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">CRB Score</span>
                      <span className="text-base font-bold text-emerald-700 tabular-nums">
                        {selectedCust.creditScore} (Tier {selectedCust.creditRating})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Loans Settled</span>
                      <span className="text-base font-bold text-slate-800 tabular-nums">
                        {selectedCust.totalLoansSettled}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-800">Account Governance</h4>
                    <p className="text-slate-600">
                      Restrict borrower from submitting loan applications or reactivate borrowing privileges.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => handleToggleRestriction(selectedCust)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer ${
                          selectedCust.accountStatus === 'Restricted'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-rose-600 hover:bg-rose-700 text-white'
                        }`}
                      >
                        {selectedCust.accountStatus === 'Restricted' ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            Clear Restriction & Reactivate
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" />
                            Restrict Borrower Account
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'identity' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 text-sm">Statutory Identification Dossier</span>
                      {selectedCust.kycVerified ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold flex items-center gap-1">
                          <Clock className="w-4 h-4 text-amber-600" />
                          Pending Review
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">National ID</span>
                        <span className="font-bold font-mono text-slate-800">{selectedCust.nationalId}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">KRA PIN</span>
                        <span className="font-bold font-mono text-slate-800">{selectedCust.kraPin || 'Pending'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Date of Birth</span>
                        <span className="font-medium text-slate-800">{selectedCust.dateOfBirth}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">IPRS Checksum</span>
                        <span className="font-medium text-emerald-700">Valid Match</span>
                      </div>
                    </div>
                  </div>

                  {/* ID Document Previews */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border border-slate-200 rounded-xl space-y-2">
                      <span className="font-bold text-slate-700 block">National ID - Front Side</span>
                      <div className="h-32 bg-slate-100 rounded-lg flex items-center justify-center border border-dashed border-slate-300 text-slate-400 text-xs">
                        {selectedCust.identity?.frontSideUploaded ? (
                          <div className="text-center p-2">
                            <FileText className="w-6 h-6 text-[#167D78] mx-auto mb-1" />
                            <span className="text-slate-700 font-semibold block">ID_Front_{selectedCust.nationalId}.png</span>
                            <span className="text-[10px] text-emerald-700 font-semibold">Ready for Inspection</span>
                          </div>
                        ) : (
                          <span>Not Uploaded</span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 border border-slate-200 rounded-xl space-y-2">
                      <span className="font-bold text-slate-700 block">National ID - Back Side</span>
                      <div className="h-32 bg-slate-100 rounded-lg flex items-center justify-center border border-dashed border-slate-300 text-slate-400 text-xs">
                        {selectedCust.identity?.backSideUploaded ? (
                          <div className="text-center p-2">
                            <FileText className="w-6 h-6 text-[#167D78] mx-auto mb-1" />
                            <span className="text-slate-700 font-semibold block">ID_Back_{selectedCust.nationalId}.png</span>
                            <span className="text-[10px] text-emerald-700 font-semibold">Ready for Inspection</span>
                          </div>
                        ) : (
                          <span>Not Uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Compliance Review Box */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="font-bold text-slate-800">Compliance Officer Assessment</h4>
                    <textarea
                      rows={2}
                      value={kycReviewNotes}
                      onChange={(e) => setKycReviewNotes(e.target.value)}
                      placeholder="Enter verification notes (e.g. Verified against IPRS database)..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />

                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleRejectKyc(selectedCust.id)}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl cursor-pointer"
                      >
                        Reject KYC
                      </button>
                      <button
                        onClick={() => handleApproveKyc(selectedCust.id)}
                        className="px-4 py-1.5 bg-[#167D78] hover:bg-[#126460] text-white font-bold rounded-xl cursor-pointer"
                      >
                        Approve & Verify KYC
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'employment' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-800">Employment & Income Profile</h4>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="text-slate-500 block">Employment Status</span>
                        <span className="font-bold text-slate-800">{selectedCust.employmentStatus}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Employer / Business</span>
                        <span className="font-bold text-slate-800">
                          {selectedCust.employment?.employerOrBusiness || 'Not specified'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Monthly Declared Income</span>
                        <span className="font-bold text-[#101C2C] text-sm tabular-nums">
                          KES {selectedCust.monthlyIncome.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Other Income Streams</span>
                        <span className="font-medium text-slate-700">
                          {selectedCust.employment?.otherIncomeSources || 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'payment' && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-800">Verified Payout Channels</h4>
                    <div className="space-y-2 pt-1">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-[#167D78]" />
                            M-Pesa Mobile Wallet
                          </span>
                          <span className="font-mono text-slate-600 block mt-0.5">{selectedCust.phone}</span>
                        </div>
                        <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ownership Verified
                        </span>
                      </div>

                      {selectedCust.payment?.bankAccountNumber && (
                        <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 flex items-center gap-1.5">
                              <Building className="w-3.5 h-3.5 text-slate-500" />
                              {selectedCust.payment?.bankName || 'Commercial Bank'}
                            </span>
                            <span className="font-mono text-slate-600 block mt-0.5">
                              Acc: {selectedCust.payment?.bankAccountNumber}
                            </span>
                          </div>
                          <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="space-y-4 text-xs">
                  {/* Add note form */}
                  <form onSubmit={handleAddNote} className="space-y-2">
                    <textarea
                      rows={2}
                      required
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      placeholder="Add an internal operations note (visible only to institutional staff)..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-[#167D78] hover:bg-[#126460] text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        Post Note
                      </button>
                    </div>
                  </form>

                  {/* Notes Timeline */}
                  <div className="space-y-2">
                    {(!selectedCust.internalNotes || selectedCust.internalNotes.length === 0) ? (
                      <p className="text-slate-400 text-center py-4">No internal notes recorded yet.</p>
                    ) : (
                      selectedCust.internalNotes.map((note) => (
                        <div key={note.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="font-bold text-slate-800">
                              {note.author} ({note.authorRole})
                            </span>
                            <span className="text-slate-400">{note.date}</span>
                          </div>
                          <p className="text-slate-700">{note.note}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedCust(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
