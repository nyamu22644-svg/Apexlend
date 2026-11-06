'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye, FileText, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type KycCase = {
  kyc_case_id: string; customer_profile_id: string; customer_number: string; full_name: string;
  email: string; phone_number: string | null; status: 'pending' | 'under_review'; opened_at: string; document_count: number;
};
type KycDocument = { id: string; document_type: string; content_type: string; created_at: string };

async function api(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body;
}

export function KycReviewQueue() {
  const { session, profile } = useAuth();
  const [cases, setCases] = useState<KycCase[]>([]);
  const [selected, setSelected] = useState<KycCase | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true); setError('');
    try {
      const result = await api('/api/staff/kyc/cases', session.access_token);
      setCases(result.cases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the KYC review queue');
    } finally { setLoading(false); }
  }, [session?.access_token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const loadDocuments = async () => {
      if (!selected || !session?.access_token || !profile?.permissions.includes('document.read_sensitive')) { setDocuments([]); return; }
      setLoadingDocuments(true);
      try {
        const result = await api(`/api/staff/kyc/cases/${selected.kyc_case_id}/documents`, session.access_token);
        setDocuments(result.documents || []);
      } catch (err) { setError(err instanceof Error ? err.message : 'Unable to load documents'); }
      finally { setLoadingDocuments(false); }
    };
    loadDocuments();
  }, [selected, session?.access_token, profile?.permissions]);

  const openDocument = async (documentId: string) => {
    if (!session?.access_token) return;
    try {
      const result = await api(`/api/staff/kyc/documents/${documentId}`, session.access_token);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to open document'); }
  };

  const decide = async (decision: 'verified' | 'rejected') => {
    if (!selected || !session?.access_token) return;
    if (decision === 'rejected' && notes.trim().length < 5) {
      setError('Give the customer a clear rejection reason (at least 5 characters).'); return;
    }
    setSaving(true); setError('');
    try {
      await api('/api/staff/kyc/decision', session.access_token, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: selected.kyc_case_id, decision, notes }),
      });
      setSelected(null); setNotes(''); await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the decision');
    } finally { setSaving(false); }
  };

  if (!profile?.permissions.includes('kyc.read')) {
    return <div className="p-6 bg-white rounded-2xl border border-slate-200 text-sm text-slate-600">Your staff role does not have KYC review access.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-xl font-bold text-[#101C2C]">KYC Review Queue</h1><p className="text-xs text-slate-500 mt-1">Customer-submitted identity cases awaiting a recorded compliance decision.</p></div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#167D78]" /></div> : cases.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">No KYC cases require review.</div> : (
          <div className="divide-y divide-slate-100">
            {cases.map((item) => <button key={item.kyc_case_id} onClick={() => { setSelected(item); setNotes(''); setError(''); }} className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between gap-3">
              <div><p className="font-semibold text-sm text-[#101C2C]">{item.full_name}</p><p className="text-xs text-slate-500 mt-1">{item.customer_number} · {item.email} · {item.phone_number || 'No phone'}</p></div>
              <div className="text-right"><p className="text-xs font-semibold text-amber-700">{item.status.replace('_', ' ')}</p><p className="text-[11px] text-slate-400 mt-1">{item.document_count} document(s)</p></div>
            </button>)}
          </div>
        )}
      </div>
      {selected && <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4"><div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-xl space-y-5">
        <div className="flex gap-3"><div className="p-2 rounded-xl bg-[#E7F3F2] text-[#167D78]"><ShieldCheck className="w-5 h-5" /></div><div><h2 className="font-bold text-[#101C2C]">Review KYC case</h2><p className="text-xs text-slate-500">{selected.full_name} · {selected.customer_number}</p></div></div>
        <div className="grid grid-cols-2 gap-3 text-xs"><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400 block">Email</span>{selected.email}</div><div className="rounded-xl bg-slate-50 p-3"><span className="text-slate-400 block">Documents</span>{selected.document_count} uploaded</div></div>
        {profile.permissions.includes('document.read_sensitive') && <div className="space-y-2"><p className="text-xs font-semibold text-slate-700">Submitted documents</p>{loadingDocuments ? <Loader2 className="w-4 h-4 animate-spin text-[#167D78]" /> : documents.map((document) => <button key={document.id} onClick={() => openDocument(document.id)} className="w-full flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-left text-xs hover:bg-slate-50"><span className="capitalize">{document.document_type.replaceAll('_', ' ')}</span><span className="inline-flex items-center gap-1 text-[#167D78] font-semibold"><Eye className="w-3.5 h-3.5" />View</span></button>)}</div>}
        <label className="block text-xs font-semibold text-slate-700">Review notes <span className="font-normal text-slate-400">(required to reject)</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 w-full min-h-24 rounded-xl border border-slate-200 p-3 font-normal text-slate-800" placeholder="Record your verification checks or the reason for rejection." /></label>
        <p className="text-[11px] text-slate-500 flex gap-1.5"><FileText className="w-3.5 h-3.5 shrink-0" />Document viewing is intentionally restricted to personnel with sensitive-document permission. This decision is immutable in the audit trail.</p>
        <div className="flex flex-wrap justify-end gap-2"><button onClick={() => setSelected(null)} disabled={saving} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>{profile.permissions.includes('kyc.decide') && <><button onClick={() => decide('rejected')} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold disabled:opacity-50"><XCircle className="w-3.5 h-3.5" />Reject</button><button onClick={() => decide('verified')} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#167D78] text-white text-xs font-semibold disabled:opacity-50"><CheckCircle2 className="w-3.5 h-3.5" />Approve KYC</button></>}</div>
      </div></div>}
    </div>
  );
}
