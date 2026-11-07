import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, requireAuthenticatedUser } from '@/lib/server/supabase';

const token = (request: NextRequest) => {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
};

async function deliverManualReconciliationNotifications(accessToken: string, disbursementId: string) {
  // Settlement is committed before this runs. A mail outage must never undo it.
  const admin = createAdminClient();
  const { data: attempt } = await admin.from('disbursement_attempts').select('payment_request_id').eq('disbursement_request_id', disbursementId).order('sequence_number', { ascending: false }).limit(1).maybeSingle();
  if (!attempt?.payment_request_id) return { customerEmail: 'not_found', staffEmail: 'not_attempted' };
  const { data: payment } = await admin.from('payment_requests').select('loan_account_id').eq('id', attempt.payment_request_id).maybeSingle();
  if (!payment?.loan_account_id) return { customerEmail: 'not_found', staffEmail: 'not_attempted' };
  const { data: notification } = await admin.from('customer_notifications').select('id').eq('related_entity_id', payment.loan_account_id).eq('title', 'Loan disbursed').eq('notification_type', 'success').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const baseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) return { customerEmail: 'not_configured', staffEmail: 'not_attempted' };
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
  const requests: Promise<Response>[] = [fetch(`${baseUrl}/functions/v1/staff-notification-email`, { method: 'POST', headers, body: '{}' })];
  if (notification?.id) requests.unshift(fetch(`${baseUrl}/functions/v1/customer-email-notification`, { method: 'POST', headers, body: JSON.stringify({ notificationId: notification.id }) }));
  const results = await Promise.allSettled(requests);
  const customer = notification?.id ? results[0] : undefined;
  const staff = results[results.length - 1];
  return {
    customerEmail: !notification?.id ? 'not_found' : customer?.status === 'fulfilled' && customer.value.ok ? 'requested' : 'failed',
    staffEmail: staff.status === 'fulfilled' && staff.value.ok ? 'requested' : 'failed',
  };
}

export async function GET(request: NextRequest) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { client } = await requireAuthenticatedUser(accessToken);
    const [{ data, error }, { data: candidates, error: candidateError }, { data: readiness, error: readinessError }] = await Promise.all([client.rpc('get_staff_disbursement_queue'), client.rpc('get_staff_disbursement_candidates'), client.rpc('get_staff_disbursement_readiness')]);
    if (error || candidateError || readinessError) return NextResponse.json({ error: error?.message || candidateError?.message || readinessError?.message }, { status: 403 });
    return NextResponse.json({ disbursements: data || [], candidates: candidates || [], readiness: readiness || [] });
  } catch { return NextResponse.json({ error: 'Unable to load disbursements' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json(); const { client } = await requireAuthenticatedUser(accessToken);
    const { data, error } = await client.rpc('create_disbursement_request', { p_loan_account_id: body.loanAccountId, p_idempotency_key: body.idempotencyKey });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ id: data });
  } catch { return NextResponse.json({ error: 'Unable to prepare disbursement' }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json(); const { client } = await requireAuthenticatedUser(accessToken);
    if (body.action === 'manual_reconcile') {
      const { error } = await client.rpc('reconcile_confirmed_finoq_disbursement', { p_disbursement_id: body.id, p_finoq_reference: body.finoqReference || '', p_reason: body.reason || '' });
      if (error) return NextResponse.json({ error: error.message }, { status: 422 });
      const delivery = await deliverManualReconciliationNotifications(accessToken, body.id).catch(() => ({ customerEmail: 'failed', staffEmail: 'failed' }));
      return NextResponse.json({ ok: true, delivery });
    }
    const { error } = await client.rpc('approve_disbursement_request', { p_disbursement_id: body.id, p_action: body.action, p_reason: body.reason || '' });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unable to decide disbursement' }, { status: 500 }); }
}
