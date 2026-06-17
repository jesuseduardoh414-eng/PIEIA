import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';

const router = Router();
router.use(requireAuth);

// Crea un nuevo componente en el proyecto (T5: multicomponente).
router.post('/proyectos/:proyectoId/componentes', async (req, res, next) => {
  try {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre del componente es requerido' });

    const rol = await rolEnProyecto(req.user, req.params.proyectoId);
    if (!['admin', 'coordinador'].includes(rol)) {
      return res.status(403).json({ error: 'Solo el coordinador puede agregar componentes' });
    }

    const componente = await prisma.componente.create({
      data: { proyectoId: req.params.proyectoId, nombre: nombre.trim() },
      include: { tareas: true },
    });
    res.status(201).json(componente);
  } catch (err) {
    next(err);
  }
});

// Agrega una tarea manual a un componente (T5: tarea sin plantilla).
router.post('/componentes/:componenteId/tareas', async (req, res, next) => {
  try {
    const componente = await prisma.componente.findUnique({ where: { id: req.params.componenteId } });
    if (!componente) return res.status(404).json({ error: 'Componente no encontrado' });

    const rol = await rolEnProyecto(req.user, componente.proyectoId);
    if (!['admin', 'coordinador'].includes(rol)) {
      return res.status(403).json({ error: 'Solo el coordinador puede agregar tareas' });
    }

    const { nombre, horasEstimadas, esCritica } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre de la tarea es requerido' });

    const ultimo = await prisma.tarea.findFirst({
      where: { componenteId: componente.id },
      orderBy: { orden: 'desc' },
    });
    const orden = (ultimo?.orden ?? 0) + 1;

    const tarea = await prisma.tarea.create({
      data: {
        componenteId: componente.id,
        nombre: nombre.trim(),
        estado: 'pendiente',
        horasEstimadas: horasEstimadas ? Number(horasEstimadas) : null,
        esCritica: Boolean(esCritica),
        orden,
      },
      include: { asignado: { select: { nombre: true } } },
    });
    res.status(201).json(tarea);
  } catch (err) {
    next(err);
  }
});

export default router;
