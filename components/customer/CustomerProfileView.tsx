'use client';

import React, { useEffect, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import {
  User,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Mail,
  Award,
  Lock,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertCircle,
  Briefcase,
  CreditCard,
  Bell,
  HelpCircle,
  FileCheck,
  LogOut,
  Edit2,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/shared/Modal';
import { useAuth } from '@/lib/auth-context';

export function CustomerProfileView() {
  const { customer, brand, logoutCustomer, setCustomerView } = useBrand();
  const { session, signOut } = useAuth();

  // Accordion section states
  const [openSection, setOpenSection] = useState<'personal' | 'contact' | 'employment' | 'identity' | 'payment' | null>(
    'personal'
  );

  // Modals
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureReason, setClosureReason] = useState('No longer need digital credit');
  const [closureSubmitted, setClosureSubmitted] = useState(false);
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);
  const [complaintCategory, setComplaintCategory] = useState('Transaction or Payment Dispute');
  const [complaintDescription, setComplaintDescription] = useState('');
  const [complaintEvidence, setComplaintEvidence] = useState<File | null>(null);
  const [ticketNumber, setTicketNumber] = useState('CBK-89210');
  const [complaints, setComplaints] = useState<Array<{ id: string; complaint_number: string; subject: string; status: string; created_at: string }>>([]);
  const [closureRequests, setClosureRequests] = useState<Array<{ id: string; status: string; requested_at: string }>>([]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch('/api/customer/support', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => response.json().then((body) => ({ response, body })))
      .then(({ response, body }) => { if (response.ok) { setComplaints(body.complaints || []); setClosureRequests(body.closure_requests || []); } })
      .catch(() => undefined);
  }, [session?.access_token, complaintSubmitted, closureSubmitted]);

  const toggleSection = (section: 'personal' | 'contact' | 'employment' | 'identity' | 'payment') => {
    setOpenSection(openSection === section ? null : section);
  };

  const [supportError, setSupportError] = useState('');
  const sendConfirmationEmail = async (notificationId?: string) => {
    if (!notificationId || !session?.access_token || !process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    // The Edge Function verifies this customer's session and owns all provider secrets.
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/customer-email-notification`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId }) }).catch(() => undefined);
  };
  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setSupportError('');
    try { const r = await fetch('/api/customer/support', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'complaint', subject: complaintCategory, description: complaintDescription }) }); const body = await r.json(); if (!r.ok) throw new Error(body.error); if (complaintEvidence && body.complaint?.complaint_id) { const form = new FormData(); form.append('complaintId', body.complaint.complaint_id); form.append('file', complaintEvidence); const upload = await fetch('/api/customer/support/evidence', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form }); if (!upload.ok) { const uploadBody = await upload.json().catch(() => ({})); throw new Error(uploadBody.error || 'Complaint was saved, but evidence could not be uploaded'); } } setTicketNumber(body.complaint.complaint_number); setComplaintSubmitted(true); void sendConfirmationEmail(body.notificationId); }
    catch (error) { setSupportError(error instanceof Error ? error.message : 'Unable to submit complaint'); }
  };

  const handleClosureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setSupportError('');
    try { const r = await fetch('/api/customer/support', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'closure', reason: closureReason }) }); const body = await r.json(); if (!r.ok) throw new Error(body.error); setClosureSubmitted(true); void sendConfirmationEmail(body.notificationId); }
    catch (error) { setSupportError(error instanceof Error ? error.message : 'Unable to request account closure'); }
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 rounded-full bg-[#101C2C] text-[#D6A85F] flex items-center justify-center font-bold text-base shrink-0">
            {customer.fullName
              .split(' ')
              .map((n) => n[0])
              .join('') || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-[#101C2C]">{customer.fullName}</h2>
              {customer.kycVerified && <CheckCircle2 className="w-4 h-4 text-[#167D78]" />}
            </div>
            <p className="text-xs text-slate-500 font-mono">{customer.phone || customer.email}</p>
            <span
              className={`inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                customer.kycVerified
                  ? 'bg-[#E7F3F2] text-[#167D78]'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {customer.kycVerified ? 'Tier 1 KYC Verified' : 'Incomplete KYC'}
            </span>
          </div>
        </div>

        <button
          onClick={() => setCustomerView('kyc-wizard')}
          className="p-2 text-slate-400 hover:text-[#167D78] rounded-lg hover:bg-slate-50 cursor-pointer"
          title="Edit Profile in KYC Wizard"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* Profile Completion Indicator */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold text-[#101C2C]">Profile Completion</span>
          <span className="font-mono font-bold text-[#167D78]">
            {customer.profileCompletionPercentage}% Complete
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#167D78] rounded-full transition-all duration-300"
            style={{ width: `${customer.profileCompletionPercentage}%` }}
          />
        </div>
        {customer.profileCompletionPercentage < 100 && (
          <div className="flex justify-between items-center pt-1 text-[11px]">
            <span className="text-slate-500">Finish all 5 sections to unlock maximum borrowing limits</span>
            <button
              onClick={() => setCustomerView('kyc-wizard')}
              className="text-[#167D78] font-bold hover:underline"
            >
              Verify →
            </button>
          </div>
        )}
      </div>

      {/* Credit Standing & Limit Card */}
      <div className="bg-[#101C2C] text-white rounded-2xl p-5 shadow-sm space-y-2.5">
        <div className="flex justify-between items-center text-xs text-slate-300">
          <span>Metropol & TransUnion CRB Rating</span>
          <span className="text-[#D6A85F] font-bold font-mono">Tier {customer.creditRating}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono text-white tabular-nums">
            {customer.creditScore}
          </span>
          <span className="text-xs text-emerald-400 font-medium">/ 900 Standing</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Approved digital loan borrowing capacity up to KES {customer.maxBorrowingCapacity.toLocaleString()}.
        </p>
      </div>

      {/* THE 5 PROGRESSIVE KYC SECTIONS */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          KYC & Regulatory Profile (5 Sections)
        </h3>

        {/* Section 1: Personal Information */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <button
            onClick={() => toggleSection('personal')}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#E7F3F2] text-[#167D78] flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#101C2C]">1. Personal Information</p>
                <p className="text-[11px] text-slate-500">Legal names, date of birth, National ID</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#167D78] px-2 py-0.5 rounded-full bg-[#E7F3F2]">
                Verified
              </span>
              {openSection === 'personal' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'personal' && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Full Legal Names:</span>
                <span className="font-bold text-[#101C2C]">{customer.personal.fullName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Date of Birth:</span>
                <span>{customer.personal.dateOfBirth}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">National ID:</span>
                <span className="font-bold">{customer.personal.nationalId}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Nationality:</span>
                <span>{customer.personal.nationality}</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Contact Information */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <button
            onClick={() => toggleSection('contact')}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#101C2C]">2. Contact Information</p>
                <p className="text-[11px] text-slate-500">Phone, email, residential address</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#167D78] px-2 py-0.5 rounded-full bg-[#E7F3F2]">
                Verified
              </span>
              {openSection === 'contact' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'contact' && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Mobile Phone:</span>
                <span className="font-bold text-[#167D78]">{customer.contact.phone} (Verified)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Email Address:</span>
                <span className="font-sans text-slate-700">{customer.contact.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Residential Address:</span>
                <span className="font-sans text-slate-700">{customer.contact.residentialAddress}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">County & Town:</span>
                <span>{customer.contact.town}, {customer.contact.county}</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Employment and Income */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <button
            onClick={() => toggleSection('employment')}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#101C2C]">3. Employment & Income</p>
                <p className="text-[11px] text-slate-500">Employer, occupation, monthly income</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#167D78] px-2 py-0.5 rounded-full bg-[#E7F3F2]">
                Assessed
              </span>
              {openSection === 'employment' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'employment' && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Employment Status:</span>
                <span className="font-bold text-[#101C2C]">{customer.employment.employmentStatus}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Employer / Business:</span>
                <span className="font-sans text-slate-700">{customer.employment.employerOrBusiness}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Occupation:</span>
                <span className="font-sans text-slate-700">{customer.employment.occupation}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Declared Net Monthly Income:</span>
                <span className="font-bold text-[#167D78]">KES {customer.employment.monthlyIncome.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Existing Obligations:</span>
                <span>KES {customer.employment.existingObligations.toLocaleString()}/mo</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 4: Identity Verification & Documents */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <button
            onClick={() => toggleSection('identity')}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#101C2C]">4. Identity Verification</p>
                <p className="text-[11px] text-slate-500">Government ID front/back, KRA PIN</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#167D78] px-2 py-0.5 rounded-full bg-[#E7F3F2]">
                Passed
              </span>
              {openSection === 'identity' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'identity' && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">ID Document Type:</span>
                <span className="font-bold text-[#101C2C]">{customer.identity.documentType}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Front Side Proof:</span>
                <span className="text-[#167D78] font-semibold">Uploaded & Audited</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Back Side Proof:</span>
                <span className="text-[#167D78] font-semibold">Uploaded & Audited</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">KRA PIN Status:</span>
                <span className="font-bold text-[#101C2C]">{customer.kraPin} (Verified)</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 5: Payment Information */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
          <button
            onClick={() => toggleSection('payment')}
            className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#101C2C]">5. Payment Information</p>
                <p className="text-[11px] text-slate-500">M-Pesa line & disbursement channels</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#167D78] px-2 py-0.5 rounded-full bg-[#E7F3F2]">
                Linked
              </span>
              {openSection === 'payment' ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSection === 'payment' && (
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Disbursement M-Pesa Line:</span>
                <span className="font-bold text-[#167D78]">{customer.payment.mpesaNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400 font-sans">Safaricom KYC Ownership:</span>
                <span className="text-emerald-700 font-semibold">Matched to National ID</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400 font-sans">Secondary Bank Channel:</span>
                <span className="font-sans text-slate-700">{customer.payment.bankName}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADDITIONAL PROFILE CAPABILITIES REQUIRED BY USER */}
      <div className="space-y-2 pt-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
          Account Governance & Support
        </h3>

        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs divide-y divide-slate-100 text-xs">
          {/* Complaints Management (CBK Required) */}
          <button
            onClick={() => setShowComplaintsModal(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-4 h-4 text-[#167D78]" />
              <div>
                <p className="font-bold text-[#101C2C]">Help & Complaints Desk</p>
                <p className="text-[11px] text-slate-500">CBK statutory complaint escalation procedure</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90" />
          </button>

          {/* Privacy & Legal Documents */}
          <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="w-4 h-4 text-slate-600" />
              <div>
                <p className="font-bold text-[#101C2C]">Privacy & Data Consents</p>
                <p className="text-[11px] text-slate-500">Kenyan Data Protection Act 2019 rights</p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-[#167D78]">Consented</span>
          </div>

          {/* Request Account Closure */}
          <button
            onClick={() => setShowClosureModal(true)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 cursor-pointer text-rose-600"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-4 h-4" />
              <div>
                <p className="font-bold">Request Account Closure</p>
                <p className="text-[11px] text-slate-400">Close account if all balances settled</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 -rotate-90" />
          </button>
        </div>
        {(complaints.length > 0 || closureRequests.length > 0) && <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 space-y-3 text-xs"><p className="font-bold text-[#101C2C]">Your support requests</p>{complaints.slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0"><div><p className="font-mono text-[10px] text-slate-400">{item.complaint_number}</p><p className="font-semibold text-slate-700">{item.subject}</p></div><span className="capitalize rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{item.status}</span></div>)}{closureRequests.slice(0, 1).map((item) => <div key={item.id} className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-700">Account closure request</p><span className="capitalize rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">{item.status}</span></div>)}</div>}
      </div>

      {/* Logout Action */}
      <div className="pt-2">
        <button
          onClick={async () => { await signOut(); logoutCustomer(); }}
          className="w-full py-3 bg-white border border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 text-rose-700 text-xs font-semibold rounded-2xl shadow-2xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Account</span>
        </button>
      </div>

      {/* Institutional Footer */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
        <p className="text-[11px] font-bold text-[#101C2C]">{brand.institutionName}</p>
        <p className="text-[10px] text-slate-500">
          {brand.cbkLicenseNumber} • Authorized by {brand.regulatoryBody}
        </p>
      </div>

      {/* Complaints Modal */}
      {showComplaintsModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowComplaintsModal(false)}
          title="Customer Dispute & Complaints Desk"
          subtitle="Governed under Central Bank of Kenya DCP Consumer Protection Guidelines"
          maxWidth="md"
        >
          {complaintSubmitted ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-[#167D78] mx-auto" />
              <h4 className="text-base font-bold text-[#101C2C]">Complaint Ticket Logged</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Ticket #{ticketNumber} generated. We will update you in the app and by email when email delivery is configured.
              </p>
            </div>
          ) : (
            <form onSubmit={handleComplaintSubmit} className="space-y-4 text-xs">
              {supportError && <p className="p-2 bg-rose-50 text-rose-700 rounded-lg">{supportError}</p>}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Complaint Category</label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="Transaction or Payment Dispute">M-Pesa Transaction Dispute</option>
                  <option value="Loan Calculation / Fee Query">Loan Calculation / Fee Query</option>
                  <option value="CRB Listing Discrepancy">CRB Listing Discrepancy</option>
                  <option value="Service / App Experience">Service Experience</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Details & Evidence</label>
                <textarea
                  rows={4}
                  required
                  value={complaintDescription}
                  onChange={(e) => setComplaintDescription(e.target.value)}
                  placeholder="Describe the issue, date, and any M-Pesa receipt code..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#167D78]"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attach evidence (optional)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setComplaintEvidence(e.target.files?.[0] || null)} className="w-full text-xs text-slate-600" />
                <p className="mt-1 text-[10px] text-slate-500">Receipt, screenshot, or PDF — JPG, PNG, WEBP, or PDF up to 5 MB.</p>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 space-y-0.5">
                <p>• Statutory escalation: complaints@centralbank.go.ke</p>
                <p>• Emergency phone: {brand.supportPhone}</p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowComplaintsModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#167D78] hover:bg-[#126561] text-white font-semibold rounded-xl"
                >
                  Submit Official Complaint
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Account Closure Modal */}
      {showClosureModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowClosureModal(false)}
          title="Account Closure Request"
          subtitle="Zero balance requirement verification"
          maxWidth="sm"
        >
          {closureSubmitted ? (
            <div className="py-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <p className="text-xs font-bold text-[#101C2C]">Closure Request Received</p>
              <p className="text-[11px] text-slate-500">Staff will review it once all balances are confirmed settled.</p>
            </div>
          ) : (
            <form onSubmit={handleClosureSubmit} className="space-y-4 text-xs">
              {supportError && <p className="p-2 bg-rose-50 text-rose-700 rounded-lg">{supportError}</p>}
              <p className="text-slate-600 leading-normal">
                Account closure requires zero outstanding balances and settles all electronic certificates.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason for closure</label>
                <select
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="No longer need digital credit">No longer need digital credit</option>
                  <option value="Switching to cooperative / SACCO">Switching to SACCO</option>
                  <option value="Temporary pause">Temporary pause</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClosureModal(false)}
                  className="px-3.5 py-2 border border-slate-200 text-slate-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl"
                >
                  Confirm Closure
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
