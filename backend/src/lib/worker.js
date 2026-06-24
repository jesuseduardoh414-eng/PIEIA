import { prisma } from './prisma.js';
import { reclamarSiguiente, completarTrabajo, fallarTrabajo } from './cola.js';
import { completarEjecucion, fallarEjecucion } from './bitacora.js';
import { generarCatalogoCuantificacion } from './cuantificacionIA.js';
import { auditarDocumentoInicial } from './auditorIA.js';
import { consultarRAG } from './ragPDF.js';
import { generarMemoriaCalculo } from './memoriaCalculo.js';
import { construirDocxMemoria } from './wordMemoria.js';
import { crearVersionEntregable } from './versiones.js';
import { generarLayoutPlano, construirPdfPlano } from './planoIA.js';
import { logger } from './logger.js';
import { captureExcepcion } from './sentry.js';
import { verificarAlertasCosto } from './alertasCosto.js';

const TIMEOUT_MS = 10 * 60 * 1000; // RNF-04: job estándar < 10 min
const INTERVALO_MS = 2000;

// ── Handlers por tipo de trabajo ──────────────────────────────────────────────
// Cada handler recibe el job y devuelve { resultado, ejecucion }.
// `resultado` se guarda en trabajo_agente y lo lee el frontend (polling).
// `ejecucion` (opcional) actualiza el registro de ejecucion_agente.

const HANDLERS = {
  // Trabajo de prueba: verifica la mecánica de la cola sin gastar créditos.
  async test(job) {
    return { resultado: { ok: true, eco: job.payload, procesadoEn: new Date().toISOString() }, ejecucion: null };
  },

  async ag01_cuantificar(job) {
    if (!job.archivo) throw new Error('Trabajo sin archivo Excel');
    const catalogo = await generarCatalogoCuantificacion(Buffer.from(job.archivo));
    const meta = catalogo._meta ?? {};
    delete catalogo._meta;
    return {
      resultado: catalogo,
      ejecucion: { outputs: catalogo, scoreConfianza: null, costoUsd: meta.costoUsd, versionPrompt: meta.versionPrompt, estado: 'pendiente_validacion' },
    };
  },

  async ag02_auditar(job) {
    if (!job.archivo) throw new Error('Trabajo sin archivo PDF');
    const tipo = job.payload?.tipo || 'mecanica_suelos';
    const r = await auditarDocumentoInicial(Buffer.from(job.archivo), tipo);
    const meta = r._meta ?? {};
    delete r._meta;
    const total = r.camposPresentes.length + r.camposFaltantes.length;
    const score = r.completo ? 100 : Math.round((r.camposPresentes.length / total) * 100);
    return {
      resultado: r,
      ejecucion: { outputs: { completo: r.completo, faltantes: r.camposFaltantes.length }, scoreConfianza: score, costoUsd: meta.costoUsd, versionPrompt: meta.versionPrompt, estado: 'pendiente_validacion' },
    };
  },

  async ag04_consultar(job) {
    const { pregunta, tipo } = job.payload ?? {};
    const r = await consultarRAG(pregunta, tipo || null);
    const meta = r._meta ?? {};
    delete r._meta;
    return {
      resultado: r,
      ejecucion: { outputs: { respuesta: r.respuesta?.slice(0, 300), fuentes: r.fuentes }, costoUsd: meta.costoUsd, versionPrompt: meta.versionPrompt, estado: 'pendiente_validacion' },
    };
  },

  // Generador de plano esquematico desde un prompt (asistente AG-06 lite). Borrador IA.
  async ag06_plano(job) {
    const { tareaId, prompt, userId } = job.payload ?? {};
    const tarea = await prisma.tarea.findUnique({ where: { id: tareaId } });
    if (!tarea) throw new Error('Tarea no encontrada');

    const layout = await generarLayoutPlano(prompt);
    const meta = layout._meta ?? {};
    delete layout._meta;
    const buffer = await construirPdfPlano(layout);
    const file = { originalname: `Plano esquematico IA - ${(layout.titulo || 'casa').slice(0, 40)}.pdf`, buffer, size: buffer.length };

    // Se guarda como entregable tipo dwg_arquitectonico: asi se ve en el visor APS y se
    // puede marcar (RF-D01). El contenido es PDF; APS lo traduce igual.
    let entregable = await prisma.entregable.findFirst({
      where: { tareaId: tarea.id, nombre: 'Plano esquematico (IA)' },
      include: { versiones: { orderBy: { numero: 'desc' }, take: 1 } },
    });
    if (!entregable) {
      entregable = await prisma.entregable.create({ data: { tareaId: tarea.id, nombre: 'Plano esquematico (IA)', tipo: 'dwg_arquitectonico' } });
      entregable.versiones = [];
    }
    const siguiente = (entregable.versiones[0]?.numero || 0) + 1;
    const version = await crearVersionEntregable(entregable.id, siguiente, file, userId, {
      origen: 'agente',
      notas: `Boceto esquematico generado por IA a partir de: "${String(prompt).slice(0, 120)}". Borrador IA, requiere validacion del ingeniero.`,
    });
    await prisma.entregable.update({ where: { id: entregable.id }, data: { versionActualId: version.id } });

    return {
      resultado: { entregableId: entregable.id, versionId: version.id, titulo: layout.titulo, habitaciones: layout.habitaciones?.length ?? 0 },
      ejecucion: { outputs: { entregableId: entregable.id, versionId: version.id, titulo: layout.titulo }, costoUsd: meta.costoUsd, estado: 'pendiente_validacion' },
    };
  },

  async ag03_memoria(job) {
    const { tareaId, datosDiseno, notas, userId } = job.payload ?? {};
    const tarea = await prisma.tarea.findUnique({
      where: { id: tareaId },
      include: { componente: { include: { proyecto: { include: { tipologia: { include: { disciplina: true } } } } } } },
    });
    if (!tarea) throw new Error('Tarea no encontrada');

    const proyecto = tarea.componente.proyecto;
    const borrador = await generarMemoriaCalculo({ proyecto, tarea, datosDiseno });
    const metaIA = borrador._meta ?? {};
    delete borrador._meta;

    const buffer = await construirDocxMemoria({
      proyecto, tarea, titulo: borrador.titulo, secciones: borrador.secciones,
      fecha: new Date().toLocaleDateString('es-MX'),
    });
    const file = { originalname: `Memoria de calculo - ${tarea.nombre}.docx`, buffer, size: buffer.length };

    let entregable = await prisma.entregable.findFirst({
      where: { tareaId: tarea.id, tipo: 'pdf_memoria' },
      include: { versiones: { orderBy: { numero: 'desc' }, take: 1 } },
    });
    if (!entregable) {
      entregable = await prisma.entregable.create({ data: { tareaId: tarea.id, nombre: 'Memoria de calculo', tipo: 'pdf_memoria' } });
      entregable.versiones = [];
    }
    const siguiente = (entregable.versiones[0]?.numero || 0) + 1;
    const version = await crearVersionEntregable(entregable.id, siguiente, file, userId, {
      origen: 'agente',
      notas: notas || 'Borrador generado por IA (AG-03). Pendiente de revision del ingeniero responsable.',
    });
    await prisma.entregable.update({ where: { id: entregable.id }, data: { versionActualId: version.id } });

    return {
      resultado: { entregableId: entregable.id, versionId: version.id },
      ejecucion: { outputs: { entregableId: entregable.id, versionId: version.id }, costoUsd: metaIA.costoUsd, versionPrompt: metaIA.versionPrompt, estado: 'pendiente_validacion' },
    };
  },
};

