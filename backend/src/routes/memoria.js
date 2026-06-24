import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { indexarMemoria, buscarSimilares, listarMemorias, eliminarMemoria } from '../lib/memoriaOrg.js';

const router = Router();
router.use(requireAuth);

function adminOnly(req, res, next) {
  if (!req.user.esAdmin) return res.status(403).json({ error: 'Solo administradores' });
  next();
}

// GET /api/memoria/similares?consulta=casa+habitacion+pilotes&tipologia=T1
// Devuelve proyectos similares — uso desde FormCrear.
router.get('/similares', async (req, res, next) => {
  try {
    const { consulta, tipologia } = req.query;
    if (!consulta?.trim()) return res.json({ resultados: [] });
    const resultado = await buscarSimilares({ consulta, tipologia: tipologia || null });
    const meta = resultado._meta;
    res.json({ resultados: resultado.resultados, costoUsd: meta?.costoUsd });
  } catch (err) { next(err); }
});

// GET /api/memoria  — listar todas (admin)
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const rows = await listarMemorias();
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/memoria — indexar nueva entrada
router.post('/', adminOnly, async (req, res, next) => {
  try {
    const { slug, tipologia, municipio, resumen, metadatos } = req.body;
    if (!slug?.trim() || !resumen?.trim())
      return res.status(400).json({ error: 'slug y resumen son requeridos' });
    const r = await indexarMemoria({ slug, tipologia, municipio, resumen, metadatos: metadatos ?? {} });
    res.status(201).json(r);
  } catch (err) { next(err); }
});

// DELETE /api/memoria/:id
router.delete('/:id', adminOnly, async (req, res, next) => {
  try {
    await eliminarMemoria(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
