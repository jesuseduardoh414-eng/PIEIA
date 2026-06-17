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

export const API_URL = BASE;

export const api = {
  get: (p) => req('GET', p),
  post: (p, b) => req('POST', p, b),
  patch: (p, b) => req('PATCH', p, b),
  del: (p) => req('DELETE', p),
  upload,
};
