import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { cacheGet, cacheSet, cacheDelete } from '../lib/cache.js';

const router = Router();
const CACHE_KEY = 'tipologias:activas';

router.get('/', async (req, res, next) => {
  try {
    const cached = cacheGet(CACHE_KEY);
    if (cached) return res.json(cached);

    const tipologias = await prisma.tipologia.findMany({
      where: { activa: true },
      orderBy: { clave: 'asc' },
      select: { id: true, clave: true, nombre: true, descripcion: true },
    });
    cacheSet(CACHE_KEY, tipologias, 10 * 60 * 1000); // 10 min
    res.json(tipologias);
  } catch (err) {
    next(err);
  }
});

export default router;
