import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheGet, cacheSet, cacheDelete } from '../lib/cache.js';

const router = Router();
router.use(requireAuth);

function adminOnly(req, res, next) {
  if (!req.user.esAdmin) return res.status(403).json({ error: 'Solo administradores' });
  next();
}

// Normaliza un municipio para comparación (lowercase, sin acentos, sin artículos).
function normalizarMunicipio(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

const CACHE_KEY_TODAS = 'normativa:todas';

async function cargarTodasNormativas() {
  const cached = cacheGet(CACHE_KEY_TODAS);
  if (cached) return cached;
  const todas = await prisma.matrizNormativa.findMany({
    where: { activo: true },
    orderBy: [{ jurisdiccion: 'asc' }, { nombre: 'asc' }],
  });
  cacheSet(CACHE_KEY_TODAS, todas, 5 * 60 * 1000);
  return todas;
}

// GET /api/normativa?municipio=Monterrey
router.get('/', async (req, res, next) => {
  try {
    const municipioNorm = normalizarMunicipio(req.query.municipio);
    const todas = await cargarTodasNormativas();

    const aplicables = todas.filter((n) => {
      if (n.jurisdiccion === 'federal' || n.jurisdiccion === 'estatal') return true;
      if (!municipioNorm) return false;
      return n.aplicaEn.some((m) => normalizarMunicipio(m) === municipioNorm ||
        normalizarMunicipio(m).includes(municipioNorm) ||
        municipioNorm.includes(normalizarMunicipio(m)));
    });

    res.json(aplicables);
  } catch (err) { next(err); }
});

// ── CRUD admin ───────────────────────────────────────────────────────────────

router.get('/admin', adminOnly, async (req, res, next) => {
  try {
    const normativas = await prisma.matrizNormativa.findMany({
      orderBy: [{ jurisdiccion: 'asc' }, { nombre: 'asc' }],
    });
    res.json(normativas);
  } catch (err) { next(err); }
});

router.post('/admin', adminOnly, async (req, res, next) => {
  try {
    const { jurisdiccion, nombre, clave, aplicaEn, descripcion, urlReferencia } = req.body;
    if (!jurisdiccion || !nombre?.trim()) {
      return res.status(400).json({ error: 'jurisdiccion y nombre son requeridos' });
    }
    if (!['federal', 'estatal', 'municipal'].includes(jurisdiccion)) {
      return res.status(400).json({ error: 'jurisdiccion debe ser federal, estatal o municipal' });
    }
    const normativa = await prisma.matrizNormativa.create({
      data: {
        jurisdiccion,
        nombre: nombre.trim(),
        clave: clave?.trim() || null,
        aplicaEn: Array.isArray(aplicaEn) ? aplicaEn.map((m) => m.toLowerCase().trim()) : [],
        descripcion: descripcion?.trim() || null,
        urlReferencia: urlReferencia?.trim() || null,
      },
    });
    cacheDelete(CACHE_KEY_TODAS);
    res.status(201).json(normativa);
  } catch (err) { next(err); }
});

router.patch('/admin/:id', adminOnly, async (req, res, next) => {
  try {
    const n = await prisma.matrizNormativa.findUnique({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ error: 'Normativa no encontrada' });
    const data = {};
    if (req.body.nombre !== undefined) data.nombre = req.body.nombre.trim();
    if (req.body.clave !== undefined) data.clave = req.body.clave?.trim() || null;
    if (req.body.descripcion !== undefined) data.descripcion = req.body.descripcion?.trim() || null;
    if (req.body.urlReferencia !== undefined) data.urlReferencia = req.body.urlReferencia?.trim() || null;
    if (req.body.aplicaEn !== undefined) data.aplicaEn = Array.isArray(req.body.aplicaEn) ? req.body.aplicaEn.map((m) => m.toLowerCase().trim()) : [];
    if (req.body.activo !== undefined) data.activo = Boolean(req.body.activo);
    const actualizada = await prisma.matrizNormativa.update({ where: { id: req.params.id }, data });
    cacheDelete(CACHE_KEY_TODAS);
    res.json(actualizada);
  } catch (err) { next(err); }
});

router.delete('/admin/:id', adminOnly, async (req, res, next) => {
  try {
    const n = await prisma.matrizNormativa.findUnique({ where: { id: req.params.id } });
    if (!n) return res.status(404).json({ error: 'Normativa no encontrada' });
    await prisma.matrizNormativa.delete({ where: { id: req.params.id } });
    cacheDelete(CACHE_KEY_TODAS);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
