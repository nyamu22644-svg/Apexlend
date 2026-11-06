'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { StatCard } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Users,
  Wallet,
  Coins,
  CalendarCheck,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Send,
  Clock,
  ShieldCheck,
} from 'lucide-react';
type DashboardData = {
  reporting_date?: string; timezone?: string; snapshot_available?: boolean;
  metrics?: Record<string, number | null>;
  growth?: Record<string, number | null>;
  portfolio_trend?: { month: string; label: string; value: number }[];
  recent_applications?: { id: string; customer_name: string; phone: string | null; requested_amount: number; status: string; submitted_at: string | null }[];
  recent_activity?: { id: string; kind: 'check' | 'send' | 'clock'; title: string; description: string; occurred_at: string }[];
  gateway?: { name: string; sample_size: number; success_percent: number | null; state: 'healthy' | 'degraded' | 'unhealthy' | 'unavailable' };
};

const money = (value: number | null | undefined) => value === null || value === undefined ? '—' : `KES ${value.toLocaleString('en-KE', { maximumFractionDigits: 1 })}`;
const compactMoney = (value: number | null | undefined) => value === null || value === undefined ? '—' : `KES ${(value / 1_000_000).toLocaleString('en-KE', { maximumFractionDigits: 1 })}M`;
const number = (value: number | null | undefined) => value === null || value === undefined ? '—' : value.toLocaleString('en-KE');
const growth = (value: number | null | undefined) => value === null || value === undefined ? undefined : `${Math.abs(value).toLocaleString('en-KE', { maximumFractionDigits: 1 })}%`;
const relativeTime = (value: string) => { const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); return minutes < 1 ? 'Just now' : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} hr ago` : `${Math.floor(minutes / 1440)} days ago`; };

export function StaffDashboard() {
  const { setStaffModule } = useBrand();
  const { session } = useAuth();
  const [activeChartPoint, setActiveChartPoint] = useState<number>(5);
  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true); setLoadError('');
    try {
      const response = await fetch('/api/staff/dashboard', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load dashboard data');
      setDashboard(body);
    } catch (error) { setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data'); }
    finally { setLoading(false); }
  }, [session?.access_token]);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const trend = dashboard.portfolio_trend || [];
  const chartData = useMemo(() => trend.map((item, index) => ({ ...item, index })), [trend]);
  const activeIndex = Math.min(activeChartPoint, Math.max(chartData.length - 1, 0));
  const chartMax = Math.max(...chartData.map((point) => point.value), 1);
  const chartPoints = chartData.map((point, index) => ({ x: chartData.length < 2 ? 320 : 80 + (480 * index) / (chartData.length - 1), y: 185 - (point.value / chartMax) * 150, idx: index }));
  const linePath = chartPoints.length ? `M ${chartPoints.map((point) => `${point.x} ${point.y}`).join(' L ')}` : '';
  const areaPath = chartPoints.length ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} 185 L ${chartPoints[0].x} 185 Z` : '';
  const metrics = dashboard.metrics || {};
  const changes = dashboard.growth || {};
  const displayApplications = dashboard.recent_applications || [];
  const activity = dashboard.recent_activity || [];
  const gateway = dashboard.gateway;

  const pendingDisbursementsCount = metrics.awaiting_payout;
  const pendingUnderwritingCount = metrics.underwriting_queue;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#101C2C]">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">Overview of your lending operations</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Reporting Interval:</span>
          <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-[#167D78]">
            {dashboard.reporting_date ? `Today · ${new Date(`${dashboard.reporting_date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : 'Today · —'}
          </span>
        </div>
      </div>

      {/* 4 Stat Cards (Exact match to reference image) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Customers"
          value={number(metrics.customers)}
          growth={growth(changes.customers)}
          growthType="up"
          icon={<Users className="w-5 h-5" />}
          iconBg="bg-[#E7F3F2] text-[#167D78]"
          onClick={() => setStaffModule('customers')}
        />
        <StatCard
          title="Active Loans"
          value={number(metrics.active_loans)}
          growth={growth(changes.active_loans)}
          growthType="up"
          icon={<Wallet className="w-5 h-5" />}
          iconBg="bg-teal-50 text-teal-600"
          onClick={() => setStaffModule('loans')}
        />
        <StatCard
          title="Portfolio Balance"
          value={compactMoney(metrics.portfolio_balance)}
          growth={growth(changes.portfolio_balance)}
          growthType="up"
          icon={<Coins className="w-5 h-5" />}
          iconBg="bg-[#FAF4E9] text-[#D6A85F]"
          onClick={() => setStaffModule('reports')}
        />
        <StatCard
          title="Today's Repayments"
          value={compactMoney(metrics.today_repayments)}
          growth={undefined}
          growthType="up"
          icon={<CalendarCheck className="w-5 h-5" />}
          iconBg="bg-emerald-50 text-emerald-600"
          onClick={() => setStaffModule('repayments')}
        />
      </div>

      {/* Operational Highlights Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs text-xs">
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
          <div>
            <span className="text-slate-400 block text-[10px]">Total Disbursed (Batch)</span>
            <span className="font-bold text-[#101C2C] text-sm tabular-nums">{compactMoney(metrics.total_disbursed)}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold">{growth(changes.total_disbursed) || '—'}</span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50">
          <div>
            <span className="text-slate-400 block text-[10px]">Overdue Portfolio (PAR)</span>
            <span className="font-bold text-amber-600 text-sm tabular-nums">{compactMoney(metrics.par_balance)}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold">{growth(changes.par_balance) || '—'}</span>
        </div>

        <button
          onClick={() => setStaffModule('disbursements')}
          className="flex items-center justify-between p-2 rounded-xl bg-teal-50/70 hover:bg-teal-50 transition-colors text-left cursor-pointer"
        >
          <div>
            <span className="text-[#167D78] block text-[10px] font-semibold">Awaiting Payout</span>
            <span className="font-bold text-[#101C2C] text-sm tabular-nums">{number(pendingDisbursementsCount)} Ready</span>
          </div>
          <Send className="w-3.5 h-3.5 text-[#167D78]" />
        </button>

        <button
          onClick={() => setStaffModule('applications')}
          className="flex items-center justify-between p-2 rounded-xl bg-amber-50/70 hover:bg-amber-50 transition-colors text-left cursor-pointer"
        >
          <div>
            <span className="text-amber-800 block text-[10px] font-semibold">Underwriting Queue</span>
            <span className="font-bold text-[#101C2C] text-sm tabular-nums">{number(pendingUnderwritingCount)} In Review</span>
          </div>
          <Clock className="w-3.5 h-3.5 text-amber-700" />
        </button>
      </div>

      {/* Middle Grid: Portfolio Trend + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Loan Portfolio Trend Visual Chart (Exact match to reference image) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#101C2C]">Loan Portfolio Trend</h3>
            <span className="text-xs font-semibold text-[#167D78] bg-[#E7F3F2] px-2.5 py-1 rounded-full">
              {compactMoney(metrics.portfolio_balance)} Total
            </span>
          </div>

          {/* SVG Line / Area Chart */}
          <div className="relative h-56 w-full pt-4">
            {/* Tooltip on active point */}
            <div
              className="absolute -top-1 transition-all duration-200 pointer-events-none -translate-x-1/2 z-10"
              style={{
                left: `${chartPoints[activeIndex] ? (chartPoints[activeIndex].x / 600) * 100 : 50}%`,
              }}
            >
              <div className="bg-[#101C2C] text-white text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg shadow-md whitespace-nowrap">
                {chartData[activeIndex] ? `${chartData[activeIndex].label} · ${compactMoney(chartData[activeIndex].value)}` : 'Reporting history pending'}
              </div>
            </div>

            <svg viewBox="0 0 600 220" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#167D78" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#167D78" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="40" y1="20" x2="580" y2="20" stroke="#F1F5F9" strokeWidth="1" />
              <text x="10" y="24" fontSize="10" fill="#94A3B8" fontFamily="monospace">{compactMoney(chartMax)}</text>

              <line x1="40" y1="75" x2="580" y2="75" stroke="#F1F5F9" strokeWidth="1" />
              <text x="10" y="79" fontSize="10" fill="#94A3B8" fontFamily="monospace">{compactMoney(chartMax * .67)}</text>

              <line x1="40" y1="130" x2="580" y2="130" stroke="#F1F5F9" strokeWidth="1" />
              <text x="10" y="134" fontSize="10" fill="#94A3B8" fontFamily="monospace">{compactMoney(chartMax * .33)}</text>

              <line x1="40" y1="185" x2="580" y2="185" stroke="#F1F5F9" strokeWidth="1" />
              <text x="10" y="189" fontSize="10" fill="#94A3B8" fontFamily="monospace">0M</text>

              {/* Chart Coordinates:
                  Jan: (80, 110)
                  Feb: (176, 92)
                  Mar: (272, 78)
                  Apr: (368, 62)
                  May: (464, 50)
                  Jun: (560, 42)
              */}
              {areaPath && <path d={areaPath} fill="url(#portfolioGradient)" />}

              {linePath && <path
                d={linePath}
                fill="none"
                stroke="#167D78"
                strokeWidth="3"
                strokeLinecap="round"
              />}

              {/* Interactive Data Nodes */}
              {chartPoints.map((pt) => (
                <circle
                  key={pt.idx}
                  cx={pt.x}
                  cy={pt.y}
                  r={activeIndex === pt.idx ? 6 : 4}
                  fill={activeIndex === pt.idx ? '#167D78' : '#FFFFFF'}
                  stroke="#167D78"
                  strokeWidth="2.5"
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setActiveChartPoint(pt.idx)}
                />
              ))}
            </svg>

            {/* X-Axis Labels */}
            <div className="flex justify-between pl-10 pr-2 pt-2 text-[11px] font-medium text-slate-500">
              {chartData.map((d, i) => (
                <span
                  key={d.label}
                  onClick={() => setActiveChartPoint(i)}
                  className={`cursor-pointer hover:text-[#167D78] ${
                    activeIndex === i ? 'text-[#167D78] font-bold' : ''
                  }`}
                >
                  {d.month}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Recent Activity (Exact match to reference image) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#101C2C]">Recent Activity</h3>
              <button
                onClick={() => setStaffModule('repayments')}
                className="text-xs font-semibold text-[#167D78] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              {activity.map((act) => (
                <div key={act.id} className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${act.kind === 'clock' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-[#167D78]'}`}
                  >
                    {act.kind === 'check' && <CheckCircle2 className="w-4 h-4" />}
                    {act.kind === 'send' && <Send className="w-4 h-4" />}
                    {act.kind === 'clock' && <Clock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#101C2C] truncate">{act.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{act.description}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{relativeTime(act.occurred_at)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{gateway?.name || 'Payment Gateway'}</span>
            <span className={`${gateway?.state === 'healthy' ? 'text-emerald-600' : gateway?.state === 'unavailable' ? 'text-slate-500' : 'text-amber-600'} font-semibold flex items-center gap-1`}>
              <span className={`w-1.5 h-1.5 rounded-full ${gateway?.state === 'healthy' ? 'bg-emerald-500' : gateway?.state === 'unavailable' ? 'bg-slate-400' : 'bg-amber-500'}`} />
              {gateway?.success_percent === null || gateway?.success_percent === undefined ? 'Status unavailable' : `${gateway.state === 'healthy' ? 'Healthy' : gateway.state} (${gateway.success_percent.toLocaleString('en-KE', { maximumFractionDigits: 2 })}%)`}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Loan Applications + Stay Compliant Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Recent Loan Applications Table (Exact match to reference image) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[#101C2C]">Recent Loan Applications</h3>
            <button
              onClick={() => setStaffModule('applications')}
              className="text-xs font-semibold text-[#167D78] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="pb-3 font-medium">Customer</th>
                  <th className="pb-3 font-medium">Amount</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 font-medium text-[#101C2C]">
                      <div>
                        <span>{app.customer_name}</span>
                        <p className="text-[10px] text-slate-400 font-mono">{app.phone || 'No phone'}</p>
                      </div>
                    </td>
                    <td className="py-3 font-mono font-bold text-[#101C2C]">
                      {money(app.requested_amount)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={app.status} size="sm" />
                    </td>
                    <td className="py-3 text-right font-medium text-slate-500 whitespace-nowrap">
                      {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Stay Compliant Banner (Exact match to reference image) */}
        <div className="bg-[#167D78] text-white rounded-2xl p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
          {/* Subtle gold ribbon graphic in bottom corner matching reference image */}
          <div className="absolute -bottom-10 -right-10 w-36 h-36 bg-[#D6A85F] rounded-full opacity-35 blur-xl pointer-events-none" />
          <svg
            className="absolute bottom-0 right-0 w-32 h-32 opacity-25 pointer-events-none"
            viewBox="0 0 100 100"
            fill="none"
          >
            <path
              d="M30 100 C 40 60, 70 40, 100 20 L 100 100 Z"
              fill="#D6A85F"
            />
          </svg>

          <div className="space-y-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-lg font-bold">Stay Compliant</h4>
            <p className="text-xs text-white/90 leading-relaxed max-w-xs">
              All transactions are securely logged and auditable in accordance with the Central Bank of Kenya DCP
              regulations.
            </p>
          </div>

          <div className="pt-6 relative z-10">
            <button
              onClick={() => setStaffModule('reports')}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#167D78] hover:bg-slate-50 text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <span>View Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
