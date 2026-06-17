import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { crearVersionEntregable } from '../lib/versiones.js';
import { notificarCoordinadores } from '../lib/notificaciones.js';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
// Inputs que el cliente puede entregar (RF-E02).
const INPUT_TIPOS = ['dwg_arquitectonico', 'dwg_topografia', 'pdf_mecanica_suelos'];

async function esClienteDe(user, proyectoId) {
  const m = await prisma.miembroProyecto.findUnique({
    where: { proyectoId_usuarioId: { proyectoId, usuarioId: user.id } },
  });
  return m?.rol === 'cliente';
}

// Resumen seguro de un proyecto para el cliente (NUNCA expone archivos internos, RF-E05).
async function resumenProyecto(p) {
  const tareas = await prisma.tarea.findMany({
    where: { componente: { proyectoId: p.id } },
    select: { estado: true, esperaClienteSegundos: true, esperaClienteDesde: true },
  });
  const total = tareas.length;
  const aprobadas = tareas.filter((t) => t.estado === 'aprobada').length;
  const esperandoCliente = tareas.filter((t) => t.estado === 'en_espera_cliente').length;
  const esperaSeg = tareas.reduce((acc, t) => {
    let s = t.esperaClienteSegundos || 0;
    if (t.esperaClienteDesde) s += Math.max(0, Math.floor((Date.now() - new Date(t.esperaClienteDesde)) / 1000));
    return acc + s;
  }, 0);
  return {
    id: p.id,
    clave: p.clave,
    nombre: p.nombre,
    estado: p.estado,
    municipio: p.municipio,
    tipologia: p.tipologia,
    avance: total ? Math.round((aprobadas / total) * 100) : 0,
    totalTareas: total,
    aprobadas,
    esperandoCliente,
    estaEsperandoCliente: esperandoCliente > 0,
    esperaSegundos: esperaSeg,
  };
}

