import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Items activos para un tipo de entregable (usados en FormRevision, RF-D04).
router.get('/:tipo', async (req, res, next) => {
  try {
    const items = await prisma.checklistRevisionItem.findMany({
      where: { tipoEntregable: req.params.tipo, activo: true },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

export default router;
