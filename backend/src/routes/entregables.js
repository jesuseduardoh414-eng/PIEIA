import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';
import { obtenerStream, eliminarArchivo } from '../lib/storage.js';
import { crearVersionEntregable } from '../lib/versiones.js';
import { TIPO_ENTREGABLE, valores } from '@pieia/contracts';

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const TIPOS = valores(TIPO_ENTREGABLE);
const ROLES_SUBEN = ['admin', 'coordinador', 'calculista', 'dibujante']; // no lectura/cliente

async function tareaYRol(user, tareaId) {
  const tarea = await prisma.tarea.findUnique({
    where: { id: tareaId },
    include: { componente: { select: { proyectoId: true } } },
  });
  if (!tarea) return { codigo: 404, msg: 'Tarea no encontrada' };
  const rol = await rolEnProyecto(user, tarea.componente.proyectoId);
  if (!rol) return { codigo: 403, msg: 'Sin acceso a este proyecto' };
  return { tarea, rol };
}

// Lista de entregables de una tarea con su historial de versiones.
router.get('/tareas/:tareaId/entregables', async (req, res, next) => {
  try {
    const { tarea, rol, codigo, msg } = await tareaYRol(req.user, req.params.tareaId);
    if (codigo) return res.status(codigo).json({ error: msg });
    if (rol === 'cliente') return res.status(403).json({ error: 'Sin acceso' }); // RF-E05
    const entregables = await prisma.entregable.findMany({
      where: { tareaId: tarea.id },
      orderBy: { createdAt: 'asc' },
      include: {
        versiones: {
          orderBy: { numero: 'desc' },
          include: { subidoPorUsuario: { select: { nombre: true } } },
        },
      },
    });
    res.json(entregables);
  } catch (err) {
    next(err);
  }
});

// Crea un entregable nuevo subiendo su version 1 (RF-C02).
router.post('/tareas/:tareaId/entregables', upload.single('archivo'), async (req, res, next) => {
  try {
    const { tarea, rol, codigo, msg } = await tareaYRol(req.user, req.params.tareaId);
    if (codigo) return res.status(codigo).json({ error: msg });
    if (!ROLES_SUBEN.includes(rol)) return res.status(403).json({ error: 'Tu rol no puede subir entregables' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

    const tipo = TIPOS.includes(req.body.tipo) ? req.body.tipo : 'otro';
    const nombre = (req.body.nombre || req.file.originalname).slice(0, 200);

    const entregable = await prisma.entregable.create({ data: { tareaId: tarea.id, nombre, tipo } });
    const version = await crearVersionEntregable(entregable.id, 1, req.file, req.user.id, { notas: req.body.notas });
    await prisma.entregable.update({ where: { id: entregable.id }, data: { versionActualId: version.id } });

    res.status(201).json({ ...entregable, versionActualId: version.id, versiones: [version] });
  } catch (err) {
    next(err);
  }
});

// Sube una version nueva de un entregable existente (no sobrescribe nada).
router.post('/entregables/:entregableId/versiones', upload.single('archivo'), async (req, res, next) => {
  try {
    const ent = await prisma.entregable.findUnique({
      where: { id: req.params.entregableId },
      include: {
        tarea: { include: { componente: { select: { proyectoId: true } } } },
        versiones: { orderBy: { numero: 'desc' }, take: 1 },
      },
    });
    if (!ent) return res.status(404).json({ error: 'Entregable no encontrado' });
    const rol = await rolEnProyecto(req.user, ent.tarea.componente.proyectoId);
    if (!rol) return res.status(403).json({ error: 'Sin acceso' });
    if (!ROLES_SUBEN.includes(rol)) return res.status(403).json({ error: 'Tu rol no puede subir entregables' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });

    const siguiente = (ent.versiones[0]?.numero || 0) + 1;
    const version = await crearVersionEntregable(ent.id, siguiente, req.file, req.user.id, { notas: req.body.notas });
    await prisma.entregable.update({ where: { id: ent.id }, data: { versionActualId: version.id } });

    res.status(201).json(version);
  } catch (err) {
    next(err);
  }
});

// Elimina un entregable completo (todas sus versiones y archivos físicos).
// Solo admin y coordinador pueden borrar.
router.delete('/entregables/:entregableId', async (req, res, next) => {
  try {
    const ent = await prisma.entregable.findUnique({
      where: { id: req.params.entregableId },
      include: {
        versiones: { select: { storagePath: true } },
        tarea: { include: { componente: { select: { proyectoId: true } } } },
      },
    });
    if (!ent) return res.status(404).json({ error: 'Entregable no encontrado' });
    const rol = await rolEnProyecto(req.user, ent.tarea.componente.proyectoId);
    if (!['admin', 'coordinador'].includes(rol)) {
      return res.status(403).json({ error: 'Solo admin o coordinador pueden eliminar entregables' });
    }

    // Romper la FK circular antes de borrar en cascada
    await prisma.entregable.update({ where: { id: ent.id }, data: { versionActualId: null } });
    await prisma.entregable.delete({ where: { id: ent.id } });

    // Borrar archivos físicos (best-effort)
    await Promise.all(ent.versiones.map((v) => eliminarArchivo(v.storagePath)));

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Descarga una version concreta (el archivo es inmutable).
router.get('/versiones/:versionId/descargar', async (req, res, next) => {
  try {
    const v = await prisma.versionEntregable.findUnique({
      where: { id: req.params.versionId },
      include: { entregable: { include: { tarea: { include: { componente: { select: { proyectoId: true } } } } } } },
    });
    if (!v) return res.status(404).json({ error: 'Version no encontrada' });
    const rol = await rolEnProyecto(req.user, v.entregable.tarea.componente.proyectoId);
    if (!rol || rol === 'cliente') return res.status(403).json({ error: 'Sin acceso' }); // RF-E05

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(v.nombreArchivo)}"`);
    (await obtenerStream(v.storagePath)).pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
