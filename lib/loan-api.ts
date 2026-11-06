export type LiveLoanProduct = { product_id: string; product_version_id: string; code: string; name: string; terms: { min_amount: number; max_amount: number; min_term_months: number; max_term_months: number; interest_rate_per_month: number; processing_fee_percent?: number; repayment_frequency?: string } };
async function request(path: string, token: string, init?: RequestInit) { const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Request failed'); return body; }
export async function getAvailableLoanProducts(token: string): Promise<LiveLoanProduct[]> { const result = await request('/api/customer/loan-products', token); return result.products || []; }
export type LiveLoanQuote = { monthly_installment: number; total_interest: number; processing_fee: number; excise_duty: number; total_fees: number; total_repayable: number };
export async function getLoanQuote(token: string, productVersionId: string, amount: number, termMonths: number): Promise<LiveLoanQuote> { const result = await request('/api/customer/loan-quote', token, { method: 'POST', body: JSON.stringify({ productVersionId, amount, termMonths }) }); return result.quote; }
export async function submitLoanApplication(token: string, productVersionId: string, amount: number, termMonths: number, purpose: string, crbConsent: boolean, termsConsent: boolean, idempotencyKey: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('/api/customer/loan-applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productVersionId, amount, termMonths, purpose, crbConsent, termsConsent, idempotencyKey }),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Request failed');
    return body;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('Submission timed out. Please try again.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
