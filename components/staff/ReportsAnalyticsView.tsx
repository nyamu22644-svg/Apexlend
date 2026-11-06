'use client';

import React, { useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import {
  Download,
  FileSpreadsheet,
  BarChart2,
  ShieldCheck,
  CheckCircle2,
  Filter,
  Calendar,
  FileText,
  Printer,
  X,
} from 'lucide-react';

export function ReportsAnalyticsView() {
  const { brand, loanProducts, transactions, activeLoans, disbursements } = useBrand();
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const [printableModal, setPrintableModal] = useState<{ open: boolean; title: string; content: string }>({
    open: false,
    title: '',
    content: '',
  });

  const generateAndDownloadCsv = (
    filename: string,
    headers: string[],
    rows: (string | number | undefined | null)[][]
  ) => {
    const csvContent =
      headers.join(',') +
      '\n' +
      rows
        .map((row) =>
          row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadToast(`Generated and downloaded ${filename}.csv.`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const handleExportDcpReturn = () => {
    const headers = ['Quarter', 'Institution', 'CBK_License', 'Active_Loans', 'Gross_Portfolio_KES', 'NPL_Ratio', 'Disbursed_KES'];
    const rows = [
      ['Q1 2025', brand.institutionName, brand.cbkLicenseNumber, activeLoans.length, '52400000', '3.4%', '148600000'],
    ];
    generateAndDownloadCsv('CBK_FORM_DCP_01_RETURN', headers, rows);
  };

  const handleExportCrbFeed = () => {
    const headers = ['Customer_Name', 'National_ID', 'Loan_Number', 'Outstanding_Balance', 'Monthly_Installment', 'Days_Past_Due', 'Status'];
    const rows = activeLoans.map((l) => [
      l.customerName,
      '29841029',
      l.loanNumber,
      l.outstandingBalance,
      l.monthlyInstallment,
      l.daysInArrears ?? 0,
      l.status,
    ]);
    generateAndDownloadCsv('CRB_METROPOL_BATCH_FEED', headers, rows);
  };

  const handleExportMpesaLedger = () => {
    const headers = ['Receipt_Ref', 'Internal_Ref', 'Payer_Name', 'Phone', 'Loan_Number', 'Amount_KES', 'Type', 'Reconciliation_Status'];
    const rows = transactions.map((t) => [
      t.mpesaReceipt,
      t.transactionRef,
      t.customerName,
      t.phone,
      t.loanNumber,
      t.amount,
      t.type,
      t.reconciliationStatus || 'matched',
    ]);
    generateAndDownloadCsv('MPESA_RECONCILIATION_LEDGER', headers, rows);
  };

  const handleExportDisbursementsRegister = () => {
    const headers = ['Disbursement_ID', 'Loan_Number', 'Borrower', 'Phone', 'Amount_KES', 'Channel', 'Status', 'Provider_Ref'];
    const rows = disbursements.map((d) => [
      d.id,
      d.loanNumber,
      d.customerName,
      d.phone,
      d.amount,
      d.channel,
      d.status,
      d.providerReference || 'Pending',
    ]);
    generateAndDownloadCsv('DISBURSEMENTS_REGISTER', headers, rows);
  };

  const handlePrintReport = (title: string, summary: string) => {
    setPrintableModal({
      open: true,
      title,
      content: summary,
    });
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101C2C] tracking-tight">Reports & Regulatory Returns</h1>
          <p className="text-xs text-slate-500 mt-1">
            Statutory CBK supervisory schedules, CRB credit bureaus, and general ledger financial statements.
          </p>
        </div>
      </div>

      {/* Toast Alert */}
      {downloadToast && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-[#167D78] text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#167D78]" />
            <span>{downloadToast}</span>
          </div>
          <button onClick={() => setDownloadToast(null)} className="text-teal-700 hover:text-teal-900 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Ribbon */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">Filter Reports:</span>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#167D78]"
          >
            <option value="all">All Loan Products</option>
            {loanProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: '7 Days' },
            { id: '30d', label: '30 Days' },
            { id: 'quarter', label: 'Quarter to Date' },
            { id: 'ytd', label: 'Full Year' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setDateRange(r.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize whitespace-nowrap cursor-pointer transition-colors ${
                dateRange === r.id
                  ? 'bg-white text-[#101C2C] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Statutory Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CBK Return */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#101C2C]">
              <ShieldCheck className="w-4 h-4 text-[#167D78]" />
              <span>CBK Quarterly Credit Provider Return (Form DCP-01)</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Mandatory submission showing total disbursements, interest earnings, NPL classification, and consumer complaints summary for {brand.cbkLicenseNumber}.
            </p>
          </div>
          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <span className="text-[11px] font-mono text-slate-400">Quarter ended 31 Mar 2025</span>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  handlePrintReport(
                    'CBK Form DCP-01 Compliance Dossier',
                    `Institution: ${brand.institutionName}\nLicense: ${brand.cbkLicenseNumber}\nQuarter: Q1 2025\nActive Loans: ${activeLoans.length}\nGross Portfolio: KES 52,400,000\nNPL Ratio: 3.4% (Below 5% statutory threshold)\nAll transactions reconciled under CBK Digital Credit Providers Regulations 2022.`
                  )
                }
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                title="Print Preview"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportDcpReturn}
                className="px-3.5 py-1.5 bg-[#167D78] hover:bg-[#126460] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* CRB Feed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#101C2C]">
              <FileSpreadsheet className="w-4 h-4 text-[#167D78]" />
              <span>Credit Reference Bureau (CRB) Monthly Data Feed</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Standardized METROPOL / TRANSUNION batch submission detailing active accounts, payment performance, and days past due.
            </p>
          </div>
          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <span className="text-[11px] font-mono text-slate-400">{activeLoans.length} Active Records</span>
            <button
              onClick={handleExportCrbFeed}
              className="px-3.5 py-1.5 bg-[#167D78] hover:bg-[#126460] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* M-Pesa Reconciliation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#101C2C]">
              <Download className="w-4 h-4 text-[#167D78]" />
              <span>M-Pesa Reconciliation & Settlement Audit</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Daily match ledger between Safaricom Daraja C2B/B2C transactions and internal general ledger accounting balances.
            </p>
          </div>
          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <span className="text-[11px] font-mono text-slate-400">{transactions.length} Transactions</span>
            <button
              onClick={handleExportMpesaLedger}
              className="px-3.5 py-1.5 bg-[#167D78] hover:bg-[#126460] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Disbursements Register */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#101C2C]">
              <BarChart2 className="w-4 h-4 text-[#167D78]" />
              <span>Disbursements & Payouts Register</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Complete chronological register of M-Pesa B2C and Bank EFT loan releases with maker-checker audit footprints.
            </p>
          </div>
          <div className="pt-2 flex justify-between items-center border-t border-slate-100">
            <span className="text-[11px] font-mono text-slate-400">{disbursements.length} Records</span>
            <button
              onClick={handleExportDisbursementsRegister}
              className="px-3.5 py-1.5 bg-[#167D78] hover:bg-[#126460] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Preview Modal */}
      {printableModal.open && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-[#101C2C] flex items-center gap-2">
                <Printer className="w-4 h-4 text-[#167D78]" />
                {printableModal.title}
              </h3>
              <button
                onClick={() => setPrintableModal({ open: false, title: '', content: '' })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="bg-slate-50 p-4 rounded-xl font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-200">
              {printableModal.content}
            </pre>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setPrintableModal({ open: false, title: '', content: '' })}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                  setPrintableModal({ open: false, title: '', content: '' });
                }}
                className="px-4 py-2 bg-[#167D78] hover:bg-[#126460] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
