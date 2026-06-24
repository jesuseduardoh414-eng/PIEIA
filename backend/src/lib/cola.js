import { prisma } from './prisma.js';

// Cola durable de trabajos de agentes. El worker (lib/worker.js) consume de aquí.

// Encola un trabajo. `archivo` es un Buffer opcional (Excel/PDF).
export async function encolar({ tipo, payload = {}, archivo = null, prioridad = 5, maxIntentos = 3, ejecucionId = null }) {
  return prisma.trabajoAgente.create({
    data: { tipo, payload, archivo: archivo ?? null, prioridad, maxIntentos, ejecucionId },
    select: { id: true, tipo: true, estado: true, prioridad: true, createdAt: true },
  });
}

// Reclama atómicamente el siguiente trabajo disponible (FOR UPDATE SKIP LOCKED).
// Marca el trabajo como 'procesando' e incrementa intentos. Devuelve null si no hay.
export async function reclamarSiguiente() {
  const filas = await prisma.$queryRawUnsafe(`
    UPDATE "trabajo_agente"
    SET "estado" = 'procesando', "iniciado_en" = NOW(), "intentos" = "intentos" + 1, "updated_at" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "trabajo_agente"
      WHERE "estado" = 'encolado' AND "disponible_en" <= NOW()
      ORDER BY "prioridad" ASC, "created_at" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id", "tipo", "payload", "intentos", "max_intentos" AS "maxIntentos", "ejecucion_id" AS "ejecucionId";
  `);
  const t = filas?.[0];
  if (!t) return null;
  // jsonb puede volver como string en queries raw: normaliza a objeto.
  if (typeof t.payload === 'string') {
    try { t.payload = JSON.parse(t.payload); } catch { t.payload = {}; }
  }
  // El archivo (bytea) se trae aparte solo si se reclamó, para no cargar memoria de más.
  const conArchivo = await prisma.trabajoAgente.findUnique({
    where: { id: t.id },
    select: { archivo: true },
  });
  return { ...t, archivo: conArchivo?.archivo ?? null };
}

export async function completarTrabajo(id, resultado) {
  return prisma.trabajoAgente.update({
    where: { id },
    data: {
      estado: 'completado',
      resultado: resultado ?? null,
      error: null,
      completadoEn: new Date(),
      archivo: null, // liberar el archivo de la BD al terminar
    },
  });
}

// Falla un trabajo. Si quedan intentos, lo re-encola con backoff exponencial.
export async function fallarTrabajo(id, error, { intentos, maxIntentos }) {
  const msg = (error?.message || String(error)).slice(0, 1000);
  if (intentos < maxIntentos) {
    const backoffSeg = Math.min(300, 10 * Math.pow(2, intentos - 1)); // 10s, 20s, 40s... máx 5min
    return prisma.trabajoAgente.update({
      where: { id },
      data: {
        estado: 'encolado',
        error: msg,
        disponibleEn: new Date(Date.now() + backoffSeg * 1000),
      },
    });
  }
  return prisma.trabajoAgente.update({
    where: { id },
    data: { estado: 'fallido', error: msg, completadoEn: new Date(), archivo: null },
  });
}

// Estado de un trabajo (para el polling del frontend).
export async function obtenerTrabajo(id) {
  return prisma.trabajoAgente.findUnique({
    where: { id },
    select: { id: true, tipo: true, estado: true, resultado: true, error: true, intentos: true, maxIntentos: true, ejecucionId: true, createdAt: true, completadoEn: true },
  });
}
