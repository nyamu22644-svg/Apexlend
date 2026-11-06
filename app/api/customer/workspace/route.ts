import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
function token(request: NextRequest) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; }
export async function GET(request: NextRequest) {
  try { const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const { client } = await requireAuthenticatedUser(accessToken); const { data, error } = await client.rpc('get_my_customer_workspace'); if (error) return NextResponse.json({ error: 'Unable to load customer workspace' }, { status: 422 }); if (!data?.[0]) return NextResponse.json({ error: 'Customer workspace unavailable' }, { status: 404 }); return NextResponse.json({ customer: data[0] }); }
  catch { return NextResponse.json({ error: 'Unable to load customer workspace' }, { status: 500 }); }
}
