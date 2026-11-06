import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { client } = await requireAuthenticatedUser(accessToken);
    const { data, error } = await client.rpc('get_staff_dashboard');
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json(data ?? {});
  } catch {
    return NextResponse.json({ error: 'Unable to load dashboard data' }, { status: 500 });
  }
}
