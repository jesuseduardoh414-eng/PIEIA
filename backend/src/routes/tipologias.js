import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// Lista de tipologias activas (alimenta el alta de proyecto, MOD-A).
router.get('/', async (req, res, next) => {
  try {
    const tipologias = await prisma.tipologia.findMany({
      where: { activa: true },
      orderBy: { clave: 'asc' },
      select: { id: true, clave: true, nombre: true, descripcion: true },
    });
    res.json(tipologias);
  } catch (err) {
    next(err);
  }
});

export default router;
