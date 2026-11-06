export type InterestCalculationMethod = 'flat' | 'reducing_balance' | 'amortized';
export type RepaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type LoanApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'additional_info_required'
  | 'approved'
  | 'declined'
  | 'disbursement_pending'
  | 'disbursed'
  | 'cancelled';

export type LoanAccountStatus = 'active' | 'in_arrears' | 'settled' | 'defaulted' | 'written_off';
export type InstallmentStatus = 'pending' | 'due' | 'paid' | 'overdue';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'reversed';
export type TransactionType = 'disbursement' | 'repayment' | 'fee_charge' | 'penalty_charge' | 'reversal';

export type UserRole =
  | 'super_admin'
  | 'admin'
  | 'operations_manager'
  | 'kyc_officer'
  | 'credit_officer'
  | 'loan_approver'
  | 'disbursement_officer'
  | 'disbursement_preparer'
  | 'disbursement_approver'
  | 'finance_officer'
  | 'collections_agent'
  | 'compliance_auditor'
  | 'support_officer'
  | 'product_settings_admin'
  | 'customer';

export type StaffModule =
  | 'dashboard'
  | 'customers'
  | 'support'
  | 'kyc'
  | 'loan_products'
  | 'applications'
  | 'loans'
  | 'disbursements'
  | 'repayments'
  | 'collections'
  | 'reports'
  | 'branding'
  | 'audit_logs'
  | 'staff_management';

export interface BrandConfig {
  institutionName: string;
  shortName: string;
  tagline: string;
  cbkLicenseNumber: string;
  regulatoryBody: string;
  physicalAddress: string;
  supportPhone: string;
  supportEmail: string;
  mpesaPaybill: string;
  mpesaAccountPrefix: string;
  ussdCode: string;
  currency: string;
  primaryColor: string; // Teal: #167D78
  secondaryColor: string; // Midnight navy: #101C2C
  accentColor: string; // Muted gold: #D6A85F
  surfaceColor: string; // #F5F7FA
  whiteColor: string; // #FFFFFF
  logoStyle: 'geometric-ribbon' | 'shield' | 'crest';
}

export interface LoanProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'Business & MSME' | 'Personal' | 'Asset Finance' | 'Agriculture' | 'Salary Advance';
  minAmount: number;
  maxAmount: number;
  defaultAmount: number;
  stepAmount: number;
  minTermMonths: number;
  maxTermMonths: number;
  termOptions: number[]; // e.g., [3, 6, 9, 12]
  defaultTermMonths: number;
  interestRatePerMonth: number; // e.g. 2.5%
  interestCalculationMethod: InterestCalculationMethod;
  repaymentFrequency: RepaymentFrequency;
  processingFeePercent: number; // e.g. 3%
  exciseDutyPercent: number; // 20% on fees (Kenya Tax)
  insuranceFeePercent: number; // e.g. 0.5%
  gracePeriodDays: number;
  latePenaltyRatePercent: number;
  effectiveDate?: string;
  version?: string | number;
  eligibilityRules: {
    minAge: number;
    minMonthlyIncome: number;
    minCreditScore: number;
    requiresMpesaStatement: boolean;
    requiresGuarantor: boolean;
  };
  approvalMode: 'automatic' | 'manual' | 'tiered';
  status: 'active' | 'inactive' | 'draft' | 'suspended' | 'archived';
}

// 5-Section Progressive Customer Profile Structure
export interface PersonalInformation {
  fullName: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationalId: string;
  nationality: string;
  gender: 'Female' | 'Male' | 'Prefer not to say';
  completed: boolean;
}

export interface ContactInformation {
  phone: string;
  phoneVerified: boolean;
  email: string;
  emailVerified: boolean;
  residentialAddress: string;
  county: string;
  town: string;
  completed: boolean;
}

export interface EmploymentIncome {
  employmentStatus: 'Employed' | 'Self-Employed' | 'Business Owner' | 'Contractor' | 'Unemployed';
  employerOrBusiness: string;
  occupation: string;
  monthlyIncome: number;
  otherIncomeSources: string;
  existingObligations: number;
  completed: boolean;
}

export interface IdentityVerification {
  documentType: 'National ID' | 'Passport' | 'Alien ID';
  frontSideUploaded: boolean;
  backSideUploaded: boolean;
  frontDocUrl?: string;
  backDocUrl?: string;
  kraPin: string;
  kraPinVerified: boolean;
  verificationResult: 'unverified' | 'pending' | 'verified' | 'rejected';
  verifiedAt?: string;
  verifiedBy?: string;
  reviewNotes?: string;
  completed: boolean;
}

export interface PaymentInformation {
  mpesaNumber: string;
  mpesaVerified: boolean;
  accountOwnershipConfirmed: boolean;
  accountType: 'M-Pesa Wallet' | 'Bank Account';
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  completed: boolean;
}

export interface CustomerNote {
  id: string;
  author: string;
  authorRole: string;
  date: string;
  note: string;
}

export interface CustomerProfile {
  id: string;
  customerNumber: string;
  fullName: string;
  email: string;
  phone: string;
  nationalId: string;
  kraPin: string;
  dateOfBirth: string;
  employmentStatus: 'Employed' | 'Self-Employed' | 'Business Owner' | 'Contractor';
  monthlyIncome: number;
  creditScore: number;
  creditRating: 'A' | 'B' | 'C' | 'D';
  availableLoanLimit: number;
  maxBorrowingCapacity: number;
  accountStatus: 'Good standing' | 'Under Review' | 'Restricted';
  joinedDate: string;
  kycVerified: boolean;
  activeLoanCount: number;
  totalLoansSettled: number;

