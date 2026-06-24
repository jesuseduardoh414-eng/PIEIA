import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/auth/AuthProvider';
import { initSentry, Sentry } from '@/lib/sentry';
import App from '@/App';
import '@/index.css';

// Sentry (RNF-08) antes de montar la app, para capturar errores de render iniciales.
initSentry();

function FallbackError() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'system-ui', color: '#444', padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: 18, fontWeight: 600 }}>Algo salió mal</h1>
      <p style={{ fontSize: 14, maxWidth: 420 }}>Ocurrió un error inesperado y el equipo ya fue notificado. Recarga la página para continuar.</p>
      <button onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '8px 16px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>Recargar</button>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 min — no refetch al cambiar de pestaña
      gcTime: 15 * 60 * 1000,    // 15 min en caché
      retry: 1,
      refetchOnWindowFocus: false, // no refetch al volver al tab
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<FallbackError />}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
