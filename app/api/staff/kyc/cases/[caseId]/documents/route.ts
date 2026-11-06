import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/server/supabase';

function token(request: NextRequest) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { caseId } = await params;
    const { client } = await requireAuthenticatedUser(accessToken);
    const { data: access } = await client.rpc('get_my_access');
    if (!access?.[0]?.permission_codes?.includes('document.read_sensitive')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data, error } = await client.from('documents').select('id, document_type, content_type, created_at').eq('kyc_case_id', caseId).order('created_at');
    if (error) return NextResponse.json({ error: 'Documents unavailable' }, { status: 403 });
    return NextResponse.json({ documents: data || [] });
  } catch {
    return NextResponse.json({ error: 'Documents unavailable' }, { status: 500 });
  }
}
