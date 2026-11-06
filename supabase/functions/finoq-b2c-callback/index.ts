import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async request => {
  try {
    // FinoQ does not provide a callback signature. The URL secret is only a
    // first gate; a successful payout is independently verified with FinoQ.
    if (new URL(request.url).searchParams.get('token') !== Deno.env.get('FINOQ_CALLBACK_TOKEN')) return json({ error: 'Unauthorized' }, 401);
    const payload = await request.json();
    if (payload.transaction_type !== 'outbound_payment' || !payload.external_reference || !payload.reference) return json({ error: 'Invalid callback' }, 400);
    const external = String(payload.external_reference); const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return json({ error: 'Invalid callback amount' }, 400);
    // Failed callbacks are retained for later reconciliation; only a verified
    // success is permitted to activate a loan.
    if (!(payload.success === true && payload.status === 'success')) return json({ ok: true, status: 'received_pending_reconciliation' });
    const username = Deno.env.get('FINOQ_API_USERNAME'), password = Deno.env.get('FINOQ_API_PASSWORD');
    if (!username || !password) return json({ error: 'Finoq verification is not configured' }, 503);
    const verificationResponse = await fetch('https://api.finoq.africa/api/global/transaction-status', { method: 'POST', headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: String(payload.reference) }) });
    const verification = await verificationResponse.json().catch(() => null);
    if (!verificationResponse.ok || verification?.success !== true || String(verification?.status).toLowerCase() !== 'success' || String(verification?.external_reference || '') !== external || Number(verification?.amount) !== amount) return json({ error: 'Disbursement could not be verified' }, 422);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await admin.rpc('process_finoq_disbursement', { p_external_reference: external, p_provider_reference: String(verification.provider_reference || payload.provider_reference || payload.reference), p_success: true, p_amount: amount, p_payload: payload });
    if (error) throw error;
    return json({ ok: true });
  } catch { return json({ error: 'Callback processing failed' }, 500); }
});
