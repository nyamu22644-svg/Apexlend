'use client';

import React, { useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import {
  ArrowLeft,
  ShieldCheck,
  Upload,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Building,
  Check,
  Loader2,
} from 'lucide-react';
import { submitKyc, uploadKycDocument } from '@/lib/kyc-api';
import { useAuth } from '@/lib/auth-context';


interface KycVerificationWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function KycVerificationWizard({ onComplete, onCancel }: KycVerificationWizardProps) {
  const { customer, updateCustomerSection, setCustomerView } = useBrand();
  const { session, isConfigured } = useAuth();
  const [submissionError, setSubmissionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [wizardStep, setWizardStep] = useState<'intro' | 'personal' | 'id_proof' | 'employment' | 'bank_details' | 'success'>(
    customer.profileCompletionPercentage > 20 ? 'personal' : 'intro'
  );

  // Form states matching image_cbdc19ed.png
  // Personal Details
  const [firstName, setFirstName] = useState(customer.personal?.firstName || '');
  const [lastName, setLastName] = useState(customer.personal?.lastName || '');
  const [dobDay, setDobDay] = useState(customer.dateOfBirth ? customer.dateOfBirth.split('-')[2] || '' : '');
  const [dobMonth, setDobMonth] = useState(customer.dateOfBirth ? customer.dateOfBirth.split('-')[1] || '' : '');
  const [dobYear, setDobYear] = useState(customer.dateOfBirth ? customer.dateOfBirth.split('-')[0] || '' : '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [email, setEmail] = useState(customer.email || '');
  const [address1, setAddress1] = useState(customer.contact?.residentialAddress || '');
  const [address2, setAddress2] = useState(customer.contact?.county ? `${customer.contact.town}, ${customer.contact.county}` : '');
  const [nationalIdNumber, setNationalIdNumber] = useState('');

  // ID Proof
  const [documentType, setDocumentType] = useState<'National ID' | 'Passport' | 'Alien ID'>('National ID');
  const [frontUploaded, setFrontUploaded] = useState(customer.identity?.frontSideUploaded || false);
  const [backUploaded, setBackUploaded] = useState(customer.identity?.backSideUploaded || false);
  const [frontUploading, setFrontUploading] = useState(false);
  const [backUploading, setBackUploading] = useState(false);
  const [frontDocName, setFrontDocName] = useState('');
  const [backDocName, setBackDocName] = useState('');
  const [kraPin, setKraPin] = useState('');

  const frontInputRef = React.useRef<HTMLInputElement>(null);
  const backInputRef = React.useRef<HTMLInputElement>(null);

  const handleFrontFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFrontDocName(file.name);
    setFrontUploading(true);
    try {
      if (isConfigured) {
        if (!session?.access_token) throw new Error('Please sign in before uploading documents');
        const type = documentType === 'Passport' ? 'passport_front' : documentType === 'Alien ID' ? 'alien_id_front' : 'national_id_front';
        await uploadKycDocument(session.access_token, type, file);
      }
      setFrontUploaded(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Document upload failed');
    } finally {
      setFrontUploading(false);
    }
  };

  const handleBackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBackDocName(file.name);
    setBackUploading(true);
    try {
      if (isConfigured) {
        if (!session?.access_token) throw new Error('Please sign in before uploading documents');
        const type = documentType === 'Passport' ? 'passport_back' : documentType === 'Alien ID' ? 'alien_id_back' : 'national_id_back';
        await uploadKycDocument(session.access_token, type, file);
      }
      setBackUploaded(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Document upload failed');
    } finally {
      setBackUploading(false);
    }
  };


  // Bank & Payment Details
  const [accountType, setAccountType] = useState<'Saving' | 'Current' | 'M-Pesa Wallet'>('M-Pesa Wallet');
  const [bankName, setBankName] = useState(customer.payment?.bankName || '');
  const [accountName, setAccountName] = useState(customer.payment?.bankAccountName || '');
  const [accountNumber, setAccountNumber] = useState(customer.payment?.mpesaNumber || '');
  const [branchCode, setBranchCode] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState(customer.employment?.employmentStatus || '');
  const [employerName, setEmployerName] = useState(customer.employment?.employerOrBusiness || '');
  const [occupation, setOccupation] = useState(customer.employment?.occupation || '');
  const [monthlyIncome, setMonthlyIncome] = useState(String(customer.employment?.monthlyIncome || ''));
  const [otherIncomeSources, setOtherIncomeSources] = useState(customer.employment?.otherIncomeSources || '');
  const [existingMonthlyObligations, setExistingMonthlyObligations] = useState(String(customer.employment?.existingObligations || 0));

  const handlePersonalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const full = `${firstName} ${lastName}`.trim();
    const dob = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;

    updateCustomerSection('personal', {
      firstName,
      lastName,
      fullName: full,
      dateOfBirth: dob,
      nationalId: nationalIdNumber,
      nationality: 'Kenyan',
      gender: 'Female',
      completed: true,
    });

    updateCustomerSection('contact', {
      phone,
      phoneVerified: true,
      email,
      emailVerified: true,
      residentialAddress: address1,
      county: address2.includes(',') ? address2.split(',')[1].trim() : 'Nairobi',
      town: address2.includes(',') ? address2.split(',')[0].trim() : address2,
      completed: true,
    });

    setWizardStep('id_proof');
  };

  const handleIdProofSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontUploaded || !backUploaded) {
      setSubmissionError('Upload both sides of the identity document before continuing.');
      return;
    }
    updateCustomerSection('identity', {
      documentType,
      frontSideUploaded: true,
      backSideUploaded: true,
      kraPin,
      kraPinVerified: false,
      verificationResult: 'pending',
      completed: true,
    });

    setWizardStep('employment');
  };

  const handleEmploymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCustomerSection('employment', { employmentStatus: employmentStatus as any, employerOrBusiness: employerName, occupation, monthlyIncome: Number(monthlyIncome), otherIncomeSources, existingObligations: Number(existingMonthlyObligations), completed: true });
    setWizardStep('bank_details');
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError('');
    setIsSubmitting(true);
    try {
      if (isConfigured) {
        if (!session?.access_token) throw new Error('Please sign in before submitting KYC');
        const [town, county] = address2.split(',').map((value) => value.trim());
        await submitKyc(session.access_token, {
          fullName: `${firstName} ${lastName}`.trim(), phone, dateOfBirth: `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`,
          nationalId: nationalIdNumber, kraPin, residentialAddress: address1,
          county: county || town || '', town: town || '', mpesaPhone: accountNumber, nationality: 'Kenyan', gender: 'Prefer not to say',
          employmentStatus, employerName, occupation, monthlyIncome: Number(monthlyIncome), otherIncomeSources,
          existingMonthlyObligations: Number(existingMonthlyObligations), bankName, bankAccountName: accountName,
          bankAccountNumber: accountType === 'M-Pesa Wallet' ? '' : accountNumber, bankBranchCode: branchCode,
        });
      }
    updateCustomerSection('payment', {
      accountType: accountType === 'M-Pesa Wallet' ? 'M-Pesa Wallet' : 'Bank Account',
      bankName,
      bankAccountName: accountName,
      bankAccountNumber: accountNumber,
      mpesaNumber: accountNumber,
      mpesaVerified: false,
      accountOwnershipConfirmed: false,
      completed: true,
    });

    setWizardStep('success');
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'KYC submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (onComplete) onComplete();
    else setCustomerView('dashboard');
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5 pb-24 max-w-lg mx-auto">
      {/* Top Header with Back button */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <button
          onClick={() => {
            if (wizardStep === 'bank_details') setWizardStep('employment');
            else if (wizardStep === 'employment') setWizardStep('id_proof');
            else if (wizardStep === 'id_proof') setWizardStep('personal');
            else if (wizardStep === 'personal') setWizardStep('intro');
            else if (onCancel) onCancel();
            else setCustomerView('dashboard');
          }}
          className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-[#101C2C]">KYC Verification</h2>
        <span className="text-xs font-mono text-[#167D78] font-semibold">CBK Regulated</span>
      </div>

      {/* SCREEN 1: INTRO SCREEN (Matching image_cbdc19ed.png screen 1) */}
      {wizardStep === 'intro' && (
        <div className="py-6 text-center space-y-6">
          <div className="w-24 h-24 rounded-3xl bg-[#E7F3F2] text-[#167D78] flex items-center justify-center mx-auto shadow-xs border border-[#D0E9E7]">
            <ShieldCheck className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-[#101C2C]">KYC Verification</h3>
            <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
              To ensure the security of your account and comply with regulatory requirements, we need to verify your
              identity. You will be done in 5mins!
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <button
              type="button"
              onClick={() => setWizardStep('personal')}
              className="w-full py-3.5 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Start Verification
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Skip for later
            </button>
          </div>
        </div>
      )}

      {/* STEP TABS HEADER (Personal Details | ID Proof | Bank Details) */}
      {submissionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{submissionError}</div>
      )}
      {wizardStep !== 'intro' && wizardStep !== 'success' && (
        <div className="border-b border-slate-100 pb-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span
              className={`pb-1.5 transition-colors ${
                wizardStep === 'personal'
                  ? 'text-[#167D78] border-b-2 border-[#167D78] font-bold'
                  : 'text-slate-400'
              }`}
            >
              Personal Details
            </span>
            <span
              className={`pb-1.5 transition-colors ${
                wizardStep === 'id_proof'
                  ? 'text-[#167D78] border-b-2 border-[#167D78] font-bold'
                  : 'text-slate-400'
              }`}
            >
              ID Proof
            </span>
            <span className={`pb-1.5 transition-colors ${wizardStep === 'employment' ? 'text-[#167D78] border-b-2 border-[#167D78] font-bold' : 'text-slate-400'}`}>Employment</span>
            <span
              className={`pb-1.5 transition-colors ${
                wizardStep === 'bank_details'
                  ? 'text-[#167D78] border-b-2 border-[#167D78] font-bold'
                  : 'text-slate-400'
              }`}
            >
              Bank Details
            </span>
          </div>
        </div>
      )}

      {/* SCREEN 2: PERSONAL DETAILS (Matching image_cbdc19ed.png screen 2) */}
      {wizardStep === 'personal' && (
        <form onSubmit={handlePersonalSubmit} className="space-y-4 text-xs">
          <p className="text-xs text-slate-500 font-medium">Please fill out the fields below</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">First Name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Muthoni"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={dobDay}
                onChange={(e) => setDobDay(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono focus:ring-2 focus:ring-[#167D78]"
              ><option value="">DD</option>{Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,'0')}</option>)}</select>
              <select
                value={dobMonth}
                onChange={(e) => setDobMonth(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono focus:ring-2 focus:ring-[#167D78]"
              ><option value="">MM</option>{Array.from({length:12},(_,i)=><option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,'0')}</option>)}</select>
              <select
                value={dobYear}
                onChange={(e) => setDobYear(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono focus:ring-2 focus:ring-[#167D78]"
              ><option value="">YYYY</option>{Array.from({length:86},(_,i)=>new Date().getFullYear()-18-i).map(year=><option key={year} value={String(year)}>{year}</option>)}</select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">National ID Number</label>
            <input
              type="text"
              required
              value={nationalIdNumber}
              onChange={(e) => setNationalIdNumber(e.target.value)}
              placeholder="e.g. 29841029"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
            <div className="flex gap-2">
              <span className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-600 font-semibold text-xs flex items-center">
                +254
              </span>
              <input
                type="tel"
                required
                value={phone.replace('+254', '').trim()}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="712 345 678"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-[#167D78]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.ke"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address 1 (Residential)</label>
            <input
              type="text"
              required
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              placeholder="House/Apartment & Street"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Town / County</label>
            <select required value={address2} onChange={(e) => setAddress2(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            ><option value="">Select your county</option>{['Nairobi','Mombasa','Kisumu','Nakuru','Kiambu','Machakos','Kajiado','Uasin Gishu','Meru','Nyeri','Kakamega','Other county'].map(x=><option key={x} value={x}>{x}</option>)}</select>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setWizardStep('intro')}
              className="w-full py-2 text-center text-slate-500 hover:text-slate-800 text-xs"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {/* SCREEN 3: ID PROOF (Matching image_cbdc19ed.png screen 3) */}
      {wizardStep === 'id_proof' && (
        <form onSubmit={handleIdProofSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Document Type</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            >
              <option value="National ID">Kenyan National ID Card</option>
              <option value="Passport">Republic of Kenya Passport</option>
              <option value="Alien ID">Alien Registration Card</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Kenya Revenue Authority (KRA) PIN</label>
            <input
              type="text"
              required
              value={kraPin}
              onChange={(e) => setKraPin(e.target.value.toUpperCase())}
              placeholder="e.g. A009418290Z"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            />
          </div>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={frontInputRef}
            onChange={handleFrontFileChange}
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
          />
          <input
            type="file"
            ref={backInputRef}
            onChange={handleBackFileChange}
            accept="image/*,application/pdf"
            capture="environment"
            className="hidden"
          />

          {/* Front Side Upload Box */}
          <div
            onClick={() => frontInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
              frontUploaded
                ? 'border-[#167D78] bg-[#E7F3F2]/40'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white text-[#167D78] shadow-xs flex items-center justify-center mx-auto mb-2 border border-slate-100">
              {frontUploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#167D78]" />
              ) : frontUploaded ? (
                <Check className="w-5 h-5" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </div>
            <p className="font-bold text-[#101C2C] text-xs">
              {frontUploading
                ? 'Uploading document securely...'
                : frontUploaded
                ? `Front Side Uploaded (${frontDocName})`
                : 'Front Side'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Upload the front side of your document. Supports JPG, PNG and PDF
            </p>
          </div>

          {/* Back Side Upload Box */}
          <div
            onClick={() => backInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
              backUploaded
                ? 'border-[#167D78] bg-[#E7F3F2]/40'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-white text-[#167D78] shadow-xs flex items-center justify-center mx-auto mb-2 border border-slate-100">
              {backUploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#167D78]" />
              ) : backUploaded ? (
                <Check className="w-5 h-5" />
              ) : (
                <ImageIcon className="w-5 h-5" />
              )}
            </div>
            <p className="font-bold text-[#101C2C] text-xs">
              {backUploading
                ? 'Uploading document securely...'
                : backUploaded
                ? `Back Side Uploaded (${backDocName})`
                : 'Back Side'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Upload the Back side of your document. Supports JPG, PNG and PDF
            </p>
          </div>


          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setWizardStep('personal')}
              className="w-full py-2 text-center text-slate-500 hover:text-slate-800 text-xs"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {wizardStep === 'employment' && (
        <form onSubmit={handleEmploymentSubmit} className="space-y-4 text-xs">
          <p className="text-xs text-slate-500 font-medium">Employment and income details help us assess affordability.</p>
          <label className="block font-semibold text-slate-700">Employment Status<select required value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value as typeof employmentStatus)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"><option value="">Select status</option><option>Employed</option><option>Self-Employed</option><option>Business Owner</option><option>Contractor</option><option>Unemployed</option></select></label>
          {employmentStatus !== 'Unemployed' && <label className="block font-semibold text-slate-700">{employmentStatus === 'Business Owner' ? 'Business Name' : employmentStatus === 'Self-Employed' ? 'Business / Trade Name' : employmentStatus === 'Contractor' ? 'Main Client / Organisation' : 'Employer Name'}<input required={employmentStatus !== 'Contractor'} value={employerName} onChange={(e) => setEmployerName(e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl" /></label>}
          <label className="block font-semibold text-slate-700">Occupation / Role<select required value={occupation} onChange={(e) => setOccupation(e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"><option value="">Select occupation</option>{['Administration / Office','Agriculture','Construction / Trade','Education','Finance / Professional services','Healthcare','Hospitality / Retail','Manufacturing','Public service','Transport / Logistics','Technology','Student','Retired','Other'].map(x=><option key={x}>{x}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="block font-semibold text-slate-700">Net Monthly Income (KES)<input required min="0" type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl" /></label><label className="block font-semibold text-slate-700">Monthly Obligations (KES)<input required min="0" type="number" value={existingMonthlyObligations} onChange={(e) => setExistingMonthlyObligations(e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl" /></label></div>
          <label className="block font-semibold text-slate-700">Other Income Sources <span className="font-normal text-slate-400">(optional)</span><textarea value={otherIncomeSources} onChange={(e) => setOtherIncomeSources(e.target.value)} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl" placeholder="e.g. rental income, side business" /></label>
          <div className="flex gap-2"><button type="button" onClick={() => setWizardStep('id_proof')} className="flex-1 py-3 border border-slate-200 rounded-xl">Back</button><button type="submit" className="flex-1 py-3 bg-[#167D78] text-white rounded-xl font-semibold">Next</button></div>
        </form>
      )}

      {/* SCREEN 4: BANK & PAYMENT DETAILS (Matching image_cbdc19ed.png screen 4) */}
      {wizardStep === 'bank_details' && (
        <form onSubmit={handleBankSubmit} className="space-y-4 text-xs">
          {/* Account Type Radio options */}
          <div>
            <label className="block font-semibold text-slate-700 mb-2">Account Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accType"
                  checked={accountType === 'M-Pesa Wallet'}
                  onChange={() => {
                    setAccountType('M-Pesa Wallet');
                    setBankName('Safaricom M-Pesa');
                  }}
                  className="text-[#167D78] focus:ring-[#167D78]"
                />
                <span className="text-slate-800 font-medium">M-Pesa Wallet</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accType"
                  checked={accountType === 'Saving'}
                  onChange={() => {
                    setAccountType('Saving');
                    setBankName('Equity Bank Kenya');
                  }}
                  className="text-[#167D78] focus:ring-[#167D78]"
                />
                <span className="text-slate-800 font-medium">Saving</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accType"
                  checked={accountType === 'Current'}
                  onChange={() => {
                    setAccountType('Current');
                    setBankName('KCB Bank Kenya');
                  }}
                  className="text-[#167D78] focus:ring-[#167D78]"
                />
                <span className="text-slate-800 font-medium">Current</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Disbursement Channel / Bank</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            >
              <option value="Safaricom M-Pesa">Safaricom M-Pesa (Instant B2C)</option>
              <option value="Equity Bank Kenya">Equity Bank Kenya</option>
              <option value="KCB Bank Kenya">KCB Bank Kenya</option>
              <option value="Co-operative Bank">Co-operative Bank of Kenya</option>
              <option value="NCBA Bank">NCBA Bank Kenya</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Account Name</label>
            <input
              type="text"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Enter Registered Name e.g Jane Muthoni"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {accountType === 'M-Pesa Wallet' ? 'M-Pesa Mobile Number' : 'Bank Account Number'}
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={accountType === 'M-Pesa Wallet' ? '07XX XXX XXX' : 'Enter Account Number'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Branch / IFSC Code</label>
            <input
              type="text"
              value={branchCode}
              onChange={(e) => setBranchCode(e.target.value)}
              placeholder="e.g. 048 - Nairobi"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-[#167D78]"
            />
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? 'Submitting securely...' : 'Submit for KYC Review'}
            </button>
            <button
              type="button"
              onClick={() => setWizardStep('id_proof')}
              className="w-full py-2 text-center text-slate-500 hover:text-slate-800 text-xs"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {/* SCREEN 5: SUCCESS & UNLOCKED */}
      {wizardStep === 'success' && (
        <div className="py-6 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-[#E7F3F2] text-[#167D78] flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[#101C2C]">KYC Submitted for Review</h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Your documents and details are awaiting compliance review. Loan access remains unavailable until a
              qualified staff member approves your KYC case.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Verified Profile:</span>
              <span className="font-bold text-[#101C2C]">{customer.fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">National ID:</span>
              <span className="font-bold">{customer.nationalId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Disbursement Line:</span>
              <span className="font-bold text-[#167D78]">{customer.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-sans">Compliance Standing:</span>
              <span className="text-amber-700 font-bold">Under Review</span>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => setCustomerView('apply')}
              className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Apply for a Loan Now
            </button>
            <button
              type="button"
              onClick={handleClose}
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
