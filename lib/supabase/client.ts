import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve Supabase URL supporting Next.js public prefix, Vite prefix, or project ID
const rawSupabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  (process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID
    ? `https://${process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID}.supabase.co`
    : '');

// Retrieve Supabase client-safe key:
// Supabase migrated from legacy JWT 'anon' keys to modern 'Publishable keys' (prefixed with 'sb_publishable_').
// We check for modern publishable keys first, then fall back to legacy anon keys for full compatibility.
const supabaseClientKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

// Authentication may be enabled ahead of business-data access. Keep browser data access
// disabled until each workflow has a production repository behind it.
const runtimeEnabled = process.env.NEXT_PUBLIC_SUPABASE_RUNTIME_ENABLED === 'true';

export type SupabaseKeyType = 'publishable' | 'legacy_anon' | 'placeholder' | 'missing';

/**
 * Detects the format of the configured Supabase client key.
 */
export function detectKeyType(key: string): SupabaseKeyType {
  if (!key) return 'missing';
  if (key === 'your-anon-key-here' || key.startsWith('placeholder-')) return 'placeholder';
  if (key.startsWith('sb_publishable_')) return 'publishable';
  if (key.startsWith('eyJ')) return 'legacy_anon';
  // Other non-empty string that isn't placeholder
  return 'publishable';
}

/**
 * Validates whether the Supabase environment variables are properly defined.
 */
export function isSupabaseConfigured(): boolean {
  if (!rawSupabaseUrl || !supabaseClientKey) {
    return false;
  }
  // Check if default placeholder is still present
  if (
    rawSupabaseUrl.includes('your-project.supabase.co') ||
    supabaseClientKey === 'your-anon-key-here' ||
    supabaseClientKey.startsWith('placeholder-')
  ) {
    return false;
  }
  try {
    const parsed = new URL(rawSupabaseUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** True only when a production data repository has deliberately been enabled. */
export function isSupabaseDataRuntimeEnabled(): boolean {
  return isSupabaseConfigured() && runtimeEnabled;
}

/**
 * Diagnostic status for developer onboarding and configuration alerts.
 */
export function getSupabaseConfigStatus(): {
  isConfigured: boolean;
  url: string;
  hasKey: boolean;
  keyType: SupabaseKeyType;
  keyPreview: string;
  message: string;
} {
  const configured = isSupabaseConfigured();
  const credentialsPresent = Boolean(rawSupabaseUrl && supabaseClientKey);
  const keyType = detectKeyType(supabaseClientKey);

  let keyPreview = 'Not set';
  if (supabaseClientKey && keyType !== 'placeholder') {
    if (supabaseClientKey.length > 18) {
      keyPreview = `${supabaseClientKey.slice(0, 16)}••••${supabaseClientKey.slice(-4)}`;
    } else {
      keyPreview = '••••••••••••';
    }
  }

  let message = 'Supabase credentials missing. Provide NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to connect real authentication.';
  if (credentialsPresent && !runtimeEnabled) {
    message = 'Supabase authentication is connected. Business data remains in safe mock mode until its production workflows are enabled.';
  }
  if (configured) {
    if (keyType === 'publishable') {
      message = 'Connected with modern Supabase Publishable Key (sb_publishable_...).';
    } else if (keyType === 'legacy_anon') {
      message = 'Connected with legacy JWT Anon Key (eyJ...). Supabase recommends migrating to Publishable Keys.';
    } else {
      message = 'Supabase backend connected successfully.';
    }
  }

  return {
    isConfigured: configured,
    url: rawSupabaseUrl ? rawSupabaseUrl.replace(/^(https?:\/\/[^/]+).*/, '$1') : '',
    hasKey: Boolean(supabaseClientKey && keyType !== 'placeholder' && keyType !== 'missing'),
    keyType,
    keyPreview,
    message,
  };
}

// Fallback dummy URL/Key if missing to allow instantiation without throwing during initial build
const activeUrl = isSupabaseConfigured()
  ? rawSupabaseUrl
  : 'https://placeholder-project.supabase.co';

const activeKey = isSupabaseConfigured()
  ? supabaseClientKey
  : 'placeholder-anon-key-00000000000000000000000000000000';

/**
 * Centralized, singleton Supabase client.
 * Compatible with modern Publishable keys (sb_publishable_...) and legacy anon keys.
 * Never exposes secret keys (sb_secret_...) in client-side code.
 */
export const supabase: SupabaseClient = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'lending_platform_supabase_auth',
  },
});

