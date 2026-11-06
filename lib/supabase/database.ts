import { supabase, isSupabaseDataRuntimeEnabled } from './client';
import { CustomerProfile, LoanApplication, LoanAccount, Transaction, LoanProduct } from '../types/lending';
import {
  MOCK_CUSTOMER,
  MOCK_RECENT_APPLICATIONS,
  MOCK_ACTIVE_LOANS,
  MOCK_CUSTOMER_TRANSACTIONS,
  MOCK_LOAN_PRODUCTS,
} from '../mock-data';


/**
 * Calculates KYC completion percentage across the 5 mandatory sections:
 * 1. Personal Details (20%)
 * 2. Contact Details (20%)
 * 3. Employment & Income (20%)
 * 4. Identity & Documents (20%)
 * 5. Payment Channel (20%)
 */
export function calculateKycProgress(personal: any, contact: any, employment: any, identity: any, payment: any): {
  percentage: number;
  isComplete: boolean;
} {
  let count = 0;
  if (personal?.completed) count += 20;
  if (contact?.completed) count += 20;
  if (employment?.completed) count += 20;
  if (identity?.completed) count += 20;
  if (payment?.completed) count += 20;

  return {
    percentage: count,
    isComplete: count >= 100,
  };
}

/**
 * Fetches customer profile from Supabase with automatic fallback to mock data.
 * If user exists in auth.users/profiles but does not yet have a record in public.customers,
 * initializes their customer record.
 */
export async function getCustomerProfile(
  userId: string,
  defaults?: { email?: string; fullName?: string; phone?: string }
): Promise<CustomerProfile> {
  if (!isSupabaseDataRuntimeEnabled()) {
    return MOCK_CUSTOMER;
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*, profiles(*)')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('Error fetching customer profile from Supabase:', error.message);
      return MOCK_CUSTOMER;
    }

    if (!data) {
      // User is authenticated but record in public.customers does not exist yet.
      // Auto-provision initial customer profile row
      const customerNum = `CUST-KE-${Math.floor(10000 + Math.random() * 90000)}`;
      const { data: newCust, error: insertError } = await supabase
        .from('customers')
        .insert({
          id: userId,
          institution_id: '00000000-0000-0000-0000-000000000001',
          customer_number: customerNum,
          mpesa_phone_number: defaults?.phone || '0700 000 000',
          kyc_status: 'pending',
          profile_completion_percentage: 20,
          is_kyc_complete_for_lending: false,
        })
        .select('*, profiles(*)')
        .single();

      if (insertError) {
        console.warn('Could not auto-provision customer record:', insertError.message);
        return MOCK_CUSTOMER;
      }
      return mapDbCustomerToProfile(newCust, defaults);
    }

    return mapDbCustomerToProfile(data, defaults);
  } catch (err) {
    console.warn('Failed to query customer profile:', err);
    return MOCK_CUSTOMER;
  }
}

/**
 * Maps Supabase relational columns to the 5-section frontend CustomerProfile.
 */
