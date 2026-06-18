import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireProjectRole } from '../middleware/auth.js';
import { notificarMiembros } from '../lib/notificaciones.js';
import { generarReporteCambio } from '../lib/reporteCambio.js';
import { guardarArchivo } from '../lib/storage.js';

const router = Router();
router.use(requireAuth);

// Factores de retrabajo por clasificacion (configurables a futuro).
const EN_CURSO = ['pendiente', 'en_desarrollo', 'en_revision', 'con_observaciones', 'en_espera_cliente'];
const FACTOR_RETRABAJO = 1.0; // tarea aprobada -> se rehace completa
const FACTOR_AJUSTE = 0.5; // tarea en curso -> ajuste parcial

// Recorre el grafo de dependencias aguas abajo desde la tarea raiz (MOD-F, RF-F02).
async function analizarImpacto(proyectoId, tareaRaizId) {
  const tareas = await prisma.tarea.findMany({ where: { componente: { proyectoId } } });
  const mapa = new Map(tareas.map((t) => [t.id, t]));
  if (!mapa.has(tareaRaizId)) return null;

  const ids = tareas.map((t) => t.id);
  const deps = await prisma.dependencia.findMany({ where: { predecesoraId: { in: ids } } });
  const ady = new Map();
  for (const d of deps) {
    if (!ady.has(d.predecesoraId)) ady.set(d.predecesoraId, []);
    ady.get(d.predecesoraId).push(d.sucesoraId);
  }

  // BFS/DFS por sucesoras (subarbol afectado, incluyendo la raiz).
  const visitadas = new Set();
  const pila = [tareaRaizId];
  while (pila.length) {
    const cur = pila.pop();
    if (visitadas.has(cur)) continue;
    visitadas.add(cur);
    for (const s of ady.get(cur) ?? []) if (!visitadas.has(s)) pila.push(s);
  }

  const afectadas = [...visitadas]
    .map((id) => mapa.get(id))
    .filter(Boolean)
    .sort((a, b) => a.orden - b.orden)
    .map((t) => {
      let clasificacion = 'no_iniciada';
      let factor = 0;
      if (t.estado === 'aprobada') {
        clasificacion = 'retrabajo';
        factor = FACTOR_RETRABAJO;
      } else if (EN_CURSO.includes(t.estado)) {
        clasificacion = 'ajuste';
        factor = FACTOR_AJUSTE;
      }
      return {
        id: t.id,
        nombre: t.nombre,
        orden: t.orden,
        estado: t.estado,
        clasificacion,
        horas: Math.round((t.horasEstimadas || 0) * factor * 10) / 10,
      };
    });

  const horasRetrabajo = Math.round(afectadas.reduce((a, x) => a + x.horas, 0) * 10) / 10;
  return { afectadas, horasRetrabajo };
}

// Previsualizacion del impacto (no persiste).
router.post('/:proyectoId/cambios/analisis', requireProjectRole('coordinador'), async (req, res, next) => {
  try {
    const { tareaRaizId } = req.body;
    if (!tareaRaizId) return res.status(400).json({ error: 'Indica la tarea que cambio' });
    const impacto = await analizarImpacto(req.params.proyectoId, tareaRaizId);
    if (!impacto) return res.status(404).json({ error: 'Tarea no pertenece al proyecto' });
    res.json(impacto);
  } catch (err) {
    next(err);
  }
});

