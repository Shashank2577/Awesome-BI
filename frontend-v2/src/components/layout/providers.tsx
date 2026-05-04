'use client';
import { ThemeProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: 1 } } }));
  return <QueryClientProvider client={qc}><ThemeProvider attribute="class" defaultTheme="light">{children}</ThemeProvider></QueryClientProvider>;
}
