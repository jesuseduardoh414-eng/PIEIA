import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';
import { desbloquearSucesoras } from './tareas.js';
import { crearNotificacion, notificarMiembros } from '../lib/notificaciones.js';

const router = Router();
router.use(requireAuth);

const ROLES_REVISAN = ['admin', 'coordinador']; // firma interna (RF-D03)
const ROLES_RESUELVEN = ['admin', 'coordinador', 'calculista', 'dibujante'];

const versionConProyecto = (versionId) =>
  prisma.versionEntregable.findUnique({
    where: { id: versionId },
    include: { entregable: { include: { tarea: { include: { componente: { select: { proyectoId: true } } } } } } },
  });

// Crear revision sobre una version: APROBAR = firma interna inmutable con hash (RF-D03),
// o CON OBSERVACIONES (RF-D01). El revisor siempre es un humano autenticado (RF-H06).
router.post('/versiones/:versionId/revisiones', async (req, res, next) => {
  try {
    const version = await versionConProyecto(req.params.versionId);
    if (!version) return res.status(404).json({ error: 'Version no encontrada' });

    const proyectoId = version.entregable.tarea.componente.proyectoId;
    const rol = await rolEnProyecto(req.user, proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso' });
    if (!ROLES_REVISAN.includes(rol)) {
      return res.status(403).json({ error: 'Solo el coordinador aprueba u observa (firma interna)' });
    }

    const { resultado, comentario } = req.body;
    if (!['aprobado', 'con_observaciones'].includes(resultado)) {
      return res.status(400).json({ error: 'Resultado invalido' });
    }
    const observaciones = Array.isArray(req.body.observaciones)
      ? req.body.observaciones.map((s) => String(s).trim()).filter(Boolean)
      : [];
    if (resultado === 'con_observaciones' && observaciones.length === 0) {
      return res.status(400).json({ error: 'Indica al menos una observacion' });
    }

    const nuevoEstado = resultado === 'aprobado' ? 'aprobada' : 'con_observaciones';

    const revision = await prisma.$transaction(async (tx) => {
      const creada = await tx.revision.create({
        data: {
          versionEntregableId: version.id,
          revisorId: req.user.id,
          resultado,
          comentario: comentario || null,
          hashVersion: version.hashSha256, // firma: hash exacto de la version aprobada/observada
          observaciones: { create: observaciones.map((texto) => ({ texto })) },
        },
        include: { observaciones: true, revisor: { select: { nombre: true } }, version: { select: { numero: true } } },
      });

      await tx.tarea.update({
        where: { id: version.entregable.tarea.id },
        data: { estado: nuevoEstado },
      });

      return creada;
    });

    const desbloqueadas = nuevoEstado === 'aprobada' ? await desbloquearSucesoras(version.entregable.tarea.id) : [];

    // Notificaciones de revision (fire-and-forget).
    const tarea = version.entregable.tarea;
    const url = `/proyectos/${proyectoId}`;
    if (resultado === 'aprobado') {
      notificarMiembros(proyectoId, {
        tipo: 'tarea_aprobada',
        titulo: `"${tarea.nombre}" aprobada tras revision`,
        url,
      }, [req.user.id]).catch(() => {});
    } else if (resultado === 'con_observaciones' && tarea.asignadoA && tarea.asignadoA !== req.user.id) {
      crearNotificacion({
        usuarioId: tarea.asignadoA,
        tipo: 'tarea_observaciones',
        titulo: `"${tarea.nombre}" tiene observaciones`,
        cuerpo: `${revision.observaciones.length} punto(s) a corregir.`,
        url,
      }).catch(() => {});
    }

    res.status(201).json({ ...revision, tareaEstado: nuevoEstado, desbloqueadas });
  } catch (err) {
    next(err);
  }
});

// Historial de revisiones de un entregable (todas sus versiones).
router.get('/entregables/:entregableId/revisiones', async (req, res, next) => {
  try {
    const ent = await prisma.entregable.findUnique({
      where: { id: req.params.entregableId },
      include: { tarea: { include: { componente: { select: { proyectoId: true } } } } },
    });
    if (!ent) return res.status(404).json({ error: 'Entregable no encontrado' });
    const rol = await rolEnProyecto(req.user, ent.tarea.componente.proyectoId);
    if (!rol || rol === 'cliente') return res.status(403).json({ error: 'Sin acceso' }); // RF-E05

    const revisiones = await prisma.revision.findMany({
      where: { version: { entregableId: ent.id } },
      orderBy: { firmadoEn: 'desc' },
      include: {
        revisor: { select: { nombre: true } },
        version: { select: { numero: true } },
        observaciones: { orderBy: { createdAt: 'asc' } },
      },
    });
    res.json(revisiones);
  } catch (err) {
    next(err);
  }
});

// Resolver una observacion (RF-D02): con nueva version vinculada O justificacion escrita.
router.patch('/observaciones/:observacionId/resolver', async (req, res, next) => {
  try {
    const obs = await prisma.observacion.findUnique({
      where: { id: req.params.observacionId },
      include: {
        revision: {
          include: {
            version: { include: { entregable: { include: { tarea: { include: { componente: { select: { proyectoId: true } } } } } } } },
          },
        },
      },
    });
    if (!obs) return res.status(404).json({ error: 'Observacion no encontrada' });

    const proyectoId = obs.revision.version.entregable.tarea.componente.proyectoId;
    const rol = await rolEnProyecto(req.user, proyectoId);
    if (!rol || !ROLES_RESUELVEN.includes(rol)) return res.status(403).json({ error: 'Sin permiso' });
    if (obs.estado === 'resuelta') return res.status(409).json({ error: 'La observacion ya esta resuelta' });

    const justificacion = String(req.body.justificacion || '').trim();
    const resueltaConVersionId = req.body.resueltaConVersionId || null;
    if (!justificacion && !resueltaConVersionId) {
      return res.status(400).json({ error: 'Cierra con una nueva version vinculada o una justificacion escrita' });
    }

    const actualizada = await prisma.observacion.update({
      where: { id: obs.id },
      data: { estado: 'resuelta', justificacion: justificacion || null, resueltaConVersionId },
    });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

export default router;
