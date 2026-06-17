import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Conteo de no leidas (para el badge de la campana — polling ligero).
router.get('/conteo', async (req, res, next) => {
  try {
    const sinLeer = await prisma.notificacion.count({
      where: { usuarioId: req.user.id, leida: false },
    });
    res.json({ sinLeer });
  } catch (err) {
    next(err);
  }
});

// Lista de notificaciones del usuario (no leidas primero, limite 40).
router.get('/', async (req, res, next) => {
  try {
    const notificaciones = await prisma.notificacion.findMany({
      where: { usuarioId: req.user.id },
      orderBy: [{ leida: 'asc' }, { createdAt: 'desc' }],
      take: 40,
    });
    res.json(notificaciones);
  } catch (err) {
    next(err);
  }
});

// Marcar una como leida.
router.patch('/:id/leer', async (req, res, next) => {
  try {
    const notif = await prisma.notificacion.findUnique({ where: { id: req.params.id } });
    if (!notif || notif.usuarioId !== req.user.id) {
      return res.status(404).json({ error: 'Notificacion no encontrada' });
    }
    const actualizada = await prisma.notificacion.update({
      where: { id: req.params.id },
      data: { leida: true },
    });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// Marcar todas como leidas.
router.patch('/leer-todo', async (req, res, next) => {
  try {
    await prisma.notificacion.updateMany({
      where: { usuarioId: req.user.id, leida: false },
      data: { leida: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
