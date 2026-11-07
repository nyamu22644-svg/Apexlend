import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, requireAuthenticatedUser } from '@/lib/server/supabase';

const token = (request: NextRequest) => {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
};

async function sendInvitation(email: string, name: string, actionLink: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/staff-invite-email`, {
    method: 'POST', headers: { 'X-Internal-Invite-Token': process.env.STAFF_INVITE_EMAIL_TOKEN || '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, actionLink }),
  });
  if (!response.ok) { const detail = await response.json().catch(() => ({})); throw new Error(detail.error || 'The staff account exists but the invitation email could not be sent'); }
}

export async function GET(request: NextRequest) {
  try { const value = token(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const { client } = await requireAuthenticatedUser(value); const { data, error } = await client.rpc('get_staff_access_management'); if (error) return NextResponse.json({ error: error.message }, { status: 403 }); return NextResponse.json(data || {}); } catch { return NextResponse.json({ error: 'Unable to load staff directory' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const value = token(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json(); const { client } = await requireAuthenticatedUser(value);
    const access = await client.rpc('has_permission', { required_permission: 'staff.manage' }); if (access.data !== true) return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    // Invitations always land on the staff hostname, even if an administrator
    // is working from a preview or customer hostname.
    const staffPortalUrl = process.env.NEXT_PUBLIC_STAFF_PORTAL_URL?.replace(/\/+$/, '');
    const redirectTo = `${staffPortalUrl || request.nextUrl.origin}/staff/activate`; const admin = createAdminClient();
    if (body.action === 'resend') {
      const { data: staff, error } = await client.rpc('get_staff_directory');
      const member = !error && (staff || []).find((item: { profile_id: string }) => item.profile_id === body.profileId);
      if (!member) return NextResponse.json({ error: 'Staff member is unavailable' }, { status: 404 });
      const link = await admin.auth.admin.generateLink({ type: 'recovery', email: member.email, options: { redirectTo } });
      if (link.error || !link.data.properties.action_link) return NextResponse.json({ error: link.error?.message || 'Unable to create a new activation link' }, { status: 422 });
      await sendInvitation(member.email, member.full_name, link.data.properties.action_link); return NextResponse.json({ ok: true });
    }
    if (!body.fullName || !body.email || !body.employeeNumber || !body.role) return NextResponse.json({ error: 'Name, email, employee number and role are required' }, { status: 400 });
    let invite = await admin.auth.admin.generateLink({ type: 'invite', email: body.email, options: { data: { full_name: body.fullName, phone: body.phone || '' }, redirectTo } });
    // A failed earlier invite can leave an Auth identity without an application profile.
    // Finish provisioning that identity and issue a password-setup link, but never turn an
    // existing customer account into a staff account through this fallback.
    if (invite.error) {
      const { data: existingProfile } = await admin.from('profiles').select('id').eq('email', body.email).maybeSingle();
      if (existingProfile) return NextResponse.json({ error: 'This email already belongs to an existing account. Use a different work email.' }, { status: 422 });
      invite = await admin.auth.admin.generateLink({ type: 'recovery', email: body.email, options: { redirectTo } });
    }
    if (invite.error || !invite.data.user || !invite.data.properties.action_link) return NextResponse.json({ error: invite.error?.message || 'Unable to generate staff invitation' }, { status: 422 });
    const { error } = await client.rpc('provision_invited_staff', { p_profile_id: invite.data.user.id, p_employee_number: body.employeeNumber, p_department: body.department || '', p_job_title: body.title || '', p_role_code: body.role, p_approval_limit: Number(body.approvalLimit || 0) });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    await sendInvitation(body.email, body.fullName, invite.data.properties.action_link); return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to invite staff member' }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try { const value = token(request); if (!value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json(); const { client } = await requireAuthenticatedUser(value); const { error } = body.action === 'access'
    ? await client.rpc('update_staff_access', { p_staff_profile_id: body.profileId, p_role_code: body.role, p_approval_limit: Number(body.approvalLimit || 0), p_allowed_permissions: body.allowedPermissions || [], p_denied_permissions: body.deniedPermissions || [] })
    : await client.rpc('set_staff_active', { p_profile_id: body.profileId, p_active: Boolean(body.active) }); if (error) return NextResponse.json({ error: error.message }, { status: 422 }); if (body.action === 'access') await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/staff-notification-email`, { method: 'POST', headers: { Authorization: `Bearer ${value}`, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => undefined); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: 'Unable to update staff status' }, { status: 500 }); }
}
