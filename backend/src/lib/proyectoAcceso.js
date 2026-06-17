import { prisma } from './prisma.js';

// Devuelve el rol del usuario en un proyecto ('admin' si es admin global), o null si no es miembro.
export async function rolEnProyecto(user, proyectoId) {
  if (user.esAdmin) return 'admin';
  const m = await prisma.miembroProyecto.findUnique({
    where: { proyectoId_usuarioId: { proyectoId, usuarioId: user.id } },
  });
  return m?.rol ?? null;
}
