import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Configurable Lending Management Platform | Licensed Kenya Credit Systems',
  description: 'Enterprise mobile-first lending management platform for licensed digital credit providers in Kenya. Fully configurable loan products, credit scoring, M-Pesa repayments, and operations console.',
  openGraph: {
    title: 'Configurable Lending Management Platform',
    description: 'Enterprise mobile-first lending platform for licensed Kenyan lending institutions.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Configurable Lending Management Platform',
    description: 'Enterprise mobile-first lending platform for licensed Kenyan lending institutions.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#101C2C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="antialiased min-h-screen bg-[#F5F7FA] text-[#101C2C]">
        {children}
      </body>
    </html>
  );
}
