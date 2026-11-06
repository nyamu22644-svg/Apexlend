import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';
function token(request: NextRequest) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; }
export async function GET(request: NextRequest) {
  try { const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const { client } = await requireAuthenticatedUser(accessToken); const { data, error } = await client.rpc('get_my_available_loan_products'); if (error) return NextResponse.json({ error: error.message }, { status: 422 }); return NextResponse.json({ products: data || [] }); }
  catch { return NextResponse.json({ error: 'Unable to load loan products' }, { status: 500 }); }
}
