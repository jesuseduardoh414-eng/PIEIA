// Inicialización de Sentry en el frontend (RNF-08). No-op si no hay VITE_SENTRY_DSN.
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // No capturamos PII por defecto: la plataforma maneja datos de clientes.
    sendDefaultPii: false,
  });
}

export { Sentry };
