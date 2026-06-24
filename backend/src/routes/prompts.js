import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { invalidarPromptCache } from '../lib/prompts.js';

const router = Router();
router.use(requireAuth);

function adminOnly(req, res, next) {
  if (!req.user.esAdmin) return res.status(403).json({ error: 'Solo administradores' });
  next();
}

const SEMVER = /^\d+\.\d+\.\d+$/;

// GET /api/prompts — todas las versiones, agrupadas por agente/clave
router.get('/', adminOnly, async (req, res, next) => {
  try {
    const rows = await prisma.plantillaPrompt.findMany({
      orderBy: [{ agente: 'asc' }, { clave: 'asc' }, { createdAt: 'desc' }],
    });
    // Agrupar por agente+clave
    const grupos = {};
    for (const r of rows) {
      const k = `${r.agente}::${r.clave}`;
      (grupos[k] ??= { agente: r.agente, clave: r.clave, versiones: [] }).versiones.push(r);
    }
    res.json(Object.values(grupos));
  } catch (err) { next(err); }
});

// POST /api/prompts — crear nueva versión de un prompt
router.post('/', adminOnly, async (req, res, next) => {
  try {
    const { agente, clave, version, contenido, changelog, activar } = req.body;
    if (!agente?.trim() || !clave?.trim() || !version?.trim() || !contenido?.trim())
      return res.status(400).json({ error: 'agente, clave, version y contenido son requeridos' });
    if (!SEMVER.test(version))
      return res.status(400).json({ error: 'version debe ser semver (ej: 1.1.0)' });

    const dup = await prisma.plantillaPrompt.findFirst({ where: { agente, clave, version } });
    if (dup) return res.status(409).json({ error: `Ya existe ${agente}/${clave} v${version}` });

    const nueva = await prisma.plantillaPrompt.create({
      data: {
        agente: agente.trim(),
        clave: clave.trim(),
        version: version.trim(),
        contenido,
        changelog: changelog?.trim() || null,
        activa: false,
      },
    });

    // Activar de una vez si se pidió (desactiva las demás de ese agente/clave)
    if (activar) {
      await prisma.plantillaPrompt.updateMany({
        where: { agente, clave, NOT: { id: nueva.id } },
        data: { activa: false },
      });
      await prisma.plantillaPrompt.update({ where: { id: nueva.id }, data: { activa: true } });
      invalidarPromptCache(agente, clave);
      nueva.activa = true;
    }

    res.status(201).json(nueva);
  } catch (err) { next(err); }
});

// PATCH /api/prompts/:id/activar — activar esta versión (desactiva las hermanas)
router.patch('/:id/activar', adminOnly, async (req, res, next) => {
  try {
    const p = await prisma.plantillaPrompt.findUnique({ where: { id: req.params.id } });
    if (!p) return res.status(404).json({ error: 'Versión no encontrada' });

    await prisma.plantillaPrompt.updateMany({
      where: { agente: p.agente, clave: p.clave, NOT: { id: p.id } },
      data: { activa: false },
    });
    const activada = await prisma.plantillaPrompt.update({ where: { id: p.id }, data: { activa: true } });
    invalidarPromptCache(p.agente, p.clave);
    res.json(activada);
  } catch (err) { next(err); }
});

// DELETE /api/prompts/:id — eliminar una versión NO activa
router.delete('/:id', adminOnly, async (req, res, next) => {
  try {
    const p = await prisma.plantillaPrompt.findUnique({ where: { id: req.params.id } });
    if (!p) return res.status(404).json({ error: 'Versión no encontrada' });
    if (p.activa) return res.status(400).json({ error: 'No se puede eliminar la versión activa' });
    await prisma.plantillaPrompt.delete({ where: { id: p.id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
