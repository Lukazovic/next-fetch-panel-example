import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { DevNetworkPanel } from 'next-fetch-panel';
import { Analytics } from '@vercel/analytics/next';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://next-fetch-panel-example.vercel.app'),
  title: 'next-fetch-panel — Live Example',
  description:
    'Live example of next-fetch-panel, a real-time DevTools-style panel for inspecting server-side fetch() calls in Next.js App Router apps.',
  keywords: ['next-fetch-panel', 'nextjs', 'devtools', 'ssr', 'fetch'],
  openGraph: {
    title: 'next-fetch-panel — Live Example',
    description:
      'Real-time DevTools-style panel for inspecting server-side fetch() calls in Next.js App Router apps.',
    url: 'https://next-fetch-panel-example.vercel.app',
    siteName: 'next-fetch-panel example',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'next-fetch-panel — Live Example',
    description:
      'Real-time DevTools-style panel for inspecting server-side fetch() calls in Next.js App Router apps.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <Analytics />
      <body className="min-h-full flex flex-col">
        {children}
        <DevNetworkPanel />
      </body>
    </html>
  );
}
