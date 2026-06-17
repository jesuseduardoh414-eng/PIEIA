import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';
import { cambiarEstadoTareaSchema, asignarTareaSchema, TRANSICIONES_TAREA } from '@pieia/contracts';
import { crearNotificacion, notificarCoordinadores, notificarMiembros } from '../lib/notificaciones.js';

const router = Router();
router.use(requireAuth);

// Quien puede mover una tarea a cada estado destino (RF-B01).
// 'asignado' = el responsable de la tarea; 'coordinador'/'admin' por rol.
const PERMISO_DESTINO = {
  pendiente: ['coordinador', 'admin'], // reactivar una tarea invalidada
  en_desarrollo: ['asignado', 'coordinador', 'admin'], // iniciar / corregir / reanudar
  en_espera_cliente: ['asignado', 'coordinador', 'admin'],
  en_revision: ['asignado', 'coordinador', 'admin'], // entregar
};

const ROLES_ASIGNABLES = ['coordinador', 'calculista', 'dibujante', 'admin'];

// RF-B02: al aprobar una tarea, desbloquea las sucesoras cuyas predecesoras
// (fin_a_inicio) esten TODAS aprobadas.
export async function desbloquearSucesoras(tareaId) {
  const desbloqueadas = [];
  const deps = await prisma.dependencia.findMany({
    where: { predecesoraId: tareaId },
    select: { sucesoraId: true },
  });
  for (const { sucesoraId } of deps) {
    const suc = await prisma.tarea.findUnique({
      where: { id: sucesoraId },
      include: { componente: { select: { proyectoId: true } } },
    });
    if (!suc || suc.estado !== 'bloqueada') continue;

    const preds = await prisma.dependencia.findMany({
      where: { sucesoraId, tipo: 'fin_a_inicio' },
      include: { predecesora: { select: { estado: true } } },
    });
    const todasAprobadas = preds.every((d) => d.predecesora.estado === 'aprobada');
    if (todasAprobadas) {
      const t = await prisma.tarea.update({ where: { id: sucesoraId }, data: { estado: 'pendiente' } });
      desbloqueadas.push({ id: t.id, nombre: t.nombre });

      if (suc.asignadoA) {
        crearNotificacion({
          usuarioId: suc.asignadoA,
          tipo: 'tarea_desbloqueada',
          titulo: `"${suc.nombre}" ya está disponible`,
          cuerpo: 'Una predecesora fue aprobada. Ya puedes iniciar esta tarea.',
          url: `/proyectos/${suc.componente.proyectoId}`,
        }).catch(() => {});
      }
    }
  }
  return desbloqueadas;
}