// Registra el cambio y, si se decide absorber o cotizar, invalida las tareas afectadas (RF-B07/RF-F05).
router.post('/:proyectoId/cambios', requireProjectRole('coordinador'), async (req, res, next) => {
  try {
    const { tareaRaizId, descripcion, decision } = req.body;
    if (!tareaRaizId || !descripcion) return res.status(400).json({ error: 'Faltan datos del cambio' });
    if (!['absorbido', 'cotizado', 'rechazado'].includes(decision)) {
      return res.status(400).json({ error: 'Decision invalida' });
    }
    const impacto = await analizarImpacto(req.params.proyectoId, tareaRaizId);
    if (!impacto) return res.status(404).json({ error: 'Tarea no pertenece al proyecto' });

    const resultado = await prisma.$transaction(async (tx) => {
      const cambio = await tx.cambioAlcance.create({
        data: {
          proyectoId: req.params.proyectoId,
          descripcion,
          tareaRaizId,
          tareasAfectadas: impacto.afectadas,
          horasRetrabajo: impacto.horasRetrabajo,
          decision,
          decididoPor: req.user.id,
        },
      });

      let invalidadas = 0;
      if (decision !== 'rechazado') {
        const ids = impacto.afectadas.map((a) => a.id);
        const r = await tx.tarea.updateMany({
          where: { id: { in: ids }, estado: { not: 'invalidada' } },
          data: { estado: 'invalidada' },
        });
        invalidadas = r.count;
      }
      return { cambio, invalidadas };
    });

    notificarMiembros(req.params.proyectoId, {
      tipo: 'cambio_alcance',
      titulo: `Cambio de alcance: "${descripcion}"`,
      cuerpo: `${resultado.invalidadas} tarea(s) afectadas. Decision: ${decision}.`,
      url: `/proyectos/${req.params.proyectoId}`,
    }, [req.user.id]).catch(() => {});

    // Generar reporte DOCX en segundo plano (no bloquea la respuesta)
    const proyecto = await prisma.proyecto.findUnique({ where: { id: req.params.proyectoId }, select: { clave: true, nombre: true, clienteNombre: true, municipio: true } });
    generarReporteCambio({
      proyecto,
      cambio: resultado.cambio,
      afectadas: impacto.afectadas,
      decidioPor: req.user.nombre || req.user.email,
    }).then(async (buffer) => {
      const path = `cambios/${resultado.cambio.id}/reporte_impacto.docx`;
      await guardarArchivo(path, buffer);
      await prisma.cambioAlcance.update({ where: { id: resultado.cambio.id }, data: { reportePath: path } });
    }).catch((e) => console.error('[Cambio] Error generando reporte:', e?.message));

    res.status(201).json({ ...resultado.cambio, invalidadas: resultado.invalidadas });
  } catch (err) {
    next(err);
  }
});

// Historial de cambios del proyecto.
router.get('/:proyectoId/cambios', requireProjectRole(), async (req, res, next) => {
  try {
    const cambios = await prisma.cambioAlcance.findMany({
      where: { proyectoId: req.params.proyectoId },
      orderBy: { createdAt: 'desc' },
      include: { decidioUsuario: { select: { nombre: true } } },
    });
    res.json(cambios);
  } catch (err) {
    next(err);
  }
});

// Descarga del reporte PDF de un cambio de alcance (RF-F04)
router.get('/:proyectoId/cambios/:cambioId/reporte', requireProjectRole(), async (req, res, next) => {
  try {
    const cambio = await prisma.cambioAlcance.findFirst({
      where: { id: req.params.cambioId, proyectoId: req.params.proyectoId },
      include: { proyecto: { select: { clave: true, nombre: true, clienteNombre: true, municipio: true } }, decidioUsuario: { select: { nombre: true } } },
    });
    if (!cambio) return res.status(404).json({ error: 'Cambio no encontrado' });

    // Si ya tiene reporte guardado, devuelve ese
    if (cambio.reportePath) {
      const { obtenerBuffer } = await import('../lib/storage.js');
      const buffer = await obtenerBuffer(cambio.reportePath);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="reporte_cambio_${cambio.proyecto.clave}.docx"`);
      return res.send(buffer);
    }

    // Si no, genera al vuelo
    const buffer = await generarReporteCambio({
      proyecto: cambio.proyecto,
      cambio,
      afectadas: cambio.tareasAfectadas ?? [],
      decidioPor: cambio.decidioUsuario?.nombre ?? 'Coordinador',
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_cambio_${cambio.proyecto.clave}.docx"`);
    res.send(buffer);
  } catch (err) { next(err); }
});

export default router;
