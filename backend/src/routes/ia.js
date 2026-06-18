import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';
import { crearVersionEntregable } from '../lib/versiones.js';
import { generarMemoriaCalculo } from '../lib/memoriaCalculo.js';
import { construirDocxMemoria } from '../lib/wordMemoria.js';
import { registrarEjecucion, completarEjecucion, fallarEjecucion } from '../lib/bitacora.js';

const router = Router();
router.use(requireAuth);

const ROLES_GENERAN = ['admin', 'coordinador', 'calculista']; // RF-A03/AG-03: redacta el calculista, no el dibujante

// AG-03: genera un borrador de memoria de calculo (.docx) con Claude a partir de
// datos de diseno que el calculista pega manualmente, y lo guarda como entregable.
router.post('/tareas/:tareaId/memoria-ia', async (req, res, next) => {
  const t0 = Date.now();
  let ej = null;
  try { ej = await registrarEjecucion({ agente: 'AG-03', tareaId: req.params.tareaId, modelo: 'claude-sonnet-4-6', inputs: { tareaId: req.params.tareaId } }); } catch (_) {}
  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id: req.params.tareaId },
      include: {
        componente: {
          include: {
            proyecto: { include: { tipologia: { include: { disciplina: true } } } },
          },
        },
      },
    });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const rol = await rolEnProyecto(req.user, tarea.componente.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso a este proyecto' });
    if (!ROLES_GENERAN.includes(rol)) return res.status(403).json({ error: 'Tu rol no puede generar memorias con IA' });

    const datosDiseno = (req.body.datosDiseno || '').trim();
    if (datosDiseno.length < 10) {
      return res.status(400).json({ error: 'Pega los datos de diseno (resultados, dimensiones, parametros) que debe citar la memoria' });
    }

    const proyecto = tarea.componente.proyecto;
    const borrador = await generarMemoriaCalculo({ proyecto, tarea, datosDiseno });
    const metaIA = borrador._meta ?? {};
    delete borrador._meta;
    const buffer = await construirDocxMemoria({
      proyecto,
      tarea,
      titulo: borrador.titulo,
      secciones: borrador.secciones,
      fecha: new Date().toLocaleDateString('es-MX'),
    });

    const file = {
      originalname: `Memoria de calculo - ${tarea.nombre}.docx`,
      buffer,
      size: buffer.length,
    };

    let entregable = await prisma.entregable.findFirst({
      where: { tareaId: tarea.id, tipo: 'pdf_memoria' },
      include: { versiones: { orderBy: { numero: 'desc' }, take: 1 } },
    });

    const notas = req.body.notas || 'Borrador generado por IA (AG-03). Pendiente de revision del ingeniero responsable.';

    if (!entregable) {
      entregable = await prisma.entregable.create({
        data: { tareaId: tarea.id, nombre: 'Memoria de calculo', tipo: 'pdf_memoria' },
      });
      entregable.versiones = [];
    }

    const siguiente = (entregable.versiones[0]?.numero || 0) + 1;
    const version = await crearVersionEntregable(entregable.id, siguiente, file, req.user.id, { origen: 'agente', notas });
    await prisma.entregable.update({ where: { id: entregable.id }, data: { versionActualId: version.id } });

    if (ej) completarEjecucion(ej.id, {
      outputs: { entregableId: entregable.id, versionId: version.id },
      duracionMs: Date.now() - t0,
      costoUsd: metaIA.costoUsd,
      estado: 'pendiente_validacion',
    }).catch(() => {});

    res.status(201).json({ ...entregable, versionActualId: version.id, versiones: [version, ...entregable.versiones] });
  } catch (err) {
    if (ej) fallarEjecucion(ej.id, err).catch(() => {});
    next(err);
  }
});

export default router;
