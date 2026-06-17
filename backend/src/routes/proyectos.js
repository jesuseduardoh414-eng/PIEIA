import { Router } from 'express';
import { ZipArchive } from 'archiver';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireProjectRole } from '../middleware/auth.js';
import { crearProyectoSchema, agregarMiembroSchema } from '@pieia/contracts';
import { obtenerBuffer } from '../lib/storage.js';

const router = Router();
router.use(requireAuth);

// Lista de proyectos visibles para el usuario (admin ve todos; el resto, donde es miembro).
router.get('/', async (req, res, next) => {
  try {
    // Los clientes no ven el panel interno (RF-E05); usan el Portal.
    const where = req.user.esAdmin
      ? {}
      : { miembros: { some: { usuarioId: req.user.id, rol: { not: 'cliente' } } } };
    const proyectos = await prisma.proyecto.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { tipologia: { select: { clave: true, nombre: true } } },
    });
    const conTotales = await Promise.all(
      proyectos.map(async (p) => ({
        ...p,
        totalTareas: await prisma.tarea.count({ where: { componente: { proyectoId: p.id } } }),
      }))
    );
    res.json(conTotales);
  } catch (err) {
    next(err);
  }
});

// Detalle de un proyecto con su checklist (requiere ser miembro o admin).
router.get('/:proyectoId', requireProjectRole(), async (req, res, next) => {
  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: req.params.proyectoId },
      include: {
        tipologia: true,
        componentes: {
          include: { tareas: { orderBy: { orden: 'asc' }, include: { asignado: { select: { nombre: true } } } } },
        },
      },
    });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const miRol = req.user.esAdmin ? 'admin' : (req.miembro?.rol ?? null);
    res.json({ ...proyecto, miRol });
  } catch (err) {
    next(err);
  }
});

// Alta de proyecto + generacion automatica del checklist (RF-A01, RF-A02).
router.post('/', async (req, res, next) => {
  try {
    const data = crearProyectoSchema.parse(req.body);

    const dup = await prisma.proyecto.findUnique({ where: { clave: data.clave } });
    if (dup) return res.status(409).json({ error: 'Ya existe un proyecto con esa clave' });

    const plantillas = await prisma.plantillaTarea.findMany({
      where: { tipologiaId: data.tipologiaId },
      orderBy: { orden: 'asc' },
    });
    if (plantillas.length === 0) {
      return res.status(400).json({ error: 'Esa tipologia no tiene plantillas de tarea configuradas' });
    }

    const proyecto = await prisma.$transaction(async (tx) => {
      const p = await tx.proyecto.create({
        data: {
          clave: data.clave,
          nombre: data.nombre,
          clienteNombre: data.clienteNombre,
          estado: data.estado,
          municipio: data.municipio,
          tipologiaId: data.tipologiaId,
          fechaInicio: new Date(),
          fechaCompromiso: data.fechaCompromiso ?? null,
        },
      });

      // El creador queda como coordinador del proyecto.
      await tx.miembroProyecto.create({
        data: { proyectoId: p.id, usuarioId: req.user.id, rol: 'coordinador' },
      });

      // Componente "General" (los proyectos T5 multicomponente se extenderan despues).
      const comp = await tx.componente.create({ data: { proyectoId: p.id, nombre: 'General' } });

      // Instancia las tareas desde las plantillas. Sin dependencias -> pendiente; con ellas -> bloqueada.
      const ordenAId = new Map();
      for (const pt of plantillas) {
        const sinDeps = !pt.dependeDeOrdenes || pt.dependeDeOrdenes.length === 0;
        const tarea = await tx.tarea.create({
          data: {
            componenteId: comp.id,
            nombre: pt.nombre,
            estado: sinDeps ? 'pendiente' : 'bloqueada',
            complejidad: pt.complejidad,
            repetitividad: pt.repetitividad,
            horasEstimadas: pt.horasTeoricas,
            esCritica: pt.esCritica,
            orden: pt.orden,
          },
        });
        ordenAId.set(pt.orden, tarea.id);
      }

      // Crea las dependencias (grafo) entre las tareas generadas.
      for (const pt of plantillas) {
        for (const ord of pt.dependeDeOrdenes ?? []) {
          const predecesoraId = ordenAId.get(ord);
          const sucesoraId = ordenAId.get(pt.orden);
          if (predecesoraId && sucesoraId) {
            await tx.dependencia.create({
              data: { predecesoraId, sucesoraId, tipo: 'fin_a_inicio' },
            });
          }
        }
      }

      return p;
    });

    res.status(201).json(proyecto);
  } catch (err) {
    next(err);
  }
});

