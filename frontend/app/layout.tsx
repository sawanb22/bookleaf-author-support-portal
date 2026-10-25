import type { Metadata } from 'next';
import { Literata, IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/mock/auth-context';

// Literata: Serif for page titles, section headers, book titles
const literata = Literata({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-literata',
  display: 'swap',
  fallback: ['Georgia', 'Cambria', 'serif'],
});

// IBM Plex Sans: Sans-serif for operational UI, body, labels, forms, tables & tabular figures
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-ibm-plex',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

export const metadata: Metadata = {
  title: 'BookLeaf Author Support Portal',
  description: 'Author support queries, book production tracking, and royalty accounting portal.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${literata.variable} ${ibmPlexSans.variable} font-sans antialiased`}
    >
      <body className="min-h-screen bg-page text-text font-sans selection:bg-primary-tint selection:text-primary">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-on-primary focus:rounded-md focus-ring"
        >
          Skip to content
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
