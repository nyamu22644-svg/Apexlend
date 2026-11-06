'use client';

import { AuthProvider } from '@/lib/auth-context';
import { BrandProvider } from '@/lib/brand-context';
import { AppShell } from '@/components/AppShell';

export default function HomePage() {
  return (
    <AuthProvider>
      <BrandProvider>
        <AppShell />
      </BrandProvider>
    </AuthProvider>
  );
}
