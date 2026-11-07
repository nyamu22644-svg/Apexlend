import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) return json({ error: 'Unauthorized' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await request.json();
    const { data, error } = await userClient.rpc('submit_finoq_disbursement', { p_disbursement_id: body.disbursementId });
    if (error) return json({ error: error.message }, 422);
    const payout = data?.[0];

    const username = Deno.env.get('FINOQ_API_USERNAME');
    const password = Deno.env.get('FINOQ_API_PASSWORD');
    const account = Deno.env.get('FINOQ_ACCOUNT_ID');
    const callbackToken = Deno.env.get('FINOQ_CALLBACK_TOKEN');
    if (!username || !password || !account || !callbackToken) return json({ error: 'Finoq B2C is not configured' }, 503);

    const callbackUrl = `${url}/functions/v1/finoq-b2c-callback?token=${encodeURIComponent(callbackToken)}`;
    const response = await fetch('https://api.finoq.africa/api/v2/withdraw', {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ external_reference: payout.external_reference, account_id: Number(account), amount: Number(payout.amount), phone_number: payout.destination_phone, account_number: payout.destination_phone, network_code: '63902', channel: 'phone', recipient_type: 'MSISDN', callback_url: callbackUrl }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: result.message || 'Finoq did not accept payout' }, 502);

    // Retain both references. Finoq's merchant_reference is required for a
    // later status lookup, while external_reference identifies our request.
    const merchantReference = String(result.merchant_reference || result.reference || result.conversation_id || '');
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error: referenceError } = await admin.from('payment_requests').update({
      external_reference: payout.external_reference,
      provider_reference: merchantReference || payout.external_reference,
      status: 'submitted',
      updated_at: new Date().toISOString(),
    }).eq('id', payout.payment_request_id);
    if (referenceError) throw referenceError;

    return json({ ok: true, reference: merchantReference || payout.external_reference });
  } catch (error) {
    console.error('Finoq payout submission failed', error);
    return json({ error: 'Unable to submit payout' }, 500);
  }
});
