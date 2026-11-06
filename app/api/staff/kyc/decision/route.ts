import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';

function token(request: NextRequest) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { caseId, decision, notes } = await request.json();
    const { client } = await requireAuthenticatedUser(accessToken);
    const { error } = await client.rpc('decide_kyc_case', {
      p_kyc_case_id: caseId, p_decision: decision, p_notes: notes || '',
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ status: decision });
  } catch {
    return NextResponse.json({ error: 'Unable to record KYC decision' }, { status: 500 });
  }
}
