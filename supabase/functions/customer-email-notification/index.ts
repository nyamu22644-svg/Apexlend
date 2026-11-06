import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authorization = request.headers.get('Authorization');
    const internal = request.headers.get('X-Notification-Token') === Deno.env.get('PAYHERO_CALLBACK_TOKEN') || request.headers.get('X-Notification-Token') === Deno.env.get('FINOQ_CALLBACK_TOKEN');
    if (!internal && !authorization) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization || '' } } });
    const { data: { user } } = internal ? { data: { user: null } } : await userClient.auth.getUser(); if (!internal && !user) return json({ error: 'Unauthorized' }, 401);
    const { notificationId } = await request.json(); if (!notificationId) return json({ error: 'Notification is required' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: notification } = await admin.from('customer_notifications').select('id,customer_profile_id,title,message,action_path,action_label').eq('id', notificationId).maybeSingle();
    if (!notification) return json({ error: 'Notification not found' }, 404);
    if (!internal && notification.customer_profile_id !== user!.id) {
      const [{ data: complaintManager }, { data: closureManager }, { data: applicationApprover }] = await Promise.all([
        userClient.rpc('has_permission', { required_permission: 'complaint.manage' }),
        userClient.rpc('has_permission', { required_permission: 'account_closure.manage' }),
        userClient.rpc('has_permission', { required_permission: 'application.approve' }),
      ]);
      if (complaintManager !== true && closureManager !== true && applicationApprover !== true) return json({ error: 'Notification not found' }, 404);
    }
    // For a customer-triggered send this is the caller; for an authorised staff
    // decision it must always remain the customer who owns the notification.
    const { data: profile } = await admin.from('profiles').select('email,full_name').eq('id', notification.customer_profile_id).maybeSingle();
    if (!profile?.email) return json({ error: 'Customer email is unavailable' }, 422);
    const { data: existing } = await admin.from('notification_deliveries').select('id,status').eq('notification_id', notification.id).eq('channel', 'email').maybeSingle();
    if (existing?.status === 'sent') return json({ ok: true, status: 'already_sent' });
    if (!existing) await admin.from('notification_deliveries').insert({ notification_id: notification.id, channel: 'email', status: 'queued' });
    const from = Deno.env.get('EMAIL_FROM'); const baseUrl = Deno.env.get('APP_URL')?.replace(/\/$/, ''); const actionUrl = baseUrl && notification.action_path?.startsWith('/') ? `${baseUrl}${notification.action_path}` : ''; const actionHtml = actionUrl ? `<p><a href="${escape(actionUrl)}" style="display:inline-block;padding:12px 18px;background:#167D78;color:#fff;text-decoration:none;border-radius:8px">${escape(notification.action_label || 'Open customer portal')}</a></p>` : ''; const html = `<p>Hello ${escape(profile.full_name || 'Customer')},</p><p>${escape(notification.message).replaceAll('\n', '<br/>')}</p>${actionHtml}<p>Regards,<br/>Your lending team</p>`;
    let provider = ''; let messageId = ''; let failure = '';
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey && from) { const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [profile.email], subject: notification.title, html }) }); const result = await response.json().catch(() => ({})); if (response.ok) { provider = 'resend'; messageId = String(result.id || ''); } else failure = String(result.message || 'Resend delivery failed'); }
    if (!provider) { const brevoKey = Deno.env.get('BREVO_API_KEY'); const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL'); if (brevoKey && senderEmail) { const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: { email: senderEmail, name: Deno.env.get('BREVO_SENDER_NAME') || 'Lending support' }, to: [{ email: profile.email, name: profile.full_name || undefined }], subject: notification.title, htmlContent: html }) }); const result = await response.json().catch(() => ({})); if (response.ok) { provider = 'brevo'; messageId = String(result.messageId || ''); } else failure = String(result.message || 'Brevo delivery failed'); } }
    if (!provider) { await admin.from('notification_deliveries').update({ status: (resendKey || Deno.env.get('BREVO_API_KEY')) ? 'failed' : 'skipped', error_message: failure || 'Email provider is not configured', attempted_at: new Date().toISOString() }).eq('notification_id', notification.id).eq('channel', 'email'); return json({ ok: false, status: 'not_sent' }, 202); }
    await admin.from('notification_deliveries').update({ status: 'sent', provider, provider_message_id: messageId, error_message: null, attempted_at: new Date().toISOString() }).eq('notification_id', notification.id).eq('channel', 'email');
    return json({ ok: true, provider });
  } catch { return json({ error: 'Unable to deliver notification email' }, 500); }
});
