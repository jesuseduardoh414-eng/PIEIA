import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Salud del API y conectividad con la base de datos.
router.get('/', async (req, res) => {
  let db = 'desconocido';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'ok';
  } catch {
    db = 'sin_conexion';
  }
  res.json({ status: 'ok', servicio: 'pieia-backend', db, ts: new Date().toISOString() });
});

export default router;
