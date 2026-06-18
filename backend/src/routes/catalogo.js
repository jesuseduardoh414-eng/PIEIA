import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const requireAdmin = (req, res, next) =>
  req.user.esAdmin ? next() : res.status(403).json({ error: 'Solo administradores' });

// ---- Conceptos ----

router.get('/conceptos', async (req, res, next) => {
  try {
    const conceptos = await prisma.conceptoCatalogo.findMany({
      where: req.query.disciplinaId ? { disciplinaId: req.query.disciplinaId } : undefined,
      include: { disciplina: { select: { nombre: true } }, precios: { orderBy: { vigenciaDesde: 'desc' }, take: 1 } },
      orderBy: [{ disciplinaId: 'asc' }, { clave: 'asc' }],
    });
    res.json(conceptos);
  } catch (err) { next(err); }
});

router.post('/conceptos', requireAdmin, async (req, res, next) => {
  try {
    const { disciplinaId, clave, descripcion, unidad, alias } = req.body;
    if (!disciplinaId || !clave || !descripcion || !unidad)
      return res.status(400).json({ error: 'disciplinaId, clave, descripcion y unidad son requeridos' });
    const concepto = await prisma.conceptoCatalogo.create({
      data: { disciplinaId, clave: clave.toUpperCase(), descripcion, unidad, alias: alias ?? [] },
      include: { disciplina: { select: { nombre: true } } },
    });
    res.status(201).json(concepto);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Ya existe un concepto con esa clave en esta disciplina' });
    next(err);
  }
});

router.patch('/conceptos/:id', requireAdmin, async (req, res, next) => {
  try {
    const { descripcion, unidad, alias, activo } = req.body;
    const concepto = await prisma.conceptoCatalogo.update({
      where: { id: req.params.id },
      data: { descripcion, unidad, alias, activo },
      include: { disciplina: { select: { nombre: true } } },
    });
    res.json(concepto);
  } catch (err) { next(err); }
});

router.delete('/conceptos/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.conceptoCatalogo.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ---- Precios unitarios ----

router.get('/conceptos/:id/precios', async (req, res, next) => {
  try {
    const precios = await prisma.precioUnitario.findMany({
      where: { conceptoId: req.params.id },
      orderBy: { vigenciaDesde: 'desc' },
    });
    res.json(precios);
  } catch (err) { next(err); }
});

router.post('/conceptos/:id/precios', requireAdmin, async (req, res, next) => {
  try {
    const { region, precio, fuente, vigenciaDesde } = req.body;
    if (!precio || !vigenciaDesde)
      return res.status(400).json({ error: 'precio y vigenciaDesde son requeridos' });
    const p = await prisma.precioUnitario.create({
      data: {
        conceptoId: req.params.id,
        region: region ?? 'Noreste',
        precio,
        fuente,
        vigenciaDesde: new Date(vigenciaDesde),
      },
    });
    res.status(201).json(p);
  } catch (err) { next(err); }
});

router.delete('/precios/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.precioUnitario.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
