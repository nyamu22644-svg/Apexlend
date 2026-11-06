'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AuditLogEntry } from '@/lib/types/lending';
import {
  FileCheck2,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  X,
  Lock,
  ArrowRight,
  Download,
} from 'lucide-react';

export function AuditLogView() {
  const { session } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const loadAuditEvents = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoadError(null);
      const response = await fetch('/api/staff/audit-logs', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load audit events');
      setAuditLogs((body.events || []).map((event: any): AuditLogEntry => ({
        id: event.audit_id,
        timestamp: new Intl.DateTimeFormat('en-KE', {
          dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Africa/Nairobi',
        }).format(new Date(event.occurred_at)) + ' EAT',
        actor: event.actor_name,
        actorRole: event.actor_role,
        action: event.action,
        module: String(event.target_type || '').replace(/_/g, ' '),
        targetId: event.target_id,
        category: event.category,
        details: event.details,
        beforeValue: event.before_state ? JSON.stringify(event.before_state, null, 2) : undefined,
        afterValue: event.after_state ? JSON.stringify(event.after_state, null, 2) : undefined,
        outcome: 'Success',
      })));
    } catch (error) {
      setAuditLogs([]);
      setLoadError(error instanceof Error ? error.message : 'Unable to load audit events');
    }
  }, [session?.access_token]);

  useEffect(() => { void loadAuditEvents(); }, [loadAuditEvents]);

  const filtered = auditLogs.filter((log) => {
    const matchesSearch =
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.targetId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || log.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const handleExportAudit = () => {
    const csvContent =
      'Timestamp,Actor,Role,Module,Action,Target,Category,Details,Outcome,IP\n' +
      filtered
        .map(
          (l) =>
            `"${l.timestamp}","${l.actor}","${l.actorRole}","${l.module}","${l.action}","${l.targetId}","${l.category || ''}","${l.details.replace(/"/g, '""')}","${l.outcome || 'Success'}","${l.ipAddress || ''}"`
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AUDIT_LOG_EXPORT_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101C2C] tracking-tight">Regulatory Audit Trail</h1>
          <p className="text-xs text-slate-500 mt-1">
            A read-only record of actions the platform has actually logged, including available before-and-after changes.
          </p>
        </div>
        <button
          onClick={handleExportAudit}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          Export Audit Ledger (CSV)
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by actor, action, target or module..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'Credit', label: 'Credit' },
            { id: 'Disbursement', label: 'Disbursement' },
            { id: 'Repayment', label: 'Repayment' },
            { id: 'Customer', label: 'Customer' },
            { id: 'Configuration', label: 'Config' },
            { id: 'Security', label: 'Security' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap cursor-pointer transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-white text-[#101C2C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Timestamp (EAT)</th>
                <th className="py-3 px-4">Actor & Role</th>
                <th className="py-3 px-4">Event Action</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loadError && (
                <tr><td colSpan={6} className="py-8 px-4 text-center font-sans text-rose-700">{loadError}</td></tr>
              )}
              {!loadError && filtered.length === 0 && (
                <tr><td colSpan={6} className="py-8 px-4 text-center font-sans text-slate-500">No recorded audit events match these filters.</td></tr>
              )}
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                    {log.timestamp}
                  </td>

                  <td className="py-3 px-4 font-sans">
                    <span className="font-bold text-[#101C2C]">{log.actor}</span>
                    <span className="block text-[10px] text-slate-400 font-mono capitalize">{log.actorRole}</span>
                  </td>

                  <td className="py-3 px-4">
                    <span className="text-[11px] font-semibold text-[#167D78] block">
                      {log.action}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans">{log.module}</span>
                  </td>

                  <td className="py-3 px-4 font-semibold text-slate-800 text-[11px]">
                    {log.targetId}
                  </td>

                  <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate text-[11px]">
                    {log.details}
                  </td>

                  <td className="py-3 px-4 text-right font-sans">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-2.5 py-1 text-xs text-[#167D78] hover:text-[#126460] font-semibold hover:bg-teal-50 rounded-lg cursor-pointer transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inspect Event Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#101C2C] flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#167D78]" />
                Audit Trail Event Dossier
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Action Code:</span>
                <span className="font-mono font-bold text-[#167D78]">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Timestamp:</span>
                <span className="font-mono text-slate-800">{selectedLog.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Actor:</span>
                <span className="font-bold text-slate-800">
                  {selectedLog.actor} ({selectedLog.actorRole})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Module:</span>
                <span className="font-medium text-slate-800">{selectedLog.module}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Resource:</span>
                <span className="font-mono font-semibold text-slate-800">{selectedLog.targetId}</span>
              </div>
              {selectedLog.ipAddress && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Client IP:</span>
                  <span className="font-mono text-slate-600">{selectedLog.ipAddress}</span>
                </div>
              )}
            </div>

            {/* Before vs After State */}
            {(selectedLog.beforeValue || selectedLog.afterValue) && (
              <div className="space-y-2 text-xs">
                <h4 className="font-bold text-slate-800">State Transition (Delta)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <span className="text-[10px] font-bold text-rose-800 block uppercase">Before</span>
                    <span className="font-mono text-slate-700">{selectedLog.beforeValue || 'None'}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="text-[10px] font-bold text-emerald-800 block uppercase">After</span>
                    <span className="font-mono text-slate-800">{selectedLog.afterValue || 'None'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1 text-xs">
              <span className="text-slate-500 block">Full Description:</span>
              <p className="text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-100">
                {selectedLog.details}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
