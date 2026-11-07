import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const successfulStatus = (value: unknown) => ['success', 'successful', 'completed'].includes(String(value || '').trim().toLowerCase());

Deno.serve(async request => {
  try {
    // FinoQ does not sign callbacks. The URL token, stored payout record,
    // amount, and independent status lookup are all required before a loan is
    // activated.
    if (new URL(request.url).searchParams.get('token') !== Deno.env.get('FINOQ_CALLBACK_TOKEN')) return json({ error: 'Unauthorized' }, 401);
    const payload = await request.json();
    if (payload.transaction_type !== 'outbound_payment' || !payload.external_reference || !payload.reference) return json({ error: 'Invalid callback' }, 400);
    const external = String(payload.external_reference);
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Invalid callback amount' }, 400);
    if (!(payload.success === true && successfulStatus(payload.status))) return json({ ok: true, status: 'received_pending_reconciliation' });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // FinoQ echoes our B2C reference. During the very short interval between
    // FinoQ accepting the withdrawal and us saving its merchant reference,
    // that value is still in provider_reference; afterwards it is in
    // external_reference. Match either state so an exceptionally fast callback
    // cannot be lost in that transition.
    const { data: payment } = await admin
      .from('payment_requests')
      .select('id,loan_account_id,amount,external_reference,provider_reference,status')
      .eq('request_type', 'b2c_disbursement')
      .or(`external_reference.eq.${external},provider_reference.eq.${external}`)
      .maybeSingle();
    if (!payment || Number(payment.amount) !== amount) {
      console.error('Finoq callback did not match a pending payout', { external, amount });
      return json({ error: 'Disbursement callback unavailable' }, 422);
    }
    if (payment.status === 'completed') return json({ ok: true, status: 'already_processed' });

    const username = Deno.env.get('FINOQ_API_USERNAME');
    const password = Deno.env.get('FINOQ_API_PASSWORD');
    if (!username || !password) return json({ error: 'Finoq verification is not configured' }, 503);
    // Use the merchant reference retained at submission. The callback reference
    // remains a safe fallback for older payouts.
    const merchantReference = String(payment.provider_reference || payload.reference);
    const verificationResponse = await fetch('https://api.finoq.africa/api/global/transaction-status', {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ request_id: merchantReference }),
    });
    const rawVerification = await verificationResponse.json().catch(() => null);
    const verification = rawVerification?.data ?? rawVerification?.transaction ?? rawVerification;
    const verificationState = verification?.status ?? verification?.transaction_status ?? verification?.state;
    // Kenya's legacy withdrawal status endpoint returns ResponseCode/ResultCode
    // instead of the newer success/status fields. "0" is its successful final
    // result; the callback amount has already been matched to our payout.
    const legacySuccess = String(verification?.ResponseCode ?? verification?.response_code ?? '') === '0'
      && String(verification?.ResultCode ?? verification?.result_code ?? '') === '0';
    const verifiedSuccess = verification?.success === true || successfulStatus(verificationState) || legacySuccess;
    const verifiedAmount = Number(verification?.amount ?? verification?.transaction_amount ?? payment.amount);
    if (!verificationResponse.ok || !verifiedSuccess || verifiedAmount !== amount) {
      console.error('Finoq payout verification failed', { external, amount, merchantReference, verificationStatus: verificationResponse.status, verification: rawVerification });
      return json({ error: 'Disbursement could not be verified' }, 422);
    }

    const providerReference = String(verification?.provider_reference || payload.provider_reference || merchantReference);
    const { error } = await admin.rpc('process_finoq_disbursement', { p_external_reference: external, p_provider_reference: providerReference, p_success: true, p_amount: amount, p_payload: payload });
    if (error) throw error;

    // Delivery follows the committed settlement; mail transport cannot hold a
    // correctly verified payout in a pending financial state.
    if (payment.loan_account_id) {
      const { data: notification } = await admin.from('customer_notifications').select('id').eq('related_entity_id', payment.loan_account_id).eq('title', 'Loan disbursed').eq('notification_type', 'success').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (notification?.id) await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/customer-email-notification`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Notification-Token': Deno.env.get('FINOQ_CALLBACK_TOKEN')! }, body: JSON.stringify({ notificationId: notification.id }) });
    }
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/staff-notification-email`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Notification-Token': Deno.env.get('FINOQ_CALLBACK_TOKEN')! }, body: '{}' });
    return json({ ok: true });
  } catch (error) {
    console.error('Finoq callback processing failed', error);
    return json({ error: 'Callback processing failed' }, 500);
  }
});
