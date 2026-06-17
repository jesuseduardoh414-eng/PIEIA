import { ZodError } from 'zod';

// 404 para rutas no encontradas.
export function notFound(req, res, next) {
  res.status(404).json({ error: 'Recurso no encontrado', path: req.originalUrl });
}

// Manejador central de errores. Traduce errores de validacion Zod a 400.
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Datos invalidos',
      detalles: err.flatten().fieldErrors,
    });
  }

  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Error interno del servidor',
  });
}
