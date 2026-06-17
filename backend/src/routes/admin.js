import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function adminOnly(req, res, next) {
  if (!req.user.esAdmin) return res.status(403).json({ error: 'Solo administradores del sistema' });
  next();
}

// --- Estadisticas globales ---
router.get('/stats', adminOnly, async (req, res, next) => {
  try {
    const [usuarios, proyectos, tareas, aprobadas, enRevision, liberados] = await Promise.all([
      prisma.usuario.count(),
      prisma.proyecto.count(),
      prisma.tarea.count(),
      prisma.tarea.count({ where: { estado: 'aprobada' } }),
      prisma.tarea.count({ where: { estado: 'en_revision' } }),
      prisma.proyecto.count({ where: { estadoProyecto: 'liberado' } }),
    ]);
    res.json({ usuarios, proyectos, tareas, aprobadas, enRevision, liberados });
  } catch (err) {
    next(err);
  }
});

// --- Usuarios ---
router.get('/usuarios', adminOnly, async (req, res, next) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nombre: true,
        email: true,
        esAdmin: true,
        createdAt: true,
        _count: { select: { membresias: true } },
      },
    });
    res.json(usuarios);
  } catch (err) {
    next(err);
  }
});

// Toggle esAdmin (no se puede modificar a uno mismo)
router.patch('/usuarios/:id/admin', adminOnly, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'No puedes modificar tu propio rol de administrador' });
    }
    const usuario = await prisma.usuario.findUnique({ where: { id: req.params.id } });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const actualizado = await prisma.usuario.update({
      where: { id: req.params.id },
      data: { esAdmin: !usuario.esAdmin },
      select: { id: true, nombre: true, email: true, esAdmin: true },
    });
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

// --- Tipologias (todas, incluidas inactivas) ---
router.get('/tipologias', adminOnly, async (req, res, next) => {
  try {
    const tipologias = await prisma.tipologia.findMany({
      orderBy: { clave: 'asc' },
      include: {
        disciplina: { select: { nombre: true } },
        _count: { select: { plantillas: true, proyectos: true } },
      },
    });
    res.json(tipologias);
  } catch (err) {
    next(err);
  }
});

// Crear tipologia
router.post('/tipologias', adminOnly, async (req, res, next) => {
  try {
    const { clave, nombre, descripcion, disciplinaId } = req.body;
    if (!clave || !nombre || !disciplinaId) {
      return res.status(400).json({ error: 'clave, nombre y disciplinaId son requeridos' });
    }
    const dup = await prisma.tipologia.findUnique({ where: { clave: clave.toUpperCase() } });
    if (dup) return res.status(409).json({ error: 'Ya existe una tipologia con esa clave' });

    const tipologia = await prisma.tipologia.create({
      data: { clave: clave.toUpperCase(), nombre, descripcion: descripcion || null, disciplinaId },
      include: { disciplina: { select: { nombre: true } }, _count: { select: { plantillas: true, proyectos: true } } },
    });
    res.status(201).json(tipologia);
  } catch (err) {
    next(err);
  }
});

