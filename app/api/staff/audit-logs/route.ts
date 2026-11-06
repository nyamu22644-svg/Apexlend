import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';

export async function GET(request: NextRequest) {
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { client } = await requireAuthenticatedUser(token);
    const { data, error } = await client.rpc('get_staff_audit_events', { p_limit: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ events: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Unable to load audit events' }, { status: 500 });
  }
}
