import crypto from 'crypto';
import path from 'path';
import { prisma } from './prisma.js';
import { guardarArchivo } from './storage.js';

// Crea una version inmutable de un entregable: calcula SHA-256 y persiste el archivo.
// Compartido por el panel interno (MOD-C) y el Portal de cliente (MOD-E).
export async function crearVersionEntregable(entregableId, numero, file, usuarioId, { origen = 'humano', notas = null } = {}) {
  const hashSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
  const nombreSeguro = file.originalname.replace(/[/\\]/g, '_');
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