// Lista de proyectos del cliente.
router.get('/proyectos', async (req, res, next) => {
  try {
    const membresias = await prisma.miembroProyecto.findMany({
      where: { usuarioId: req.user.id, rol: 'cliente' },
      select: { proyectoId: true },
    });
    const proyectos = await prisma.proyecto.findMany({
      where: { id: { in: membresias.map((m) => m.proyectoId) } },
      include: { tipologia: { select: { clave: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(await Promise.all(proyectos.map(resumenProyecto)));
  } catch (err) {
    next(err);
  }
});

// Detalle seguro + inputs ya entregados por el cliente.
router.get('/proyectos/:proyectoId', async (req, res, next) => {
  try {
    if (!(await esClienteDe(req.user, req.params.proyectoId))) {
      return res.status(403).json({ error: 'Sin acceso' });
    }
    const p = await prisma.proyecto.findUnique({
      where: { id: req.params.proyectoId },
      include: { tipologia: { select: { clave: true, nombre: true } } },
    });
    if (!p) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const resumen = await resumenProyecto(p);
    const inputs = await prisma.entregable.findMany({
      where: { tarea: { componente: { proyectoId: p.id } }, tipo: { in: INPUT_TIPOS } },
      include: { versiones: { orderBy: { numero: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
    const hitos = await prisma.tarea.findMany({
      where: { componente: { proyectoId: p.id }, requiereAprobacionCliente: true },
      orderBy: { orden: 'asc' },
      select: { id: true, nombre: true, estado: true, aprobadoCliente: true, fechaAprobacionCliente: true },
    });
    res.json({
      ...resumen,
      inputs: inputs.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        tipo: e.tipo,
        versiones: e.versiones.length ? e.versiones[0].numero : 0,
        actualizado: e.updatedAt,
      })),
      hitos,
    });
  } catch (err) {
    next(err);
  }
});

// El cliente aprueba un hito (RF-E03). Solo si la tarea está aprobada internamente.
router.post('/proyectos/:proyectoId/hitos/:tareaId/aprobar', async (req, res, next) => {
  try {
    const { proyectoId, tareaId } = req.params;
    if (!(await esClienteDe(req.user, proyectoId))) return res.status(403).json({ error: 'Sin acceso' });

    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      include: { componente: { select: { proyectoId: true } } },
    });
    if (!tarea || tarea.componente.proyectoId !== proyectoId) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    if (!tarea.requiereAprobacionCliente) {
      return res.status(400).json({ error: 'Esta tarea no es un hito de aprobacion de cliente' });
    }
    if (tarea.estado !== 'aprobada') {
      return res.status(409).json({ error: 'El equipo aun no ha aprobado esta etapa internamente' });
    }
    if (tarea.aprobadoCliente) {
      return res.status(409).json({ error: 'Ya aprobaste esta etapa anteriormente' });
    }

    const actualizada = await prisma.tarea.update({
      where: { id: tarea.id },
      data: { aprobadoCliente: true, fechaAprobacionCliente: new Date() },
    });

    notificarCoordinadores(proyectoId, {
      tipo: 'hito_aprobado_cliente',
      titulo: `Hito "${tarea.nombre}" aprobado por el cliente`,
      cuerpo: `${req.user.nombre} confirmo su aprobacion.`,
      url: `/proyectos/${proyectoId}`,
    }).catch(() => {});

    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// El cliente sube un input. RF-E02: reanuda las tareas que esperaban su informacion.
router.post('/proyectos/:proyectoId/inputs', upload.single('archivo'), async (req, res, next) => {
  try {
    const proyectoId = req.params.proyectoId;
    if (!(await esClienteDe(req.user, proyectoId))) return res.status(403).json({ error: 'Sin acceso' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
    if (!INPUT_TIPOS.includes(req.body.tipo)) {
      return res.status(400).json({ error: 'Tipo de input no permitido' });
    }

    // Se adjunta a la primera tarea del proyecto (recepcion de informacion).
    const tarea = await prisma.tarea.findFirst({
      where: { componente: { proyectoId } },
      orderBy: { orden: 'asc' },
    });
    if (!tarea) return res.status(400).json({ error: 'El proyecto no tiene tareas' });

    let entregable = await prisma.entregable.findFirst({
      where: {
        tareaId: tarea.id,
        tipo: req.body.tipo,
      },
      include: {
        versiones: { orderBy: { numero: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!entregable) {
      entregable = await prisma.entregable.create({
        data: { tareaId: tarea.id, nombre: req.file.originalname, tipo: req.body.tipo },
        include: {
          versiones: { orderBy: { numero: 'desc' }, take: 1 },
        },
      });
    }

    const siguienteVersion = (entregable.versiones[0]?.numero || 0) + 1;
    const version = await crearVersionEntregable(entregable.id, siguienteVersion, req.file, req.user.id, { origen: 'humano' });
    await prisma.entregable.update({
      where: { id: entregable.id },
      data: { versionActualId: version.id, nombre: req.file.originalname },
    });

    // Reanuda tareas en espera del cliente (cierra el intervalo de espera).
    const enEspera = await prisma.tarea.findMany({ where: { componente: { proyectoId }, estado: 'en_espera_cliente' } });
    const ahora = new Date();
    for (const t of enEspera) {
      const seg = t.esperaClienteDesde ? Math.max(0, Math.floor((ahora - new Date(t.esperaClienteDesde)) / 1000)) : 0;
      await prisma.tarea.update({
        where: { id: t.id },
        data: { estado: 'en_desarrollo', esperaClienteSegundos: (t.esperaClienteSegundos || 0) + seg, esperaClienteDesde: null },
      });
    }

    notificarCoordinadores(proyectoId, {
      tipo: 'input_cliente',
      titulo: 'Input recibido del cliente',
      cuerpo: `Se recibió "${req.file.originalname}" (${req.body.tipo.replace(/_/g, ' ')}).`,
      url: `/proyectos/${proyectoId}`,
    }).catch(() => {});

    res.status(201).json({ ok: true, reanudadas: enEspera.length });
  } catch (err) {
    next(err);
  }
});

export default router;
