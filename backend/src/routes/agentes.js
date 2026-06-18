import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { generarCatalogoCuantificacion } from '../lib/cuantificacionIA.js';
import { indexarPDF, consultarRAG, listarDocumentos } from '../lib/ragPDF.js';

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
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo Excel (.xlsx)' });
    const catalogo = await generarCatalogoCuantificacion(req.file.buffer);
    res.json(catalogo);
  } catch (err) {
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

export default router;
