import { getCore } from '../lib/core.js';
import { prisma } from '../lib/prisma.js';

export const COOKIE_NAME = 'pieia_token';

// Verifica la sesion (JWT en cookie HttpOnly, o header Authorization: Bearer como respaldo).
// El token lo emite y valida @r4d-26/core (auth.login / auth.verifyToken); la identidad
// (id) es la misma entre core.Profile y nuestro Usuario, asi que cargamos el resto de
// los datos de PIEIA (esAdmin, membresias de proyecto) desde nuestra propia tabla.
export async function requireAuth(req, res, next) {
  try {
    const fromCookie = req.cookies?.[COOKIE_NAME];
    const fromHeader = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = fromCookie || fromHeader;
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const core = getCore();
    const coreUser = await core.auth.verifyToken.execute(token);
    const usuario = await prisma.usuario.findUnique({ where: { id: coreUser.id } });
    if (!usuario) return res.status(401).json({ error: 'Sesion invalida' });

    req.user = { id: usuario.id, email: usuario.email, esAdmin: usuario.esAdmin };
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
// Implementa en la capa Express lo que en Supabase haria RLS. El admin global pasa siempre.
export function requireProjectRole(...rolesPermitidos) {
  return async (req, res, next) => {
    const proyectoId = req.params.proyectoId || req.body?.proyectoId;
    if (!proyectoId) return res.status(400).json({ error: 'Falta proyectoId' });
    if (req.user.esAdmin) return next();

    const miembro = await prisma.miembroProyecto.findUnique({
      where: { proyectoId_usuarioId: { proyectoId, usuarioId: req.user.id } },
    });
    if (!miembro) return res.status(403).json({ error: 'Sin permiso en este proyecto' });

    if (rolesPermitidos.length) {
      if (!rolesPermitidos.includes(miembro.rol)) return res.status(403).json({ error: 'Sin permiso en este proyecto' });
    } else if (miembro.rol === 'cliente') {
      // Sin roles explicitos = cualquier miembro STAFF. El cliente solo accede via Portal (RF-E05).
      return res.status(403).json({ error: 'Sin permiso en este proyecto' });
    }
    req.miembro = miembro;
    next();
  };
}
