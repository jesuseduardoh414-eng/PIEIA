// Logs estructurados (RNF-08). En producción emite JSON por línea (ingestible por
// cualquier colector); en desarrollo, texto legible. Nivel configurable con LOG_LEVEL.
const NIVELES = { debug: 10, info: 20, warn: 30, error: 40 };
const nivelMin = NIVELES[process.env.LOG_LEVEL] ?? NIVELES.info;
const esProd = process.env.NODE_ENV === 'production';

function emitir(nivel, mensaje, meta) {
  if (NIVELES[nivel] < nivelMin) return;
  const salida = nivel === 'error' ? console.error : nivel === 'warn' ? console.warn : console.log;
  if (esProd) {
    salida(JSON.stringify({ ts: new Date().toISOString(), nivel, msg: mensaje, ...meta }));
  } else {
    const extra = meta && Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    salida(`[${nivel}] ${mensaje}${extra}`);
  }
}

export const logger = {
  debug: (msg, meta = {}) => emitir('debug', msg, meta),
  info: (msg, meta = {}) => emitir('info', msg, meta),
  warn: (msg, meta = {}) => emitir('warn', msg, meta),
  error: (msg, meta = {}) => emitir('error', msg, meta),
};
