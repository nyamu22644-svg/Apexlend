'use client';

import React, { useEffect, useState } from 'react';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { BRAND_PRESETS } from '@/lib/brand-config';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { PolicySettingsCards } from './PolicySettingsCards';
import {
  Building,
  ShieldCheck,
  Phone,
  Sliders,
  CreditCard,
  Send,
  Smartphone,
  Mail,
  Users,
  AlertTriangle,
  Lock,
  Archive,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Save,
  Key,
  Globe,
  Radio,
} from 'lucide-react';

export function BrandingConfigView() {
  const { brand, updateBrand, setBrandPreset, staffRole } = useBrand();
  const { session, profile } = useAuth();
  const [activeSection, setActiveSection] = useState<string>('branding');
  const [isSavedToast, setIsSavedToast] = useState(false);
  const [revealSecrets, setRevealSecrets] = useState<Record<string, boolean>>({});

  // Credentials belong only in server-side configuration. These are empty demo placeholders.
  const [configs, setConfigs] = useState({
    // Daraja B2C
    darajaConsumerKey: '',
    darajaConsumerSecret: '',
    darajaPasskey: '',
    darajaB2cShortcode: '',
    // Daraja C2B
    darajaC2bValidationUrl: '',
    darajaC2bConfirmationUrl: '',
    // Bank EFT
    bankApiEndpoint: '',
    bankApiKey: '',
    // SMS
    smsProvider: 'AfricasTalking Kenya',
    smsSenderId: 'CREDIT-INFO',
    smsApiKey: '',
    // Email
    emailProvider: 'Resend / Brevo transactional',
    emailFrom: 'notifications@institution.co.ke',
    emailApiKey: '',
    // Workflows
    makerCheckerThreshold: 50000,
    maxDstiPercent: 40,
    // Collections
    statutoryNoticeDays: 60,
    // Security
    sessionTimeoutMins: 15,
    auditRetentionYears: 7,
  });

  const toggleSecret = (key: string) => {
    setRevealSecrets((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    if (!session?.access_token || !profile?.permissions.includes('settings.manage')) return;
    fetch('/api/staff/settings', { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((response) => response.json())
      .then((data) => { if (data.branding) updateBrand(data.branding); if (data.settings) setConfigs((current) => ({ ...current, ...data.settings })); })
      .catch(() => undefined);
  }, [session?.access_token, profile?.permissions]);

  const handleApplyPreset = (key: string) => {
    setBrandPreset(key);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2500);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    const { darajaConsumerKey, darajaConsumerSecret, darajaPasskey, bankApiKey, smsApiKey, emailApiKey, ...safeSettings } = configs;
    const response = await fetch('/api/staff/settings', { method: 'PUT', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ branding: brand, settings: safeSettings }) });
    if (response.ok) { setIsSavedToast(true); setTimeout(() => setIsSavedToast(false), 3000); }
  };

  const sections = [
    { id: 'branding', label: '1. Institution Branding & Colors', icon: <Building className="w-4 h-4" /> },
    { id: 'regulatory', label: '2. CBK Regulatory Compliance', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'contact', label: '3. Contact & Headquarters', icon: <Phone className="w-4 h-4" /> },
    { id: 'loans', label: '4. Loan Policy & Default Thresholds', icon: <Sliders className="w-4 h-4" /> },
    { id: 'channels', label: '5. Payment Channels & Paybill', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'workflows', label: '6. Staff Approval Checks', icon: <Users className="w-4 h-4" /> },
    { id: 'collections_rules', label: '7. Overdue Payment Rules', icon: <AlertTriangle className="w-4 h-4" /> },
    { id: 'security', label: '8. Security & Record Keeping', icon: <Lock className="w-4 h-4" /> },
  ];
  const guidance: Record<string, string> = {
    branding: 'What borrowers see: use your registered name, short name, colours, and a simple promise you can stand behind.',
    regulatory: 'Your legal identity: enter details exactly as they appear on your licence. These details appear on documents customers receive.',
    contact: 'Where customers can reach a real person: use an address, phone number, and email your team checks regularly.',
    loans: 'How lending limits work: these controls help decide how much a customer may borrow and how loan changes are handled.',
    channels: 'How money is identified: set the public paybill and reference format customers use when paying you.',
    daraja_b2c: 'How you send loan money out: identify the approved disbursement channel. Never paste a secret key into a shared browser.',
    daraja_c2b: 'How incoming payments reach the system: confirm callback addresses with your payment provider before going live.',
    bank_eft: 'Bank payouts: use this only after your bank has supplied and tested its integration details.',
    sms_gateway: 'Text messages: choose the provider and sender name customers should recognise on repayment reminders and notices.',
    email_gateway: 'Email messages: use a company address customers can reply to for statements and verification messages.',
    workflows: 'Four-eyes checks: decide the amount above which one staff member prepares a decision and another person must approve it.',
    collections_rules: 'Overdue repayments: choose how long customers have to respond before a formal demand process begins. Get legal approval before changing this.',
    security: 'Keeping records safe: choose when idle staff are signed out and how long audited records are kept. Confirm legal retention requirements first.',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#101C2C] tracking-tight">System Settings & Infrastructure</h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure white-label branding, payment gateways, regulatory disclosures, and operational parameters.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">8 simple sections</span>
          <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Server configuration required
          </span>
        </div>
      </div>

      {/* Toast Alert */}
      {isSavedToast && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-[#167D78] text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Settings saved. Updated tokens and parameters propagated across the platform.</span>
        </div>
      )}

      {/* Instant White-Label Preset Switcher */}
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-slate-700 space-y-1">
        <p className="font-bold text-[#167D78]">Plain-language guide</p>
        <p>Start with your public identity and borrower contact details. Next set lending and collections rules. Payment and messaging sections identify where a connection is used; passwords, API keys, and provider secrets are never saved in this browser or shown back to staff.</p>
      </div>
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#101C2C] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#D6A85F]" />
            Instant Institution White-Label Presets
          </h3>
          <span className="text-[11px] text-slate-400">Click to re-skin platform live</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(BRAND_PRESETS).map(([key, preset]) => {
            const isSelected = brand.institutionName === preset.institutionName;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleApplyPreset(key)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#167D78] bg-teal-50/50 ring-2 ring-[#167D78]/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#101C2C]">{preset.institutionName}</span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-[#167D78]" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{preset.tagline}</p>
                <div className="mt-2 text-[10px] font-mono text-slate-400">
                  {preset.cbkLicenseNumber} · Paybill: {preset.mpesaPaybill}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Layout: Left Nav + Right Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-3 space-y-1 h-fit">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Configuration Sections
          </div>
          {sections.map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                activeSection === sec.id
                  ? 'bg-[#167D78] text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {sec.icon}
              <span className="truncate">{sec.label}</span>
            </button>
          ))}
        </div>

        {/* Section Detail Form */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <form onSubmit={handleSave} className="space-y-5 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 leading-relaxed"><span className="font-bold text-[#101C2C]">Before you change this:</span> {guidance[activeSection]}</div>
            {/* Section 1: Branding */}
            {activeSection === 'branding' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#167D78]" />
                  Institution Branding & Visual Tokens
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Institution Legal Name</label>
                    <input
                      type="text"
                      value={brand.institutionName}
                      onChange={(e) => updateBrand({ institutionName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Short Brand Name</label>
                    <input
                      type="text"
                      value={brand.shortName}
                      onChange={(e) => updateBrand({ shortName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Brand Tagline / Value Proposition</label>
                  <input
                    type="text"
                    value={brand.tagline}
                    onChange={(e) => updateBrand({ tagline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Primary Color (Teal)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brand.primaryColor}
                        onChange={(e) => updateBrand({ primaryColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                      />
                      <span className="font-mono text-[11px]">{brand.primaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Secondary (Navy)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brand.secondaryColor}
                        onChange={(e) => updateBrand({ secondaryColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                      />
                      <span className="font-mono text-[11px]">{brand.secondaryColor}</span>
                    </div>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Accent (Gold)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brand.accentColor}
                        onChange={(e) => updateBrand({ accentColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200"
                      />
                      <span className="font-mono text-[11px]">{brand.accentColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section 2: Regulatory */}
            {activeSection === 'regulatory' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#167D78]" />
                  Central Bank of Kenya (CBK) Regulatory Identifiers
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">CBK License Number</label>
                    <input
                      type="text"
                      value={brand.cbkLicenseNumber}
                      onChange={(e) => updateBrand({ cbkLicenseNumber: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Regulatory Supervisory Authority</label>
                    <input
                      type="text"
                      value={brand.regulatoryBody}
                      onChange={(e) => updateBrand({ regulatoryBody: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Compliant with the Digital Credit Providers Regulations 2022. License details are displayed in borrower contracts, statements, and footers.
                </p>
              </div>
            )}

            {/* Section 3: Contact */}
            {activeSection === 'contact' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#167D78]" />
                  Contact Information & Physical Headquarters
                </h3>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Physical Address / Head Office</label>
                  <input
                    type="text"
                    value={brand.physicalAddress}
                    onChange={(e) => updateBrand({ physicalAddress: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Customer Support Phone</label>
                    <input
                      type="text"
                      value={brand.supportPhone}
                      onChange={(e) => updateBrand({ supportPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Official Support Email</label>
                    <input
                      type="email"
                      value={brand.supportEmail}
                      onChange={(e) => updateBrand({ supportEmail: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Loan Defaults */}
            {activeSection === 'loans' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#167D78]" />
                  Institution-wide Loan Defaults & Limits
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Max Debt Service-to-Income (DSTI %)</label>
                    <input
                      type="number"
                      value={configs.maxDstiPercent}
                      onChange={(e) => setConfigs({ ...configs, maxDstiPercent: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Base Currency</label>
                    <input
                      type="text"
                      disabled
                      value={brand.currency}
                      className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-500"
                    />
                  </div>
                </div>
                <PolicySettingsCards />
              </div>
            )}

            {/* Section 5: Channels */}
            {activeSection === 'channels' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-[#167D78]" />
                  Payment Channels & M-Pesa Shortcodes
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">M-Pesa Paybill Number</label>
                    <input
                      type="text"
                      value={brand.mpesaPaybill}
                      onChange={(e) => updateBrand({ mpesaPaybill: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-[#101C2C] focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Account Prefix / Identifier</label>
                    <input
                      type="text"
                      value={brand.mpesaAccountPrefix}
                      onChange={(e) => updateBrand({ mpesaAccountPrefix: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">USSD Shortcode Portal</label>
                    <input
                      type="text"
                      value={brand.ussdCode}
                      onChange={(e) => updateBrand({ ussdCode: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-emerald-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 6: Daraja B2C */}
            {activeSection === 'daraja_b2c' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Send className="w-4 h-4 text-[#167D78]" />
                  Safaricom Daraja API — B2C Disbursement Gateway
                </h3>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">B2C Initiator Shortcode</label>
                  <input
                    type="text"
                    value={configs.darajaB2cShortcode}
                    onChange={(e) => setConfigs({ ...configs, darajaB2cShortcode: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Consumer Key (API Secret)</label>
                  <div className="relative">
                    <input
                      type={revealSecrets['b2cKey'] ? 'text' : 'password'}
                      value={configs.darajaConsumerKey}
                      onChange={(e) => setConfigs({ ...configs, darajaConsumerKey: e.target.value })}
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret('b2cKey')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {revealSecrets['b2cKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Consumer Secret</label>
                  <div className="relative">
                    <input
                      type={revealSecrets['b2cSecret'] ? 'text' : 'password'}
                      value={configs.darajaConsumerSecret}
                      onChange={(e) => setConfigs({ ...configs, darajaConsumerSecret: e.target.value })}
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret('b2cSecret')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {revealSecrets['b2cSecret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 7: Daraja C2B */}
            {activeSection === 'daraja_c2b' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#167D78]" />
                  Safaricom Daraja API — C2B & STK Push Callbacks
                </h3>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">C2B Validation IPN Endpoint</label>
                  <input
                    type="text"
                    value={configs.darajaC2bValidationUrl}
                    onChange={(e) => setConfigs({ ...configs, darajaC2bValidationUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">C2B Confirmation IPN Endpoint</label>
                  <input
                    type="text"
                    value={configs.darajaC2bConfirmationUrl}
                    onChange={(e) => setConfigs({ ...configs, darajaC2bConfirmationUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                </div>
              </div>
            )}

            {/* Section 8: Bank EFT */}
            {activeSection === 'bank_eft' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Building className="w-4 h-4 text-[#167D78]" />
                  Commercial Bank EFT & PesaLink Real-Time Payouts
                </h3>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Bank Clearing Switch Endpoint</label>
                  <input
                    type="text"
                    value={configs.bankApiEndpoint}
                    onChange={(e) => setConfigs({ ...configs, bankApiEndpoint: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Clearing Secret / API Token</label>
                  <div className="relative">
                    <input
                      type={revealSecrets['bankKey'] ? 'text' : 'password'}
                      value={configs.bankApiKey}
                      onChange={(e) => setConfigs({ ...configs, bankApiKey: e.target.value })}
                      className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                    <button
                      type="button"
                      onClick={() => toggleSecret('bankKey')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {revealSecrets['bankKey'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Section 9: SMS Gateway */}
            {activeSection === 'sms_gateway' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#167D78]" />
                  SMS Notification Gateway (Borrower Disclosures & Reminders)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">SMS Aggregator Provider</label>
                    <input
                      type="text"
                      value={configs.smsProvider}
                      onChange={(e) => setConfigs({ ...configs, smsProvider: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Approved Alphanumeric Sender ID</label>
                    <input
                      type="text"
                      value={configs.smsSenderId}
                      onChange={(e) => setConfigs({ ...configs, smsSenderId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 10: Email Gateway */}
            {activeSection === 'email_gateway' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#167D78]" />
                  Email Provider (Statements & Verification)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Default From Address</label>
                    <input
                      type="email"
                      value={configs.emailFrom}
                      onChange={(e) => setConfigs({ ...configs, emailFrom: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">DKIM & SPF Status</label>
                    <input
                      type="text"
                      disabled
                      value="Verified / Pass (100% deliverability)"
                      className="w-full px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Section 11: Workflows */}
            {activeSection === 'workflows' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#167D78]" />
                  Maker-Checker Dual Approval Thresholds
                </h3>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Single Underwriter Approval Ceiling (KES)</label>
                  <input
                    type="number"
                    value={configs.makerCheckerThreshold}
                    onChange={(e) => setConfigs({ ...configs, makerCheckerThreshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-bold text-[#101C2C] focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Applications above this threshold strictly require checker approval before queuing for disbursement.
                  </p>
                </div>
              </div>
            )}

            {/* Section 12: Collections Rules */}
            {activeSection === 'collections_rules' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#167D78]" />
                  Delinquency Remediation & Statutory Notice Policy
                </h3>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Statutory Demand Notice Period (Days)</label>
                  <input
                    type="number"
                    value={configs.statutoryNoticeDays}
                    onChange={(e) => setConfigs({ ...configs, statutoryNoticeDays: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Minimum formal written notice before credit reference bureau reporting or asset recovery under CBK guidelines.
                  </p>
                </div>
              </div>
            )}

            {/* Section 13: Security & Audit Retention */}
            {activeSection === 'security' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#101C2C] pb-2 border-b border-slate-100 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#167D78]" />
                  Security Governance & Immutable Audit Retention
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Staff Inactivity Timeout (Minutes)</label>
                    <input
                      type="number"
                      value={configs.sessionTimeoutMins}
                      onChange={(e) => setConfigs({ ...configs, sessionTimeoutMins: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Statutory Audit Retention (Years)</label>
                    <input
                      type="number"
                      value={configs.auditRetentionYears}
                      onChange={(e) => setConfigs({ ...configs, auditRetentionYears: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Enforces Kenya Data Protection Act 2019 and CBK Prudential Guidelines. Immutable append-only write logs are maintained for 7 years.
                </p>
              </div>
            )}

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#167D78] hover:bg-[#126460] text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                <Save className="w-4 h-4" />
                Save & Apply Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
