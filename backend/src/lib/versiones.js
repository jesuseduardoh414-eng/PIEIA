import crypto from 'crypto';
import path from 'path';
import { prisma } from './prisma.js';
import { guardarArchivo } from './storage.js';

// Crea una version inmutable de un entregable: calcula SHA-256 y persiste el archivo.
// Compartido por el panel interno (MOD-C) y el Portal de cliente (MOD-E).
export async function crearVersionEntregable(entregableId, numero, file, usuarioId, { origen = 'humano', notas = null } = {}) {
  const hashSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  // La CLAVE de storage debe ser ASCII segura (Supabase rechaza acentos, guiones largos, etc.
  // con InvalidKey). Quitamos diacriticos y dejamos solo [a-zA-Z0-9 ._-]. El nombre "bonito"
  // (con acentos) se conserva en nombreArchivo para mostrar en la UI.
  const nombreSeguro = (file.originalname
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 ._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120)) || 'archivo';
  const relPath = path.posix.join(entregableId, `${numero}-${nombreSeguro}`);
  await guardarArchivo(relPath, file.buffer);
  return prisma.versionEntregable.create({
    data: {
      entregableId,
      numero,
      nombreArchivo: file.originalname,
      storagePath: relPath,
      tamanoBytes: file.size,
      hashSha256,
      subidoPor: usuarioId,
      origen,
      notas,
    },
  });
}