function conTimeout(promesa, ms) {
  return Promise.race([
    promesa,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`Timeout: el trabajo excedió ${ms / 1000}s`)), ms)),
  ]);
}

// Procesa un trabajo si hay disponible. Devuelve true si procesó algo.
async function procesarUno() {
  const job = await reclamarSiguiente();
  if (!job) return false;

  const handler = HANDLERS[job.tipo];
  const t0 = Date.now();

  if (!handler) {
    await fallarTrabajo(job.id, new Error(`Tipo de trabajo desconocido: ${job.tipo}`), { intentos: job.maxIntentos, maxIntentos: job.maxIntentos });
    return true;
  }

  try {
    const { resultado, ejecucion } = await conTimeout(handler(job), TIMEOUT_MS);
    await completarTrabajo(job.id, resultado);
    if (job.ejecucionId && ejecucion) {
      await completarEjecucion(job.ejecucionId, { ...ejecucion, duracionMs: Date.now() - t0 }).catch(() => {});
    }
    logger.info('Trabajo de agente completado', {
      trabajoId: job.id, tipo: job.tipo, ejecucionId: job.ejecucionId,
      duracionMs: Date.now() - t0, costoUsd: ejecucion?.costoUsd ?? null,
    });
    // Alertas de costo por umbral (RF-H04): se evalúan tras registrar el costo.
    if (job.ejecucionId) verificarAlertasCosto(job.ejecucionId).catch(() => {});
  } catch (err) {
    logger.error('Trabajo de agente falló', {
      trabajoId: job.id, tipo: job.tipo, intento: job.intentos, maxIntentos: job.maxIntentos,
      mensaje: err.message,
    });
    await fallarTrabajo(job.id, err, { intentos: job.intentos, maxIntentos: job.maxIntentos });
    // Solo marca la ejecución como rechazada y reporta a Sentry si ya no quedan reintentos.
    if (job.ejecucionId && job.intentos >= job.maxIntentos) {
      await fallarEjecucion(job.ejecucionId, err).catch(() => {});
      captureExcepcion(err, {
        agente: { trabajoId: job.id, tipo: job.tipo, ejecucionId: job.ejecucionId, intentos: job.intentos },
      });
    }
  }
  return true;
}

let corriendo = false;
let timer = null;

// Arranca el worker in-process. Procesa un trabajo por tick para respetar
// el rate limit del único API key de Anthropic.
export function iniciarWorker() {
  if (timer) return;
  logger.info('Worker de agentes iniciado', { pollSegundos: INTERVALO_MS / 1000 });
  timer = setInterval(async () => {
    if (corriendo) return; // evita solapamiento de ticks
    corriendo = true;
    try {
      // Vacía la cola en ráfaga: procesa hasta que no quede nada pendiente.
      while (await procesarUno()) { /* sigue */ }
    } catch (err) {
      logger.error('Error inesperado en el loop del worker', { mensaje: err.message });
      captureExcepcion(err, { origen: { tipo: 'worker-loop' } });
    } finally {
      corriendo = false;
    }
  }, INTERVALO_MS);
}

export function detenerWorker() {
  if (timer) { clearInterval(timer); timer = null; }
}