// Actualizar tipologia (nombre, descripcion, toggle activa)
router.patch('/tipologias/:id', adminOnly, async (req, res, next) => {
  try {
    const tipologia = await prisma.tipologia.findUnique({ where: { id: req.params.id } });
    if (!tipologia) return res.status(404).json({ error: 'Tipologia no encontrada' });

    const data = {};
    if (req.body.nombre !== undefined) data.nombre = req.body.nombre;
    if (req.body.descripcion !== undefined) data.descripcion = req.body.descripcion;
    if (req.body.activa !== undefined) data.activa = Boolean(req.body.activa);

    const actualizada = await prisma.tipologia.update({
      where: { id: req.params.id },
      data,
      include: { disciplina: { select: { nombre: true } }, _count: { select: { plantillas: true, proyectos: true } } },
    });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// Disciplinas disponibles (para el formulario de nueva tipologia)
router.get('/disciplinas', adminOnly, async (req, res, next) => {
  try {
    const disciplinas = await prisma.disciplina.findMany({ orderBy: { nombre: 'asc' } });
    res.json(disciplinas);
  } catch (err) {
    next(err);
  }
});

// --- Checklist de revision por tipo de entregable (RF-D04) ---

router.get('/checklist', adminOnly, async (req, res, next) => {
  try {
    const items = await prisma.checklistRevisionItem.findMany({
      orderBy: [{ tipoEntregable: 'asc' }, { orden: 'asc' }, { createdAt: 'asc' }],
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/checklist', adminOnly, async (req, res, next) => {
  try {
    const { tipoEntregable, texto, orden } = req.body;
    if (!tipoEntregable || !texto?.trim()) {
      return res.status(400).json({ error: 'Tipo de entregable y texto son requeridos' });
    }
    const item = await prisma.checklistRevisionItem.create({
      data: { tipoEntregable, texto: texto.trim(), orden: Number(orden) || 0 },
    });
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.patch('/checklist/:id', adminOnly, async (req, res, next) => {
  try {
    const item = await prisma.checklistRevisionItem.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Item no encontrado' });
    const actualizado = await prisma.checklistRevisionItem.update({
      where: { id: req.params.id },
      data: { activo: !item.activo },
    });
    res.json(actualizado);
  } catch (err) {
    next(err);
  }
});

// --- Plantillas de tareas por tipologia (RF-A03) ---

router.get('/tipologias/:tipologiaId/plantillas', adminOnly, async (req, res, next) => {
  try {
    const plantillas = await prisma.plantillaTarea.findMany({
      where: { tipologiaId: req.params.tipologiaId },
      orderBy: { orden: 'asc' },
    });
    res.json(plantillas);
  } catch (err) {
    next(err);
  }
});

router.post('/tipologias/:tipologiaId/plantillas', adminOnly, async (req, res, next) => {
  try {
    const tip = await prisma.tipologia.findUnique({ where: { id: req.params.tipologiaId } });
    if (!tip) return res.status(404).json({ error: 'Tipologia no encontrada' });

    const { nombre, horasTeoricas, rolSugerido, complejidad, repetitividad, esCritica, orden, dependeDeOrdenes } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre es requerido' });

    const plantilla = await prisma.plantillaTarea.create({
      data: {
        tipologiaId: req.params.tipologiaId,
        nombre: nombre.trim(),
        horasTeoricas: horasTeoricas != null && horasTeoricas !== '' ? Number(horasTeoricas) : null,
        rolSugerido: rolSugerido || null,
        complejidad: Number(complejidad) || 5,
        repetitividad: Number(repetitividad) || 5,
        esCritica: Boolean(esCritica),
        orden: Number(orden) || 0,
        dependeDeOrdenes: Array.isArray(dependeDeOrdenes) ? dependeDeOrdenes.map(Number) : [],
      },
    });
    res.status(201).json(plantilla);
  } catch (err) {
    next(err);
  }
});

router.patch('/plantillas/:id', adminOnly, async (req, res, next) => {
  try {
    const plantilla = await prisma.plantillaTarea.findUnique({ where: { id: req.params.id } });
    if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });

    const data = {};
    if (req.body.nombre !== undefined) data.nombre = req.body.nombre.trim();
    if (req.body.horasTeoricas !== undefined) {
      data.horasTeoricas = req.body.horasTeoricas != null && req.body.horasTeoricas !== '' ? Number(req.body.horasTeoricas) : null;
    }
    if (req.body.rolSugerido !== undefined) data.rolSugerido = req.body.rolSugerido || null;
    if (req.body.complejidad !== undefined) data.complejidad = Number(req.body.complejidad);
    if (req.body.repetitividad !== undefined) data.repetitividad = Number(req.body.repetitividad);
    if (req.body.esCritica !== undefined) data.esCritica = Boolean(req.body.esCritica);
    if (req.body.orden !== undefined) data.orden = Number(req.body.orden);
    if (req.body.dependeDeOrdenes !== undefined) {
      data.dependeDeOrdenes = Array.isArray(req.body.dependeDeOrdenes) ? req.body.dependeDeOrdenes.map(Number) : [];
    }

    const actualizada = await prisma.plantillaTarea.update({ where: { id: req.params.id }, data });
    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

router.delete('/plantillas/:id', adminOnly, async (req, res, next) => {
  try {
    const plantilla = await prisma.plantillaTarea.findUnique({ where: { id: req.params.id } });
    if (!plantilla) return res.status(404).json({ error: 'Plantilla no encontrada' });
    await prisma.plantillaTarea.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
