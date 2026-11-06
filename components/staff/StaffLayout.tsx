'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useBrand, StaffModule } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { UserRole } from '@/lib/types/lending';
import { BrandLogo } from '@/components/shared/BrandLogo';
import {
  LayoutDashboard,
  Users,
  Layers,
  FileText,
  Wallet,
  CreditCard,
  ShieldAlert,
  BarChart3,
  Settings,
  Bell,
  Menu,
  X,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Send,
  UserCog,
  MessageSquare,
  LogOut,
} from 'lucide-react';
import { StaffDashboard } from './StaffDashboard';
import { CustomerManagementView } from './CustomerManagementView';
import { KycReviewQueue } from './KycReviewQueue';
import { LoanProductConfigView } from './LoanProductConfigView';
import { LoanApplicationsView } from './LoanApplicationsView';
import { LoanAccountsView } from './LoanAccountsView';
import { DisbursementsView } from './DisbursementsView';
import { RepaymentMonitoringView } from './RepaymentMonitoringView';
import { CollectionsArrearsView } from './CollectionsArrearsView';
import { ReportsAnalyticsView } from './ReportsAnalyticsView';
import { BrandingConfigView } from './BrandingConfigView';
import { AuditLogView } from './AuditLogView';
import { StaffManagementView } from './StaffManagementView';
import { SupportOperationsView } from './SupportOperationsView';

