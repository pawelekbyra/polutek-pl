'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { LanguageProvider } from './LanguageContext';
import { ToastProvider } from '@/app/hooks/useToast';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,  // komentarze świeże 2 minuty
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: false, // YouTube też tak robi
      }
    }
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}
