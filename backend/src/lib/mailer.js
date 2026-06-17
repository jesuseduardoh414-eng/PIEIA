import nodemailer from 'nodemailer';
import { plantillaCorreo } from './plantillaCorreo.js';

// SMTP propio de PIEIA (Gmail + App Password). Las notificaciones in-app (RF-B04)
// son nuestras, no pasan por la logica de notificaciones del core.
const transporter = nodemailer.createTransport({
  host: process.env.CORE_SMTP_HOST,
  port: Number(process.env.CORE_SMTP_PORT),
  secure: Number(process.env.CORE_SMTP_PORT) === 465,
  auth: { user: process.env.CORE_SMTP_USER, pass: process.env.CORE_SMTP_PASS },
});

export async function enviarCorreoNotificacion({ to, titulo, cuerpo, url }) {
  const link = url ? `${process.env.FRONTEND_URL}${url}` : null;
  const { html, attachments } = plantillaCorreo({
    titulo,
    parrafos: [cuerpo || titulo],
    cta: link ? { href: link, texto: 'Ver en PIEIA' } : null,
  });
  await transporter.sendMail({ from: process.env.CORE_SMTP_FROM, to, subject: titulo, html, attachments });
}

// Correo a la medida con la misma plantilla (ej. recuperacion de contrasena, cuyo
// link es externo de Supabase y no una ruta interna de PIEIA).
export async function enviarCorreoPlantilla({ to, subject, titulo, parrafos, cta }) {
  const { html, attachments } = plantillaCorreo({ titulo: titulo || subject, parrafos, cta });
  await transporter.sendMail({ from: process.env.CORE_SMTP_FROM, to, subject, html, attachments });
}
