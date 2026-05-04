import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/layout/providers';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Awesome BI',
  description: 'Intelligent Business Intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-7xl p-6 lg:p-8">{children}</div>
            </main>
          </div>
          <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: '10px', background: '#1E293B', color: '#F8FAFC', fontSize: '14px' } }} />
        </Providers>
      </body>
    </html>
  );
}
