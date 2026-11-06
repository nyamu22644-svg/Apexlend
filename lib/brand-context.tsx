'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BrandConfig,
  CustomerProfile,
  LoanApplication,
  LoanProduct,
  LoanAccount,
  Transaction,
  UserRole,
  StaffModule,
  CustomerAuthSession,
  CustomerNotification,
  DisbursementRecord,
  CollectionRecord,
  StaffUser,
  AuditLogEntry,
  CustomerNote,
} from './types/lending';
import { DEFAULT_BRAND, BRAND_PRESETS } from './brand-config';
import {
  MOCK_CUSTOMER,
  MOCK_NEW_CUSTOMER_TEMPLATE,
  MOCK_CUSTOMER_NOTIFICATIONS,
  MOCK_LOAN_PRODUCTS,
  MOCK_ACTIVE_LOANS,
  MOCK_CUSTOMER_TRANSACTIONS,
  MOCK_RECENT_APPLICATIONS,
  MOCK_CUSTOMERS_LIST,
  MOCK_DISBURSEMENTS,
  MOCK_COLLECTIONS,
  MOCK_STAFF_USERS,
  MOCK_AUDIT_LOGS,
} from './mock-data';
import { notificationService } from './notifications/provider';
import {
  updateCustomerKyc,
  submitLoanApplication as submitSupabaseLoanApplication,
  recordRepayment as recordSupabaseRepayment,
} from './supabase/database';

export type CustomerView = 'dashboard' | 'apply' | 'loans' | 'payments' | 'profile' | 'kyc-wizard';

export type { StaffModule };

interface BrandContextType {
  brand: BrandConfig;
  updateBrand: (partial: Partial<BrandConfig>) => void;
  setBrandPreset: (presetKey: string) => void;
  
  // Portal navigation
  activePortal: 'customer' | 'staff';
  setActivePortal: (portal: 'customer' | 'staff') => void;
  
  // Customer View
  customerView: CustomerView;
  setCustomerView: (view: CustomerView) => void;

  // Customer Auth Session
  authSession: CustomerAuthSession;
  setAuthSession: React.Dispatch<React.SetStateAction<CustomerAuthSession>>;
  loginCustomer: (email: string) => boolean;
  registerCustomer: (fullName: string, email: string) => void;
  verifyCustomerEmail: (code: string) => boolean;
  resendVerificationEmail: () => Promise<void>;
  sendPasswordResetLink: (email: string) => Promise<void>;
  logoutCustomer: () => void;
  switchCustomerPersona: (type: 'complete' | 'new') => void;
  
  // Staff View
  staffModule: StaffModule;
  setStaffModule: (module: StaffModule) => void;
  staffRole: UserRole;
  setStaffRole: (role: UserRole) => void;

  // Mobile Device Frame preview toggle for testing
  previewDeviceFrame: boolean;
  setPreviewDeviceFrame: (val: boolean) => void;

  // Shared Mutable State for interactive prototypes
  customer: CustomerProfile;
  setLiveCustomer: (customer: CustomerProfile) => void;
  updateCustomerSection: (
    section: 'personal' | 'contact' | 'employment' | 'identity' | 'payment',
    data: any
  ) => void;
  loanProducts: LoanProduct[];
  activeLoans: LoanAccount[];
  transactions: Transaction[];
  applications: LoanApplication[];
  customersList: CustomerProfile[];
  disbursements: DisbursementRecord[];
  collections: CollectionRecord[];
  staffUsers: StaffUser[];
  auditLogs: AuditLogEntry[];
  notifications: CustomerNotification[];
  markNotificationRead: (id: string) => void;

  // Interactive Operations
  submitNewApplication: (data: {
    amount: number;
    termMonths: number;
    purpose: string;
    productId: string;
  }) => LoanApplication;
  approveApplication: (applicationId: string, officerName: string) => void;
  rejectApplication: (applicationId: string, reason: string) => void;
  requestApplicationInfo: (applicationId: string, notes: string) => void;
  makeMpesaRepayment: (amount: number, phone: string, loanId: string) => { receipt: string; success: boolean };
  updateLoanProduct: (product: LoanProduct) => void;
  createLoanProduct: (product: Partial<LoanProduct>) => LoanProduct;
  setLoanProductStatus: (productId: string, status: LoanProduct['status']) => void;

  // Disbursement Operations
  executeDisbursement: (disbursementId: string) => boolean;
  retryDisbursement: (disbursementId: string) => boolean;

  // Customer Management Operations
  updateCustomerKycStatus: (customerId: string, status: 'verified' | 'rejected', notes?: string) => void;
  addCustomerInternalNote: (customerId: string, note: string) => void;
  restrictCustomerAccount: (customerId: string, reason: string) => void;
  reactivateCustomerAccount: (customerId: string) => void;

  // Repayment & Reconciliation Operations
  allocatePayment: (txId: string, loanNumber: string) => boolean;
  reverseTransaction: (txId: string, reason: string) => boolean;

  // Collections Operations
  recordCollectionFollowUp: (
    loanNumber: string,
    outcome: string,
    notes: string,
    promiseAmount?: number,
    promiseDate?: string
  ) => void;
  assignCollectionOfficer: (loanNumber: string, officerName: string) => void;

  // Loan Restructuring & Settlement
  restructureLoan: (loanNumber: string, newTermMonths: number, reason: string) => boolean;
  writeOffLoan: (loanNumber: string, reason: string) => boolean;