  // 5 Structured Sections
  personal: PersonalInformation;
  contact: ContactInformation;
  employment: EmploymentIncome;
  identity: IdentityVerification;
  payment: PaymentInformation;
  profileCompletionPercentage: number;
  isKycCompleteForLending: boolean;

  // Staff operational fields
  internalNotes?: CustomerNote[];
  statusReason?: string;
}

export interface CustomerAuthSession {
  isAuthenticated: boolean;
  email: string;
  fullName: string;
  emailConfirmed: boolean;
  authView: 'login' | 'register' | 'verify-email' | 'otp-login' | 'forgot-password' | 'authenticated';
  pendingEmailVerificationCode?: string;
  lastVerificationSentAt?: number;
}

export interface CustomerNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  timeAgo: string;
  type: 'alert' | 'success' | 'info' | 'payment';
  read: boolean;
  actionUrl?: string;
}

export interface LoanApplication {
  id: string;
  applicationId: string;
  customerId: string;
  customerName: string;
  phone: string;
  nationalId: string;
  loanProductId: string;
  productName: string;
  requestedAmount: number;
  approvedAmount?: number;
  termMonths: number;
  monthlyInstallment: number;
  totalInterest: number;
  processingFee: number;
  totalRepayable: number;
  loanPurpose: string;
  creditScore: number;
  riskTier?: 'Tier A' | 'Tier B' | 'Tier C' | 'Tier D';
  dstiRatio?: number; // Debt Service to Income percentage
  status: LoanApplicationStatus;
  submittedAt: string;
  preparedBy?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  decisionReason?: string;
}

export interface RepaymentInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  feesDue: number;
  totalDue: number;
  amountPaid: number;
  status: InstallmentStatus;
  paidDate?: string;
  mpesaReceipt?: string;
}

export interface LoanAdjustment {
  id: string;
  date: string;
  type: 'interest_waiver' | 'penalty_waiver' | 'schedule_extension' | 'write_off';
  amount: number;
  approvedBy: string;
  reason: string;
}

export interface LoanAccount {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  nationalId: string;
  productId: string;
  productName: string;
  principalAmount: number;
  totalRepayable: number;
  disbursedAmount: number;
  outstandingBalance: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  totalPaidAmount: number;
  interestRate: number;
  termMonths: number;
  monthlyInstallment: number;
  repaymentFrequency: RepaymentFrequency;
  disbursedAt: string;
  maturityDate: string;
  nextRepaymentDueDate: string;
  nextRepaymentAmount: number;
  daysUntilDue: number;
  status: LoanAccountStatus;
  installments: RepaymentInstallment[];
  disbursementDate?: string;
  nextRepaymentDate?: string;
  daysInArrears?: number;
  interestRatePerMonth?: number;
  repaymentSchedule?: any[];
  adjustments?: LoanAdjustment[];
  internalNotes?: CustomerNote[];
}

export interface DisbursementRecord {
  id: string;
  disbursementRef?: string;
  applicationId: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  nationalId?: string;
  phone: string;
  amount: number;
  channel: 'M-Pesa B2C' | 'Bank EFT/RTGS' | string;
  destinationAccount: string;
  initiatedBy: string;
  initiatedAt: string;
  completedAt?: string;
  status: 'pending' | 'initiated' | 'successful' | 'failed' | 'reversed';
  providerReference?: string;
  failureReason?: string;
  reconciliationStatus: 'reconciled' | 'pending' | 'flagged' | 'matched';
  retryCount: number;
}

export interface Transaction {
  id: string;
  transactionRef: string;
  mpesaReceipt: string;
  type: TransactionType;
  amount: number;
  phone: string;
  customerName: string;
  loanNumber: string;
  date: string;
  timeAgo: string;
  status: TransactionStatus;
  channel: 'm-pesa_stk' | 'm-pesa_c2b' | 'm-pesa_b2c' | 'internal_transfer' | 'bank_eft';
  allocated: boolean;
  allocatedToLoan?: string;
  reconciliationStatus?: 'matched' | 'unallocated' | 'disputed' | 'flagged';
}

export interface CollectionRecord {
  id: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  phone: string;
  totalOutstanding: number;
  overdueArrears: number;
  daysPastDue: number;
  ageingBucket: 'PAR 1-30' | 'PAR 31-60' | 'PAR 61-90' | 'PAR 90+';
  assignedOfficer: string;
  lastContactDate: string;
  nextFollowUpDate: string;
  status: 'active_followup' | 'promise_to_pay' | 'escalated' | 'legal_notice' | 'remedied';
  promiseToPayAmount?: number;
  promiseToPayDate?: string;
  contactHistory: Array<{
    id: string;
    timestamp: string;
    officer: string;
    channel: 'Phone Call' | 'SMS Reminder' | 'Demand Notice' | 'In-Person' | string;
    notes: string;
    outcome: string;
  }>;
}

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  title: string;
  department: string;
  avatarInitials: string;
  status: 'active' | 'suspended';
  lastLogin: string;
  permissions: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  module: string;
  targetId: string;
  category: 'Security' | 'Credit' | 'Disbursement' | 'Repayment' | 'Configuration' | 'Collections' | 'Customer';
  details: string;
  beforeValue?: string;
  afterValue?: string;
  outcome: 'Success' | 'Declined' | 'Blocked';
  ipAddress?: string;
}