// RF-D05: candado de liberacion — todas las tareas no-invalidadas deben estar aprobadas.
router.post('/:proyectoId/liberar', requireProjectRole('coordinador'), async (req, res, next) => {
  try {
    const { proyectoId } = req.params;
    const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (proyecto.estadoProyecto === 'liberado') {
      return res.status(409).json({ error: 'El proyecto ya esta liberado' });
    }

    const pendientes = await prisma.tarea.count({
      where: {
        componente: { proyectoId },
        estado: { notIn: ['aprobada', 'invalidada'] },
      },
    });
    if (pendientes > 0) {
      return res.status(422).json({
        error: `Hay ${pendientes} tarea(s) sin aprobar. Todas las tareas activas deben estar aprobadas para liberar el proyecto.`,
      });
    }

    const actualizado = await prisma.proyecto.update({
      where: { id: proyectoId },
      data: { estadoProyecto: 'liberado' },
    });
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

// RF-C05: descarga ZIP con la version actual de cada entregable de tareas aprobadas.
router.get('/:proyectoId/zip', requireProjectRole(), async (req, res, next) => {
  try {
    const { proyectoId } = req.params;
    const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
    if (!proyecto) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const entregables = await prisma.entregable.findMany({
      where: {
        tarea: { componente: { proyectoId }, estado: 'aprobada' },
        versionActualId: { not: null },
      },
      include: {
        versionActual: true,
        tarea: { select: { nombre: true, orden: true } },
      },
      orderBy: { tarea: { orden: 'asc' } },
    });

    if (entregables.length === 0) {
      return res.status(422).json({ error: 'No hay entregables en tareas aprobadas para este proyecto' });
    }

    const nombreZip = `${proyecto.clave}_entregables.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreZip}"`);

    const zip = new ZipArchive({ zlib: { level: 6 } });
    zip.on('error', (err) => next(err));
    zip.pipe(res);

    for (const e of entregables) {
      if (!e.versionActual) continue;
      const carpeta = `${String(e.tarea.orden).padStart(2, '0')}_${e.tarea.nombre}`;
      const fileBuffer = await obtenerBuffer(e.versionActual.storagePath);
      zip.append(fileBuffer, { name: `${carpeta}/${e.versionActual.nombreArchivo}` });
    }

    await zip.finalize();
  } catch (err) {
    next(err);
  }
});

// ---- Miembros del proyecto (TRD §3: roles por proyecto) ----

router.get('/:proyectoId/miembros', requireProjectRole(), async (req, res, next) => {
  try {
    const miembros = await prisma.miembroProyecto.findMany({
      where: { proyectoId: req.params.proyectoId },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(miembros);
  } catch (err) {
    next(err);
  }
});

router.post('/:proyectoId/miembros', requireProjectRole('coordinador'), async (req, res, next) => {
  try {
    const { email, rol } = agregarMiembroSchema.parse(req.body);
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) {
      return res.status(404).json({ error: 'Ese correo no esta registrado. El usuario debe crear su cuenta primero.' });
    }
    const existe = await prisma.miembroProyecto.findUnique({
      where: { proyectoId_usuarioId: { proyectoId: req.params.proyectoId, usuarioId: usuario.id } },
    });
    if (existe) return res.status(409).json({ error: 'Ese usuario ya es miembro del proyecto' });

    const miembro = await prisma.miembroProyecto.create({
      data: { proyectoId: req.params.proyectoId, usuarioId: usuario.id, rol },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
    });
    res.status(201).json(miembro);
  } catch (err) {
    next(err);
  }
});

router.delete('/:proyectoId/miembros/:usuarioId', requireProjectRole('coordinador'), async (req, res, next) => {
  try {
    await prisma.miembroProyecto.deleteMany({
      where: { proyectoId: req.params.proyectoId, usuarioId: req.params.usuarioId },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
