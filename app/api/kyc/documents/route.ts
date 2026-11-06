import { createHash, randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, requireAuthenticatedUser } from '@/lib/server/supabase';
import { hasExpectedFileSignature } from '@/lib/server/upload-validation';

export const runtime = 'nodejs';

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const documentTypes = new Set(['national_id_front', 'national_id_back', 'passport_front', 'passport_back', 'alien_id_front', 'alien_id_back']);

function token(request: NextRequest) {
  const value = request.headers.get('authorization');
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

function safeFilename(name: string) {
  const extension = name.split('.').pop()?.toLowerCase() || 'bin';
  return `document.${extension.replace(/[^a-z0-9]/g, '') || 'bin'}`;
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = token(request);
    if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { client, user } = await requireAuthenticatedUser(accessToken);
    const form = await request.formData();
    const file = form.get('file');
    const documentType = String(form.get('documentType') || '');

    if (!(file instanceof File) || !documentTypes.has(documentType)) {
      return NextResponse.json({ error: 'A supported document type and file are required' }, { status: 400 });
    }
    if (!allowedTypes.has(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Documents must be JPG, PNG, WEBP, or PDF files up to 5 MB' }, { status: 400 });
    }

    const { data: access, error: accessError } = await client.rpc('get_my_access');
    const current = access?.[0];
    if (accessError || !current || current.profile_id !== user.id || current.user_type !== 'customer') {
      return NextResponse.json({ error: 'An active customer account is required' }, { status: 403 });
    }

    const documentId = randomUUID();
    const content = Buffer.from(await file.arrayBuffer());
    if (!hasExpectedFileSignature(content, file.type)) {
      return NextResponse.json({ error: 'The file contents do not match the declared document type' }, { status: 400 });
    }
    const objectPath = `${current.institution_id}/${user.id}/${documentId}/${safeFilename(file.name)}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage.from('kyc-documents').upload(objectPath, content, {
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) return NextResponse.json({ error: 'Secure document upload failed' }, { status: 502 });

    const { error: registrationError } = await client.rpc('register_my_kyc_document', {
      p_document_id: documentId,
      p_object_path: objectPath,
      p_document_type: documentType,
      p_sha256: createHash('sha256').update(content).digest('hex'),
      p_content_type: file.type,
      p_size_bytes: file.size,
    });

    if (registrationError) {
      await admin.storage.from('kyc-documents').remove([objectPath]);
      return NextResponse.json({ error: registrationError.message }, { status: 422 });
    }
    return NextResponse.json({ documentId, documentType });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Document upload failed';
    return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 500 });
  }
}
