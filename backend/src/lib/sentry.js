// Envoltura de Sentry para el resto del backend. Todo es no-op si no hay SENTRY_DSN,
// así el código de negocio no necesita comprobar si Sentry está configurado.
import * as Sentry from '@sentry/node';

export const sentryHabilitado = !!process.env.SENTRY_DSN;

// Registra el manejador de errores de Express (RNF-08). Captura solo errores 5xx;
// los 4xx (validación Zod, auth) son flujo normal, no incidentes.
export function setupSentryErrorHandler(app) {
  if (!sentryHabilitado) return;
  Sentry.setupExpressErrorHandler(app, {
    shouldHandleError(error) {
      if (error?.name === 'ZodError') return false;
      const status = error?.status || error?.statusCode || 500;
      return status >= 500;
    },
  });
}

function aplicarContexto(scope, contexto) {
  for (const [clave, valor] of Object.entries(contexto)) {
    scope.setContext(clave, valor && typeof valor === 'object' ? valor : { valor });
  }
}

export function captureExcepcion(err, contexto = {}) {
  if (!sentryHabilitado) return;
  Sentry.withScope((scope) => {
    aplicarContexto(scope, contexto);
    Sentry.captureException(err);
  });
}

export function captureMensaje(mensaje, nivel = 'warning', contexto = {}) {
  if (!sentryHabilitado) return;
  Sentry.withScope((scope) => {
    scope.setLevel(nivel);
    aplicarContexto(scope, contexto);
    Sentry.captureMessage(mensaje);
  });
}
