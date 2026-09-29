import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import './styles/index.css';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import { LangProvider } from './lib/lang';
import { setUnauthorizedHandler } from './lib/api';
import { initTheme } from './lib/theme';

// On any 401, drop the cached session so ProtectedRoute redirects to /login.
setUnauthorizedHandler(() => queryClient.setQueryData(['me'], null));

// Apply the persisted dark/light mode before first paint.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <App />
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
