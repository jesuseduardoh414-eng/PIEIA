import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

// 404 para rutas no encontradas.
export function notFound(req, res, next) {
  res.status(404).json({ error: 'Recurso no encontrado', path: req.originalUrl });
}

// Manejador central de errores. Traduce errores de validacion Zod a 400.
// Los 5xx ya los reporta a Sentry el handler registrado antes (setupSentryErrorHandler);
// aqui solo respondemos y dejamos traza estructurada (RNF-08).
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos invalidos',
      detalles: err.flatten().fieldErrors,
    });
  }

  const status = err.status || 500;
  logger.error('Error en peticion', {
    status,
    metodo: req.method,
    ruta: req.originalUrl,
    usuario: req.user?.id || null,
    mensaje: err.message,
    ...(status >= 500 ? { stack: err.stack } : {}),
  });
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
  });
}
