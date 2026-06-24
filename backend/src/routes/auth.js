import { Router } from 'express';
import { SupabaseAuthService, getPrisma as getCorePrisma, JwtTokenProvider } from '@r4d-26/core';
import { prisma } from '../lib/prisma.js';
import { getCore } from '../lib/core.js';
import { requireAuth, COOKIE_NAME } from '../middleware/auth.js';
import { enviarCorreoPlantilla } from '../lib/mailer.js';
import { decidirSuperficie } from '../lib/policy.js';
import { logger } from '../lib/logger.js';
import { loginSchema } from '@pieia/contracts';

// PIEIA deshabilita deliberadamente el 2FA del core (ver docs/ADR-002-2fa-deshabilitado.md).
// Se puede reactivar el comportamiento del core poniendo PIEIA_2FA_BYPASS=false.
const BYPASS_2FA = process.env.PIEIA_2FA_BYPASS !== 'false';

const router = Router();

// Pieza exportada del core, sin pasar por ConfigProvider/AuthFactory: generar el
// link de recuperacion no necesita Redis ni el resto del armado del core, solo
// hablar con Supabase Auth directo.
const supabaseAuth = new SupabaseAuthService(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Vence junto con el token que emite el core (LoginUseCase lo firma fijo a 24h).
// En produccion el frontend (Vercel) y el backend (Render) viven en dominios distintos:
// la cookie de sesion necesita SameSite=None + Secure para viajar cross-site. En dev
// (http://localhost) se usa Lax (None exige Secure, que localhost no tiene).
const esProd = process.env.NODE_ENV === 'production';
const cookieOpts = {
  httpOnly: true,
  sameSite: esProd ? 'none' : 'lax',
  secure: esProd,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

async function publicUser(u) {
  const membresias = await prisma.miembroProyecto.findMany({
    where: { usuarioId: u.id },
    select: { rol: true },
  });
  const roles = [...new Set(membresias.map((m) => m.rol))];
  const { esCliente, soloCliente } = decidirSuperficie({ esAdmin: u.esAdmin, roles });

  return { id: u.id, nombre: u.nombre, email: u.email, esAdmin: u.esAdmin, esCliente, soloCliente };
}

// Traduce los errores tipados del core (BaseError: statusCode + message) al formato
// {error: "..."} que ya usa el resto de la API de PIEIA. Sin registro publico: el
// registro ahora es por invitacion (pendiente, ver tareas_pieia_invitaciones.json).
function manejarErrorCore(err, res, next) {
  if (err?.statusCode && err?.message) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  next(err);
}

router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const core = getCore();
    let resultado = await core.auth.login.execute({ email: data.email, password: data.password }, req.ip, req.headers['user-agent']);

    // 2FA del core deshabilitado a proposito (ADR-002). El core fuerza setup de 2FA a
    // perfiles con globalRole "admin"; PIEIA no implementa 2FA y gestiona admins con su
    // propio campo esAdmin. IMPORTANTE: las credenciales YA fueron validadas por Supabase
    // (login.execute solo devuelve requires2FA tras autenticar bien); aqui solo se omite el
    // paso de 2FA, no se salta la autenticacion. Firmamos el token directamente — NO se
    // reintenta login.execute() porque con globalRole=null tiene un bug (TypeError).
    if (BYPASS_2FA && (resultado.requires2FASetup || resultado.requires2FA) && resultado.user?.id) {
      logger.warn('Login: 2FA del core omitido (PIEIA no usa 2FA)', { usuario: resultado.user.email });

      // Best-effort: limpiar globalRoleId para que futuros logins no vuelvan a forzar 2FA.
      try {
        const corePrisma = getCorePrisma();
        await corePrisma.profile.update({
          where: { id: resultado.user.id },
          data: { globalRoleId: null, emailVerifiedAt: new Date() },
        });
      } catch (dbErr) {
        logger.error('Login: no se pudo limpiar globalRole en el core', { mensaje: dbErr?.message });
      }

      // Firmamos con CORE_JWT_SECRET (el mismo que usa el core internamente).
      try {
        const token = new JwtTokenProvider(process.env.CORE_JWT_SECRET, process.env.CORE_JWT_REFRESH_SECRET)
          .sign(
            { id: resultado.user.id, email: resultado.user.email, role: 'authenticated', global_role: 'user', productSlug: null },
            { expiresIn: '24h' },
          );
        resultado = { success: true, token, user: resultado.user };
      } catch (signErr) {
        logger.error('Login: fallo al firmar el token (bypass 2FA)', { mensaje: signErr?.message });
        return res.status(500).json({ error: 'No se pudo completar el inicio de sesion' });
      }
    }

    if (resultado.requires2FA || resultado.requires2FASetup) {
      return res.status(501).json({ error: 'La verificacion en dos pasos todavia no esta soportada en PIEIA' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: resultado.user.id } });
    if (!usuario) return res.status(404).json({ error: 'Tu cuenta existe en el login pero no en PIEIA. Contacta al administrador.' });

    res.cookie(COOKIE_NAME, resultado.token, cookieOpts);
    res.json(await publicUser(usuario));
  } catch (err) {
    manejarErrorCore(err, res, next);
  }
});

// Logout: el core no nos da forma de revocar el token de sesion que el mismo emitio
// (su SupabaseAuthService.signOut espera un token nativo de Supabase, no el JWT del
// core) — alcanza con borrar la cookie; el JWT vence solo a las 24h.
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOpts, maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: { id: true, nombre: true, email: true, esAdmin: true },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Determina la superficie: solo-cliente entra al Portal (MOD-E); staff al panel interno.
    res.json(await publicUser(usuario));
  } catch (err) {
    next(err);
  }
});

// Genera el link de recuperacion (Supabase Auth) y lo envia por correo (Nodemailer
// propio, no la cola del core). Nunca revela si el correo existe o no.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email es requerido' });

    const mensaje = 'Si el correo existe en PIEIA, recibiras un enlace para restablecer tu contrasena.';
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario) return res.json({ success: true, message: mensaje });

    const link = await supabaseAuth.generateRecoveryLink(email, `${process.env.FRONTEND_URL}/restablecer-contrasena`);
    await enviarCorreoPlantilla({
      to: email,
      subject: 'Recuperacion de contrasena - PIEIA',
      titulo: `Hola ${usuario.nombre}`,
      parrafos: [
        'Solicitaste restablecer tu contrasena en PIEIA. Este enlace es valido por un tiempo limitado.',
        'Si no fuiste tu, ignora este correo y tu contrasena seguira igual.',
      ],
      cta: { href: link, texto: 'Restablecer mi contrasena' },
    });
    res.json({ success: true, message: mensaje });
  } catch (err) {
    next(err);
  }
});

// Consume el link de recuperacion que Supabase genero (RF: recuperacion de contrasena).
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'token y password son requeridos' });
    const core = getCore();
    const resultado = await core.auth.resetPassword.execute({ token, password }, req.ip);
    res.json(resultado);
  } catch (err) {
    manejarErrorCore(err, res, next);
  }
});

// Consume el link de verificacion de correo (token nativo de Supabase, no el JWT de sesion).
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token es requerido' });
    const core = getCore();
    const resultado = await core.auth.verifyEmail.execute({ token }, req.ip);
    res.json(resultado);
  } catch (err) {
    manejarErrorCore(err, res, next);
  }
});

export default router;
