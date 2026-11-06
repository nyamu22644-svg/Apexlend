import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';

function token(request: NextRequest) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; }

export async function GET(request: NextRequest) {
  try {
    const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { client } = await requireAuthenticatedUser(accessToken);
    const { data, error } = await client.rpc('get_my_notifications');
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ notifications: data || [] });
  } catch { return NextResponse.json({ error: 'Unable to load notifications' }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { notificationId } = await request.json(); if (!notificationId) return NextResponse.json({ error: 'Notification is required' }, { status: 400 });
    const { client } = await requireAuthenticatedUser(accessToken);
    const { error } = await client.rpc('mark_my_notification_read', { p_notification_id: notificationId });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: 'Unable to update notification' }, { status: 500 }); }
}
