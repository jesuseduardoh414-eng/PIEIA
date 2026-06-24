import { promises as fs, createReadStream as fsCreateReadStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';

// Almacenamiento de entregables en Supabase Storage. IMPORTANTE: debe usar el
// proyecto Supabase PROPIO de PIEIA (ref dnxicscudpgqcfdhdqgd), NO el del core/wabee
// (SUPABASE_URL apunta al core, que es compartido y no controlamos). Por eso usa
// variables DEDICADAS: STORAGE_SUPABASE_URL / STORAGE_SUPABASE_KEY / SUPABASE_BUCKET.
// Si no están las tres, se usa disco local (dev) y nunca se escribe en el core.
const BUCKET = process.env.SUPABASE_BUCKET;
const SB_URL = process.env.STORAGE_SUPABASE_URL;
const SB_KEY = process.env.STORAGE_SUPABASE_KEY;
const USE_SUPABASE = !!(BUCKET && SB_URL && SB_KEY);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ROOT = process.env.UPLOADS_PATH || path.resolve(__dirname, '../../uploads');

// ── Supabase helpers ────────────────────────────────────────────────────────

const sbHeaders = () => ({
  apikey: SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
});

async function sbUpload(relPath, buffer) {
  const url = `${SB_URL}/storage/v1/object/${BUCKET}/${relPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Content-Type': 'application/octet-stream', 'x-upsert': 'true' },
    body: buffer,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase Storage upload failed (${res.status}): ${err}`);
  }
}

async function sbDownloadBuffer(relPath) {
  const url = `${SB_URL}/storage/v1/object/${BUCKET}/${relPath}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase Storage download failed (${res.status}): ${relPath}`);
  return Buffer.from(await res.arrayBuffer());
}

async function sbDownloadStream(relPath) {
  const url = `${SB_URL}/storage/v1/object/${BUCKET}/${relPath}`;
  const res = await fetch(url, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase Storage download failed (${res.status}): ${relPath}`);
  // res.body es un Web ReadableStream; lo convertimos a Node.js Readable (Node ≥ 18)
  return Readable.fromWeb(res.body);
}

async function sbDelete(relPath) {
  await fetch(`${SB_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [relPath] }),
  });
}

// ── API pública ─────────────────────────────────────────────────────────────

export async function guardarArchivo(relPath, buffer) {
  if (USE_SUPABASE) {
    await sbUpload(relPath, buffer);
    return relPath;
  }
  const full = path.join(LOCAL_ROOT, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return relPath;
}

// Devuelve un Readable stream del archivo (compatible con .pipe(res) y archiver).
export async function obtenerStream(relPath) {
  if (USE_SUPABASE) return sbDownloadStream(relPath);
  return fsCreateReadStream(path.join(LOCAL_ROOT, relPath));
}

// Devuelve un Buffer del archivo (para procesarlo en memoria: APS, ZIP, IA).
export async function obtenerBuffer(relPath) {
  if (USE_SUPABASE) return sbDownloadBuffer(relPath);
  return fs.readFile(path.join(LOCAL_ROOT, relPath));
}

// Genera una URL firmada para subida directa desde el navegador (evita pasar por el backend).
// Devuelve null si no se usa Supabase (dev local) o si Storage no responde — en ese caso
// el frontend cae al upload por backend (multer), asi que nunca se pierde una subida.
export async function generarUrlFirmadaSubida(relPath) {
  if (!USE_SUPABASE) return null;
  // Endpoint correcto de Supabase Storage para crear una signed upload URL.
  const url = `${SB_URL}/storage/v1/object/upload/sign/${BUCKET}/${relPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // data.url es la ruta relativa (incluye ?token=...); el PUT va a {SB_URL}/storage/v1{url}.
  return data?.url ? `${SB_URL}/storage/v1${data.url}` : null;
}

export async function eliminarArchivo(relPath) {
  if (USE_SUPABASE) {
    await sbDelete(relPath);
    return;
  }
  try {
    await fs.unlink(path.join(LOCAL_ROOT, relPath));
  } catch (_) {}
}

// Solo para compatibilidad en dev — no usar en rutas nuevas.
export function rutaAbsoluta(relPath) {
  return path.join(LOCAL_ROOT, relPath);
}
