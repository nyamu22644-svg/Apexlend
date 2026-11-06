import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
function token(request: NextRequest) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; }
export async function POST(request: NextRequest) {
  try { const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json(); const { client } = await requireAuthenticatedUser(accessToken); const { error } = await client.rpc('resolve_loan_application_approval', { p_approval_request_id: body.approvalRequestId, p_action: body.action, p_reason: body.reason || '' }); if (error) return NextResponse.json({ error: error.message }, { status: 422 }); const { data: notificationId } = body.action === 'approved' ? await client.rpc('get_loan_approval_notification', { p_approval_request_id: body.approvalRequestId }) : { data: null }; return NextResponse.json({ status: body.action, notificationId }); } catch { return NextResponse.json({ error: 'Unable to resolve application approval' }, { status: 500 }); }
}
