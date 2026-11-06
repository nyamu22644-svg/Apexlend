import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, requireAuthenticatedUser } from '@/lib/server/supabase';

function token(request: NextRequest) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { documentId } = await params;
    const { client } = await requireAuthenticatedUser(accessToken);
    const { data: access } = await client.rpc('get_my_access');
    if (!access?.[0]?.permission_codes?.includes('document.read_sensitive')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { data: document, error } = await client.from('documents').select('bucket_id, object_path, document_type').eq('id', documentId).maybeSingle();
    if (error || !document) return NextResponse.json({ error: 'Document unavailable' }, { status: 404 });
    const { data: signed, error: signedError } = await createAdminClient().storage.from(document.bucket_id).createSignedUrl(document.object_path, 60);
    if (signedError || !signed?.signedUrl) return NextResponse.json({ error: 'Document unavailable' }, { status: 502 });
    return NextResponse.json({ url: signed.signedUrl, documentType: document.document_type });
  } catch {
    return NextResponse.json({ error: 'Document unavailable' }, { status: 500 });
  }
}
