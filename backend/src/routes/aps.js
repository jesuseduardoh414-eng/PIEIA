import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { rolEnProyecto } from '../lib/proyectoAcceso.js';
import { obtenerBuffer } from '../lib/storage.js';
import { obtenerToken, asegurarBucket, subirArchivo, iniciarTraduccion, obtenerManifiesto } from '../lib/aps.js';
import { permiteAccesoInterno } from '../lib/policy.js';

const router = Router();
router.use(requireAuth);

// Carga el archivo al OSS de APS y lanza la traducción a SVF2.
// El cliente sigue el estado con GET /versiones/:id/aps.
router.post('/versiones/:versionId/traducir', async (req, res, next) => {
  try {
    const version = await prisma.versionEntregable.findUnique({
      where: { id: req.params.versionId },
      include: {
        entregable: { include: { tarea: { include: { componente: { select: { proyectoId: true } } } } } },
      },
    });
    if (!version) return res.status(404).json({ error: 'Version no encontrada' });

    const proyectoId = version.entregable.tarea.componente.proyectoId;
    const rol = await rolEnProyecto(req.user, proyectoId);
    if (!permiteAccesoInterno(rol)) return res.status(403).json({ error: 'Sin acceso' }); // CA-E01

    const buffer = await obtenerBuffer(version.storagePath);

    const token = await obtenerToken();
    await asegurarBucket(token);

    // Clave única en el bucket: {versionId}-{nombreArchivo}
    const objectKey = `${version.id}-${version.nombreArchivo}`;
    const urn = await subirArchivo(token, objectKey, buffer);
    await iniciarTraduccion(token, urn);

    const actualizada = await prisma.versionEntregable.update({
      where: { id: version.id },
      data: { apsUrn: urn, apsListo: false },
    });

    res.json(actualizada);
  } catch (err) {
    next(err);
  }
});

// Estado de la traducción para una versión: no_subido | pendiente | traduciendo | listo | error
router.get('/versiones/:versionId/aps', async (req, res, next) => {
  try {
    const version = await prisma.versionEntregable.findUnique({
      where: { id: req.params.versionId },
      include: {
        entregable: { include: { tarea: { include: { componente: { select: { proyectoId: true } } } } } },
      },
    });
    if (!version) return res.status(404).json({ error: 'Version no encontrada' });

    const rol = await rolEnProyecto(req.user, version.entregable.tarea.componente.proyectoId);
    if (!permiteAccesoInterno(rol)) return res.status(403).json({ error: 'Sin acceso' }); // CA-E01

    if (!version.apsUrn) return res.json({ estado: 'no_subido' });
    if (version.apsListo) return res.json({ estado: 'listo', urn: version.apsUrn });

    const token = await obtenerToken();
    const manifiesto = await obtenerManifiesto(token, version.apsUrn);

    if (!manifiesto) return res.json({ estado: 'pendiente', urn: version.apsUrn });

    const estado =
      manifiesto.status === 'success' ? 'listo'
      : manifiesto.status === 'failed' ? 'error'
      : 'traduciendo';

    const progreso = manifiesto.progress ?? '0%';

    if (estado === 'listo' && !version.apsListo) {
      await prisma.versionEntregable.update({ where: { id: version.id }, data: { apsListo: true } });
    }

    res.json({ estado, progreso, urn: version.apsUrn });
  } catch (err) {
    next(err);
  }
});

// Token de viewer 2-legged para el frontend (scope data:read).
// Solo usuarios autenticados pueden pedirlo.
router.get('/aps/token-visor', async (req, res, next) => {
  try {
    const token = await obtenerToken();
    res.json({ access_token: token });
  } catch (err) {
    next(err);
  }
});

export default router;
