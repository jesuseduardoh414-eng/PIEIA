import { readFileSync, readdirSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { prisma } from './prisma.js';

const EVALS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../evals');
const CASOS_DIR = join(EVALS_DIR, 'casos');

// ── Carga de casos ────────────────────────────────────────────────────────────
export function cargarCasos(filtroAgente = null) {
  if (!existsSync(CASOS_DIR)) return [];
  const casos = [];
  for (const f of readdirSync(CASOS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const caso = JSON.parse(readFileSync(join(CASOS_DIR, f), 'utf8'));
      if (caso.plantilla) continue; // ignora plantillas sin datos reales
      if (filtroAgente && caso.agente !== filtroAgente) continue;
      casos.push({ ...caso, _archivo: f });
    } catch (e) {
      casos.push({ id: f, agente: '?', error: `JSON inválido: ${e.message}`, _archivo: f });
    }
  }
  return casos;
}

// ── Métricas de comparación (puras, testeables sin créditos) ──────────────────
function pctDesviacion(real, esperado) {
  if (!esperado) return real === 0 ? 0 : 100;
  return (Math.abs(real - esperado) / Math.abs(esperado)) * 100;
}
function sumarPorUnidad(conceptos, unidad) {
  return (conceptos || [])
    .filter((c) => (c.unidad || '').toUpperCase() === unidad)
    .reduce((a, c) => a + (Number(c.cantidad) || 0), 0);
}

export function compararAG01(salida, caso) {
  const esp = caso.esperado || {};
  const tol = caso.tolerancias || {};
  const conceptos = salida.conceptos || [];

  const concretoReal = sumarPorUnidad(conceptos, 'M3');
  const aceroReal = sumarPorUnidad(conceptos, 'KG');
  const concretoPct = pctDesviacion(concretoReal, esp.concretoM3);
  const aceroPct = pctDesviacion(aceroReal, esp.aceroKg);

  const claves = (conceptos).map((c) => (c.clave || '').toUpperCase());
  const esperadas = (esp.conceptosClave || []).map((k) => k.toUpperCase());
  const encontradas = esperadas.filter((k) => claves.includes(k));
  const mapeoPct = esperadas.length ? (encontradas.length / esperadas.length) * 100 : 100;

  const metricas = {
    concretoReal: +concretoReal.toFixed(2), concretoEsperado: esp.concretoM3, concretoDesvPct: +concretoPct.toFixed(1),
    aceroReal: +aceroReal.toFixed(2), aceroEsperado: esp.aceroKg, aceroDesvPct: +aceroPct.toFixed(1),
    mapeoPct: +mapeoPct.toFixed(1),
  };
  const aprobado = concretoPct <= (tol.concretoPct ?? 5)
    && aceroPct <= (tol.aceroPct ?? 5)
    && mapeoPct >= (tol.mapeoMinPct ?? 90);
  const score = Math.max(0, Math.round(100 - (concretoPct + aceroPct) / 2));
  return { aprobado, score, metricas };
}

export function compararAG02(salida, caso) {
  const esp = caso.esperado?.campos || {};
  const tol = caso.tolerancias || {};
  const datos = salida.datos || {};
  const claves = Object.keys(esp);

  const detalle = {};
  let hits = 0;
  for (const k of claves) {
    const esperado = esp[k];
    const real = datos[k];
    let ok = false;
    if (real !== null && real !== undefined) {
      if (typeof esperado === 'number') {
        ok = pctDesviacion(Number(real), esperado) <= (tol.numericoPct ?? 5);
      } else if (typeof esperado === 'string' && esperado) {
        ok = String(real).toLowerCase().includes(esperado.toLowerCase())
          || esperado.toLowerCase().includes(String(real).toLowerCase());
      }
    }
    if (ok) hits++;
    detalle[k] = { esperado, real: real ?? null, ok };
  }
  const recall = claves.length ? (hits / claves.length) * 100 : 100;
  const aprobado = recall >= (tol.recallMinPct ?? 90);
  return { aprobado, score: Math.round(recall), metricas: { recallPct: +recall.toFixed(1), hits, total: claves.length }, detalle };
}

export function compararAG04(salida, caso) {
  const esp = caso.esperado || {};
  const texto = (salida.respuesta || '').toLowerCase();
  const requeridas = esp.contiene || [];
  const faltantes = requeridas.filter((s) => !texto.includes(String(s).toLowerCase()));
  const fuentes = (salida.fuentes || []).length;
  const aprobado = faltantes.length === 0 && fuentes >= (esp.fuentesMin ?? 1);
  const score = requeridas.length ? Math.round(((requeridas.length - faltantes.length) / requeridas.length) * 100) : (fuentes ? 100 : 0);
  return { aprobado, score, metricas: { fuentes, subcadenasOk: requeridas.length - faltantes.length, subcadenasTotal: requeridas.length }, detalle: { faltantes } };
}

export function compararSalida(agente, salida, caso) {
  if (agente === 'AG-01') return compararAG01(salida, caso);
  if (agente === 'AG-02') return compararAG02(salida, caso);
  if (agente === 'AG-04') return compararAG04(salida, caso);
  throw new Error(`Sin comparador de evals para ${agente}`);
}

// ── Ejecución de un caso (corre el agente real) ───────────────────────────────
async function ejecutarAgente(caso) {
  // Import perezoso para no cargar los libs de IA si solo se listan casos.
  if (caso.agente === 'AG-01') {
    const { generarCatalogoCuantificacion } = await import('./cuantificacionIA.js');
    const buffer = leerFixture(caso.archivo);
    return generarCatalogoCuantificacion(buffer);
  }
  if (caso.agente === 'AG-02') {
    const { auditarDocumentoInicial } = await import('./auditorIA.js');
    const buffer = leerFixture(caso.archivo);
    return auditarDocumentoInicial(buffer, caso.tipo || 'mecanica_suelos');
  }
  if (caso.agente === 'AG-04') {
    const { consultarRAG } = await import('./ragPDF.js');
    return consultarRAG(caso.pregunta, caso.tipoNormativa || null);
  }
  throw new Error(`Agente no soportado en evals: ${caso.agente}`);
}

function leerFixture(rel) {
  const ruta = join(EVALS_DIR, rel);
  if (!existsSync(ruta)) {
    const err = new Error(`Falta el archivo de prueba: evals/${rel}`);
    err.code = 'FIXTURE_FALTANTE';
    throw err;
  }
  return readFileSync(ruta);
}

export async function correrCaso(caso) {
  const salida = await ejecutarAgente(caso);
  const meta = salida._meta || {};
  const cmp = compararSalida(caso.agente, salida, caso);
  return { ...cmp, versionPrompt: meta.versionPrompt || null, costoUsd: meta.costoUsd || null };
}

// ── Corrida batch con persistencia ────────────────────────────────────────────
export async function correrTodos(filtroAgente = null) {
  const casos = cargarCasos(filtroAgente);
  const corridaId = randomUUID();
  const resultados = [];

  for (const caso of casos) {
    let row;
    try {
      const r = await correrCaso(caso);
      row = await prisma.evalResultado.create({
        data: {
          corridaId, casoId: caso.id, agente: caso.agente, versionPrompt: r.versionPrompt,
          aprobado: r.aprobado, score: r.score, metricas: r.metricas, detalle: r.detalle ?? null,
        },
      });
    } catch (e) {
      row = await prisma.evalResultado.create({
        data: {
          corridaId, casoId: caso.id, agente: caso.agente, versionPrompt: null,
          aprobado: false, score: null, metricas: {}, detalle: null, error: e.message,
        },
      });
    }
    resultados.push(row);
  }

  const aprobados = resultados.filter((r) => r.aprobado).length;
  return { corridaId, total: resultados.length, aprobados, reprobados: resultados.length - aprobados, resultados };
}

// Último resultado de eval por agente (para el gate de promoción de prompts).
export async function ultimoEvalPorAgente(agente) {
  return prisma.evalResultado.findFirst({
    where: { agente },
    orderBy: { createdAt: 'desc' },
  });
}
