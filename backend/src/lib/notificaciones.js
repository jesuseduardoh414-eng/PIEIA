import { prisma } from './prisma.js';
import { enviarCorreoNotificacion } from './mailer.js';

// Fire-and-forget: si el correo falla no debe romper el flujo principal.
function enviarCorreos(usuarios, payload) {
  for (const u of usuarios) {
    enviarCorreoNotificacion({ to: u.email, ...payload }).catch(() => {});
  }
}

// Crea una notificacion para un usuario especifico.
export async function crearNotificacion({ usuarioId, tipo, titulo, cuerpo = null, url = null }) {
  const notif = await prisma.notificacion.create({ data: { usuarioId, tipo, titulo, cuerpo, url } });
  prisma.usuario
    .findUnique({ where: { id: usuarioId }, select: { email: true } })
    .then((u) => u && enviarCorreos([u], { titulo, cuerpo, url }))
    .catch(() => {});
  return notif;
}

// Notifica a todos los miembros activos de un proyecto (excluye clientes, lectura y los ids indicados).
export async function notificarMiembros(proyectoId, { tipo, titulo, cuerpo = null, url = null }, excluir = []) {
  const miembros = await prisma.miembroProyecto.findMany({
    where: {
      proyectoId,
      rol: { notIn: ['cliente', 'lectura'] },
      ...(excluir.length > 0 && { usuarioId: { notIn: excluir } }),
    },
    select: { usuarioId: true },
  });
  if (miembros.length === 0) return;
  await prisma.notificacion.createMany({
    data: miembros.map((m) => ({ usuarioId: m.usuarioId, tipo, titulo, cuerpo, url })),
  });
  prisma.usuario
    .findMany({ where: { id: { in: miembros.map((m) => m.usuarioId) } }, select: { email: true } })
    .then((usuarios) => enviarCorreos(usuarios, { titulo, cuerpo, url }))
    .catch(() => {});
}

// Notifica solo a coordinadores y admin del proyecto.
export async function notificarCoordinadores(proyectoId, payload, excluir = []) {
  const miembros = await prisma.miembroProyecto.findMany({
    where: {
      proyectoId,
      rol: { in: ['admin', 'coordinador'] },
      ...(excluir.length > 0 && { usuarioId: { notIn: excluir } }),
    },
    select: { usuarioId: true },
  });
  if (miembros.length === 0) return;
  await prisma.notificacion.createMany({
    data: miembros.map((m) => ({ usuarioId: m.usuarioId, ...payload })),
  });
  prisma.usuario
    .findMany({ where: { id: { in: miembros.map((m) => m.usuarioId) } }, select: { email: true } })
    .then((usuarios) => enviarCorreos(usuarios, payload))
    .catch(() => {});
}
