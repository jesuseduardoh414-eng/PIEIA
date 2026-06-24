import { getCore } from '../lib/core.js';
import { prisma } from '../lib/prisma.js';
import { decidirAccesoProyecto } from '../lib/policy.js';

export const COOKIE_NAME = 'pieia_token';

// Cache en memoria: token -> { user, expiresAt }
// Evita 2 roundtrips a Supabase por cada peticion autenticada.
const AUTH_CACHE = new Map();
const AUTH_TTL_MS = 2 * 60 * 1000; // 2 minutos

// Limpia tokens expirados cada 5 minutos para no acumular memoria.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of AUTH_CACHE) if (v.expiresAt <= now) AUTH_CACHE.delete(k);
}, 5 * 60 * 1000);

export function invalidateAuthCache(userId) {
  for (const [k, v] of AUTH_CACHE) if (v.user.id === userId) AUTH_CACHE.delete(k);
}

export async function requireAuth(req, res, next) {
  try {
    const fromCookie = req.cookies?.[COOKIE_NAME];
    const fromHeader = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = fromCookie || fromHeader;
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const cached = AUTH_CACHE.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      req.user = cached.user;
      return next();
    }

    const core = getCore();
    const coreUser = await core.auth.verifyToken.execute(token);
    const usuario = await prisma.usuario.findUnique({
      where: { id: coreUser.id },
      select: { id: true, email: true, esAdmin: true },
    });
    if (!usuario) return res.status(401).json({ error: 'Sesion invalida' });

    const user = { id: usuario.id, email: usuario.email, esAdmin: usuario.esAdmin };
    AUTH_CACHE.set(token, { user, expiresAt: Date.now() + AUTH_TTL_MS });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
}

// Solo administradores globales.
export function requireAdmin(req, res, next) {
  if (!req.user?.esAdmin) return res.status(403).json({ error: 'Requiere rol de administrador' });
  next();
}

// Autorizacion por rol DENTRO de un proyecto (TRD §3: roles por proyecto).
// Implementa en la capa Express lo que en Supabase haria RLS (ver
// docs/ADR-001-autorizacion-en-express.md). La DECISION vive en lib/policy.js
// (pura y testeada); aqui solo se cargan los datos y se traduce a HTTP.
export function requireProjectRole(...rolesPermitidos) {
  return async (req, res, next) => {
    const proyectoId = req.params.proyectoId || req.body?.proyectoId;
    if (!proyectoId) return res.status(400).json({ error: 'Falta proyectoId' });

    const miembro = req.user.esAdmin
      ? null
      : await prisma.miembroProyecto.findUnique({
          where: { proyectoId_usuarioId: { proyectoId, usuarioId: req.user.id } },
        });

    const { permitido } = decidirAccesoProyecto({
      esAdmin: req.user.esAdmin,
      miembroRol: miembro?.rol ?? null,
      rolesPermitidos,
    });
    if (!permitido) return res.status(403).json({ error: 'Sin permiso en este proyecto' });

    req.miembro = miembro;
    next();
  };
}
