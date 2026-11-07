'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type Disbursement = { disbursement_id: string; loan_account_id: string; account_number: string; customer_name: string; destination_phone: string; amount: number; status: string; maker_name: string | null; checker_name: string | null };
type Loan = { loan_account_id: string; account_number: string; customer_name: string; destination_phone: string; amount: number; contract_accepted_at: string | null; readiness_status?: string };
type Reconciliation = { id: string; reference: string; reason: string; confirmation: string };

async function api(path: string, token: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}
const money = (value: number) => `KES ${Number(value).toLocaleString()}`;

export function DisbursementsView() {
  const { session, profile } = useAuth();
  const [items, setItems] = useState<Disbursement[]>([]);
  const [candidates, setCandidates] = useState<Loan[]>([]);
  const [readiness, setReadiness] = useState<Loan[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const isSuperAdmin = profile?.role === 'super_admin';

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    try { const data = await api('/api/staff/disbursements', session.access_token); setItems(data.disbursements || []); setCandidates(data.candidates || []); setReadiness(data.readiness || []); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load disbursements'); }
  }, [session?.access_token]);
  useEffect(() => { load(); }, [load]);

  const prepare = async (loan: Loan) => {
    if (!session?.access_token) return; setBusy(loan.loan_account_id); setError('');
    try { await api('/api/staff/disbursements', session.access_token, { method: 'POST', body: JSON.stringify({ loanAccountId: loan.loan_account_id, idempotencyKey: crypto.randomUUID() }) }); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to prepare disbursement'); } finally { setBusy(null); }
  };
  const decide = async (item: Disbursement, action: string) => {
    if (!session?.access_token) return; setBusy(item.disbursement_id); setError('');
    try { await api('/api/staff/disbursements', session.access_token, { method: 'PATCH', body: JSON.stringify({ id: item.disbursement_id, action, reason: note }) }); setNote(''); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to decide disbursement'); } finally { setBusy(null); }
  };
  const submit = async (item: Disbursement) => {
    if (!session?.access_token || !process.env.NEXT_PUBLIC_SUPABASE_URL) return; setBusy(item.disbursement_id); setError('');
    try { const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/finoq-b2c-disbursement`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ disbursementId: item.disbursement_id }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Unable to submit Finoq payout'); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to submit Finoq payout'); } finally { setBusy(null); }
  };
  const reconcile = async () => {
    if (!session?.access_token || !reconciliation) return;
    if (reconciliation.confirmation !== 'RECONCILE') { setError('Type RECONCILE to confirm that Finoq and the recipient have confirmed this payout.'); return; }
    setBusy(reconciliation.id); setError('');
    try { await api('/api/staff/disbursements', session.access_token, { method: 'PATCH', body: JSON.stringify({ id: reconciliation.id, action: 'manual_reconcile', finoqReference: reconciliation.reference, reason: reconciliation.reason }) }); setReconciliation(null); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to reconcile disbursement'); } finally { setBusy(null); }
  };

  const waiting = readiness.filter(item => item.readiness_status === 'awaiting_customer_acceptance');
  return <div className="space-y-6">
    <div className="flex justify-between"><div><h1 className="text-2xl font-bold">Disbursements Queue</h1><p className="text-xs text-slate-500">Finoq B2C payouts with customer contract acceptance and maker-checker control.</p></div><span className="text-xs font-semibold text-[#167D78] flex gap-1"><ShieldCheck className="w-4 h-4" />Dual-control enforced</span></div>
    {error && <p className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs">{error}</p>}
    {profile?.permissions.includes('disbursement.create') && <><section className="bg-amber-50 rounded-2xl border border-amber-200 overflow-hidden"><div className="p-4 border-b border-amber-200"><h2 className="font-bold text-sm">Awaiting customer contract acceptance</h2><p className="text-xs text-amber-800 mt-1">A payout cannot be prepared until the borrower accepts their approved contract.</p></div>{waiting.length ? <div className="divide-y divide-amber-100">{waiting.map(item => <div key={item.loan_account_id} className="p-4 flex justify-between"><div><b>{item.customer_name}</b><p className="text-xs text-slate-600 font-mono">{item.account_number} · {item.destination_phone || 'No M-Pesa phone'}</p><p className="text-xs">{money(item.amount)} · Contract not yet accepted</p></div><span className="text-xs font-bold text-amber-700">Customer action required</span></div>)}</div> : <p className="p-5 text-xs text-slate-600">No loans are waiting for contract acceptance.</p>}</section><section className="bg-white rounded-2xl border overflow-hidden"><div className="p-4 border-b"><h2 className="font-bold text-sm">Ready to prepare payout</h2></div>{candidates.length ? <div className="divide-y">{candidates.map(item => <div key={item.loan_account_id} className="p-4 flex justify-between items-center"><div><b>{item.customer_name}</b><p className="text-xs text-slate-500 font-mono">{item.account_number} · {item.destination_phone}</p><p className="text-xs">{money(item.amount)}</p></div><button disabled={busy === item.loan_account_id} onClick={() => prepare(item)} className="px-3 py-2 bg-[#167D78] text-white rounded-xl text-xs">Prepare payout</button></div>)}</div> : <p className="p-5 text-xs text-slate-500">No accepted loans awaiting preparation.</p>}</section></>}
    <section className="bg-white rounded-2xl border overflow-hidden"><div className="p-4 border-b"><h2 className="font-bold text-sm">Payout operations</h2></div>{items.length ? <div className="divide-y">{items.map(item => <div key={item.disbursement_id} className="p-4 space-y-3"><div className="flex justify-between gap-3"><div><b>{item.customer_name} — {item.account_number}</b><p className="text-xs text-slate-500">{item.destination_phone} · {money(item.amount)}</p><p className="text-[11px] text-slate-400">Maker: {item.maker_name || '—'} · Checker: {item.checker_name || 'Awaiting authorized sign-off'}</p></div><span className="capitalize text-xs font-bold">{item.status.replace('_', ' ')}</span></div>
      {item.status === 'pending_approval' && profile?.permissions.includes('disbursement.approve') && <><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Decision note (required when rejecting)" className="w-full p-2 border rounded-xl text-xs" /><div className="flex justify-end gap-2"><button disabled={busy === item.disbursement_id} onClick={() => decide(item, 'rejected')} className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-xs">Reject</button><button disabled={busy === item.disbursement_id} onClick={() => decide(item, 'approved')} className="px-3 py-1.5 bg-[#167D78] text-white rounded-lg text-xs">Approve</button></div></>}
      {item.status === 'approved' && <div className="flex justify-between items-center p-3 bg-amber-50 rounded-xl"><span className="text-xs">Approved. Submit to Finoq only when the payout account has sufficient balance.</span><button disabled={busy === item.disbursement_id} onClick={() => submit(item)} className="px-3 py-2 bg-[#101C2C] text-white rounded-lg text-xs flex gap-1"><Send className="w-3.5 h-3.5" />Send via Finoq</button></div>}
      {item.status === 'submitted' && <div className="space-y-2"><p className="text-xs text-amber-700 flex gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Awaiting verified Finoq callback.</p>{isSuperAdmin && (reconciliation?.id === item.disbursement_id ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2"><p className="text-xs font-semibold text-amber-900">Manual reconciliation — use only after Finoq and the recipient confirm the payout.</p><label className="block text-xs text-slate-700">Finoq reference<input value={reconciliation.reference} onChange={event => setReconciliation({ ...reconciliation, reference: event.target.value })} placeholder="Merchant or provider reference from Finoq" className="mt-1 w-full rounded-lg border p-2 text-xs" /></label><p className="text-[11px] text-slate-600">In Finoq Dashboard, open the completed payout’s transaction details and copy its Merchant Reference or Provider Reference. Do not use the customer’s M-Pesa SMS code.</p><textarea value={reconciliation.reason} onChange={event => setReconciliation({ ...reconciliation, reason: event.target.value })} placeholder="How you independently confirmed the payout (minimum 20 characters)" className="w-full rounded-lg border p-2 text-xs" /><input value={reconciliation.confirmation} onChange={event => setReconciliation({ ...reconciliation, confirmation: event.target.value })} placeholder="Type RECONCILE to confirm" className="w-full rounded-lg border p-2 text-xs" /><div className="flex gap-2"><button disabled={busy === item.disbursement_id} onClick={reconcile} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-semibold text-white">Confirm reconciled payout</button><button onClick={() => setReconciliation(null)} className="rounded-lg border px-3 py-2 text-xs">Cancel</button></div></div> : <button onClick={() => setReconciliation({ id: item.disbursement_id, reference: '', reason: '', confirmation: '' })} className="text-xs font-semibold text-amber-800 underline">Manually reconcile confirmed payout</button>)}</div>}
      {item.status === 'completed' && <p className="text-xs text-emerald-700 flex gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Verified payout completed; loan is active.</p>}
      {item.status === 'failed' && <p className="text-xs text-rose-700 flex gap-1"><AlertCircle className="w-3.5 h-3.5" />Finoq reported payout failure. Investigate before retrying.</p>}
    </div>)}</div> : <p className="p-8 text-center text-xs text-slate-500">No disbursement records yet.</p>}</section>
  </div>;
}
