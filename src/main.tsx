import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/ibm-plex-sans-hebrew/400.css';
import '@fontsource/ibm-plex-sans-hebrew/500.css';
import '@fontsource/ibm-plex-sans-hebrew/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import './styles/index.css';
import { App } from './App';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './components/ui/toast';
import { SessionProvider } from './data/session';
import { toAppError } from './lib/errors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => {
        const code = toAppError(err).code;
        if (code === 'forbidden' || code === 'not_found' || code === 'not_authenticated' || code === 'not_member') return false;
        return count < 2;
      },
      retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
      refetchOnWindowFocus: false,
      throwOnError: false,
    },
    mutations: { retry: false },
  },
});

async function boot() {
  // Dev-only fictional backend for UI review (`npm run dev:demo`). Removed from production builds.
  if (import.meta.env.DEV && import.meta.env.VITE_DEMO === '1') {
    const { installDemo } = await import('./dev/demo');
    installDemo();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <SessionProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </SessionProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}

void boot();
