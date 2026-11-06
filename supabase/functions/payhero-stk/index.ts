import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const auth = request.headers.get('Authorization'); if (!auth) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser(); if (!user) return json({ error: 'Unauthorized' }, 401);
    const body = await request.json();
    const { data, error } = await userClient.rpc('create_my_stk_request', { p_loan_account_id: body.loanAccountId, p_amount: body.amount, p_idempotency_key: body.idempotencyKey, p_phone_number: body.phoneNumber });
    if (error) return json({ error: error.message }, 422);
    const payment = data?.[0]; if (!payment) return json({ error: 'Unable to create payment request' }, 500);
    const username = Deno.env.get('PAYHERO_API_USERNAME'); const password = Deno.env.get('PAYHERO_API_PASSWORD'); const legacyToken = Deno.env.get('PAYHERO_BASIC_AUTH_TOKEN'); const channelId = Deno.env.get('PAYHERO_CHANNEL_ID'); const callbackToken = Deno.env.get('PAYHERO_CALLBACK_TOKEN');
    const authorization = username && password ? `Basic ${btoa(`${username}:${password}`)}` : legacyToken ? (legacyToken.startsWith('Basic ') ? legacyToken : `Basic ${legacyToken}`) : '';
    if (!authorization || !channelId || !callbackToken) return json({ error: 'PayHero STK is not configured: set API username, API password, channel ID, and callback token' }, 503);
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/payhero-callback?token=${encodeURIComponent(callbackToken)}`;
    const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', { method: 'POST', headers: { Authorization: authorization, 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Math.round(Number(body.amount)), phone_number: payment.phone_number, channel_id: Number(channelId), provider: 'm-pesa', external_reference: payment.external_reference, customer_name: payment.customer_name, callback_url: callbackUrl }) });
    const result = await response.json().catch(() => ({})); if (!response.ok || !result.success) return json({ error: result.message || result.error || 'PayHero could not queue this STK request' }, 502);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    await admin.rpc('record_payhero_stk_submission', { p_payment_request_id: payment.payment_request_id, p_provider_reference: String(result.reference) });
    return json({ status: 'submitted', reference: result.reference, checkoutRequestId: result.CheckoutRequestID });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to start payment' }, 500); }
});
