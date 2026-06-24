import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import health from './routes/health.js';
import auth from './routes/auth.js';
import tipologias from './routes/tipologias.js';
import proyectos from './routes/proyectos.js';
import tareas from './routes/tareas.js';
import entregables from './routes/entregables.js';
import ia from './routes/ia.js';
import revisiones from './routes/revisiones.js';
import portal from './routes/portal.js';
import cambios from './routes/cambios.js';
import admin from './routes/admin.js';
import notificaciones from './routes/notificaciones.js';
import componentes from './routes/componentes.js';
import checklist from './routes/checklist.js';
import aps from './routes/aps.js';
import invitaciones from './routes/invitaciones.js';
import agentes from './routes/agentes.js';
import catalogo from './routes/catalogo.js';
import cuantificacion from './routes/cuantificacion.js';
import normativa from './routes/normativa.js';
import memoria from './routes/memoria.js';
import prompts from './routes/prompts.js';
import dxf from './routes/dxf.js';
import evals from './routes/evals.js';
import { requireAuth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/error.js';
import { setupSentryErrorHandler } from './lib/sentry.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*', credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(morgan('dev'));

  // Rutas publicas
  app.use('/api/health', health);
  app.use('/api/auth', auth);

  // Rutas protegidas (requieren sesion)
  app.use('/api/tipologias', requireAuth, tipologias);
  app.use('/api/proyectos', proyectos);
  app.use('/api/proyectos', cambios);
  app.use('/api/tareas', tareas);
  app.use('/api', entregables);
  app.use('/api', ia);
  app.use('/api', revisiones);
  app.use('/api/portal', portal);
  app.use('/api/admin', admin);
  app.use('/api/notificaciones', notificaciones);
  app.use('/api', componentes);
  app.use('/api/checklist', checklist);
  app.use('/api', aps);
  app.use('/api', invitaciones);
  app.use('/api/agentes', agentes);
  app.use('/api/catalogo', catalogo);
  app.use('/api', cuantificacion);
  app.use('/api/normativa', normativa);
  app.use('/api/memoria', memoria);
  app.use('/api/prompts', prompts);
  app.use('/api/dxf', dxf);
  app.use('/api/evals', evals);

  // Manejo de errores (siempre al final). El handler de Sentry va antes del nuestro:
  // captura los 5xx y delega la respuesta a errorHandler (RNF-08).
  app.use(notFound);
  setupSentryErrorHandler(app);
  app.use(errorHandler);

  return app;
}
