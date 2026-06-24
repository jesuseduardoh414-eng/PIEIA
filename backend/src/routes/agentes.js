import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { indexarPDF, listarDocumentos } from '../lib/ragPDF.js';
import { registrarEjecucion, completarEjecucion, fallarEjecucion } from '../lib/bitacora.js';
import { verificarAgente } from '../lib/featureFlags.js';
import { encolar, obtenerTrabajo } from '../lib/cola.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(requireAuth);

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    cb(ok ? null : new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'), ok);
  },
});

const uploadPDF = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    cb(ok ? null : new Error('Solo se aceptan archivos PDF'), ok);
  },
});

// AG-01: encola la cuantificacion desde Excel. El worker la procesa (async).
router.post('/ag01/cuantificar', uploadExcel.single('excel'), async (req, res, next) => {
  if (!await verificarAgente('AG-01', res)) return;
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo Excel (.xlsx)' });
    const ej = await registrarEjecucion({ agente: 'AG-01', modelo: 'claude-sonnet-4-6', inputs: { archivo: req.file.originalname } });
    const trabajo = await encolar({
      tipo: 'ag01_cuantificar',
      payload: { archivo: req.file.originalname },
      archivo: req.file.buffer,
      ejecucionId: ej.id,
    });
    res.status(202).json({ trabajoId: trabajo.id, ejecucionId: ej.id, estado: 'encolado' });
  } catch (err) { next(err); }
});

// AG-02: encola la auditoría de información inicial. El worker la procesa (async).
router.post('/ag02/auditar', uploadPDF.single('pdf'), async (req, res, next) => {
  if (!await verificarAgente('AG-02', res)) return;
  const tipo = req.body.tipo || 'mecanica_suelos'; // 'mecanica_suelos' | 'topografia'
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo PDF' });
    if (!['mecanica_suelos', 'topografia'].includes(tipo))
      return res.status(400).json({ error: 'tipo debe ser mecanica_suelos o topografia' });

    const ej = await registrarEjecucion({ agente: 'AG-02', modelo: 'claude-sonnet-4-6', inputs: { archivo: req.file.originalname, tipo } });
    const trabajo = await encolar({
      tipo: 'ag02_auditar',
      payload: { archivo: req.file.originalname, tipo },
      archivo: req.file.buffer,
      ejecucionId: ej.id,
    });
    res.status(202).json({ trabajoId: trabajo.id, ejecucionId: ej.id, estado: 'encolado' });
  } catch (err) { next(err); }
});

// AG-04: indexar PDF en el corpus RAG
router.post('/ag04/indexar', uploadPDF.single('pdf'), async (req, res, next) => {
  if (!await verificarAgente('AG-04', res)) return;
  const t0 = Date.now();
  let ej = null;
  try { ej = await registrarEjecucion({ agente: 'AG-04', modelo: 'voyage-3', inputs: { archivo: req.file?.originalname, tipo: req.body.tipo } }); } catch (_) {}
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo PDF' });
    const tipo = req.body.tipo || 'documento';
    const resultado = await indexarPDF(req.file.buffer, req.file.originalname, tipo);
    const meta = resultado._meta ?? {};
    delete resultado._meta;
    if (ej) completarEjecucion(ej.id, { outputs: resultado, duracionMs: Date.now() - t0, costoUsd: meta.costoUsd, estado: 'aceptada' }).catch(() => {});
    res.json(resultado);
  } catch (err) {
    if (ej) fallarEjecucion(ej.id, err).catch(() => {});
    next(err);
  }
});

// AG-04: encola una consulta al corpus RAG. El worker la procesa (async).
router.post('/ag04/consultar', async (req, res, next) => {
  if (!await verificarAgente('AG-04', res)) return;
  try {
    const { pregunta, tipo } = req.body;
    if (!pregunta?.trim()) return res.status(400).json({ error: 'Escribe una pregunta' });
    const ej = await registrarEjecucion({ agente: 'AG-04', modelo: 'claude-sonnet-4-6 + voyage-3', inputs: { pregunta: pregunta.trim() } });
    const trabajo = await encolar({
      tipo: 'ag04_consultar',
      payload: { pregunta: pregunta.trim(), tipo: tipo || null },
      ejecucionId: ej.id,
    });
    res.status(202).json({ trabajoId: trabajo.id, ejecucionId: ej.id, estado: 'encolado' });
  } catch (err) { next(err); }
});

// Estado de un trabajo de la cola (polling del frontend).
router.get('/trabajos/:id', async (req, res, next) => {
  try {
    const t = await obtenerTrabajo(req.params.id);
    if (!t) return res.status(404).json({ error: 'Trabajo no encontrado' });
    res.json(t);
  } catch (err) { next(err); }
});

// Encola un trabajo de prueba (verifica la mecánica de la cola sin gastar créditos).
router.post('/trabajos/test', async (req, res, next) => {
  try {
    const trabajo = await encolar({ tipo: 'test', payload: { mensaje: req.body?.mensaje || 'ping', ts: Date.now() }, prioridad: 1 });
    res.status(202).json({ trabajoId: trabajo.id, estado: 'encolado' });
  } catch (err) { next(err); }
});

// AG-04: listar documentos indexados
router.get('/ag04/documentos', async (req, res, next) => {
  try {
    const docs = await listarDocumentos();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// ---- Bitacora de ejecuciones ----

// Listar todas las ejecuciones (admin) o pendientes de validacion
router.get('/ejecuciones', async (req, res, next) => {
  try {
    const where = req.query.pendientes === '1' ? { estado: 'pendiente_validacion' } : {};
    const lista = await prisma.ejecucionAgente.findMany({
      where,
      include: {
        proyecto: { select: { clave: true, nombre: true } },
        tarea: { select: { nombre: true } },
        validadoPor: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: req.user.esAdmin ? 100 : 50,
    });
    res.json(lista);
  } catch (err) { next(err); }
});

// Validar una ejecucion (aceptar / editar / rechazar)
router.patch('/ejecuciones/:id/validar', async (req, res, next) => {
  try {
    const { decision, feedback } = req.body; // decision: 'aceptada' | 'editada' | 'rechazada'
    if (!['aceptada', 'editada', 'rechazada'].includes(decision))
      return res.status(400).json({ error: 'decision debe ser aceptada, editada o rechazada' });
    const ej = await prisma.ejecucionAgente.update({
      where: { id: req.params.id },
      data: { estado: decision, validadoPorId: req.user.id, feedback: feedback || null },
      include: { proyecto: { select: { clave: true } }, validadoPor: { select: { nombre: true } } },
    });
    res.json(ej);
  } catch (err) { next(err); }
});

export default router;
