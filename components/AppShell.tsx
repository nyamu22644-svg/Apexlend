'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseConfigStatus } from '@/lib/supabase/client';
import { CustomerLayout } from './customer/CustomerLayout';
import { StaffLayout } from './staff/StaffLayout';
import { StaffLoginView } from './staff/StaffLoginView';
import { StaffMfaGate } from './staff/StaffMfaGate';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { BrandLogo } from './shared/BrandLogo';
import { BRAND_PRESETS } from '@/lib/brand-config';
import {
  Smartphone,
  LayoutDashboard,
  Sparkles,
  ChevronDown,
  Eye,
  CheckCircle2,
  SlidersHorizontal,
  UserCheck,
  LogOut,
  LogIn,
  Database,
  Key,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  FileCode,
} from 'lucide-react';
import { Modal } from './shared/Modal';
import { SQL_MIGRATION_1, SQL_MIGRATION_2 } from '@/lib/supabase/migrations-sql';

export function AppShell() {
  const {
    brand,
    setBrandPreset,
    activePortal,
    setActivePortal,
    setCustomerView,
    previewDeviceFrame,
    setPreviewDeviceFrame,
    authSession,
    logoutCustomer,
    switchCustomerPersona,
  } = useBrand();

  const { isConfigured, profile, user, signOut } = useAuth();
  const [showBrandMenu, setShowBrandMenu] = useState(false);
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);
  const [referenceTab, setReferenceTab] = useState<'kyc' | 'dashboard'>('kyc');
  const [supabaseModalTab, setSupabaseModalTab] = useState<'config' | 'migration1' | 'migration2'>('config');
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
  const supabaseStatus = getSupabaseConfigStatus();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('customerView') === 'loans') {
      setActivePortal('customer');
      setCustomerView('loans');
    }
  }, [setActivePortal, setCustomerView]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(id);
    setTimeout(() => setCopiedSql(null), 2000);
  };

  const handleCustomerLogout = async () => {
    await signOut();
    logoutCustomer();
  };


  return (
    <div className="min-h-screen flex flex-col bg-[#F5F7FA] text-[#101C2C]">
      {/* Institutional Top Control & Navigation Strip */}
      <header className="bg-[#101C2C] text-white border-b border-slate-800 sticky top-0 z-40 select-none">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Brand Identity & Active System Tag */}
          <div className="flex items-center gap-3">
            <BrandLogo variant="light" size="sm" />
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs text-slate-400">
              <span className="text-[#D6A85F] font-medium font-mono">{brand.cbkLicenseNumber}</span>
              <span>•</span>
              <span className="text-slate-300">Central Bank of Kenya DCP</span>
            </div>
          </div>

          {/* Center: Portal Mode Switcher (Customer PWA vs Staff Operations) */}
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800">
            <button
              onClick={() => setActivePortal('customer')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activePortal === 'customer'
                  ? 'bg-[#167D78] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Customer Portal</span>
            </button>

            <button
              onClick={() => setActivePortal('staff')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activePortal === 'staff'
                  ? 'bg-[#167D78] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Staff Operations</span>
            </button>
          </div>

          {/* Right: Persona Testing, White-Label Selector & Reference Spec Viewer */}
          <div className="flex items-center gap-2">
            {/* Customer Auth & Persona Testing controls (if in Customer Portal) */}
            {activePortal === 'customer' && !isConfigured && (
              <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
                {authSession.isAuthenticated ? (
                  <>
                    <button
                      onClick={() => switchCustomerPersona('complete')}
                      className="px-2 py-1 rounded text-[11px] text-slate-300 hover:text-white"
                      title="Load Jane Muthoni (Verified Tier 1 Borrower)"
                    >
                      Jane (100% KYC)
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                      onClick={() => switchCustomerPersona('new')}
                      className="px-2 py-1 rounded text-[11px] text-slate-300 hover:text-white"
                      title="Load Brian Kipkorir (New Registrant, 20% KYC)"
                    >
                      New (20% KYC)
                    </button>
                    <span className="text-slate-700">|</span>
                    <button
                      onClick={handleCustomerLogout}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Sign Out to test Registration & Login"
                    >
                      <LogOut className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => switchCustomerPersona('complete')}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-emerald-400 font-semibold"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Quick Sign In</span>
                  </button>
                )}
              </div>
            )}

            {/* Toggle Phone Frame Mockup vs Responsive Width */}
            {activePortal === 'customer' && (
              <button
                onClick={() => setPreviewDeviceFrame(!previewDeviceFrame)}
                className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  previewDeviceFrame
                    ? 'bg-slate-800 text-[#D6A85F] border-slate-700'
                    : 'text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Toggle Phone Frame Simulation"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{previewDeviceFrame ? 'Frame' : 'Fluid'}</span>
              </button>
            )}

            {/* White-label Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowBrandMenu(!showBrandMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#D6A85F]" />
                <span className="hidden xl:inline truncate max-w-[110px]">{brand.shortName}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showBrandMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs text-[#101C2C]">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="font-bold text-[#101C2C]">White-Label Configurator</p>
                    <p className="text-[10px] text-slate-500">
                      Switch institution branding live without rebuilding.
                    </p>
                  </div>
                  <div className="py-1">
                    {Object.entries(BRAND_PRESETS).map(([k, p]) => (
                      <button
                        key={k}
                        onClick={() => {
                          setBrandPreset(k);
                          setShowBrandMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${
                          brand.institutionName === p.institutionName
                            ? 'bg-[#E7F3F2] text-[#167D78] font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-semibold">{p.institutionName}</p>
                          <p className="text-[10px] text-slate-400">{p.cbkLicenseNumber}</p>
                        </div>
                        {brand.institutionName === p.institutionName && (
                          <CheckCircle2 className="w-4 h-4 text-[#167D78]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Supabase Status Pill */}
            <button
              onClick={() => setShowSupabaseModal(true)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isConfigured
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/80 hover:bg-emerald-900/50'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/80 hover:bg-amber-900/50'
              }`}
              title="Click to view Supabase Connection & Configuration Status"
            >
              <Database className="w-3.5 h-3.5 text-[#167D78]" />
              <span className="hidden sm:inline font-mono text-[11px]">
                {isConfigured ? 'Supabase Live' : 'Supabase Config'}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </button>

            {/* View Attached Reference Specs Button */}
            <button
              onClick={() => setShowReferenceModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-slate-700/80 flex items-center gap-1 cursor-pointer"
              title="View Authoritative Design Specification Images"
            >
              <Eye className="w-3.5 h-3.5 text-[#167D78]" />
              <span className="hidden sm:inline">Design Specs</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Portals Viewport */}
      <main className="flex-1 w-full">
        {activePortal === 'customer' ? (
          <CustomerLayout />
        ) : (
          <ProtectedRoute
            requiredUserType="staff"
            fallback={<StaffLoginView onSuccess={() => {}} />}
          >
            <StaffMfaGate><StaffLayout /></StaffMfaGate>
          </ProtectedRoute>
        )}
      </main>

      {/* Institutional Bottom Banner (Exact match to reference image footer) */}
      <footer className="bg-[#101C2C] text-white border-t border-slate-800 py-3.5 px-4 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 bg-[#167D78] rounded-full" />
            <span className="font-bold tracking-tight text-sm">
              A complete, configurable lending platform for Kenya
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-300 flex-wrap justify-center text-[11px]">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#167D78]" />
              <span>All Loan Types</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#167D78]" />
              <span>Flexible Interest Rates</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#167D78]" />
              <span>M-Pesa Integration</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#167D78]" />
              <span>Real-time Insights</span>
            </span>
          </div>

          <div className="px-3 py-1 bg-[#D6A85F] text-[#101C2C] font-extrabold rounded-lg text-xs">
            Built for Growth
          </div>
        </div>
      </footer>

      {/* Design Reference Inspection Modal (Showing both specs) */}
      <Modal
        isOpen={showReferenceModal}
        onClose={() => setShowReferenceModal(false)}
        title="Authoritative Visual Specifications"
        subtitle="Referenced from user design attachments"
        maxWidth="xl"
      >
        <div className="space-y-4">
          {/* Reference tabs */}
          <div className="flex gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setReferenceTab('kyc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                referenceTab === 'kyc'
                  ? 'bg-[#167D78] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              1. KYC Verification Flow Spec (image_cbdc19ed.png)
            </button>
            <button
              onClick={() => setReferenceTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                referenceTab === 'dashboard'
                  ? 'bg-[#167D78] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              2. Dashboard & Portals Spec
            </button>
          </div>

          {referenceTab === 'kyc' ? (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 relative">
              <Image
                src="/assets/aistudio/image_cbdc19ed.png"
                alt="KYC Verification Specification"
                width={1200}
                height={800}
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain max-h-[65vh]"
              />
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 relative">
              <Image
                src="/assets/aistudio/Modern_Kenyan_Lending_Platform_Dashboard_06a78fe8.png"
                alt="Authoritative Visual Specification"
                width={1200}
                height={800}
                referrerPolicy="no-referrer"
                className="w-full h-auto object-contain max-h-[65vh]"
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block font-sans">Midnight Navy</span>
              <span className="font-bold text-[#101C2C]">#101C2C</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block font-sans">Teal</span>
              <span className="font-bold text-[#167D78]">#167D78</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block font-sans">Muted Gold</span>
              <span className="font-bold text-[#D6A85F]">#D6A85F</span>
            </div>
            <div className="p-2 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block font-sans">Currency</span>
              <span className="font-bold text-[#101C2C]">KES (Kenya)</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Supabase Backend Integration & Diagnostics Modal */}
      <Modal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
        title="Supabase Modern API Key Architecture & Backend Status"
        subtitle="Supporting modern Publishable & Secret keys per Supabase official specifications"
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs text-slate-700">
          {/* Modal Navigation Tabs */}
          <div className="flex border-b border-slate-200 gap-1.5 pb-2">
            <button
              onClick={() => setSupabaseModalTab('config')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                supabaseModalTab === 'config'
                  ? 'bg-[#167D78] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              1. Keys & Status
            </button>
            <button
              onClick={() => setSupabaseModalTab('migration1')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                supabaseModalTab === 'migration1'
                  ? 'bg-[#167D78] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Foundation & Access</span>
            </button>
            <button
              onClick={() => setSupabaseModalTab('migration2')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                supabaseModalTab === 'migration2'
                  ? 'bg-[#167D78] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Payments & Ledger</span>
            </button>
          </div>

          {supabaseModalTab === 'config' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm text-[#101C2C]">
                      {isConfigured ? 'Supabase Backend Connected' : 'Supabase Configuration Pending'}
                    </p>
                    {isConfigured && (
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          supabaseStatus.keyType === 'publishable'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {supabaseStatus.keyType === 'publishable'
                          ? 'Modern Publishable Key'
                          : 'Legacy JWT Anon Key'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">{supabaseStatus.message}</p>
                </div>
              </div>

              {/* Key Migration Notice */}
              <div className="p-3 bg-slate-900 text-slate-200 rounded-xl space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-[#D6A85F] font-bold font-sans">
                  <span>Supabase API Key Migration (Official Specification)</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-800 rounded">v2.49+ Standard</span>
                </div>
                <p className="text-slate-300 font-sans text-[11px]">
                  Supabase replaced legacy long-lived JWT keys with dedicated prefixes:
                </p>
                <ul className="space-y-1 text-[10px] pt-1 text-slate-300">
                  <li className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">1. Publishable Key:</span>
                    <span>Prefix <code className="text-emerald-300 bg-slate-800 px-1 py-0.5 rounded">sb_publishable_...</code> — Safe in browser with RLS.</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-rose-400 font-bold">2. Secret Key:</span>
                    <span>Prefix <code className="text-rose-300 bg-slate-800 px-1 py-0.5 rounded">sb_secret_...</code> — Privileged server-only access (bypasses RLS).</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#101C2C]">Client Environment Variables</h4>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {/* Project URL */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">NEXT_PUBLIC_SUPABASE_URL</span>
                      <p className="text-[10px] text-slate-500 font-sans">
                        {supabaseStatus.url || 'https://dktbguaggounkorfodcp.supabase.co (e.g. your project ref)'}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isConfigured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isConfigured ? 'Active' : 'Setup Required'}
                    </span>
                  </div>

                  {/* Modern Publishable Key */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#E7F3F2] text-[#167D78] font-bold">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-sans">
                        {supabaseStatus.hasKey
                          ? `${supabaseStatus.keyPreview} (${supabaseStatus.keyType === 'publishable' ? 'sb_publishable_' : 'legacy format'})`
                          : 'Missing — paste key starting with sb_publishable_'}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        supabaseStatus.hasKey ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {supabaseStatus.hasKey ? 'Connected' : 'Missing'}
                    </span>
                  </div>

                  {/* Legacy fallback indicator */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-600">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 text-slate-600 font-medium">
                          Legacy Fallback
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-sans">
                        Supported for backward compatibility if project has not yet created publishable keys.
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">Supported</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#E7F3F2] rounded-2xl border border-[#BCE1DF] text-[11px] text-[#167D78] space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Security Architecture Invariant
                </p>
                <p className="text-slate-600">
                  Only publishable keys (<code className="text-[#167D78] font-bold">sb_publishable_...</code>) or anon keys are bundled in client-side code. Secret keys (<code className="text-slate-800 font-bold">sb_secret_...</code>) are strictly confined to server-side tasks.
                </p>
              </div>
            </div>
          )}

          {supabaseModalTab === 'migration1' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#101C2C]">Backend Foundation: Identity, Access & Credit Lifecycle</h4>
                  <p className="text-[11px] text-slate-500">
                    Ordered migrations establish tenant isolation, multi-role RBAC, customers, KYC, documents, audit events, applications, approvals, contracts and schedules.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(SQL_MIGRATION_1, 'mig1')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#167D78] hover:bg-[#126561] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    {copiedSql === 'mig1' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql === 'mig1' ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                  <a
                    href="https://supabase.com/dashboard/project/dktbguaggounkorfodcp/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open SQL Editor</span>
                  </a>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] max-h-72 overflow-y-auto border border-slate-800">
                <pre>{SQL_MIGRATION_1}</pre>
              </div>
            </div>
          )}

          {supabaseModalTab === 'migration2' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-[#101C2C]">Payments, Providers & Financial Ledger</h4>
                  <p className="text-[11px] text-slate-500">
                    Supports server-side Daraja, PayHero and Finoq routing records, provider callbacks, disbursements, allocations, reversals, private Storage and double-entry journals.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(SQL_MIGRATION_2, 'mig2')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#167D78] hover:bg-[#126561] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    {copiedSql === 'mig2' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSql === 'mig2' ? 'Copied!' : 'Copy SQL'}</span>
                  </button>
                  <a
                    href="https://supabase.com/dashboard/project/dktbguaggounkorfodcp/sql/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open SQL Editor</span>
                  </a>
                </div>
              </div>

              <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] max-h-72 overflow-y-auto border border-slate-800">
                <pre>{SQL_MIGRATION_2}</pre>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setShowSupabaseModal(false)}
              className="px-4 py-2 bg-[#101C2C] text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </Modal>
    </div>
  );
}
