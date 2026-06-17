const APS_HOST = 'https://developer.api.autodesk.com';

// Cache del token 2-legged (válido 1h, refrescamos con 2 min de margen)
let _token = null;
let _tokenExpira = 0;

export async function obtenerToken() {
  if (_token && Date.now() < _tokenExpira) return _token;

  const res = await fetch(`${APS_HOST}/authentication/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.APS_CLIENT_ID,
      client_secret: process.env.APS_CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'data:read data:write data:create bucket:create bucket:read',
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APS auth error ${res.status}: ${text}`);
  }
  const data = await res.json();
  _token = data.access_token;
  _tokenExpira = Date.now() + (data.expires_in - 120) * 1000;
  return _token;
}

export const BUCKET_KEY = () => {
  if (process.env.APS_BUCKET_KEY) return process.env.APS_BUCKET_KEY.toLowerCase();
  // Si no hay bucket configurado, derivar uno único del CLIENT_ID
  const suffix = (process.env.APS_CLIENT_ID || 'app').slice(0, 8).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  return `pieia-${suffix}`;
};

// Crea el bucket si no existe (409 = ya existe, ok)
export async function asegurarBucket(token) {
  const res = await fetch(`${APS_HOST}/oss/v2/buckets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketKey: BUCKET_KEY(), policyKey: 'persistent' }),
  });
  if (res.status === 409) return;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APS bucket error ${res.status}: ${text}`);
  }
}

// Sube un Buffer al OSS bucket usando el flujo signed-S3 (el PUT directo está deprecated).
// 3 pasos: obtener URL firmada → subir a S3 → finalizar en APS.
export async function subirArchivo(token, objectKey, buffer) {
  const bk = BUCKET_KEY();
  const encoded = encodeURIComponent(objectKey);

  // 1. Solicitar URL firmada de S3
  const initRes = await fetch(
    `${APS_HOST}/oss/v2/buckets/${bk}/objects/${encoded}/signeds3upload?minutesExpiration=30`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`APS upload init error ${initRes.status}: ${text}`);
  }
  const { uploadKey, urls } = await initRes.json();

  // 2. Subir el buffer directo a S3 (sin credenciales Autodesk)
  const s3Res = await fetch(urls[0], {
    method: 'PUT',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: buffer,
    duplex: 'half',
  });
  if (!s3Res.ok) {
    const text = await s3Res.text();
    throw new Error(`S3 upload error ${s3Res.status}: ${text}`);
  }

  // 3. Finalizar: confirmar a APS que el upload terminó
  const finalRes = await fetch(
    `${APS_HOST}/oss/v2/buckets/${bk}/objects/${encoded}/signeds3upload`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadKey }),
    }
  );
  if (!finalRes.ok) {
    const text = await finalRes.text();
    throw new Error(`APS finalize error ${finalRes.status}: ${text}`);
  }

  // URN = base64url de "urn:adsk.objects:os.object:{bucket}/{objectKey}"
  return Buffer.from(`urn:adsk.objects:os.object:${bk}/${objectKey}`).toString('base64url');
}

// Lanza la traducción a SVF2 (formato del Viewer)
export async function iniciarTraduccion(token, urn) {
  const res = await fetch(`${APS_HOST}/modelderivative/v2/designdata/job`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-ads-force': 'true',
    },
    body: JSON.stringify({
      input: { urn },
      output: { formats: [{ type: 'svf2', views: ['2d', '3d'] }] },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APS translate error ${res.status}: ${text}`);
  }
  return res.json();
}

// Estado de la traducción. Devuelve null si aún no existe manifiesto.
export async function obtenerManifiesto(token, urn) {
  const res = await fetch(
    `${APS_HOST}/modelderivative/v2/designdata/${encodeURIComponent(urn)}/manifest`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`APS manifest error ${res.status}: ${text}`);
  }
  return res.json();
}
