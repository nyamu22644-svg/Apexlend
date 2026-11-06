import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';

function token(request: NextRequest) { const value = request.headers.get('authorization'); return value?.startsWith('Bearer ') ? value.slice(7) : ''; }

export async function GET(request: NextRequest) {
  try { const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const { client } = await requireAuthenticatedUser(accessToken); const { data, error } = await client.rpc('get_staff_loan_products'); if (error) return NextResponse.json({ error: 'Unable to load products' }, { status: 403 }); return NextResponse.json({ products: data || [] }); } catch { return NextResponse.json({ error: 'Unable to load products' }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try { const accessToken = token(request); if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const body = await request.json(); const { client } = await requireAuthenticatedUser(accessToken); const { data, error } = await client.rpc('publish_loan_product_version', { p_product_id: body.productId || null, p_code: body.code, p_name: body.name, p_terms: body.terms }); if (error) return NextResponse.json({ error: error.message }, { status: 422 }); return NextResponse.json({ versionId: data }); } catch { return NextResponse.json({ error: 'Unable to publish product version' }, { status: 500 }); }
}
