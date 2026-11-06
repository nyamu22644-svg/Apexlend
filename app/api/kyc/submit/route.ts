import { NextRequest, NextResponse } from 'next/server';
import { encryptPii, hashNationalId } from '@/lib/server/kyc-crypto';
import { requireAuthenticatedUser } from '@/lib/server/supabase';

export const runtime = 'nodejs';

function token(request: NextRequest) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { client } = await requireAuthenticatedUser(accessToken);
    const body = await request.json();
    const { data, error } = await client.rpc('submit_my_kyc', {
      p_full_name: String(body.fullName || ''), p_phone_number: String(body.phone || ''),
      p_date_of_birth: String(body.dateOfBirth || ''), p_residential_address: String(body.residentialAddress || ''),
      p_county: String(body.county || ''), p_town: String(body.town || ''),
      p_national_id_ciphertext: encryptPii(String(body.nationalId || '')),
      p_national_id_hash: hashNationalId(String(body.nationalId || '')),
      p_kra_pin_ciphertext: encryptPii(String(body.kraPin || '')),
      p_mpesa_phone_number: String(body.mpesaPhone || ''),
      p_nationality: String(body.nationality || 'Kenyan'), p_gender: String(body.gender || ''),
      p_employment_status: String(body.employmentStatus || ''), p_employer_name: String(body.employerName || ''),
      p_occupation: String(body.occupation || ''), p_monthly_income: Number(body.monthlyIncome || 0),
      p_other_income_sources: String(body.otherIncomeSources || ''), p_existing_monthly_obligations: Number(body.existingMonthlyObligations || 0),
      p_bank_name: String(body.bankName || ''), p_bank_account_name: String(body.bankAccountName || ''),
      p_bank_account_ciphertext: body.bankAccountNumber ? encryptPii(String(body.bankAccountNumber)) : '',
      p_bank_branch_code: String(body.bankBranchCode || ''),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ kycCaseId: data, status: 'under_review' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'KYC submission failed';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
