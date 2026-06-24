import { prisma } from './prisma.js';
import { cacheGet, cacheSet, cacheDelete } from './cache.js';

// TRD 4.6: carga el prompt activo de un agente desde la BD (tabla plantilla_prompt).
// Si la BD no tiene una versión activa, usa el fallback hardcodeado para que el
// sistema nunca se rompa. Cachea 5 min para no pegar a la BD en cada ejecución.
export async function obtenerPrompt(agente, clave, fallback) {
  const cacheKey = `prompt:${agente}:${clave}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let row = null;
  try {
    row = await prisma.plantillaPrompt.findFirst({
      where: { agente, clave, activa: true },
      orderBy: { createdAt: 'desc' },
    });
  } catch { /* tabla aún no migrada: cae al fallback */ }

  const result = row
    ? { contenido: row.contenido, version: row.version }
    : { contenido: fallback, version: '0.0.0-fallback' };

  cacheSet(cacheKey, result, 5 * 60 * 1000);
  return result;
}

export function invalidarPromptCache(agente, clave) {
  cacheDelete(`prompt:${agente}:${clave}`);
}