export function StaffLayout() {
  const { staffModule, setStaffModule, brand } = useBrand();
  const { profile, session, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [staffNotifications, setStaffNotifications] = useState<Array<{id:string;title:string;message:string;notification_type:string;read_at:string|null;created_at:string}>>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const roleMeaning: Record<string, string> = {
    super_admin: 'Can do everything and manage staff access.', operations_manager: 'Oversees daily lending work.',
    kyc_officer: 'Checks customer identity documents.', credit_officer: 'Assesses loan applications.',
    loan_approver: 'Independently approves credit decisions.', disbursement_preparer: 'Prepares approved loans for payment.',
    disbursement_approver: 'Independently approves prepared payments.', finance_officer: 'Reviews repayments and payment exceptions.',
    collections_agent: 'Follows up overdue loans.', support_officer: 'Handles customer complaints and requests.',
    compliance_auditor: 'Reviews records without changing operations.', product_settings_admin: 'Manages products, policies and settings.',
  };
  const loadNotifications = useCallback(async()=>{if(!session?.access_token)return;const r=await fetch('/api/staff/notifications',{headers:{Authorization:`Bearer ${session.access_token}`}});const b=await r.json().catch(()=>({}));if(r.ok)setStaffNotifications(b.notifications||[])},[session?.access_token]);
  useEffect(()=>{loadNotifications().catch(()=>undefined);const timer=window.setInterval(()=>loadNotifications().catch(()=>undefined),60000);return()=>window.clearInterval(timer)},[loadNotifications]);
  const markNotificationRead=async(id:string)=>{if(!session?.access_token)return;setStaffNotifications(x=>x.map(n=>n.id===id?{...n,read_at:n.read_at||new Date().toISOString()}:n));await fetch('/api/staff/notifications',{method:'PATCH',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({notificationId:id})}).catch(()=>undefined)};
  const unreadNotifications=staffNotifications.filter(n=>!n.read_at).length;

  const menuItems: { id: StaffModule; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'customers', label: 'Customers', icon: <Users className="w-4 h-4" /> },
    { id: 'support', label: 'Support & Requests', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'kyc', label: 'KYC Review', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'loan_products', label: 'Loan Products', icon: <Layers className="w-4 h-4" /> },
    { id: 'applications', label: 'Applications', icon: <FileText className="w-4 h-4" /> },
    { id: 'loans', label: 'Loans', icon: <Wallet className="w-4 h-4" /> },
    { id: 'disbursements', label: 'Disbursements', icon: <Send className="w-4 h-4" /> },
    { id: 'repayments', label: 'Repayments', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'collections', label: 'Collections', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'branding', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'audit_logs', label: 'Audit Logs', icon: <FileCheck2 className="w-4 h-4" /> },
    { id: 'staff_management', label: 'Staff & Access', icon: <UserCog className="w-4 h-4" /> },
  ];

  const renderContent = () => {
    switch (staffModule) {
      case 'dashboard':
        return <StaffDashboard />;
      case 'customers':
        return <CustomerManagementView />;
      case 'support':
        return <SupportOperationsView />;
      case 'kyc':
        return <KycReviewQueue />;
      case 'loan_products':
        return <LoanProductConfigView />;
      case 'applications':
        return <LoanApplicationsView />;
      case 'loans':
        return <LoanAccountsView />;
      case 'disbursements':
        return <DisbursementsView />;
      case 'repayments':
        return <RepaymentMonitoringView />;
      case 'collections':
        return <CollectionsArrearsView />;
      case 'reports':
        return <ReportsAnalyticsView />;
      case 'branding':
        return <BrandingConfigView />;
      case 'audit_logs':
        return <AuditLogView />;
      case 'staff_management':
        return <StaffManagementView />;
      default:
        return <StaffDashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F7FA]">
      {/* Desktop Sidebar (Midnight Navy #101C2C strictly matching reference image) */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#101C2C] text-white shrink-0 min-h-screen border-r border-slate-800">
        {/* Brand Logo Lockup */}
        <div className="p-5 border-b border-slate-800/80">
          <BrandLogo variant="light" size="md" showTagline />
        </div>

        {/* Navigation Menu (12 modules) */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = staffModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setStaffModule(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#167D78] text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Institution License Footer in Sidebar */}
        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-400">
          <p className="font-semibold text-white truncate">{brand.institutionName}</p>
          <p className="text-[10px] text-slate-400 truncate">{brand.cbkLicenseNumber}</p>
          <p className="text-[9px] text-[#D6A85F] mt-1 font-semibold">Regulated Digital Credit Provider</p>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer Menu */}
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-[#101C2C] text-white z-50 transform transition-transform duration-200 lg:hidden flex flex-col ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 flex items-center justify-between border-b border-slate-800">
          <BrandLogo variant="light" size="sm" />
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = staffModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setStaffModule(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive ? 'bg-[#167D78] text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Operations Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar (Exact match to reference image) */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Bar (Exact placeholder from reference image) */}
            <div className="relative w-full">
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search customers, loans..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
              />
              <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative">
              <button
                onClick={() => { setShowNotifications(!showNotifications); loadNotifications().catch(()=>undefined); }}
                className="p-2 text-slate-500 hover:text-slate-700 rounded-full hover:bg-slate-100 relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifications>0&&<span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadNotifications>99?'99+':unreadNotifications}</span>}
              </button>

              {/* Notification Popover */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-[#101C2C]">Operations Alerts</span>
                    <span className="text-[10px] text-[#167D78] font-semibold">Live feeds</span>
                  </div>
                  <div className="space-y-1.5 text-[11px] max-h-60 overflow-y-auto">{staffNotifications.length?staffNotifications.map(n=><button key={n.id} onClick={()=>markNotificationRead(n.id)} className={`w-full text-left p-2 rounded-lg border ${n.read_at?'bg-slate-50 border-slate-100 text-slate-600':'bg-teal-50 border-teal-100 text-slate-800'}`}><b className="block">{n.title}</b><span>{n.message}</span><small className="block text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('en-GB')}</small></button>):<p className="p-3 text-slate-500">No notifications yet.</p>}</div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pl-2">
              <div className="w-8 h-8 rounded-full bg-[#101C2C] text-[#D6A85F] font-bold text-xs flex items-center justify-center">{profile?.fullName?.split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase() || 'ST'}</div>
              <div className="hidden sm:block leading-tight"><p className="text-xs font-bold text-[#101C2C]">{profile?.fullName || 'Staff member'}</p><p className="text-[10px] text-slate-500">{profile?.email}</p><p className="text-[10px] text-[#167D78] capitalize">{profile?.role?.replaceAll('_',' ')}</p><p className="text-[9px] text-slate-400 max-w-48">{profile?.role ? roleMeaning[profile.role] : ''}</p></div>
              <button onClick={()=>signOut()} title="Log out" className="p-2 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100"><LogOut className="w-4 h-4"/></button>
            </div>
          </div>
        </header>

        {/* Operations Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{renderContent()}</main>
      </div>
    </div>
  );
}
