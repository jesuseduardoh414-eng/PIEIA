// Migra los archivos del disco local (backend/uploads) a Supabase Storage,
// conservando exactamente el mismo path relativo que guarda la BD (storage_path).
// Idempotente: usa x-upsert, asi que re-correrlo no duplica ni rompe nada.
//
// Uso:
//   1) En TU proyecto Supabase de PIEIA (ref dnxicscudpgqcfdhdqgd, NO el del core),
//      crea un bucket PRIVADO en Storage — ej. "pieia-entregables".
//   2) Define en backend/.env: SUPABASE_BUCKET, STORAGE_SUPABASE_URL, STORAGE_SUPABASE_KEY
//      (URL y service_role key de TU proyecto, no los SUPABASE_URL/SERVICE_ROLE_KEY del core).
//   3) Corre:  node scripts/migrar-storage-supabase.js
//      (agrega --dry para solo listar lo que subiria, sin subir).
import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const BUCKET = process.env.SUPABASE_BUCKET;
const SB_URL = process.env.STORAGE_SUPABASE_URL;
const SB_KEY = process.env.STORAGE_SUPABASE_KEY;
const DRY = process.argv.includes('--dry');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ROOT = process.env.UPLOADS_PATH || path.resolve(__dirname, '../uploads');

if (!BUCKET || !SB_URL || !SB_KEY) {
  console.error('[migracion] Falta configurar SUPABASE_BUCKET, STORAGE_SUPABASE_URL y STORAGE_SUPABASE_KEY en .env (proyecto propio de PIEIA, no el del core)');
  process.exit(1);
}

// Recorre recursivamente y devuelve rutas relativas a LOCAL_ROOT (estilo posix).
async function listarArchivos(dir, base = dir) {
  const entradas = await fs.readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entradas) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listarArchivos(full, base)));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

async function subir(relPath, buffer) {
  const res = await fetch(`${SB_URL}/storage/v1/object/${BUCKET}/${relPath}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
    body: buffer,
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function main() {
  let archivos = [];
  try {
    archivos = await listarArchivos(LOCAL_ROOT);
  } catch (e) {
    console.error(`[migracion] No se pudo leer ${LOCAL_ROOT}: ${e.message}`);
    process.exit(1);
  }

  if (archivos.length === 0) {
    console.log('[migracion] No hay archivos locales para migrar.');
    return;
  }

  console.log(`[migracion] ${archivos.length} archivo(s) en ${LOCAL_ROOT} -> bucket "${BUCKET}"${DRY ? ' (DRY RUN)' : ''}`);
  let ok = 0, fail = 0;
  for (const rel of archivos) {
    if (DRY) { console.log('  -', rel); ok++; continue; }
    try {
      const buffer = await fs.readFile(path.join(LOCAL_ROOT, rel));
      await subir(rel, buffer);
      console.log('  OK ', rel);
      ok++;
    } catch (e) {
      console.error('  FALLO', rel, '->', e.message);
      fail++;
    }
  }
  console.log(`[migracion] Listo. Subidos: ${ok}, fallidos: ${fail}.`);
  if (!DRY && fail === 0) {
    console.log('[migracion] Verifica en Supabase Storage y luego puedes vaciar backend/uploads/.');
  }
  process.exit(fail === 0 ? 0 : 1);
}

main();
