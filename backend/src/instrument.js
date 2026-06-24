// Inicialización de Sentry (RNF-08). DEBE ser el primer import de index.js para
// que la auto-instrumentación de Express/HTTP funcione (patrón oficial v8+).
// Sin SENTRY_DSN, Sentry.init no se llama y todo queda como no-op silencioso.
import 'dotenv/config';
import * as Sentry from '@sentry/node';

// Ruido de ioredis cuando no hay Redis (PIEIA no usa Redis) — no lo reportamos.
const RUIDO_IGNORADO = ['ECONNREFUSED', 'MaxRetriesPerRequest'];

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || undefined,
    // Trazas de rendimiento (incluye spans de agentes). Bajo por costo; subir en incidentes.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // No enviamos PII (emails, IPs) por defecto: archivos de clientes son confidenciales.
    sendDefaultPii: false,
    ignoreErrors: RUIDO_IGNORADO,
    beforeSend(event, hint) {
      const msg = hint?.originalException?.message || '';
      if (RUIDO_IGNORADO.some((r) => msg.includes(r))) return null;
      return event;
    },
  });
  console.log('[sentry] Habilitado (' + (process.env.NODE_ENV || 'development') + ')');
}