  // Staff & Access Operations
  updateStaffUser: (user: StaffUser) => void;
  inviteStaffUser: (user: Partial<StaffUser>) => StaffUser;
  toggleStaffStatus: (staffId: string) => void;

  // Audit Logging
  logAuditEvent: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;

  // Profile modal control
  isKycPromptOpen: boolean;
  setIsKycPromptOpen: (val: boolean) => void;
}

const BrandContext = createContext<BrandContextType | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig>(DEFAULT_BRAND);
  const [activePortal, setActivePortal] = useState<'customer' | 'staff'>('customer');
  const [customerView, setCustomerView] = useState<CustomerView>('dashboard');
  const [staffModule, setStaffModule] = useState<StaffModule>('dashboard');
  const [staffRole, setStaffRole] = useState<UserRole>('super_admin');
  const [previewDeviceFrame, setPreviewDeviceFrame] = useState<boolean>(true);
  const [isKycPromptOpen, setIsKycPromptOpen] = useState<boolean>(false);

  // Customer Authentication Session
  const [authSession, setAuthSession] = useState<CustomerAuthSession>({
    isAuthenticated: true,
    email: MOCK_CUSTOMER.email,
    fullName: MOCK_CUSTOMER.fullName,
    emailConfirmed: true,
    authView: 'authenticated',
  });

  // Mutable state for interactive workflow testing
  const [customer, setCustomer] = useState<CustomerProfile>(MOCK_CUSTOMER);
  const [loanProducts, setLoanProducts] = useState<LoanProduct[]>(MOCK_LOAN_PRODUCTS);
  const [activeLoans, setActiveLoans] = useState<LoanAccount[]>(MOCK_ACTIVE_LOANS);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_CUSTOMER_TRANSACTIONS);
  const [applications, setApplications] = useState<LoanApplication[]>(MOCK_RECENT_APPLICATIONS);
  const [customersList, setCustomersList] = useState<CustomerProfile[]>(MOCK_CUSTOMERS_LIST);
  const [disbursements, setDisbursements] = useState<DisbursementRecord[]>(MOCK_DISBURSEMENTS);
  const [collections, setCollections] = useState<CollectionRecord[]>(MOCK_COLLECTIONS);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>(MOCK_STAFF_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(MOCK_AUDIT_LOGS);
  const [notifications, setNotifications] = useState<CustomerNotification[]>(MOCK_CUSTOMER_NOTIFICATIONS);

  // Sync brand CSS variables dynamically into document root
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--brand-teal', brand.primaryColor);
      root.style.setProperty('--brand-navy', brand.secondaryColor);
      root.style.setProperty('--brand-gold', brand.accentColor);
    }
  }, [brand]);

  const updateBrand = (partial: Partial<BrandConfig>) => {
    setBrand((prev) => ({ ...prev, ...partial }));
    logAuditEvent({
      actor: 'System Admin',
      actorRole: staffRole,
      action: 'BRAND_SETTINGS_UPDATED',
      module: 'Settings',
      targetId: 'INSTITUTION_BRAND',
      category: 'Configuration',
      details: 'Institution brand tokens or settings updated.',
      outcome: 'Success',
    });
  };

  const setBrandPreset = (presetKey: string) => {
    if (BRAND_PRESETS[presetKey]) {
      setBrand(BRAND_PRESETS[presetKey]);
      logAuditEvent({
        actor: 'System Admin',
        actorRole: staffRole,
        action: 'BRAND_PRESET_APPLIED',
        module: 'Settings',
        targetId: presetKey,
        category: 'Configuration',
        details: `Brand preset switched to ${presetKey}.`,
        outcome: 'Success',
      });
    }
  };

  const logAuditEvent = (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      timestamp:
        new Date().toISOString().replace('T', ' ').slice(0, 19) + ' EAT',
      ipAddress: entry.ipAddress || '197.232.84.10',
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  // Auth Operations
  const loginCustomer = (email: string): boolean => {
    setAuthSession({
      isAuthenticated: true,
      email: email || customer.email,
      fullName: customer.fullName || 'Registered Borrower',
      emailConfirmed: true,
      authView: 'authenticated',
    });
    setCustomerView('dashboard');
    return true;
  };

  const registerCustomer = (fullName: string, email: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setAuthSession({
      isAuthenticated: false,
      email,
      fullName,
      emailConfirmed: false,
      authView: 'verify-email',
      pendingEmailVerificationCode: code,
      lastVerificationSentAt: Date.now(),
    });

    // Create fresh unverified customer record
    setCustomer({
      ...MOCK_NEW_CUSTOMER_TEMPLATE,
      id: `cust-${Date.now().toString().slice(-4)}`,
      fullName,
      email,
      personal: {
        ...MOCK_NEW_CUSTOMER_TEMPLATE.personal,
        fullName,
        firstName: fullName.split(' ')[0] || '',
        lastName: fullName.split(' ').slice(1).join(' ') || '',
      },
      contact: {
        ...MOCK_NEW_CUSTOMER_TEMPLATE.contact,
        email,
      },
    });

    notificationService.sendEmail({
      to: email,
      subject: `Confirm your ${brand.institutionName} customer account`,
      templateType: 'email_confirmation',
      htmlContent: `<p>Your email verification OTP is <b>${code}</b>.</p>`,
    });
  };

  const verifyCustomerEmail = (code: string): boolean => {
    if (!code || code.length < 4) return false;
    setAuthSession((prev) => ({
      ...prev,
      isAuthenticated: true,
      emailConfirmed: true,
      authView: 'authenticated',
    }));
    setCustomer((prev) => ({
      ...prev,
      contact: {
        ...prev.contact,
        emailVerified: true,
      },
    }));
    setCustomerView('dashboard');
    return true;
  };

  const resendVerificationEmail = async () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setAuthSession((prev) => ({
      ...prev,
      pendingEmailVerificationCode: code,
      lastVerificationSentAt: Date.now(),
    }));
    await notificationService.sendEmail({
      to: authSession.email,
      subject: `New verification code for ${brand.institutionName}`,
      templateType: 'email_confirmation',
      htmlContent: `<p>Your verification code is <b>${code}</b>.</p>`,
    });
  };

  const sendPasswordResetLink = async (email: string) => {
    await notificationService.sendEmail({
      to: email,
      subject: `Reset your ${brand.institutionName} password`,
      templateType: 'password_reset',
      htmlContent: `<p>Password reset instructions dispatched.</p>`,
    });
  };

  const logoutCustomer = () => {
    setAuthSession({
      isAuthenticated: false,
      email: '',
      fullName: '',
      emailConfirmed: false,
      authView: 'login',
    });
  };

  const switchCustomerPersona = (type: 'complete' | 'new') => {
    if (type === 'complete') {
      setCustomer(MOCK_CUSTOMER);
      setAuthSession({
        isAuthenticated: true,
        email: MOCK_CUSTOMER.email,
        fullName: MOCK_CUSTOMER.fullName,
        emailConfirmed: true,
        authView: 'authenticated',
      });
    } else {
      setCustomer({
        ...MOCK_NEW_CUSTOMER_TEMPLATE,
        id: `cust-${Date.now().toString().slice(-4)}`,
        fullName: 'Brian Kipkorir',
        email: 'brian.kipkorir@example.ke',
        personal: {
          ...MOCK_NEW_CUSTOMER_TEMPLATE.personal,
          fullName: 'Brian Kipkorir',
          firstName: 'Brian',
          lastName: 'Kipkorir',
        },
        contact: {
          ...MOCK_NEW_CUSTOMER_TEMPLATE.contact,
          email: 'brian.kipkorir@example.ke',
        },
      });
      setAuthSession({
        isAuthenticated: true,
        email: 'brian.kipkorir@example.ke',
        fullName: 'Brian Kipkorir',
        emailConfirmed: true,
        authView: 'authenticated',
      });
    }
  };

  // Progressive Profile Updater
  const updateCustomerSection = (
    section: 'personal' | 'contact' | 'employment' | 'identity' | 'payment',
    data: any
  ) => {
    setCustomer((prev) => {
      const updated = {
        ...prev,
        [section]: {
          ...prev[section],
          ...data,
          completed: true,
        },
      };

      let completedCount = 0;
      if (updated.personal?.completed) completedCount += 20;
      if (updated.contact?.completed) completedCount += 20;
      if (updated.employment?.completed) completedCount += 20;
      if (updated.identity?.completed) completedCount += 20;
      if (updated.payment?.completed) completedCount += 20;

      updated.profileCompletionPercentage = completedCount;
      updated.isKycCompleteForLending =
        updated.personal?.completed &&
        updated.contact?.completed &&
        updated.employment?.completed &&
        updated.identity?.completed;

      if (section === 'personal') {
        updated.fullName = data.fullName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || prev.fullName;
        updated.dateOfBirth = data.dateOfBirth || prev.dateOfBirth;
        updated.nationalId = data.nationalId || prev.nationalId;
      }
      if (section === 'contact') {
        updated.phone = data.phone || prev.phone;
        updated.email = data.email || prev.email;
      }
      if (section === 'employment') {
        updated.employmentStatus = data.employmentStatus || prev.employmentStatus;
        updated.monthlyIncome = Number(data.monthlyIncome) || prev.monthlyIncome;
      }
      if (section === 'identity') {
        updated.kraPin = data.kraPin || prev.kraPin;
        updated.kycVerified = data.verificationResult === 'verified';
      }

      return updated;
    });

    // Asynchronously dispatch update to Supabase backend if active
    updateCustomerKyc(customer.id, section, data).catch((err) => {
      console.debug('Background Supabase KYC sync:', err);
    });
  };


  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const submitNewApplication = ({
    amount,
    termMonths,
    purpose,
    productId,
  }: {
    amount: number;
    termMonths: number;
    purpose: string;
    productId: string;
  }): LoanApplication => {
    const product = loanProducts.find((p) => p.id === productId) || loanProducts[0];
    const r = product.interestRatePerMonth / 100;
    const compoundFactor = Math.pow(1 + r, termMonths);
    const monthly = Math.round((amount * (r * compoundFactor)) / (compoundFactor - 1));
    const totalRepayable = monthly * termMonths;
    const processingFee = Math.round((amount * product.processingFeePercent) / 100);

    const newApp: LoanApplication = {
      id: `app-${Date.now()}`,
      applicationId: `APP-2025-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId: customer.id,
      customerName: customer.fullName,
      phone: customer.phone,
      nationalId: customer.nationalId,
      loanProductId: product.id,
      productName: product.name,
      requestedAmount: amount,
      termMonths,
      monthlyInstallment: monthly,
      totalInterest: totalRepayable - amount,
      processingFee,
      totalRepayable,
      loanPurpose: purpose,
      creditScore: customer.creditScore,
      riskTier: customer.creditScore > 740 ? 'Tier A' : customer.creditScore > 660 ? 'Tier B' : 'Tier C',
      dstiRatio: 24.5,
      status: 'under_review',
      submittedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    };

    setApplications((prev) => [newApp, ...prev]);

    logAuditEvent({
      actor: customer.fullName,
      actorRole: 'customer',
      action: 'LOAN_APPLICATION_SUBMITTED',
      module: 'Applications',
      targetId: newApp.applicationId,
      category: 'Credit',
      details: `New application submitted for KES ${amount.toLocaleString()} (${newApp.productName}).`,
      outcome: 'Success',
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'Loan Application Submitted',
        message: `Your application ${newApp.applicationId} for KES ${amount.toLocaleString()} is currently under review.`,
        timestamp: 'Just now',
        timeAgo: 'Just now',
        type: 'info',
        read: false,
      },
      ...prev,
    ]);

    // Asynchronously dispatch application to Supabase backend if active
    submitSupabaseLoanApplication(customer.id, {
      productId,
      productName: product.name,
      amount,
      termMonths,
      purpose,
      monthlyInterestRate: product.interestRatePerMonth,
      estimatedMonthlyPayment: monthly,
    }).catch((err) => {
      console.debug('Background Supabase application sync:', err);
    });

    return newApp;

  };

  const approveApplication = (applicationId: string, officerName: string) => {
    let targetApp: LoanApplication | undefined;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.applicationId === applicationId || app.id === applicationId) {
          targetApp = {
            ...app,
            status: 'disbursement_pending',
            approvedAmount: app.requestedAmount,
            reviewedBy: officerName,
            reviewedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          };
          return targetApp;
        }
        return app;
      })
    );

    if (targetApp) {
      // Automatically add to Disbursements queue
      const newDsb: DisbursementRecord = {
        id: `dsb-${Date.now()}`,
        applicationId: targetApp.applicationId,
        loanNumber: `LN-2025-${Math.floor(1000 + Math.random() * 9000)}`,
        customerId: targetApp.customerId,
        customerName: targetApp.customerName,
        phone: targetApp.phone,
        amount: targetApp.approvedAmount || targetApp.requestedAmount,
        channel: 'M-Pesa B2C',
        destinationAccount: targetApp.phone,
        initiatedBy: officerName,
        initiatedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' EAT',
        status: 'pending',
        reconciliationStatus: 'pending',
        retryCount: 0,
      };

      setDisbursements((prev) => [newDsb, ...prev]);

      logAuditEvent({
        actor: officerName,
        actorRole: staffRole,
        action: 'MAKER_CHECKER_APPROVAL',
        module: 'Applications',
        targetId: targetApp.applicationId,
        category: 'Credit',
        details: `Loan application approved for KES ${(targetApp.approvedAmount || targetApp.requestedAmount).toLocaleString()}. Queued for disbursement.`,
        beforeValue: 'Status: under_review',
        afterValue: 'Status: disbursement_pending',
        outcome: 'Success',
      });
    }
  };

  const rejectApplication = (applicationId: string, reason: string) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.applicationId === applicationId || app.id === applicationId
          ? {
              ...app,
              status: 'declined',
              reviewNotes: reason,
              reviewedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            }
          : app
      )
    );

    logAuditEvent({
      actor: 'Underwriting Desk',
      actorRole: staffRole,
      action: 'LOAN_APPLICATION_DECLINED',
      module: 'Applications',
      targetId: applicationId,
      category: 'Credit',
      details: `Application declined. Reason: ${reason}`,
      beforeValue: 'Status: under_review',
      afterValue: 'Status: declined',
      outcome: 'Success',
    });
  };

  const requestApplicationInfo = (applicationId: string, notes: string) => {
    setApplications((prev) =>
      prev.map((app) =>
        app.applicationId === applicationId || app.id === applicationId
          ? {
              ...app,
              status: 'additional_info_required',
              reviewNotes: notes,
            }
          : app
      )
    );

    logAuditEvent({
      actor: 'Underwriting Desk',
      actorRole: staffRole,
      action: 'ADDITIONAL_INFO_REQUESTED',
      module: 'Applications',
      targetId: applicationId,
      category: 'Credit',
      details: `Requested info: ${notes}`,
      beforeValue: 'Status: under_review',
      afterValue: 'Status: additional_info_required',
      outcome: 'Success',
    });
  };

  // Disbursement Execution
  const executeDisbursement = (disbursementId: string): boolean => {
    const target = disbursements.find((d) => d.id === disbursementId);
    if (!target) return false;

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let providerRef = 'SB';
    for (let i = 0; i < 8; i++) {
      providerRef += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setDisbursements((prev) =>
      prev.map((d) =>
        d.id === disbursementId
          ? {
              ...d,
              status: 'successful',
              providerReference: providerRef,
              completedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' EAT',
              reconciliationStatus: 'matched',
            }
          : d
      )
    );

    // Update application to disbursed
    setApplications((prev) =>
      prev.map((a) =>
        a.applicationId === target.applicationId
          ? { ...a, status: 'disbursed' }
          : a
      )
    );

    // Create Active Loan Account
    const targetApp = applications.find((a) => a.applicationId === target.applicationId);
    const newLoanAccount: LoanAccount = {
      id: `loan-${Date.now()}`,
      loanNumber: target.loanNumber,
      customerId: target.customerId,
      customerName: target.customerName,
      phone: target.phone,
      nationalId: target.nationalId || '29841029',
      productId: targetApp ? targetApp.loanProductId : 'prod-01',
      productName: targetApp ? targetApp.productName : 'Working Capital Facility',
      principalAmount: target.amount,
      disbursedAmount: target.amount,
      outstandingBalance: targetApp ? targetApp.totalRepayable : Math.round(target.amount * 1.15),
      outstandingPrincipal: target.amount,
      outstandingInterest: Math.round(target.amount * 0.15),
      totalRepayable: targetApp ? targetApp.totalRepayable : Math.round(target.amount * 1.15),
      totalPaidAmount: 0,
      monthlyInstallment: targetApp ? targetApp.monthlyInstallment : Math.round(target.amount * 0.2),
      termMonths: targetApp ? targetApp.termMonths : 6,
      interestRate: 2.8,
      interestRatePerMonth: 2.8,
      repaymentFrequency: 'monthly',
      status: 'active',
      disbursedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      disbursementDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      maturityDate: '18 Oct 2025',
      nextRepaymentDate: '18 May 2025',
      nextRepaymentDueDate: '18 May 2025',
      nextRepaymentAmount: targetApp ? targetApp.monthlyInstallment : Math.round(target.amount * 0.2),
      daysUntilDue: 30,
      daysInArrears: 0,
      installments: [],
      repaymentSchedule: [
        {
          installmentNumber: 1,
          dueDate: '18 May 2025',
          principal: Math.round(target.amount / 6),
          interest: Math.round((target.amount * 0.15) / 6),
          totalDue: Math.round((target.amount * 1.15) / 6),
          status: 'pending',
        },
      ],
    };

    setActiveLoans((prev) => [newLoanAccount, ...prev]);

    // Record Transaction
    const newTx: Transaction = {
      id: `tx-dsb-${Date.now()}`,
      transactionRef: `DSB-${Date.now().toString().slice(-8)}`,
      mpesaReceipt: providerRef,
      type: 'disbursement',
      amount: target.amount,
      phone: target.phone,
      customerName: target.customerName,
      loanNumber: target.loanNumber,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeAgo: 'Just now',
      status: 'completed',
      channel: target.channel.toLowerCase().includes('m-pesa') ? 'm-pesa_b2c' : 'bank_eft',
      allocated: true,
      allocatedToLoan: target.loanNumber,
      reconciliationStatus: 'matched',
    };

    setTransactions((prev) => [newTx, ...prev]);

    logAuditEvent({
      actor: 'Disbursement Desk',
      actorRole: staffRole,
      action: 'DISBURSEMENT_EXECUTED',
      module: 'Disbursements',
      targetId: target.loanNumber,
      category: 'Disbursement',
      details: `Released KES ${target.amount.toLocaleString()} via ${target.channel} to ${target.customerName}. Provider Ref: ${providerRef}.`,
      beforeValue: 'Status: pending',
      afterValue: 'Status: successful',
      outcome: 'Success',
    });

    return true;
  };

  const retryDisbursement = (disbursementId: string): boolean => {
    setDisbursements((prev) =>
      prev.map((d) =>
        d.id === disbursementId
          ? {
              ...d,
              status: 'pending',
              retryCount: (d.retryCount || 0) + 1,
              failureReason: undefined,
            }
          : d
      )
    );

    logAuditEvent({
      actor: 'Disbursement Desk',
      actorRole: staffRole,
      action: 'DISBURSEMENT_RETRY_TRIGGERED',
      module: 'Disbursements',
      targetId: disbursementId,
      category: 'Disbursement',
      details: 'Disbursement retry initiated after credential verification.',
      outcome: 'Success',
    });

    return true;
  };

  // Customer Management
  const updateCustomerKycStatus = (
    customerId: string,
    status: 'verified' | 'rejected',
    notes?: string
  ) => {
    setCustomersList((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return {
            ...c,
            kycVerified: status === 'verified',
            identity: {
              ...c.identity,
              verificationResult: status,
              reviewNotes: notes || c.identity.reviewNotes,
              verifiedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
              verifiedBy: 'Senior Compliance Officer',
            },
            isKycCompleteForLending: status === 'verified',
          };
        }
        return c;
      })
    );

    if (customer.id === customerId) {
      setCustomer((prev) => ({
        ...prev,
        kycVerified: status === 'verified',
        identity: {
          ...prev.identity,
          verificationResult: status,
          reviewNotes: notes || prev.identity.reviewNotes,
          verifiedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          verifiedBy: 'Senior Compliance Officer',
        },
        isKycCompleteForLending: status === 'verified',
      }));
    }

    logAuditEvent({
      actor: 'Compliance Desk',
      actorRole: staffRole,
      action: status === 'verified' ? 'KYC_VERIFIED' : 'KYC_REJECTED',
      module: 'Customers',
      targetId: customerId,
      category: 'Customer',
      details: `Customer KYC marked as ${status}. ${notes ? `Notes: ${notes}` : ''}`,
      afterValue: `KYC: ${status}`,
      outcome: 'Success',
    });
  };

  const addCustomerInternalNote = (customerId: string, noteText: string) => {
    const newNote: CustomerNote = {
      id: `cn-${Date.now()}`,
      author: 'Operations Staff',
      authorRole: staffRole,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' EAT',
      note: noteText,
    };

    setCustomersList((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? { ...c, internalNotes: [newNote, ...(c.internalNotes || [])] }
          : c
      )
    );

    if (customer.id === customerId) {
      setCustomer((prev) => ({
        ...prev,
        internalNotes: [newNote, ...(prev.internalNotes || [])],
      }));
    }

    logAuditEvent({
      actor: 'Operations Staff',
      actorRole: staffRole,
      action: 'CUSTOMER_INTERNAL_NOTE_ADDED',
      module: 'Customers',
      targetId: customerId,
      category: 'Customer',
      details: `Note added: ${noteText.slice(0, 60)}...`,
      outcome: 'Success',
    });
  };

  const restrictCustomerAccount = (customerId: string, reason: string) => {
    setCustomersList((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, accountStatus: 'Restricted' } : c))
    );
    if (customer.id === customerId) {
      setCustomer((prev) => ({ ...prev, accountStatus: 'Restricted' }));
    }
    logAuditEvent({
      actor: 'Risk & Compliance',
      actorRole: staffRole,
      action: 'CUSTOMER_RESTRICTED',
      module: 'Customers',
      targetId: customerId,
      category: 'Customer',
      details: `Account restricted: ${reason}`,
      beforeValue: 'Status: Good standing',
      afterValue: 'Status: Restricted',
      outcome: 'Success',
    });
  };

  const reactivateCustomerAccount = (customerId: string) => {
    setCustomersList((prev) =>
      prev.map((c) => (c.id === customerId ? { ...c, accountStatus: 'Good standing' } : c))
    );
    if (customer.id === customerId) {
      setCustomer((prev) => ({ ...prev, accountStatus: 'Good standing' }));
    }
    logAuditEvent({
      actor: 'Risk & Compliance',
      actorRole: staffRole,
      action: 'CUSTOMER_REACTIVATED',
      module: 'Customers',
      targetId: customerId,
      category: 'Customer',
      details: 'Account restriction cleared. Restored to Good standing.',
      beforeValue: 'Status: Restricted',
      afterValue: 'Status: Good standing',
      outcome: 'Success',
    });
  };

  // Repayment & Reconciliation
  const makeMpesaRepayment = (amount: number, phone: string, loanId: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'Q';
    for (let i = 0; i < 9; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      transactionRef: `MP-${Date.now().toString().slice(-8)}`,
      mpesaReceipt: code,
      type: 'repayment',
      amount,
      phone,
      customerName: customer.fullName,
      loanNumber: loanId,
      date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      timeAgo: 'Just now',
      status: 'completed',
      channel: 'm-pesa_stk',
      allocated: true,
      allocatedToLoan: loanId,
      reconciliationStatus: 'matched',
    };

    setTransactions((prev) => [newTx, ...prev]);

    setActiveLoans((prev) =>
      prev.map((loan) => {
        if (loan.id === loanId || loan.loanNumber === loanId) {
          const newBal = Math.max(0, loan.outstandingBalance - amount);
          return {
            ...loan,
            outstandingBalance: newBal,
            totalPaidAmount: loan.totalPaidAmount + amount,
          };
        }
        return loan;
      })
    );

    logAuditEvent({
      actor: 'M-Pesa IPN Gateway',
      actorRole: 'Automated Gateway',
      action: 'C2B_REPAYMENT_ALLOCATED',
      module: 'Repayments',
      targetId: code,
      category: 'Repayment',
      details: `KES ${amount.toLocaleString()} received and allocated to ${loanId}.`,
      outcome: 'Success',
    });

    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: 'M-Pesa Payment Received',
        message: `M-Pesa receipt ${code} of KES ${amount.toLocaleString()} has been reconciled against ${loanId}.`,
        timestamp: 'Just now',
        timeAgo: 'Just now',
        type: 'payment',
        read: false,
      },
      ...prev,
    ]);

    // Asynchronously dispatch payment to Supabase backend if active
    recordSupabaseRepayment(loanId, customer.id, amount, code, phone).catch((err) => {
      console.debug('Background Supabase repayment sync:', err);
    });

    return { receipt: code, success: true };
  };


  const allocatePayment = (txId: string, loanNumber: string): boolean => {
    const tx = transactions.find((t) => t.id === txId || t.transactionRef === txId);
    if (!tx) return false;

    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId || t.transactionRef === txId
          ? {
              ...t,
              allocated: true,
              allocatedToLoan: loanNumber,
              loanNumber,
              reconciliationStatus: 'matched',
            }
          : t
      )
    );

    setActiveLoans((prev) =>
      prev.map((l) => {
        if (l.loanNumber === loanNumber) {
          return {
            ...l,
            outstandingBalance: Math.max(0, l.outstandingBalance - tx.amount),
            totalPaidAmount: l.totalPaidAmount + tx.amount,
          };
        }
        return l;
      })
    );

    logAuditEvent({
      actor: 'Finance Officer',
      actorRole: staffRole,
      action: 'MANUAL_PAYMENT_ALLOCATION',
      module: 'Repayments',
      targetId: tx.mpesaReceipt || tx.transactionRef,
      category: 'Repayment',
      details: `Unallocated payment of KES ${tx.amount.toLocaleString()} mapped to loan account ${loanNumber}.`,
      beforeValue: 'Allocated: false',
      afterValue: `Allocated to: ${loanNumber}`,
      outcome: 'Success',
    });

    return true;
  };

  const reverseTransaction = (txId: string, reason: string): boolean => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId || t.transactionRef === txId
          ? { ...t, status: 'reversed', reconciliationStatus: 'flagged' }
          : t
      )
    );

    logAuditEvent({
      actor: 'Finance Supervisor',
      actorRole: staffRole,
      action: 'TRANSACTION_REVERSED',
      module: 'Repayments',
      targetId: txId,
      category: 'Repayment',
      details: `Transaction reversed. Reason: ${reason}`,
      beforeValue: 'Status: completed',
      afterValue: 'Status: reversed',
      outcome: 'Success',
    });

    return true;
  };

  // Collections Operations
  const recordCollectionFollowUp = (
    loanNumber: string,
    outcome: string,
    notes: string,
    promiseAmount?: number,
    promiseDate?: string
  ) => {
    const newContactItem = {
      id: `ch-${Date.now()}`,
      timestamp: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' EAT',
      officer: 'Collections Agent',
      channel: 'Phone Call',
      notes,
      outcome,
    };

    setCollections((prev) =>
      prev.map((col) => {
        if (col.loanNumber === loanNumber) {
          return {
            ...col,
            status: promiseAmount ? 'promise_to_pay' : 'active_followup',
            promiseToPayAmount: promiseAmount || col.promiseToPayAmount,
            promiseToPayDate: promiseDate || col.promiseToPayDate,
            lastContactDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            contactHistory: [newContactItem, ...(col.contactHistory || [])],
          };
        }
        return col;
      })
    );

    logAuditEvent({
      actor: 'Collections Agent',
      actorRole: staffRole,
      action: promiseAmount ? 'COLLECTION_PROMISE_TO_PAY' : 'COLLECTION_CONTACT_LOGGED',
      module: 'Collections',
      targetId: loanNumber,
      category: 'Collections',
      details: `Follow-up outcome: ${outcome}. ${notes}`,
      outcome: 'Success',
    });
  };

  const assignCollectionOfficer = (loanNumber: string, officerName: string) => {
    setCollections((prev) =>
      prev.map((c) => (c.loanNumber === loanNumber ? { ...c, assignedOfficer: officerName } : c))
    );

    logAuditEvent({
      actor: 'Collections Lead',
      actorRole: staffRole,
      action: 'COLLECTION_OFFICER_REASSIGNED',
      module: 'Collections',
      targetId: loanNumber,
      category: 'Collections',
      details: `Account reassigned to officer ${officerName}.`,
      outcome: 'Success',
    });
  };

  // Loan Restructuring & Settlement
  const restructureLoan = (loanNumber: string, newTermMonths: number, reason: string): boolean => {
    setActiveLoans((prev) =>
      prev.map((l) => {
        if (l.loanNumber === loanNumber) {
          const newInstallment = Math.round(l.outstandingBalance / newTermMonths);
          return {
            ...l,
            termMonths: newTermMonths,
            monthlyInstallment: newInstallment,
            status: 'active',
          };
        }
        return l;
      })
    );

    logAuditEvent({
      actor: 'Credit Committee',
      actorRole: staffRole,
      action: 'LOAN_RESTRUCTURED',
      module: 'Loans',
      targetId: loanNumber,
      category: 'Credit',
      details: `Tenor extended to ${newTermMonths} months. Justification: ${reason}`,
      outcome: 'Success',
    });

    return true;
  };

  const writeOffLoan = (loanNumber: string, reason: string): boolean => {
    setActiveLoans((prev) =>
      prev.map((l) => (l.loanNumber === loanNumber ? { ...l, status: 'written_off' } : l))
    );

    logAuditEvent({
      actor: 'Board Credit Committee',
      actorRole: staffRole,
      action: 'LOAN_WRITTEN_OFF',
      module: 'Loans',
      targetId: loanNumber,
      category: 'Credit',
      details: `Loan written off to non-performing asset reserve. Justification: ${reason}`,
      beforeValue: 'Status: in_arrears',
      afterValue: 'Status: written_off',
      outcome: 'Success',
    });

    return true;
  };

  // Loan Products
  const updateLoanProduct = (updated: LoanProduct) => {
    setLoanProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    logAuditEvent({
      actor: 'Product Manager',
      actorRole: staffRole,
      action: 'LOAN_PRODUCT_UPDATED',
      module: 'Loan Products',
      targetId: updated.code,
      category: 'Configuration',
      details: `Updated parameters for ${updated.name}.`,
      outcome: 'Success',
    });
  };

  const createLoanProduct = (product: Partial<LoanProduct>): LoanProduct => {
    const newProd: LoanProduct = {
      id: `prod-${Date.now()}`,
      name: product.name || 'New Product',
      code: product.code || 'PROD-NEW',
      description: product.description || '',
      category: product.category || 'Business & MSME',
      minAmount: product.minAmount || 5000,
      maxAmount: product.maxAmount || 100000,
      defaultAmount: product.defaultAmount || 25000,
      stepAmount: product.stepAmount || 5000,
      minTermMonths: product.minTermMonths || 1,
      maxTermMonths: product.maxTermMonths || 12,
      termOptions: product.termOptions || [1, 3, 6, 12],
      defaultTermMonths: product.defaultTermMonths || 6,
      interestRatePerMonth: product.interestRatePerMonth || 3.0,
      interestCalculationMethod: product.interestCalculationMethod || 'reducing_balance',
      repaymentFrequency: product.repaymentFrequency || 'monthly',
      processingFeePercent: product.processingFeePercent || 3,
      exciseDutyPercent: 20,
      insuranceFeePercent: 0.5,
      gracePeriodDays: product.gracePeriodDays || 3,
      latePenaltyRatePercent: product.latePenaltyRatePercent || 1.5,
      approvalMode: product.approvalMode || 'automatic',
      status: 'active',
      eligibilityRules: product.eligibilityRules || {
        minAge: 18,
        minMonthlyIncome: 15000,
        minCreditScore: 600,
        requiresMpesaStatement: true,
        requiresGuarantor: false,
      },
      version: '1.0',
      effectiveDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    };

    setLoanProducts((prev) => [newProd, ...prev]);

    logAuditEvent({
      actor: 'Product Architect',
      actorRole: staffRole,
      action: 'LOAN_PRODUCT_CREATED',
      module: 'Loan Products',
      targetId: newProd.code,
      category: 'Configuration',
      details: `Created new credit product: ${newProd.name}.`,
      outcome: 'Success',
    });

    return newProd;
  };

  const setLoanProductStatus = (productId: string, status: LoanProduct['status']) => {
    setLoanProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, status } : p))
    );

    logAuditEvent({
      actor: 'Product Architect',
      actorRole: staffRole,
      action: 'LOAN_PRODUCT_STATUS_CHANGED',
      module: 'Loan Products',
      targetId: productId,
      category: 'Configuration',
      details: `Product status changed to ${status}.`,
      afterValue: `Status: ${status}`,
      outcome: 'Success',
    });
  };

  // Staff Management
  const updateStaffUser = (updatedUser: StaffUser) => {
    setStaffUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
    logAuditEvent({
      actor: 'Super Admin',
      actorRole: staffRole,
      action: 'STAFF_PERMISSIONS_UPDATED',
      module: 'Staff & Access Management',
      targetId: updatedUser.email,
      category: 'Security',
      details: `Role or permissions updated for ${updatedUser.fullName}.`,
      outcome: 'Success',
    });
  };

  const inviteStaffUser = (data: Partial<StaffUser>): StaffUser => {
    const newUser: StaffUser = {
      id: `staff-${Date.now()}`,
      fullName: data.fullName || 'New Staff Member',
      email: data.email || 'staff@institution.co.ke',
      phone: data.phone || '+254 700 000 000',
      role: data.role || 'credit_officer',
      title: data.title || 'Officer',
      department: data.department || 'Operations',
      avatarInitials: data.fullName ? data.fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'NS',
      status: 'active',
      lastLogin: 'Never',
      permissions: data.permissions || ['view', 'create', 'submit'],
    };

    setStaffUsers((prev) => [newUser, ...prev]);

    logAuditEvent({
      actor: 'Super Admin',
      actorRole: staffRole,
      action: 'STAFF_INVITED',
      module: 'Staff & Access Management',
      targetId: newUser.email,
      category: 'Security',
      details: `Invited ${newUser.fullName} with role ${newUser.role}.`,
      outcome: 'Success',
    });

    return newUser;
  };

  const toggleStaffStatus = (staffId: string) => {
    setStaffUsers((prev) =>
      prev.map((u) =>
        u.id === staffId
          ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' }
          : u
      )
    );

    logAuditEvent({
      actor: 'Super Admin',
      actorRole: staffRole,
      action: 'STAFF_STATUS_TOGGLED',
      module: 'Staff & Access Management',
      targetId: staffId,
      category: 'Security',
      details: 'Staff account status toggled.',
      outcome: 'Success',
    });
  };

  return (
    <BrandContext.Provider
      value={{
        brand,
        updateBrand,
        setBrandPreset,
        activePortal,
        setActivePortal,
        customerView,
        setCustomerView,
        authSession,
        setAuthSession,
        loginCustomer,
        registerCustomer,
        verifyCustomerEmail,
        resendVerificationEmail,
        sendPasswordResetLink,
        logoutCustomer,
        switchCustomerPersona,
        staffModule,
        setStaffModule,
        staffRole,
        setStaffRole,
        previewDeviceFrame,
        setPreviewDeviceFrame,
        customer,
        setLiveCustomer: setCustomer,
        updateCustomerSection,
        loanProducts,
        activeLoans,
        transactions,
        applications,
        customersList,
        disbursements,
        collections,
        staffUsers,
        auditLogs,
        notifications,
        markNotificationRead,
        submitNewApplication,
        approveApplication,
        rejectApplication,
        requestApplicationInfo,
        makeMpesaRepayment,
        updateLoanProduct,
        createLoanProduct,
        setLoanProductStatus,
        executeDisbursement,
        retryDisbursement,
        updateCustomerKycStatus,
        addCustomerInternalNote,
        restrictCustomerAccount,
        reactivateCustomerAccount,
        allocatePayment,
        reverseTransaction,
        recordCollectionFollowUp,
        assignCollectionOfficer,
        restructureLoan,
        writeOffLoan,
        updateStaffUser,
        inviteStaffUser,
        toggleStaffStatus,
        logAuditEvent,
        isKycPromptOpen,
        setIsKycPromptOpen,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}