// Cambio de estado de una tarea (maquina de estados estricta, validada en servidor).
router.patch('/:tareaId/estado', async (req, res, next) => {
  try {
    const { nuevoEstado, horasReales } = cambiarEstadoTareaSchema.parse(req.body);

    const tarea = await prisma.tarea.findUnique({
      where: { id: req.params.tareaId },
      include: { componente: { select: { proyectoId: true } } },
    });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const proyectoId = tarea.componente.proyectoId;
    const rol = await rolEnProyecto(req.user, proyectoId);
    if (!rol) return res.status(403).json({ error: 'No eres miembro de este proyecto' });

    // 1) Transicion valida segun la maquina de estados.
    const permitidas = TRANSICIONES_TAREA[tarea.estado] ?? [];
    if (!permitidas.includes(nuevoEstado)) {
      return res
        .status(409)
        .json({ error: `No se puede pasar de "${tarea.estado}" a "${nuevoEstado}"`, permitidas });
    }

    // 2) El destino debe ser operable manualmente y el rol debe tener permiso.
    const permisos = PERMISO_DESTINO[nuevoEstado];
    if (!permisos) {
      return res.status(409).json({ error: `El estado "${nuevoEstado}" es automatico, no manual` });
    }
    const esAsignado = tarea.asignadoA === req.user.id;
    const autorizado = permisos.includes(rol) || (permisos.includes('asignado') && esAsignado);
    if (!autorizado) {
      return res.status(403).json({ error: 'No tienes permiso para esta accion' });
    }

    // RF-C01: gate — no puede pasar a en_revision sin al menos un entregable subido.
    if (nuevoEstado === 'en_revision') {
      const entregableCount = await prisma.entregable.count({ where: { tareaId: tarea.id } });
      if (entregableCount === 0) {
        return res.status(422).json({ error: 'Sube al menos un entregable antes de enviar a revision' });
      }
    }

    // 3) Actualiza. horas_reales se captura al entregar/aprobar (RF-B06).
    const ahora = new Date();
    const data = { estado: nuevoEstado };
    if (horasReales != null && (nuevoEstado === 'en_revision' || nuevoEstado === 'aprobada')) {
      data.horasReales = horasReales;
    }

    // RF-B03: contador de dias atribuibles al cliente.
    if (nuevoEstado === 'en_espera_cliente') {
      data.esperaClienteDesde = ahora; // abre intervalo
    }
    if (tarea.estado === 'en_espera_cliente' && tarea.esperaClienteDesde) {
      const seg = Math.floor((ahora - new Date(tarea.esperaClienteDesde)) / 1000);
      data.esperaClienteSegundos = (tarea.esperaClienteSegundos || 0) + Math.max(0, seg);
      data.esperaClienteDesde = null; // cierra intervalo
    }

    const actualizada = await prisma.tarea.update({ where: { id: tarea.id }, data });

    // 4) Desbloqueo en cascada al aprobar.
    let desbloqueadas = [];
    if (nuevoEstado === 'aprobada') {
      desbloqueadas = await desbloquearSucesoras(tarea.id);
    }

    // 5) Notificaciones por cambio de estado (fire-and-forget).
    const url = `/proyectos/${proyectoId}`;
    if (nuevoEstado === 'en_revision') {
      notificarCoordinadores(proyectoId, {
        tipo: 'tarea_revision',
        titulo: `"${tarea.nombre}" enviada a revision`,
        cuerpo: 'Requiere firma interna.',
        url,
      }, [req.user.id]).catch(() => {});
    } else if (nuevoEstado === 'aprobada') {
      notificarMiembros(proyectoId, {
        tipo: 'tarea_aprobada',
        titulo: `"${tarea.nombre}" aprobada`,
        url,
      }, [req.user.id]).catch(() => {});
    } else if (nuevoEstado === 'con_observaciones' && tarea.asignadoA && tarea.asignadoA !== req.user.id) {
      crearNotificacion({
        usuarioId: tarea.asignadoA,
        tipo: 'tarea_observaciones',
        titulo: `"${tarea.nombre}" tiene observaciones`,
        cuerpo: 'Revisa y corrige antes de reenviar.',
        url,
      }).catch(() => {});
    } else if (nuevoEstado === 'invalidada') {
      notificarMiembros(proyectoId, {
        tipo: 'tarea_invalidada',
        titulo: `"${tarea.nombre}" fue invalidada`,
        cuerpo: 'Cambio de alcance registrado.',
        url,
      }, [req.user.id]).catch(() => {});
    }

    res.json({ tarea: actualizada, desbloqueadas });
  } catch (err) {
    next(err);
  }
});

// Toggle hito de cliente (RF-E03): marca/desmarca requiereAprobacionCliente. Solo coordinador/admin.
router.patch('/:tareaId/hito', async (req, res, next) => {
  try {
    const tarea = await prisma.tarea.findUnique({
      where: { id: req.params.tareaId },
      include: { componente: { select: { proyectoId: true } } },
    });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const rol = await rolEnProyecto(req.user, tarea.componente.proyectoId);
    if (!['admin', 'coordinador'].includes(rol)) {
      return res.status(403).json({ error: 'Solo el coordinador puede marcar hitos' });
    }

    const actualizada = await prisma.tarea.update({
      where: { id: tarea.id },
      data: { requiereAprobacionCliente: !tarea.requiereAprobacionCliente },
    });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// Asignar (o desasignar) una tarea a un miembro del proyecto. Solo coordinador/admin.
router.patch('/:tareaId/asignar', async (req, res, next) => {
  try {
    const { usuarioId } = asignarTareaSchema.parse(req.body);
    const tarea = await prisma.tarea.findUnique({
      where: { id: req.params.tareaId },
      include: { componente: { select: { proyectoId: true } } },
    });
    if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });

    const proyectoId = tarea.componente.proyectoId;
    const rol = await rolEnProyecto(req.user, proyectoId);
    if (!rol) return res.status(403).json({ error: 'No eres miembro de este proyecto' });
    if (!['admin', 'coordinador'].includes(rol)) {
      return res.status(403).json({ error: 'Solo el coordinador asigna tareas' });
    }

    if (usuarioId) {
      const miembro = await prisma.miembroProyecto.findUnique({
        where: { proyectoId_usuarioId: { proyectoId, usuarioId } },
      });
      if (!miembro) return res.status(400).json({ error: 'El usuario no es miembro del proyecto' });
      if (!ROLES_ASIGNABLES.includes(miembro.rol)) {
        return res.status(400).json({ error: 'Ese rol no puede ser responsable de tareas' });
      }
    }

    const actualizada = await prisma.tarea.update({
      where: { id: tarea.id },
      data: { asignadoA: usuarioId },
      include: { asignado: { select: { nombre: true } } },
    });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

export default router;
