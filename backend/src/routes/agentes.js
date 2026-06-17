import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { generarCatalogoCuantificacion } from '../lib/cuantificacionIA.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls');
    cb(ok ? null : new Error('Solo se aceptan archivos Excel (.xlsx, .xls)'), ok);
  },
});

// AG-01: cuantificacion automatica desde Excel de diseno estructural
router.post('/ag01/cuantificar', upload.single('excel'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo Excel (.xlsx)' });
    const catalogo = await generarCatalogoCuantificacion(req.file.buffer);
    res.json(catalogo);
  } catch (err) {
    next(err);
  }
});

export default router;
