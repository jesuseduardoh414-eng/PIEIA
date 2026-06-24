import './instrument.js'; // PRIMERO: inicializa Sentry antes de cargar Express (RNF-08)
import { createApp } from './app.js';
import { iniciarWorker } from './lib/worker.js';
import { logger } from './lib/logger.js';
import { captureExcepcion } from './lib/sentry.js';

// ioredis emite 'error' events sin handler cuando Redis no está disponible,
// lo que crashea Node. PIEIA no usa Redis — suprimimos estos errores.
process.on('uncaughtException', (err) => {
  const msg = err?.message || '';
  if (msg.includes('ECONNREFUSED') || msg.includes('MaxRetriesPerRequest') || err?.code === 'ECONNREFUSED') return;
  logger.error('uncaughtException', { mensaje: msg, stack: err?.stack });
  captureExcepcion(err, { origen: { tipo: 'uncaughtException' } });
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('ECONNREFUSED') || msg.includes('MaxRetriesPerRequest')) return;
  logger.error('unhandledRejection', { mensaje: msg, stack: reason?.stack });
  captureExcepcion(reason instanceof Error ? reason : new Error(msg), { origen: { tipo: 'unhandledRejection' } });
});

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  logger.info(`API escuchando en http://localhost:${PORT}`, { puerto: PORT });
  // Worker de agentes in-process (cola durable, TRD §4.6).
  // Desactivable con WORKER_DISABLED=1 (ej. si se corre un worker dedicado aparte).
  if (process.env.WORKER_DISABLED !== '1') iniciarWorker();
});
