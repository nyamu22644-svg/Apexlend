import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
function token(request: NextRequest) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; }
export async function POST(request: NextRequest) {
  try { const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json(); const { client } = await requireAuthenticatedUser(accessToken); const { data, error } = await client.rpc('get_my_loan_quote', { p_product_version_id: body.productVersionId, p_amount: body.amount, p_term_months: body.termMonths }); if (error) return NextResponse.json({ error: error.message }, { status: 422 }); return NextResponse.json({ quote: data?.[0] }); }
  catch { return NextResponse.json({ error: 'Unable to calculate loan quote' }, { status: 500 }); }
}