function mapDbCustomerToProfile(dbRow: any, defaults?: { email?: string; fullName?: string; phone?: string }): CustomerProfile {
  const profile = dbRow.profiles || {};
  const fullName = profile.full_name || defaults?.fullName || 'Jane Muthoni';
  const names = fullName.split(' ');
  const firstName = names[0] || 'Jane';
  const lastName = names.slice(1).join(' ') || 'Muthoni';
  const email = profile.email || defaults?.email || 'customer@example.ke';
  const phone = profile.phone_number || dbRow.mpesa_phone_number || defaults?.phone || '0712 345 678';

  const personalCompleted = Boolean(dbRow.national_id && dbRow.date_of_birth);
  const contactCompleted = Boolean(dbRow.residential_address && dbRow.county);
  const employmentCompleted = Boolean(dbRow.employment_status && Number(dbRow.monthly_income) > 0);
  const identityCompleted = Boolean(dbRow.kra_pin && dbRow.kyc_status === 'verified');
  const paymentCompleted = Boolean(dbRow.mpesa_phone_number);

  const kyc = calculateKycProgress(
    { completed: personalCompleted },
    { completed: contactCompleted },
    { completed: employmentCompleted },
    { completed: identityCompleted },
    { completed: paymentCompleted }
  );

  return {
    id: dbRow.id,
    customerNumber: dbRow.customer_number || 'CUST-KE-001',
    fullName,
    email,
    phone,
    nationalId: dbRow.national_id || '',
    kraPin: dbRow.kra_pin || '',
    dateOfBirth: dbRow.date_of_birth || '1992-06-14',
    employmentStatus: (dbRow.employment_status as any) || 'Employed',
    monthlyIncome: Number(dbRow.monthly_income) || 0,
    creditScore: dbRow.credit_score || 680,
    creditRating: dbRow.credit_rating || 'B',
    availableLoanLimit: Number(dbRow.available_loan_limit) || 30000,
    maxBorrowingCapacity: Number(dbRow.max_borrowing_capacity) || 60000,
    accountStatus: dbRow.account_status || 'Good standing',
    joinedDate: dbRow.created_at ? new Date(dbRow.created_at).toLocaleDateString('en-GB') : 'Nov 2023',
    kycVerified: dbRow.kyc_status === 'verified',
    activeLoanCount: 0,
    totalLoansSettled: 0,

    personal: {
      fullName,
      firstName,
      lastName,
      dateOfBirth: dbRow.date_of_birth || '',
      nationalId: dbRow.national_id || '',
      nationality: dbRow.nationality || 'Kenyan',
      gender: (dbRow.gender as any) || 'Female',
      completed: personalCompleted,
    },
    contact: {
      phone,
      phoneVerified: true,
      email,
      emailVerified: true,
      residentialAddress: dbRow.residential_address || '',
      county: dbRow.county || '',
      town: dbRow.town || '',
      completed: contactCompleted,
    },
    employment: {
      employmentStatus: (dbRow.employment_status as any) || 'Employed',
      employerOrBusiness: dbRow.employer_name || '',
      occupation: dbRow.occupation || '',
      monthlyIncome: Number(dbRow.monthly_income) || 0,
      otherIncomeSources: Number(dbRow.other_income) > 0 ? `KES ${Number(dbRow.other_income)}/mo` : 'None',
      existingObligations: Number(dbRow.existing_obligations) || 0,
      completed: employmentCompleted,
    },
    identity: {
      documentType: 'National ID',
      frontSideUploaded: true,
      backSideUploaded: true,
      kraPin: dbRow.kra_pin || '',
      kraPinVerified: Boolean(dbRow.kra_pin),
      verificationResult: dbRow.kyc_status === 'verified' ? 'verified' : dbRow.kyc_status === 'rejected' ? 'rejected' : 'pending',
      completed: identityCompleted,
    },
    payment: {
      mpesaNumber: dbRow.mpesa_phone_number || phone,
      mpesaVerified: true,
      accountOwnershipConfirmed: true,
      accountType: 'M-Pesa Wallet',
      bankName: dbRow.bank_name || '',
      bankAccountName: dbRow.bank_account_name || '',
      bankAccountNumber: dbRow.bank_account_number || '',
      completed: paymentCompleted,
    },
    profileCompletionPercentage: kyc.percentage,
    isKycCompleteForLending: kyc.isComplete,
  };
}

/**
 * Saves or updates a KYC section in Supabase.
 */
