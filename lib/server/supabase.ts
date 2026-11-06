import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

function requireValue(value: string | undefined, name: string): string {
  if (!value || value.includes('your_') || value.includes('replace-with')) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function createUserServerClient(accessToken: string) {
  return createClient(
    requireValue(url, 'SUPABASE_URL'),
    requireValue(publishableKey, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function createAdminClient() {
  return createClient(
    requireValue(url, 'SUPABASE_URL'),
    requireValue(secretKey, 'SUPABASE_SECRET_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function requireAuthenticatedUser(accessToken: string) {
  const client = createUserServerClient(accessToken);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Unauthorized');
  return { client, user: data.user };
}
