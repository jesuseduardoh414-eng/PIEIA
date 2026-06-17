import { Router } from 'express';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { getCore } from '../lib/core.js';
import { getPrisma as getCorePrisma } from '@r4d-26/core';
import { requireAuth } from '../middleware/auth.js';
import { enviarCorreoPlantilla } from '../lib/mailer.js';
import { ROLES, valores } from '@pieia/contracts';

const router = Router();
const ROLES_VALIDOS = valores(ROLES);
const TTL_HORAS = 72;

// ─── Rutas protegidas (requieren sesión) ──────────────────────────────────────

// Crear invitación (admin global o coordinador de proyecto)
router.post('/admin/invitaciones', requireAuth, async (req, res, next) => {
  try {
    const { email, rol = 'lectura', esAdmin = false, proyectoId } = req.body;
    if (!email) return res.status(400).json({ error: 'email es requerido' });
    if (!ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: 'rol inválido' });

    const invitador = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!invitador) return res.status(403).json({ error: 'Sin acceso' });

    // Solo admins pueden invitar sin proyecto; coordinadores solo a su proyecto
    if (!invitador.esAdmin) {
      if (!proyectoId) return res.status(403).json({ error: 'Solo el admin puede invitar sin proyecto' });
      const membresia = await prisma.miembroProyecto.findFirst({
        where: { proyectoId, usuarioId: req.user.id, rol: { in: ['admin', 'coordinador'] } },
      });
      if (!membresia) return res.status(403).json({ error: 'Solo admin o coordinador del proyecto puede invitar' });
    }

    // Revocar invitaciones previas pendientes para el mismo email
    await prisma.invitacion.deleteMany({
      where: { email, usadaEn: null, expiraEn: { gt: new Date() } },
    });

    const token = randomBytes(32).toString('hex');
    const expiraEn = new Date(Date.now() + TTL_HORAS * 60 * 60 * 1000);

    const invitacion = await prisma.invitacion.create({
      data: { email, token, rol, esAdmin: invitador.esAdmin ? esAdmin : false, proyectoId: proyectoId || null, invitadoPorId: req.user.id, expiraEn },
    });

    const link = `${process.env.FRONTEND_URL}/invitacion/${token}`;
    await enviarCorreoPlantilla({
      to: email,
      subject: 'Te invitaron a PIEIA',
      titulo: `${invitador.nombre} te invitó a PIEIA`,
      parrafos: [
        `Fuiste invitado a la Plataforma de Ingeniería Estructural IA con el rol de ${rol}.`,
        `Este enlace es válido por ${TTL_HORAS} horas.`,
      ],
      cta: { href: link, texto: 'Aceptar invitación' },
    });

    res.status(201).json(invitacion);
  } catch (err) {
    next(err);
  }
});

// Listar invitaciones (admin: todas; coordinador: solo las de sus proyectos)
router.get('/admin/invitaciones', requireAuth, async (req, res, next) => {
  try {
    const invitador = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!invitador) return res.status(403).json({ error: 'Sin acceso' });

    const where = invitador.esAdmin
      ? {}
      : {
          OR: [
            { invitadoPorId: req.user.id },
            { proyecto: { miembros: { some: { usuarioId: req.user.id, rol: { in: ['admin', 'coordinador'] } } } } },
          ],
        };

    const invitaciones = await prisma.invitacion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { invitadoPor: { select: { nombre: true } }, proyecto: { select: { clave: true, nombre: true } } },
    });

    const ahora = new Date();
    const con_estado = invitaciones.map((inv) => ({
      ...inv,
      estadoInv: inv.usadaEn ? 'usada' : inv.expiraEn < ahora ? 'expirada' : 'pendiente',
    }));

    res.json(con_estado);
  } catch (err) {
    next(err);
  }
});

