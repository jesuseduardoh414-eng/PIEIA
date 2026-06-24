const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Cliente API minimo. credentials:'include' envia/recibe la cookie HttpOnly de sesion.
async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

// Subida de archivos (multipart). No fija Content-Type: el navegador pone el boundary.
async function upload(path, formData) {
  const res = await fetch(BASE + path, { method: 'POST', credentials: 'include', body: formData });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

// Subida multipart con barra de progreso (XHR). onProgress(0..100).
export function uploadConProgreso(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', BASE + path);
    xhr.withCredentials = true;
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      const data = (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data?.error || `Error ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir el archivo'));
    xhr.send(formData);
  });
}

// Subida directa a URL firmada de Supabase Storage (PUT con progreso). onProgress(0..100).
export function uploadDirecto(signedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Error subiendo a Storage: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir a Storage'));
    xhr.send(file);
  });
}

// Calcula SHA-256 de un File en el navegador usando Web Crypto API.
export async function sha256Hex(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Polling de un trabajo de la cola de agentes hasta que termina.
// Devuelve el `resultado` si se completó, o lanza error si falló.
export async function esperarTrabajo(trabajoId, { intervaloMs = 2500, onEstado } = {}) {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const t = await req('GET', `/api/agentes/trabajos/${trabajoId}`);
    if (onEstado) onEstado(t);
    if (t.estado === 'completado') return t.resultado;
    if (t.estado === 'fallido') throw new Error(t.error || 'El trabajo falló tras varios intentos');
    await new Promise((r) => setTimeout(r, intervaloMs));
  }
}

export const API_URL = BASE;

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  patch: (p, b) => req('PATCH', p, b),
  del: (p) => req('DELETE', p),
  upload,
};
