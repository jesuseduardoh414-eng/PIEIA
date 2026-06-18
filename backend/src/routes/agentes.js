import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { generarCatalogoCuantificacion } from '../lib/cuantificacionIA.js';
import { indexarPDF, consultarRAG, listarDocumentos } from '../lib/ragPDF.js';
import { registrarEjecucion, completarEjecucion, fallarEjecucion } from '../lib/bitacora.js';
import { verificarAgente } from '../lib/featureFlags.js';
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

// AG-01: cuantificacion automatica desde Excel de diseno estructural
router.post('/ag01/cuantificar', uploadExcel.single('excel'), async (req, res, next) => {
  if (!await verificarAgente('AG-01', res)) return;
  const t0 = Date.now();
  let ej = null;
  try { ej = await registrarEjecucion({ agente: 'AG-01', modelo: 'claude-sonnet-4-6', inputs: { archivo: req.file?.originalname } }); } catch (_) {}
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo Excel (.xlsx)' });
    const catalogo = await generarCatalogoCuantificacion(req.file.buffer);
    const meta = catalogo._meta ?? {};
    delete catalogo._meta;
    if (ej) completarEjecucion(ej.id, { outputs: catalogo, duracionMs: Date.now() - t0, costoUsd: meta.costoUsd, scoreConfianza: null, estado: 'pendiente_validacion' }).catch(() => {});
    res.json({ ...catalogo, ejecucionId: ej?.id });
  } catch (err) {
    if (ej) fallarEjecucion(ej.id, err).catch(() => {});
    next(err);
  }
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

// AG-04: consultar el corpus RAG con una pregunta
router.post('/ag04/consultar', async (req, res, next) => {
  if (!await verificarAgente('AG-04', res)) return;
  const t0 = Date.now();
  let ej = null;
  try { ej = await registrarEjecucion({ agente: 'AG-04', modelo: 'claude-sonnet-4-6 + voyage-3', inputs: { pregunta: req.body.pregunta } }); } catch (_) {}
  try {
    const { pregunta, tipo } = req.body;
    if (!pregunta?.trim()) return res.status(400).json({ error: 'Escribe una pregunta' });
    const resultado = await consultarRAG(pregunta.trim(), tipo || null);
    const meta = resultado._meta ?? {};
    delete resultado._meta;
    if (ej) completarEjecucion(ej.id, { outputs: { respuesta: resultado.respuesta?.slice(0, 300), fuentes: resultado.fuentes }, duracionMs: Date.now() - t0, costoUsd: meta.costoUsd, estado: 'pendiente_validacion' }).catch(() => {});
    res.json(resultado);
  } catch (err) {
    if (ej) fallarEjecucion(ej.id, err).catch(() => {});
    next(err);
  }
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
