'use client';

import React, { useEffect, useState } from 'react';
import { useBrand, CustomerView } from '@/lib/brand-context';
import { Home, Wallet, CreditCard, User, Wifi, BatteryMedium, Signal } from 'lucide-react';
import { CustomerDashboard } from './CustomerDashboard';
import { LoanApplicationWizard } from './LoanApplicationWizard';
import { CustomerLoansView } from './CustomerLoansView';
import { CustomerRepaymentsView } from './CustomerRepaymentsView';
import { CustomerProfileView } from './CustomerProfileView';
import { KycVerificationWizard } from './KycVerificationWizard';
import { CustomerAuthView } from './CustomerAuthView';
import { useAuth } from '@/lib/auth-context';
import { getCustomerWorkspace } from '@/lib/customer-api';
import { CustomerProfile } from '@/lib/types/lending';

function mapWorkspace(data: Awaited<ReturnType<typeof getCustomerWorkspace>>): CustomerProfile {
  const names = data.full_name.trim().split(/\s+/);
  const verified = data.kyc_status === 'verified';
  const phone = data.phone_number || data.mpesa_phone_number || '';
  const employmentStatus = ['Employed', 'Self-Employed', 'Business Owner', 'Contractor'].includes(data.employment_status || '') ? data.employment_status as CustomerProfile['employmentStatus'] : 'Contractor';
  return { id: data.profile_id, customerNumber: data.customer_number, fullName: data.full_name, email: data.email, phone, nationalId: '', kraPin: '', dateOfBirth: data.date_of_birth || '', employmentStatus, monthlyIncome: Number(data.monthly_income || 0), creditScore: 0, creditRating: 'C', availableLoanLimit: Number(data.available_credit_limit || 0), maxBorrowingCapacity: Number(data.available_credit_limit || 0), accountStatus: data.kyc_status === 'rejected' ? 'Restricted' : data.kyc_status === 'verified' ? 'Good standing' : 'Under Review', joinedDate: new Date(data.created_at).toLocaleDateString('en-GB'), kycVerified: verified, activeLoanCount: 0, totalLoansSettled: 0,
    personal: { fullName: data.full_name, firstName: names[0] || '', lastName: names.slice(1).join(' '), dateOfBirth: data.date_of_birth || '', nationalId: '', nationality: data.nationality || 'Not recorded', gender: (['Female', 'Male', 'Prefer not to say'].includes(data.gender || '') ? data.gender : 'Prefer not to say') as CustomerProfile['personal']['gender'], completed: Boolean(data.date_of_birth) },
    contact: { phone, phoneVerified: false, email: data.email, emailVerified: true, residentialAddress: data.residential_address || '', county: data.county || '', town: data.town || '', completed: Boolean(data.residential_address && data.county) },
    employment: { employmentStatus, employerOrBusiness: data.employer_name || 'Not recorded', occupation: data.occupation || 'Not recorded', monthlyIncome: Number(data.monthly_income || 0), otherIncomeSources: data.other_income_sources || 'Not recorded', existingObligations: Number(data.existing_monthly_obligations || 0), completed: Boolean(data.employment_status) },
    identity: { documentType: 'National ID', frontSideUploaded: false, backSideUploaded: false, kraPin: '', kraPinVerified: verified, verificationResult: data.kyc_status === 'under_review' ? 'pending' : data.kyc_status === 'pending' ? 'unverified' : data.kyc_status, completed: verified },
    payment: { mpesaNumber: data.mpesa_phone_number || phone, mpesaVerified: false, accountOwnershipConfirmed: false, accountType: data.bank_name && data.bank_name !== 'Safaricom M-Pesa' ? 'Bank Account' : 'M-Pesa Wallet', bankName: data.bank_name || 'Not recorded', bankAccountName: data.bank_account_name || 'Not recorded', completed: Boolean(data.mpesa_phone_number) },
    profileCompletionPercentage: verified ? 100 : data.kyc_status === 'under_review' ? 60 : 20, isKycCompleteForLending: verified };
}

