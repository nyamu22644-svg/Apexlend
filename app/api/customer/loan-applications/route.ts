import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
function token(request: NextRequest) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; }
export async function POST(request: NextRequest) {
  try { const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json(); const { client } = await requireAuthenticatedUser(accessToken); const { data, error } = await client.rpc('submit_my_loan_application', { p_product_version_id: body.productVersionId, p_requested_amount: body.amount, p_requested_term_months: body.termMonths, p_loan_purpose: body.purpose, p_crb_consent: body.crbConsent, p_terms_consent: body.termsConsent, p_idempotency_key: body.idempotencyKey }); if (error) return NextResponse.json({ error: error.message }, { status: 422 }); return NextResponse.json({ application: data?.[0] }); }
  catch (error) { console.error('Loan application submission failed', error); return NextResponse.json({ error: 'Unable to submit your application' }, { status: 500 }); }
}
