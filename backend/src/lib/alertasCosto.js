// Alertas de costo de IA por umbral (RF-H04 / RNF-08). Se evalúan tras cada
// ejecución de agente: si el gasto acumulado del proyecto o del mes cruza su
// umbral, se notifica (correo a admins + Sentry + log). Los umbrales se definen
// en .env; con valor 0/ausente, esa alerta queda desactivada.
import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { captureMensaje } from './sentry.js';
import { enviarCorreoPlantilla } from './mailer.js';
import { formatCostoUSD } from './costos.js';

const UMBRAL_PROYECTO = Number(process.env.ALERTA_COSTO_PROYECTO_USD || 0);
const UMBRAL_MENSUAL = Number(process.env.ALERTA_COSTO_MENSUAL_USD || 0);

// Dedupe en memoria: una alerta por clave por día, para no spamear en cada
// ejecución una vez superado el umbral. Se reinicia al rearrancar el proceso
// (re-alertar tras un reinicio es inocuo y deseable).
const yaAlertado = new Set();
const claveDia = (scope) => `${scope}:${new Date().toISOString().slice(0, 10)}`;

export function umbralesCosto() {
  return {
    proyectoUsd: UMBRAL_PROYECTO || null,
    mensualUsd: UMBRAL_MENSUAL || null,
  };
}

async function adminsEmails() {
  const admins = await prisma.usuario.findMany({ where: { esAdmin: true }, select: { email: true } });
  return admins.map((a) => a.email).filter(Boolean);
}

async function dispararAlerta(scope, { titulo, detalle, total, umbral }) {
  const clave = claveDia(scope);
  if (yaAlertado.has(clave)) return;
  yaAlertado.add(clave);

  logger.warn('Alerta de costo de IA', { scope, total, umbral });
  captureMensaje(titulo, 'warning', { costoIA: { scope, total, umbral } });

  try {
    const destinatarios = await adminsEmails();
    if (destinatarios.length) {
      await enviarCorreoPlantilla({
        to: destinatarios.join(','),
        subject: `PIEIA — ${titulo}`,
        titulo,
        parrafos: [
          detalle,
          `Gasto acumulado: ${formatCostoUSD(total)} · Umbral: ${formatCostoUSD(umbral)}.`,
          'Revisa el panel de costos de IA en Admin para el desglose por agente y proyecto.',
        ],
      });
    }
  } catch (err) {
    // El correo no debe tumbar el worker; ya quedó la traza en log + Sentry.
    logger.error('No se pudo enviar correo de alerta de costo', { mensaje: err.message });
  }
}

// Evalúa los umbrales a partir del id de la ejecución recién completada.
export async function verificarAlertasCosto(ejecucionId) {
  if (UMBRAL_PROYECTO <= 0 && UMBRAL_MENSUAL <= 0) return;
  try {
    const ej = await prisma.ejecucionAgente.findUnique({
      where: { id: ejecucionId },
      select: { proyectoId: true },
    });

    if (UMBRAL_PROYECTO > 0 && ej?.proyectoId) {
      const [{ total }] = await prisma.$queryRaw`
        SELECT COALESCE(SUM(costo_usd), 0)::float AS total
        FROM ejecucion_agente WHERE proyecto_id = ${ej.proyectoId}::uuid`;
      if (total >= UMBRAL_PROYECTO) {
        const proyecto = await prisma.proyecto.findUnique({
          where: { id: ej.proyectoId }, select: { clave: true, nombre: true },
        });
        const nombre = proyecto ? `${proyecto.clave} — ${proyecto.nombre}` : ej.proyectoId;
        await dispararAlerta(`proyecto:${ej.proyectoId}`, {
          titulo: 'Umbral de costo de IA superado en un proyecto',
          detalle: `El proyecto ${nombre} superó el umbral de gasto de IA configurado.`,
          total, umbral: UMBRAL_PROYECTO,
        });
      }
    }

    if (UMBRAL_MENSUAL > 0) {
      const mes = new Date().toISOString().slice(0, 7);
      const [{ total }] = await prisma.$queryRaw`
        SELECT COALESCE(SUM(costo_usd), 0)::float AS total
        FROM ejecucion_agente WHERE TO_CHAR(created_at, 'YYYY-MM') = ${mes}`;
      if (total >= UMBRAL_MENSUAL) {
        await dispararAlerta(`mes:${mes}`, {
          titulo: 'Umbral de costo de IA mensual superado',
          detalle: `El gasto total de IA del mes ${mes} superó el umbral configurado.`,
          total, umbral: UMBRAL_MENSUAL,
        });
      }
    }
  } catch (err) {
    logger.error('Fallo al verificar alertas de costo', { mensaje: err.message });
  }
}
