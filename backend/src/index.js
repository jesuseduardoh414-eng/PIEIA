import 'dotenv/config';
import { createApp } from './app.js';

// ioredis emite 'error' events sin handler cuando Redis no está disponible,
// lo que crashea Node. PIEIA no usa Redis — suprimimos estos errores.
process.on('uncaughtException', (err) => {
  const msg = err?.message || '';
  if (msg.includes('ECONNREFUSED') || msg.includes('MaxRetriesPerRequest') || err?.code === 'ECONNREFUSED') return;
  console.error('[Fatal]', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('ECONNREFUSED') || msg.includes('MaxRetriesPerRequest')) return;
  console.error('[UnhandledRejection]', reason);
});

const PORT = process.env.PORT || 4000;
const app = createApp();

app.listen(PORT, () => {
  console.log(`[pieia-backend] API escuchando en http://localhost:${PORT}`);
  console.log(`[pieia-backend] Health:  http://localhost:${PORT}/api/health`);
});