// Revocar invitación pendiente
router.delete('/admin/invitaciones/:id', requireAuth, async (req, res, next) => {
  try {
    const inv = await prisma.invitacion.findUnique({ where: { id: req.params.id } });
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.usadaEn) return res.status(400).json({ error: 'La invitación ya fue usada' });

    const invitador = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!invitador?.esAdmin && inv.invitadoPorId !== req.user.id) {
      return res.status(403).json({ error: 'No puedes revocar esta invitación' });
    }

    await prisma.invitacion.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ─── Rutas públicas (sin sesión) ──────────────────────────────────────────────

// Validar token (precargar formulario)
router.get('/invitaciones/:token', async (req, res, next) => {
  try {
    const inv = await prisma.invitacion.findUnique({
      where: { token: req.params.token },
      include: { proyecto: { select: { clave: true, nombre: true } } },
    });
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada o inválida' });
    if (inv.usadaEn) return res.status(410).json({ error: 'Esta invitación ya fue utilizada' });
    if (inv.expiraEn < new Date()) return res.status(410).json({ error: 'Esta invitación ha expirado' });

    res.json({ email: inv.email, rol: inv.rol, esAdmin: inv.esAdmin, proyecto: inv.proyecto });
  } catch (err) {
    next(err);
  }
});

// Aceptar invitación: crea cuenta y asigna al proyecto
router.post('/invitaciones/:token/aceptar', async (req, res, next) => {
  try {
    const { nombre, password } = req.body;
    if (!nombre || !password) return res.status(400).json({ error: 'nombre y password son requeridos' });
    if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

    const inv = await prisma.invitacion.findUnique({ where: { token: req.params.token } });
    if (!inv) return res.status(404).json({ error: 'Invitación no encontrada' });
    if (inv.usadaEn) return res.status(410).json({ error: 'Esta invitación ya fue utilizada' });
    if (inv.expiraEn < new Date()) return res.status(410).json({ error: 'Esta invitación ha expirado' });

    // 1. Crear (o recuperar) usuario en Supabase Auth directamente
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sbHeaders = { apikey: sbKey, Authorization: `Bearer ${sbKey}`, 'Content-Type': 'application/json' };

    let supabaseUserId;
    const sbCreateRes = await fetch(`${sbUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: sbHeaders,
      body: JSON.stringify({ email: inv.email, password, email_confirm: true }),
    });
    const sbCreateData = await sbCreateRes.json();

    if (sbCreateRes.ok) {
      supabaseUserId = sbCreateData.id;
    } else {
      const msg = sbCreateData?.msg || sbCreateData?.message || '';
      const isAlreadyExists = sbCreateRes.status === 422 || msg.toLowerCase().includes('already');
      if (!isAlreadyExists) return res.status(500).json({ error: msg || 'Error al crear la cuenta' });

      // Usuario ya existe en Supabase (intento previo fallido): buscarlo por email y resetear password
      getCore();
      const corePrisma = getCorePrisma();
      const existingProfile = await corePrisma.profile.findFirst({ where: { email: inv.email } });

      if (!existingProfile) {
        // Supabase tiene el usuario pero core no tiene perfil — buscar via API
        const sbListRes = await fetch(
          `${sbUrl}/auth/v1/admin/users?per_page=1000`,
          { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
        );
        const sbListData = await sbListRes.json();
        const found = (sbListData?.users || []).find((u) => u.email === inv.email);
        if (!found) return res.status(409).json({ error: 'Ya existe una cuenta con ese correo. Inicia sesión directamente.' });
        supabaseUserId = found.id;
      } else {
        supabaseUserId = existingProfile.id;
      }

      // Resetear contraseña al valor que el usuario eligió ahora
      await fetch(`${sbUrl}/auth/v1/admin/users/${supabaseUserId}`, {
        method: 'PATCH',
        headers: sbHeaders,
        body: JSON.stringify({ password }),
      });
    }

    // 2. Crear o limpiar perfil en la BD del core (requerido para que verifyToken funcione)
    // globalRoleId: null — PIEIA no usa roles del core; dejarlo con un rol "admin" hace
    // que LoginUseCase fuerce setup de 2FA bloqueando el acceso.
    getCore();
    const corePrisma = getCorePrisma();
    const existeCoreProfile = await corePrisma.profile.findUnique({ where: { id: supabaseUserId } });
    if (!existeCoreProfile) {
      await corePrisma.profile.create({
        data: { id: supabaseUserId, email: inv.email, name: nombre, status: 'active', emailVerifiedAt: new Date(), globalRoleId: null },
      });
    } else {
      // Limpiar globalRoleId (bloquea 2FA) y asegurar emailVerifiedAt (bloquea AccountNotVerifiedError).
      const needsUpdate = existeCoreProfile.globalRoleId !== null || !existeCoreProfile.emailVerifiedAt;
      if (needsUpdate) {
        await corePrisma.profile.update({
          where: { id: supabaseUserId },
          data: { globalRoleId: null, emailVerifiedAt: existeCoreProfile.emailVerifiedAt ?? new Date() },
        });
      }
    }

    // 3. Crear usuario en PIEIA
    let usuario = await prisma.usuario.findUnique({ where: { id: supabaseUserId } });
    if (!usuario) {
      usuario = await prisma.usuario.create({
        data: { id: supabaseUserId, nombre, email: inv.email, esAdmin: inv.esAdmin },
      });
    } else if (inv.esAdmin && !usuario.esAdmin) {
      usuario = await prisma.usuario.update({ where: { id: usuario.id }, data: { esAdmin: true } });
    }

    // 4. Asignar al proyecto si aplica
    if (inv.proyectoId) {
      await prisma.miembroProyecto.upsert({
        where: { proyectoId_usuarioId: { proyectoId: inv.proyectoId, usuarioId: usuario.id } },
        update: { rol: inv.rol },
        create: { proyectoId: inv.proyectoId, usuarioId: usuario.id, rol: inv.rol },
      });
    }

    // 5. Marcar invitación como usada
    await prisma.invitacion.update({ where: { id: inv.id }, data: { usadaEn: new Date() } });

    res.status(201).json({ ok: true, userId: usuario.id });
  } catch (err) {
    next(err);
  }
});

export default router;
