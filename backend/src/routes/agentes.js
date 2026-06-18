import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { generarCatalogoCuantificacion } from '../lib/cuantificacionIA.js';
import { indexarPDF, consultarRAG, listarDocumentos } from '../lib/ragPDF.js';
import { registrarEjecucion, completarEjecucion, fallarEjecucion } from '../lib/bitacora.js';
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
  const t0 = Date.now();
  const ejecucion = await registrarEjecucion({ agente: 'AG-01', modelo: 'claude-sonnet-4-6', inputs: { archivo: req.file?.originalname } });
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo Excel (.xlsx)' });
    const catalogo = await generarCatalogoCuantificacion(req.file.buffer);
    await completarEjecucion(ejecucion.id, { outputs: catalogo, duracionMs: Date.now() - t0, estado: 'pendiente_validacion' });
    res.json({ ...catalogo, ejecucionId: ejecucion.id });
  } catch (err) {
    await fallarEjecucion(ejecucion.id, err);
    next(err);
  }
});

// AG-04: indexar PDF en el corpus RAG
router.post('/ag04/indexar', uploadPDF.single('pdf'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo PDF' });
    const tipo = req.body.tipo || 'documento';
    const resultado = await indexarPDF(req.file.buffer, req.file.originalname, tipo);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
});

// AG-04: consultar el corpus RAG con una pregunta
router.post('/ag04/consultar', async (req, res, next) => {
  try {
    const { pregunta, tipo } = req.body;
    if (!pregunta?.trim()) return res.status(400).json({ error: 'Escribe una pregunta' });
    const resultado = await consultarRAG(pregunta.trim(), tipo || null);
    res.json(resultado);
  } catch (err) {
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
