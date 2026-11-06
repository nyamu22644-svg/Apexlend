export type KycDocumentType =
  | 'national_id_front' | 'national_id_back'
  | 'passport_front' | 'passport_back'
  | 'alien_id_front' | 'alien_id_back';

async function request(path: string, accessToken: string, init: RequestInit) {
  const response = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${accessToken}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your session expired. Please sign in again, then retry.');
    if (response.status >= 500) throw new Error('The secure verification service is temporarily unavailable. Please retry shortly.');
    throw new Error(body.error || 'We could not complete that verification step. Please check the details and retry.');
  }
  return body;
}

export async function uploadKycDocument(accessToken: string, documentType: KycDocumentType, file: File) {
  const form = new FormData();
  form.set('file', file);
  form.set('documentType', documentType);
  return request('/api/kyc/documents', accessToken, { method: 'POST', body: form });
}

export async function submitKyc(accessToken: string, payload: {
  fullName: string; phone: string; dateOfBirth: string; nationalId: string; kraPin: string;
  residentialAddress: string; county: string; town: string; mpesaPhone: string; nationality: string; gender: string;
  employmentStatus: string; employerName: string; occupation: string; monthlyIncome: number; otherIncomeSources: string;
  existingMonthlyObligations: number; bankName: string; bankAccountName: string; bankAccountNumber: string; bankBranchCode: string;
}) {
  return request('/api/kyc/submit', accessToken, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
}