export function CustomerLayout() {
  const { customerView, setCustomerView, previewDeviceFrame, authSession, setLiveCustomer, setAuthSession, updateBrand } = useBrand();
  const { session, profile, isConfigured } = useAuth();
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');

  useEffect(() => {
    if (!isConfigured || !session?.access_token || profile?.userType !== 'customer') return;
    setLoadingWorkspace(true); setWorkspaceError('');
    getCustomerWorkspace(session.access_token).then((data) => {
      const customer = mapWorkspace(data); setLiveCustomer(customer);
      setAuthSession({ isAuthenticated: true, email: customer.email, fullName: customer.fullName, emailConfirmed: true, authView: 'authenticated' });
    }).catch((error) => setWorkspaceError(error instanceof Error ? error.message : 'Unable to load your account')).finally(() => setLoadingWorkspace(false));
  }, [isConfigured, profile?.userType, session?.access_token, setAuthSession, setLiveCustomer]);

  useEffect(() => {
    if (!isConfigured || !session?.access_token || profile?.userType !== 'customer') return;
    fetch('/api/customer/branding', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body; })
      .then((body) => updateBrand(body.branding || {}))
      .catch(() => undefined);
  // updateBrand intentionally is not a dependency: it is a context action recreated per render.
  }, [isConfigured, profile?.userType, session?.access_token]);

  const navItems: { view: CustomerView; label: string; icon: React.ReactNode }[] = [
    { view: 'dashboard', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { view: 'loans', label: 'Loans', icon: <Wallet className="w-5 h-5" /> },
    { view: 'payments', label: 'Payments', icon: <CreditCard className="w-5 h-5" /> },
    { view: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  const renderActiveView = () => {
    // If user is not authenticated, render the complete authentication experience
    if (isConfigured && profile?.userType !== 'customer') return <CustomerAuthView />;
    if (!isConfigured && !authSession.isAuthenticated) {
      return <CustomerAuthView />;
    }
    if (loadingWorkspace) return <div className="min-h-[400px] flex items-center justify-center text-sm text-slate-500">Loading your account…</div>;
    if (workspaceError) return <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{workspaceError}</div>;

    switch (customerView) {
      case 'dashboard':
        return <CustomerDashboard />;
      case 'apply':
        return <LoanApplicationWizard />;
      case 'loans':
        return <CustomerLoansView />;
      case 'payments':
        return <CustomerRepaymentsView />;
      case 'profile':
        return <CustomerProfileView />;
      case 'kyc-wizard':
        return <KycVerificationWizard />;
      default:
        return <CustomerDashboard />;
    }
  };

  return (
    <div className="w-full flex justify-center">
      {/* Mobile-first frame container */}
      <div
        className={`w-full transition-all duration-300 ${
          previewDeviceFrame
            ? 'max-w-[420px] bg-[#F5F7FA] rounded-[44px] overflow-hidden phone-shadow border-[7px] border-[#101C2C] my-4'
            : 'max-w-2xl bg-[#F5F7FA] min-h-screen px-4 py-6'
        }`}
      >
        {/* Mobile Phone Status Bar (Exact match to 9:41 in reference image) */}
        <div className="pt-3 px-7 pb-2 flex items-center justify-between text-[#101C2C] select-none text-xs font-semibold">
          <span className="font-mono text-xs">9:41</span>
          <div className="flex items-center gap-1.5">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <BatteryMedium className="w-4 h-4" />
          </div>
        </div>

        {/* Dynamic Screen Viewport */}
        <div className="px-4 pt-2 min-h-[680px] relative">
          {renderActiveView()}

          {/* Bottom Navigation Bar (Shown only when authenticated and not in full KYC wizard) */}
          {(!isConfigured ? authSession.isAuthenticated : profile?.userType === 'customer') && customerView !== 'kyc-wizard' && (
            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200/90 px-6 py-2.5 flex items-center justify-between shadow-lg z-20">
              {navItems.map((item) => {
                const isActive =
                  customerView === item.view || (item.view === 'dashboard' && customerView === 'apply');
                return (
                  <button
                    key={item.view}
                    onClick={() => setCustomerView(item.view)}
                    className={`flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer ${
                      isActive ? 'text-[#167D78] font-bold' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <div className="relative">
                      {item.icon}
                      {isActive && (
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#167D78] rounded-full" />
                      )}
                    </div>
                    <span className="text-[11px]">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
