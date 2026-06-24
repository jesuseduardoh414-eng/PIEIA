import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { extraerDeDxf, convertirDwgADxf } from '../lib/dxf.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(dxf|dwg)$/i.test(file.originalname);
    cb(ok ? null : new Error('Solo se aceptan archivos .dxf o .dwg'), ok);
  },
});

// POST /api/dxf/extraer — sube un DXF (o DWG si hay ODA configurado) y devuelve
// las entidades extraídas: capas, textos por capa, bloques y dimensiones.
router.post('/extraer', upload.single('archivo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Sube un archivo .dxf o .dwg' });

    let bufferDxf = req.file.buffer;
    let convertido = false;
    if (/\.dwg$/i.test(req.file.originalname)) {
      try {
        bufferDxf = convertirDwgADxf(req.file.buffer, req.file.originalname);
        convertido = true;
      } catch (e) {
        if (e.code === 'ODA_NO_CONFIGURADO') return res.status(422).json({ error: e.message });
        throw e;
      }
    }

    const datos = extraerDeDxf(bufferDxf);
    res.json({ archivo: req.file.originalname, convertidoDeDwg: convertido, ...datos });
  } catch (err) { next(err); }
});

export default router;