export async function updateCustomerKyc(
  userId: string,
  section: 'personal' | 'contact' | 'employment' | 'identity' | 'payment',
  data: Record<string, any>
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseDataRuntimeEnabled()) {
    return { success: true };
  }

  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (section === 'personal') {
      if (data.nationalId) updatePayload.national_id = data.nationalId;
      if (data.dateOfBirth) updatePayload.date_of_birth = data.dateOfBirth;
      if (data.gender) updatePayload.gender = data.gender;
      if (data.nationality) updatePayload.nationality = data.nationality;
    } else if (section === 'contact') {
      if (data.residentialAddress) updatePayload.residential_address = data.residentialAddress;
      if (data.county) updatePayload.county = data.county;
      if (data.town) updatePayload.town = data.town;
    } else if (section === 'employment') {
      if (data.employmentStatus) updatePayload.employment_status = data.employmentStatus;
      if (data.employerOrBusiness) updatePayload.employer_name = data.employerOrBusiness;
      if (data.occupation) updatePayload.occupation = data.occupation;
      if (data.monthlyIncome !== undefined) updatePayload.monthly_income = Number(data.monthlyIncome);
      if (data.existingObligations !== undefined) updatePayload.existing_obligations = Number(data.existingObligations);
    } else if (section === 'identity') {
      if (data.kraPin) updatePayload.kra_pin = data.kraPin;
      updatePayload.kyc_status = 'under_review';
    } else if (section === 'payment') {
      if (data.mpesaNumber) updatePayload.mpesa_phone_number = data.mpesaNumber;
      if (data.bankName) updatePayload.bank_name = data.bankName;
      if (data.bankAccountNumber) updatePayload.bank_account_number = data.bankAccountNumber;
      if (data.bankAccountName) updatePayload.bank_account_name = data.bankAccountName;
    }

    const { error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Submits a new loan application to Supabase.
 */
export async function submitLoanApplication(
  customerId: string,
  applicationData: {
    productId: string;
    productName: string;
    amount: number;
    termMonths: number;
    purpose: string;
    monthlyInterestRate: number;
    estimatedMonthlyPayment: number;
  }
): Promise<{ success: boolean; application?: any; error?: string }> {
  if (!isSupabaseDataRuntimeEnabled()) {
    const appId = `APP-KE-${Math.floor(10000 + Math.random() * 90000)}`;
    const totalInt = Math.round(applicationData.amount * (applicationData.monthlyInterestRate / 100) * applicationData.termMonths);
    const procFee = Math.round(applicationData.amount * 0.025);
    const mockApp: LoanApplication = {
      id: `app-local-${Date.now()}`,
      applicationId: appId,
      customerId,
      customerName: 'Customer',
      phone: '0712 345 678',
      nationalId: '29841029',
      loanProductId: applicationData.productId,
      productName: applicationData.productName,
      requestedAmount: applicationData.amount,
      termMonths: applicationData.termMonths,
      monthlyInstallment: applicationData.estimatedMonthlyPayment,
      totalInterest: totalInt,
      processingFee: procFee,
      totalRepayable: applicationData.amount + totalInt + procFee,
      loanPurpose: applicationData.purpose,
      creditScore: 780,
      status: 'submitted',
      submittedAt: new Date().toLocaleDateString('en-GB'),
    };
    return { success: true, application: mockApp };
  }


  try {
    const appNumber = `APP-KE-${Math.floor(10000 + Math.random() * 90000)}`;

    const { data, error } = await supabase
      .from('loan_applications')
      .insert({
        institution_id: '00000000-0000-0000-0000-000000000001',
        application_number: appNumber,
        customer_id: customerId,
        product_id: applicationData.productId,
        amount_requested: applicationData.amount,
        term_months: applicationData.termMonths,
        purpose: applicationData.purpose,
        monthly_interest_rate: applicationData.monthlyInterestRate,
        estimated_monthly_payment: applicationData.estimatedMonthlyPayment,
        stage: 'submitted',
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, application: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Records an M-Pesa repayment payment against an active loan in Supabase.
 */
export async function recordRepayment(
  loanId: string,
  customerId: string,
  amount: number,
  mpesaReceipt: string,
  mpesaPhone: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseDataRuntimeEnabled()) {
    return { success: true };
  }

  try {
    const { error } = await supabase.from('payments').insert({
      institution_id: '00000000-0000-0000-0000-000000000001',
      loan_id: loanId,
      customer_id: customerId,
      transaction_reference: mpesaReceipt,
      amount,
      payment_method: 'mpesa',
      mpesa_phone: mpesaPhone,
      status: 'completed',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Refresh loan balance
    const { data: loan } = await supabase
      .from('loans')
      .select('total_repaid, balance_outstanding')
      .eq('id', loanId)
      .maybeSingle();

    if (loan) {
      const newRepaid = Number(loan.total_repaid || 0) + amount;
      const newBal = Math.max(0, Number(loan.balance_outstanding || 0) - amount);
      const newStatus = newBal === 0 ? 'closed' : undefined;

      await supabase
        .from('loans')
        .update({
          total_repaid: newRepaid,
          balance_outstanding: newBal,
          ...(newStatus ? { status: newStatus } : {}),
        })
        .eq('id', loanId);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
