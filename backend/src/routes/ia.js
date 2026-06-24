import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';
import { registrarEjecucion } from '../lib/bitacora.js';
import { encolar } from '../lib/cola.js';

const router = Router();
router.use(requireAuth);

const ROLES_GENERAN = ['admin', 'coordinador', 'calculista']; // RF-A03/AG-03: redacta el calculista, no el dibujante

// AG-03: valida y ENCOLA la generación de la memoria de cálculo. El worker la
// procesa async (genera el .docx con Claude y lo guarda como entregable).
router.post('/tareas/:tareaId/memoria-ia', async (req, res, next) => {
  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id: req.params.tareaId },
      include: { componente: { select: { proyectoId: true } } },
    });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const rol = await rolEnProyecto(req.user, tarea.componente.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso a este proyecto' });
    if (!ROLES_GENERAN.includes(rol)) return res.status(403).json({ error: 'Tu rol no puede generar memorias con IA' });

    const datosDiseno = (req.body.datosDiseno || '').trim();
    if (datosDiseno.length < 10) {
      return res.status(400).json({ error: 'Pega los datos de diseno (resultados, dimensiones, parametros) que debe citar la memoria' });
    }

    const ej = await registrarEjecucion({ agente: 'AG-03', proyectoId: tarea.componente.proyectoId, tareaId: tarea.id, modelo: 'claude-sonnet-4-6', inputs: { tareaId: tarea.id } });
    const trabajo = await encolar({
      tipo: 'ag03_memoria',
      payload: { tareaId: tarea.id, datosDiseno, notas: req.body.notas || null, userId: req.user.id },
      ejecucionId: ej.id,
    });
    res.status(202).json({ trabajoId: trabajo.id, ejecucionId: ej.id, estado: 'encolado' });
  } catch (err) { next(err); }
});

// Asistente de plano (AG-06 lite): ENCOLA la generacion de un plano ESQUEMATICO desde
// un prompt. El worker llama a Claude, dibuja el PDF y lo guarda como entregable (Borrador IA).
router.post('/tareas/:tareaId/plano-ia', async (req, res, next) => {
  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id: req.params.tareaId },
      include: { componente: { select: { proyectoId: true } } },
    });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const rol = await rolEnProyecto(req.user, tarea.componente.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso a este proyecto' });
    if (!ROLES_GENERAN.includes(rol)) return res.status(403).json({ error: 'Tu rol no puede generar planos con IA' });

    const prompt = (req.body.prompt || '').trim();
    if (prompt.length < 10) {
      return res.status(400).json({ error: 'Describe la casa que quieres (recamaras, banos, cocina, cochera, etc.)' });
    }

    const ej = await registrarEjecucion({ agente: 'AG-06', proyectoId: tarea.componente.proyectoId, tareaId: tarea.id, modelo: 'claude-sonnet-4-6', inputs: { prompt } });
    const trabajo = await encolar({
      tipo: 'ag06_plano',
      payload: { tareaId: tarea.id, prompt, userId: req.user.id },
      ejecucionId: ej.id,
    });
    res.status(202).json({ trabajoId: trabajo.id, ejecucionId: ej.id, estado: 'encolado' });
  } catch (err) { next(err); }
});

export default router;
