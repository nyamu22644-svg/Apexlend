import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
Deno.serve(async (request) => {
  try {
    if (new URL(request.url).searchParams.get('token') !== Deno.env.get('PAYHERO_CALLBACK_TOKEN')) return json({ error: 'Unauthorized' }, 401);
    const payload = await request.json(); const x = payload.response || payload;
    // PayHero Kenya v2 uses PascalCase fields; FinoQ's compatible webhook uses
    // lower-case fields. Normalise both before touching the ledger.
    const external = String(x.ExternalReference || x.external_reference || '');
    const reference = String(x.MpesaReceiptNumber || x.provider_reference || x.reference || x.CheckoutRequestID || '');
    const amount = Number(x.Amount ?? x.amount ?? 0);
    const success = x.success === true || (Number(x.ResultCode) === 0 && String(x.Status || '').toUpperCase() === 'SUCCESS') || String(x.status || '').toUpperCase() === 'SUCCESS';
    if (!external || (success && (!reference || !amount))) return json({ error: 'Invalid callback payload' }, 400);
    // A callback token stops unsolicited requests; this second check stops a
    // forged "success" callback from ever changing a customer's balance.
    if (success) {
      const username = Deno.env.get('PAYHERO_API_USERNAME'); const password = Deno.env.get('PAYHERO_API_PASSWORD'); const legacyToken = Deno.env.get('PAYHERO_BASIC_AUTH_TOKEN');
      const authorization = username && password ? `Basic ${btoa(`${username}:${password}`)}` : legacyToken ? (legacyToken.startsWith('Basic ') ? legacyToken : `Basic ${legacyToken}`) : '';
      if (!authorization) return json({ error: 'Payment verification is not configured' }, 503);
      const verificationResponse = await fetch(`https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(reference)}`, {
        headers: { Authorization: authorization, Accept: 'application/json' },
      });
      const verification = await verificationResponse.json().catch(() => null);
      const verificationStatus = String(verification?.status || verification?.response?.status || '').toUpperCase();
      if (!verificationResponse.ok || verification?.success !== true || verificationStatus !== 'SUCCESS') {
        return json({ error: 'Payment could not be verified' }, 422);
      }
    }
    // Do not let an unverified failure callback cancel a customer's payment.
    // A provider-status reconciliation job can resolve legitimate failures.
    if (!success) return json({ ok: true, status: 'received_pending_reconciliation' });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.rpc('process_payhero_repayment', { p_external_reference: external, p_provider_reference: reference, p_amount: amount, p_success: success, p_payload: payload });
    if (error) throw error;
    if (success) {
      const { data: requestRow } = await admin.from('payment_requests').select('customer_profile_id').or(`external_reference.eq.${external},provider_reference.eq.${external}`).maybeSingle();
      if (requestRow?.customer_profile_id) {
        const { data: notification } = await admin.from('customer_notifications').select('id').eq('customer_profile_id', requestRow.customer_profile_id).eq('notification_type', 'payment').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (notification?.id) await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/customer-email-notification`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Notification-Token': Deno.env.get('PAYHERO_CALLBACK_TOKEN')! }, body: JSON.stringify({ notificationId: notification.id }) });
      }
    }
    if (success) await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/staff-notification-email`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Notification-Token': Deno.env.get('PAYHERO_CALLBACK_TOKEN')! }, body: '{}' });
    return json({ ok: true });
  } catch { return json({ error: 'Callback processing failed' }, 500); }
});
