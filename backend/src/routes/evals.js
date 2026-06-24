import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { cargarCasos, correrTodos } from '../lib/evals.js';

const router = Router();
router.use(requireAuth);

function adminOnly(req, res, next) {
  if (!req.user.esAdmin) return res.status(403).json({ error: 'Solo administradores' });
  next();
}

// Lista los casos dorados disponibles (sin correrlos).
router.get('/casos', adminOnly, (req, res, next) => {
  try {
    res.json(cargarCasos(req.query.agente || null));
  } catch (err) { next(err); }
});

// Corre las evals (consume créditos de LLM). Puede filtrarse por agente.
router.post('/correr', adminOnly, async (req, res, next) => {
  try {
    const resumen = await correrTodos(req.body?.agente || null);
    res.json(resumen);
  } catch (err) { next(err); }
});

// Historial de resultados (última corrida por defecto).
router.get('/resultados', adminOnly, async (req, res, next) => {
  try {
    const ultima = await prisma.evalResultado.findFirst({ orderBy: { createdAt: 'desc' } });
    if (!ultima) return res.json({ corridaId: null, resultados: [] });
    const resultados = await prisma.evalResultado.findMany({
      where: { corridaId: ultima.corridaId },
      orderBy: { agente: 'asc' },
    });
    res.json({ corridaId: ultima.corridaId, fecha: ultima.createdAt, resultados });
  } catch (err) { next(err); }
});

export default router;
