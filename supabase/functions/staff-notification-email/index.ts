import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

Deno.serve(async request => {
  try {
    const callbackToken = request.headers.get('X-Notification-Token');
    const internal = callbackToken === Deno.env.get('PAYHERO_CALLBACK_TOKEN') || callbackToken === Deno.env.get('FINOQ_CALLBACK_TOKEN');
    if (!internal) {
      const authorization = request.headers.get('Authorization');
      if (!authorization) return json({ error: 'Unauthorized' }, 401);
      const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);
      const { data: canManageStaff } = await userClient.rpc('has_permission', { required_permission: 'staff.manage' });
      if (canManageStaff !== true) return json({ error: 'Unauthorized' }, 401);
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: items, error } = await admin.rpc('get_urgent_staff_notifications_for_delivery');
    if (error) throw error;
    let sent = 0;
    for (const notification of items || []) {
      await admin.from('staff_notification_deliveries').upsert({ notification_id: notification.notification_id, channel: 'email', status: 'queued' }, { onConflict: 'notification_id,channel' });
      const from = Deno.env.get('EMAIL_FROM');
      const resendKey = Deno.env.get('RESEND_API_KEY');
      let provider = '', messageId = '', failure = '';
      if (resendKey && from) {
        const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [notification.recipient_email], subject: `Urgent: ${notification.title}`, html: `<p>Hello ${esc(notification.recipient_name || 'Administrator')},</p><p>${esc(notification.message)}</p><p>Please sign in to the staff portal to review it.</p>` }) });
        const body = await response.json().catch(() => ({}));
        if (response.ok) { provider = 'resend'; messageId = String(body.id || ''); } else failure = String(body.message || 'Resend delivery failed');
      }
      if (!provider) {
        const brevoKey = Deno.env.get('BREVO_API_KEY'); const sender = Deno.env.get('BREVO_SENDER_EMAIL');
        if (brevoKey && sender) {
          const response = await fetch('https://api.brevo.com/v3/smtp/email', { method: 'POST', headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ sender: { email: sender, name: Deno.env.get('BREVO_SENDER_NAME') || 'Lending operations' }, to: [{ email: notification.recipient_email, name: notification.recipient_name }], subject: `Urgent: ${notification.title}`, htmlContent: `<p>Hello ${esc(notification.recipient_name || 'Administrator')},</p><p>${esc(notification.message)}</p><p>Please sign in to the staff portal to review it.</p>` }) });
          const body = await response.json().catch(() => ({}));
          if (response.ok) { provider = 'brevo'; messageId = String(body.messageId || ''); } else failure = String(body.message || 'Brevo delivery failed');
        }
      }
      await admin.from('staff_notification_deliveries').update({ status: provider ? 'sent' : ((resendKey || Deno.env.get('BREVO_API_KEY')) ? 'failed' : 'skipped'), provider: provider || null, provider_message_id: messageId || null, error_message: failure || (!provider ? 'Email provider is not configured' : null), attempted_at: new Date().toISOString() }).eq('notification_id', notification.notification_id).eq('channel', 'email');
      if (provider) sent++;
    }
    return json({ ok: true, sent });
  } catch (error) {
    console.error('Staff notification delivery failed', error);
    return json({ error: 'Unable to deliver staff notifications' }, 500);
  }
});
