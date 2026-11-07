'use client';

import React, { useState, useEffect } from 'react';
import { useBrand } from '@/lib/brand-context';
import { useAuth } from '@/lib/auth-context';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { MIN_PASSWORD_LENGTH, PASSWORD_REQUIREMENTS, getPasswordRequirementChecks, passwordMeetsRequirements } from '@/lib/password-policy';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  KeyRound,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export function CustomerAuthView() {
  const {
    brand,
    authSession,
    setAuthSession,
    loginCustomer,
    registerCustomer,
    verifyCustomerEmail,
    resendVerificationEmail,
    sendPasswordResetLink,
    switchCustomerPersona,
  } = useBrand();

  const {
    signUpCustomer,
    signInCustomer,
    verifyEmailOtp,
    resendVerificationEmail: resendSupabaseOtp,
    requestPasswordReset,
    isConfigured,
    session,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'verify-email' | 'otp-login' | 'forgot-password'>(
    authSession.authView === 'verify-email' ? 'verify-email' : 'login'
  );

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [verificationCode, setVerificationCode] = useState(authSession.pendingEmailVerificationCode || '');
  const [otpLoginCode, setOtpLoginCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRequirementChecks = getPasswordRequirementChecks(password);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    if (isConfigured && mode === 'verify-email' && session?.user?.email) {
      loginCustomer(session.user.email);
    }
  }, [isConfigured, loginCustomer, mode, session?.user?.email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email.trim()) {
      setErrorMessage('Please enter your email address');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signInCustomer(email, password);
      if (res.success) {
        loginCustomer(email);
      } else {
        setErrorMessage(res.error || 'Failed to sign in. Please verify your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected login error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!fullName.trim()) {
      setErrorMessage('Please provide your full legal name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    if (!passwordMeetsRequirements(password)) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters and include uppercase, lowercase, a number, and a special character`);
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }
    if (!termsAccepted) {
      setErrorMessage('Please accept the customer terms and CBK privacy policy');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signUpCustomer(email, password, fullName);
      if (res.success) {
        const registrationEmail = email.trim().toLowerCase();
        if (!isConfigured) {
          registerCustomer(fullName, registrationEmail);
        } else {
          // Keep the confirmation view tied to the account just created, rather
          // than to the BrandContext's demo customer.
          setAuthSession({
            isAuthenticated: false,
            email: registrationEmail,
            fullName: fullName.trim(),
            emailConfirmed: false,
            authView: 'verify-email',
          });
        }
        setCooldown(30);
        setMode('verify-email');
      } else {
        setErrorMessage(res.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!verificationCode || verificationCode.length < 4) {
      setErrorMessage('Please enter the 6-digit confirmation code');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyEmailOtp(email, verificationCode);
      if (res.success) {
        verifyCustomerEmail(verificationCode);
      } else {
        setErrorMessage(res.error || 'Invalid or expired confirmation code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (cooldown > 0) return;
    setIsSubmitting(true);
    try {
      await resendSupabaseOtp(email);
      if (!isConfigured) await resendVerificationEmail();
      setCooldown(30);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend confirmation email');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    setOtpSent(true);
    setCooldown(30);
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpLoginCode || otpLoginCode.length < 4) {
      setErrorMessage('Please enter the 6-digit OTP code');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyEmailOtp(email, otpLoginCode);
      if (res.success) {
        loginCustomer(email);
      } else {
        setErrorMessage(res.error || 'Invalid OTP code.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'OTP login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await requestPasswordReset(email);
      if (res.success) {
        await sendPasswordResetLink(email);
        setResetSent(true);
      } else {
        setErrorMessage(res.error || 'Failed to request password reset');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Password reset request failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] mx-auto bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-5">
      {/* Brand Header */}
      <div className="text-center space-y-2 border-b border-slate-100 pb-4">
        <div className="flex justify-center">
          <BrandLogo variant="dark" size="md" />
        </div>
        <p className="text-xs text-slate-500 font-medium">{brand.tagline}</p>
        <span className="inline-block text-[10px] font-mono text-[#D6A85F] font-semibold bg-[#FAF4E9] px-2.5 py-0.5 rounded-full border border-[#F4E3C1]">
          {brand.cbkLicenseNumber} • Central Bank of Kenya
        </span>
      </div>

      {/* Demo personas are available only when Supabase authentication is not configured. */}
      {!isConfigured && <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
        <span className="font-semibold text-slate-600">Quick Test:</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => switchCustomerPersona('complete')}
            className="px-2 py-1 bg-white border border-slate-200 hover:border-[#167D78] rounded text-[11px] font-medium text-slate-800"
          >
            Jane (Verified)
          </button>
          <button
            type="button"
            onClick={() => switchCustomerPersona('new')}
            className="px-2 py-1 bg-white border border-slate-200 hover:border-[#167D78] rounded text-[11px] font-medium text-slate-800"
          >
            Brian (New 20%)
          </button>
        </div>
      </div>}

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* MODE 1: LOGIN */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#101C2C]">Sign in to your account</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Access your digital credit portfolio and repayment portal.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.ke"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setMode('forgot-password')}
                  className="text-[11px] text-[#167D78] hover:underline font-semibold"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <div className="pt-2 text-center space-y-2 border-t border-slate-100">
            {!isConfigured && <button
              type="button"
              onClick={() => setMode('otp-login')}
              className="text-xs text-slate-600 hover:text-[#167D78] font-medium flex items-center justify-center gap-1.5 mx-auto"
            >
              <KeyRound className="w-3.5 h-3.5" /><span>Sign in with Email OTP code instead</span>
            </button>}

            <p className="text-xs text-slate-500">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-[#167D78] font-bold hover:underline"
              >
                Create Account
              </button>
            </p>
          </div>
        </form>
      )}

      {/* MODE 2: REGISTER */}
      {mode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#101C2C]">Create customer account</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Email-first registration. Phone & identity details are collected progressively.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Jane Muthoni Kamau"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.ke"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  aria-describedby="registration-password-requirements"
                  placeholder="Create password"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  placeholder="Repeat password"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
              </div>
            </div>
            <ul id="registration-password-requirements" className="-mt-2 space-y-1 text-[11px]" aria-live="polite">
              {PASSWORD_REQUIREMENTS.map((requirement) => {
                const met = passwordRequirementChecks[requirement.key];
                return (
                  <li key={requirement.key} className={met ? 'text-emerald-700' : 'text-slate-500'}>
                    <span aria-hidden="true">{met ? '✓' : '○'}</span>{' '}{requirement.label}
                  </li>
                );
              })}
            </ul>

            <div className="pt-1">
              <label className="flex items-start gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 rounded text-[#167D78] focus:ring-[#167D78]"
                />
                <span className="text-slate-600 text-[11px] leading-tight">
                  I agree to the Digital Lending Agreement and acknowledge the Central Bank of Kenya Consumer Privacy Disclosures.
                </span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          <p className="text-xs text-center text-slate-500 pt-1">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-[#167D78] font-bold hover:underline"
            >
              Sign In
            </button>
          </p>
        </form>
      )}

      {/* MODE 3: EMAIL VERIFICATION */}
      {mode === 'verify-email' && (
        <form onSubmit={handleVerifyEmail} className="space-y-4">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 rounded-full bg-[#E7F3F2] text-[#167D78] flex items-center justify-center mx-auto mb-2">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-[#101C2C]">Check your email</h3>
            <p className="text-xs text-slate-500">
              {isConfigured ? 'Open the confirmation link sent to ' : 'We sent a verification code to '}<span className="font-semibold text-slate-800">{email || authSession.email}</span>{isConfigured ? '. This page will continue automatically after confirmation.' : '.'}
            </p>
          </div>

          {/* Dev Mode Notification Preview Box */}
          {!isConfigured && <div className="bg-[#FAF4E9] p-3 rounded-xl border border-[#F4E3C1] text-xs font-mono space-y-1">
            <div className="flex items-center justify-between text-slate-700 font-sans">
              <span className="font-semibold text-[11px]">Development Mode Delivery:</span>
              <span className="text-[10px] text-[#B7791F]">Provider: Resend / Brevo</span>
            </div>
            <p className="text-[11px] text-slate-600">
              Verification Code:{' '}
              <span className="font-bold text-[#167D78] tracking-widest text-sm">
                {authSession.pendingEmailVerificationCode || '829104'}
              </span>
            </p>
          </div>}

          {!isConfigured && <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 text-center">
              Enter 6-Digit Email Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="••••••"
              className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-mono font-bold tracking-[0.4em] text-[#101C2C] focus:outline-none focus:ring-2 focus:ring-[#167D78]"
            />
          </div>}

          {!isConfigured && <button
            type="submit"
            className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm Email & Continue</span>
          </button>}

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={handleResendEmail}
              className="text-[#167D78] font-medium hover:underline disabled:opacity-50"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : isConfigured ? 'Resend confirmation link' : 'Resend Code'}
            </button>
            <button
              type="button"
              onClick={() => setMode('login')}
              className="text-slate-500 hover:text-slate-800"
            >
              Back to Sign In
            </button>
          </div>
        </form>
      )}

      {/* MODE 4: OTP LOGIN */}
      {mode === 'otp-login' && (
        <form onSubmit={otpSent ? handleOtpLogin : handleRequestOtp} className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#101C2C]">Sign in with One-Time Code</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Receive a secure one-time code on your registered email address.
            </p>
          </div>

          {!otpSent ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.ke"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-[#E7F3F2] rounded-xl text-xs text-[#167D78] font-mono">
                OTP dispatched to {email}. Demo code: <span className="font-bold">492019</span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                  Enter 6-Digit OTP Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpLoginCode}
                  onChange={(e) => setOtpLoginCode(e.target.value)}
                  placeholder="••••••"
                  className="w-full py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-mono font-bold tracking-[0.4em] text-[#101C2C] focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{otpSent ? 'Verify & Sign In' : 'Send One-Time Code'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('login')}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800"
          >
            Back to Password Login
          </button>
        </form>
      )}

      {/* MODE 5: FORGOT PASSWORD */}
      {mode === 'forgot-password' && (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <h3 className="text-lg font-bold text-[#101C2C]">Recover your account</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your email address and we will dispatch a secure password reset link.
            </p>
          </div>

          {resetSent ? (
            <div className="p-4 bg-[#E7F3F2] rounded-2xl text-xs text-[#167D78] space-y-2">
              <p className="font-bold">Password Reset Dispatched!</p>
              <p className="text-slate-600">
                If an account exists for {email}, instructions have been routed via transactional mailer.
              </p>
              <button
                type="button"
                onClick={() => setMode('login')}
                className="pt-1 font-bold text-[#167D78] hover:underline block"
              >
                Return to Sign In →
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.ke"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#167D78]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#167D78] hover:bg-[#126561] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Send Password Reset Email
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800"
              >
                Back to Sign In
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
