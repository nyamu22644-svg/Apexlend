import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
function token(request: NextRequest) { const value=request.headers.get('authorization'); return value?.startsWith('Bearer ')?value.slice(7):''; }
export async function GET(request: NextRequest) {
  try {
    const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { client } = await requireAuthenticatedUser(accessToken); const { data, error } = await client.rpc('get_my_pending_contracts');
    if (error) return NextResponse.json({ error: error.message }, { status: 403 }); return NextResponse.json({ contracts: data || [] });
  } catch { return NextResponse.json({ error: 'Unable to load contracts' }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  try {
    const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json(); const { client } = await requireAuthenticatedUser(accessToken); const { error } = await client.rpc('accept_my_loan_contract', { p_loan_account_id: body.loanAccountId });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 }); return NextResponse.json({ status: 'accepted' });
  } catch { return NextResponse.json({ error: 'Unable to accept contract' }, { status: 500 }); }
}
