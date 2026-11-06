'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getSupabaseConfigStatus } from './supabase/client';
import { UserRole } from './types/lending';

export interface UserProfile {
  id: string;
  institutionId: string;
  userType: 'customer' | 'staff';
  email: string;
  fullName: string;
  phoneNumber?: string;
  isSuspended: boolean;
  suspensionReason?: string;
  // Staff operational properties (when userType === 'staff')
  role?: UserRole;
  department?: string;
  employeeNumber?: string;
  approvalLimitAmount?: number;
  permissions: string[];
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isConfigured: boolean;
  error: string | null;
  clearError: () => void;
  // Customer Auth
  signUpCustomer: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ) => Promise<{ success: boolean; error?: string; requiresEmailConfirmation?: boolean }>;
  signInCustomer: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  verifyEmailOtp: (
    email: string,
    token: string
  ) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: (
    email: string
  ) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (
    email: string
  ) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (
    newPassword: string
  ) => Promise<{ success: boolean; error?: string }>;
  // Staff Auth (strict authorization)
  signInStaff: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; profile?: UserProfile }>;
  // Global
  signOut: () => Promise<void>;
  // Dev Helper: Simulate persona switch for local testing if unconfigured
  simulateMockUser: (type: 'customer-verified' | 'customer-new' | 'staff-admin') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isConfigured = isSupabaseConfigured();

  const clearError = useCallback(() => setError(null), []);

  // Fetch the authenticated user's access record. Role and permission calculation happens
  // in Postgres, never in browser-controlled metadata or UI state.
  const fetchProfile = useCallback(async (userId: string, userEmail: string): Promise<UserProfile | null> => {
    if (!isConfigured) return null;

    try {
      const { data, error: accessError } = await supabase.rpc('get_my_access');
      if (accessError) throw accessError;

      const access = data?.[0];
      if (!access || access.profile_id !== userId) return null;

      const roleCodes = Array.isArray(access.role_codes) ? access.role_codes : [];
      const supportedRoles: UserRole[] = [
        'super_admin', 'admin', 'operations_manager', 'kyc_officer', 'credit_officer', 'loan_approver',
        'disbursement_officer', 'disbursement_preparer', 'disbursement_approver', 'finance_officer', 'collections_agent', 'compliance_auditor', 'support_officer', 'product_settings_admin',
      ];
      const assignedRole = roleCodes.find((role: string): role is UserRole => supportedRoles.includes(role as UserRole));

      if (access.user_type === 'staff' && !assignedRole) return null;

      return {
        id: access.profile_id,
        institutionId: access.institution_id,
        userType: access.user_type as 'customer' | 'staff',
        email: access.email || userEmail,
        fullName: access.full_name,
        phoneNumber: access.phone_number || undefined,
        isSuspended: access.profile_status !== 'active',
        role: access.user_type === 'staff' ? assignedRole : 'customer',
        department: access.department || undefined,
        employeeNumber: access.employee_number || undefined,
        approvalLimitAmount: Number(access.approval_limit || 0),
        permissions: Array.isArray(access.permission_codes) ? access.permission_codes : [],
      };
    } catch (err: any) {
      console.error('Failed to resolve profile:', err);
      return null;
    }
  }, [isConfigured]);

  // Initialize session and attach auth change listener
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!isConfigured) {
        // When not configured, initialize with a safe default for development
        setIsLoading(false);
        return;
      }

      try {
        const { data: { session: initialSession }, error: sessionErr } = await supabase.auth.getSession();
        if (sessionErr) throw sessionErr;

        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          if (initialSession?.user) {
            const p = await fetchProfile(initialSession.user.id, initialSession.user.email ?? '');
            if (mounted) setProfile(p);
          }
        }
      } catch (err: any) {
        console.error('Auth initialization error:', err);
        if (mounted) setError(err.message || 'Failed to initialize session');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    // Supabase email-confirmation links may return with a PKCE code. Exchange it
    // once, then remove it from the address bar so it cannot be reused or copied.
    if (isConfigured && typeof window !== 'undefined') {
      const code = new URLSearchParams(window.location.search).get('code');
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
          if (exchangeError && mounted) setError(exchangeError.message);
          if (!exchangeError) window.history.replaceState({}, document.title, window.location.pathname);
        });
      }
    }

    // Listen for auth state changes
    if (isConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, newSession) => {
          if (!mounted) return;
          setSession(newSession);
          setUser(newSession?.user ?? null);

          if (event === 'SIGNED_IN' && newSession?.user) {
            const p = await fetchProfile(newSession.user.id, newSession.user.email ?? '');
            if (mounted) setProfile(p);
          } else if (event === 'SIGNED_OUT') {
            if (mounted) setProfile(null);
          } else if (event === 'PASSWORD_RECOVERY') {
            // Can trigger a recovery modal if needed
          }
        }
      );

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, [isConfigured, fetchProfile]);

  // Customer Registration
  const signUpCustomer = async (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string
  ) => {
    setError(null);
    if (!email || !password) {
      setError('Email and password are required');
      return { success: false, error: 'Email and password are required' };
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    if (!isConfigured) {
      // Local development simulation fallback when Supabase keys not yet configured
      const mockUser: UserProfile = {
        id: `usr-${Date.now()}`,
        institutionId: '00000000-0000-0000-0000-000000000001',
        userType: 'customer',
        email,
        fullName,
        phoneNumber,
        isSuspended: false,
        role: 'customer',
        permissions: [],
      };
      setProfile(mockUser);
      return { success: true, requiresEmailConfirmation: true };
    }

    try {
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            fullName,
            phone: phoneNumber,
            user_type: 'customer', // Explicitly note customer
          },
        },
      });

      if (signUpErr) {
        // Detect duplicate account
        if (
          signUpErr.message.toLowerCase().includes('already registered') ||
          signUpErr.status === 422
        ) {
          const msg = 'An account with this email address already exists. Please log in instead.';
          setError(msg);
          return { success: false, error: msg };
        }
        setError(signUpErr.message);
        return { success: false, error: signUpErr.message };
      }

      const requiresEmailConfirmation = !data.session;
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user.id, data.user.email ?? email);
        setProfile(p);
      }

      return { success: true, requiresEmailConfirmation };
    } catch (err: any) {
      const msg = err.message || 'Registration failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Customer Login
  const signInCustomer = async (email: string, password: string) => {
    setError(null);
    if (!email || !password) {
      const msg = 'Email and password are required';
      setError(msg);
      return { success: false, error: msg };
    }

    if (!isConfigured) {
      // Local fallback
      const mockUser: UserProfile = {
        id: 'cust-local-101',
        institutionId: '00000000-0000-0000-0000-000000000001',
        userType: 'customer',
        email,
        fullName: email.split('@')[0],
        isSuspended: false,
        role: 'customer',
        permissions: [],
      };
      setProfile(mockUser);
      return { success: true };
    }

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        let msg = signInErr.message;
        if (signInErr.message.includes('Invalid login credentials')) {
          msg = 'Invalid email or password. Please verify your credentials and try again.';
        } else if (signInErr.message.includes('Email not confirmed')) {
          msg = 'Please verify your email address before logging in.';
        }
        setError(msg);
        return { success: false, error: msg };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        const p = await fetchProfile(data.user.id, data.user.email ?? email);

        if (p?.isSuspended) {
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setProfile(null);
          const msg = `Account Suspended: ${p.suspensionReason || 'Please contact institutional compliance support.'}`;
          setError(msg);
          return { success: false, error: msg };
        }

        setProfile(p);
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Staff Login (Enforces staff role check and suspension verification)
  const signInStaff = async (email: string, password: string) => {
    setError(null);
    if (!email || !password) {
      const msg = 'Staff email and password are required';
      setError(msg);
      return { success: false, error: msg };
    }

    if (!isConfigured) {
      // Local fallback
      const mockStaff: UserProfile = {
        id: 'staff-local-01',
        institutionId: '00000000-0000-0000-0000-000000000001',
        userType: 'staff',
        email,
        fullName: 'Operations Administrator',
        isSuspended: false,
        role: 'super_admin',
        department: 'Operations',
        permissions: [],
      };
      setProfile(mockStaff);
      return { success: true, profile: mockStaff };
    }

    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInErr) {
        setError(signInErr.message);
        return { success: false, error: signInErr.message };
      }

      if (!data.user) {
        const msg = 'Authentication failed';
        setError(msg);
        return { success: false, error: msg };
      }

      // Fetch profile and strictly verify staff privilege
      const p = await fetchProfile(data.user.id, data.user.email ?? email);

      if (!p || p.userType !== 'staff') {
        // Security Invariant: Immediate rejection and sign-out if customer attempts staff portal login
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        const msg = 'Access Denied: This portal is strictly restricted to authorized institutional staff.';
        setError(msg);
        return { success: false, error: msg };
      }

      if (p.isSuspended) {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setProfile(null);
        const msg = `Account Suspended: ${p.suspensionReason || 'Your staff credentials have been deactivated by administrator.'}`;
        setError(msg);
        return { success: false, error: msg };
      }

      setUser(data.user);
      setSession(data.session);
      setProfile(p);
      return { success: true, profile: p };
    } catch (err: any) {
      const msg = err.message || 'Staff login failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Verify Email OTP
  const verifyEmailOtp = async (email: string, token: string) => {
    setError(null);
    if (!isConfigured) {
      return { success: true };
    }

    try {
      const { data, error: otpErr } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'signup',
      });

      if (otpErr) {
        setError(otpErr.message);
        return { success: false, error: otpErr.message };
      }

      if (data.session && data.user) {
        setSession(data.session);
        setUser(data.user);
        const p = await fetchProfile(data.user.id, data.user.email ?? email);
        setProfile(p);
      }

      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Verification failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Resend OTP
  const resendVerificationEmail = async (email: string) => {
    setError(null);
    if (!isConfigured) {
      return { success: true };
    }

    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (resendErr) {
        setError(resendErr.message);
        return { success: false, error: resendErr.message };
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to resend confirmation email';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Password Reset Request
  const requestPasswordReset = async (email: string) => {
    setError(null);
    if (!isConfigured) {
      return { success: true };
    }

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/callback?type=recovery`,
      });

      if (resetErr) {
        setError(resetErr.message);
        return { success: false, error: resetErr.message };
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to send password reset link';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Update Password
  const updatePassword = async (newPassword: string) => {
    setError(null);
    if (newPassword.length < 6) {
      const msg = 'Password must be at least 6 characters';
      setError(msg);
      return { success: false, error: msg };
    }

    if (!isConfigured) {
      return { success: true };
    }

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateErr) {
        setError(updateErr.message);
        return { success: false, error: updateErr.message };
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to update password';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  // Sign Out
  const signOut = async () => {
    // End the local portal session immediately. A network-dependent global
    // sign-out must not leave this browser authenticated or block navigation.
    setUser(null);
    setSession(null);
    setProfile(null);
    if (isConfigured) {
      try {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutError) console.error('Sign out error:', signOutError);
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
  };

  // Dev simulation helper for local test personas
  const simulateMockUser = (type: 'customer-verified' | 'customer-new' | 'staff-admin') => {
    if (type === 'customer-verified') {
      setProfile({
        id: 'cust-1001',
        institutionId: '00000000-0000-0000-0000-000000000001',
        userType: 'customer',
        email: 'jane.muthoni@example.ke',
        fullName: 'Jane Muthoni',
        phoneNumber: '0712 345 678',
        isSuspended: false,
        role: 'customer',
        permissions: [],
      });
    } else if (type === 'customer-new') {
      setProfile({
        id: `cust-new-${Date.now()}`,
        institutionId: '00000000-0000-0000-0000-000000000001',
        userType: 'customer',
        email: 'brian.kipkorir@example.ke',
        fullName: 'Brian Kipkorir',
        isSuspended: false,
        role: 'customer',
        permissions: [],
      });
    } else {
      setProfile({
        id: 'staff-01',
        institutionId: '00000000-0000-0000-0000-000000000001',
        userType: 'staff',
        email: 'admin@institution.co.ke',
        fullName: 'Johnstone Doe',
        isSuspended: false,
        role: 'super_admin',
        department: 'Operations',
        permissions: [],
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isConfigured,
        error,
        clearError,
        signUpCustomer,
        signInCustomer,
        verifyEmailOtp,
        resendVerificationEmail,
        requestPasswordReset,
        updatePassword,
        signInStaff,
        signOut,
        simulateMockUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
