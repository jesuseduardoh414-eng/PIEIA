import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const pdfParse = _require('pdf-parse');
import { prisma } from './prisma.js';
import { embedTextos, embedTexto } from './voyage.js';
import { anthropic } from './anthropic.js';
import { calcularCostoVoyage, calcularCostoAnthropic } from './costos.js';
import { obtenerPrompt } from './prompts.js';

export const SYSTEM_PROMPT_AG04 = `Eres un asistente tecnico de ingenieria estructural. Responde preguntas basandote EXCLUSIVAMENTE en los fragmentos de documentos proporcionados.
Cada fragmento viene etiquetado con su documento, seccion y pagina.
Si la respuesta no esta en los fragmentos, di claramente que no encontraste esa informacion en los documentos disponibles.
OBLIGATORIO: al final de cada dato o parametro que cites, agrega la cita verificable exacta entre parentesis con el formato (Documento, seccion, p. N). Nunca des un parametro sin su cita de pagina.
Responde en espanol formal tecnico.`;

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 150;
const TOP_K = 5;

function chunksDeTexto(texto) {
  const parrafos = texto.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let actual = '';
  for (const p of parrafos) {
    if ((actual + '\n' + p).length > CHUNK_SIZE && actual) {
      chunks.push(actual.trim());
      actual = actual.slice(-CHUNK_OVERLAP) + '\n' + p;
    } else {
      actual = actual ? actual + '\n' + p : p;
    }
  }
  if (actual.trim()) chunks.push(actual.trim());
  return chunks;
}

// Extrae el texto del PDF página por página (para conservar el número de página).
async function extraerPaginas(buffer) {
  const paginas = [];
  await pdfParse(buffer, {
    pagerender: (pageData) => {
      const opt = { normalizeWhitespace: false, disableCombineTextItems: false };
      return pageData.getTextContent(opt).then((tc) => {
        let lastY, text = '';
        for (const item of tc.items) {
          if (lastY === item.transform[5] || lastY === undefined) text += item.str;
          else text += '\n' + item.str;
          lastY = item.transform[5];
        }
        paginas.push(text);
        return text;
      });
    },
  });
  return paginas;
}

// Detección best-effort de encabezado de sección (artículo / sección / numeración).
function detectarSeccion(linea) {
  const l = linea.trim();
  if (!l) return null;
  if (/^(art[íi]culo|secci[óo]n|cap[íi]tulo|tabla|figura|anexo)\s+[\w.\-]+/i.test(l)) return l.slice(0, 90);
  if (/^\d+(\.\d+){0,3}\.?\s+\p{Lu}/u.test(l)) return l.slice(0, 90);
  return null;
}

// Divide cada página en chunks etiquetados con { contenido, pagina, seccion }.
function chunksConPagina(paginas) {
  const out = [];
  let seccion = null;
  paginas.forEach((texto, idx) => {
    const pagina = idx + 1;
    for (const ch of chunksDeTexto(texto)) {
      for (const linea of ch.split('\n')) {
        const s = detectarSeccion(linea);
        if (s) seccion = s;
      }
      out.push({ contenido: ch, pagina, seccion });
    }
  });
  return out;
}

export async function indexarPDF(buffer, nombre, tipo = 'documento') {
  const paginas = await extraerPaginas(buffer);
  const chunks = chunksConPagina(paginas);
  if (chunks.length === 0) throw new Error('El PDF no contiene texto extraible');

  let totalTokensVoyage = 0;
  const embeddings = [];
  for (let i = 0; i < chunks.length; i += 5) {
    const lote = chunks.slice(i, i + 5).map((c) => c.contenido);
    const { embeddings: embs, totalTokens } = await embedTextos(lote);
    embeddings.push(...embs);
    totalTokensVoyage += totalTokens;
    if (i + 5 < chunks.length) await new Promise(r => setTimeout(r, 21000));
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "DocumentoRAG" WHERE nombre = $1`, nombre);

  for (let i = 0; i < chunks.length; i++) {
    const vec = `[${embeddings[i].join(',')}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentoRAG" ("id","nombre","tipo","chunkIndex","contenido","embedding","metadata","createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector, $6::jsonb, NOW())`,
      nombre, tipo, i, chunks[i].contenido, vec,
      JSON.stringify({ pagina: chunks[i].pagina, seccion: chunks[i].seccion }),
    );
  }

  const costoUsd = calcularCostoVoyage('voyage-3', totalTokensVoyage);
  return { nombre, tipo, chunks: chunks.length, paginas: paginas.length, _meta: { modelo: 'voyage-3', totalTokensVoyage, costoUsd } };
}

export async function consultarRAG(pregunta, tipo = null) {
  const { embedding: embPregunta, totalTokens: tokVoyage } = await embedTexto(pregunta);
  const vec = `[${embPregunta.join(',')}]`;

  const filtroTipo = tipo ? `AND tipo = '${tipo.replace(/'/g, "''")}'` : '';
  const resultados = await prisma.$queryRawUnsafe(
    `SELECT contenido, nombre, tipo, metadata, (1 - (embedding <=> $1::vector))::float8 AS similitud
     FROM "DocumentoRAG"
     WHERE embedding IS NOT NULL ${filtroTipo}
     ORDER BY embedding <=> $1::vector
     LIMIT ${TOP_K}`,
    vec,
  );

  if (!resultados.length) throw new Error('No se encontraron documentos indexados');

  const metaDe = (r) => (typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}));
  const citaDe = (r) => {
    const m = metaDe(r);
    const partes = [r.nombre];
    if (m.seccion) partes.push(m.seccion);
    if (m.pagina) partes.push(`p. ${m.pagina}`);
    return partes.join(', ');
  };

  const contexto = resultados
    .map((r, i) => `[${i + 1}] Cita: (${citaDe(r)})\n${r.contenido}`)
    .join('\n\n---\n\n');

  const prompt = await obtenerPrompt('AG-04', 'system', SYSTEM_PROMPT_AG04);

  const respuesta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: prompt.contenido,
    messages: [{ role: 'user', content: `Documentos disponibles:\n\n${contexto}\n\n---\n\nPregunta: ${pregunta}` }],
  });

  const texto = respuesta.content.find((b) => b.type === 'text')?.text;
  const costoVoyage = calcularCostoVoyage('voyage-3', tokVoyage);
  const costoAnthropic = calcularCostoAnthropic('claude-sonnet-4-6', respuesta.usage?.input_tokens ?? 0, respuesta.usage?.output_tokens ?? 0);

  return {
    respuesta: texto,
    fuentes: resultados.map((r) => {
      const m = metaDe(r);
      return { nombre: r.nombre, pagina: m.pagina ?? null, seccion: m.seccion ?? null, cita: citaDe(r), similitud: Number(r.similitud).toFixed(3) };
    }),
    _meta: {
      modelo: 'claude-sonnet-4-6 + voyage-3',
      versionPrompt: prompt.version,
      inputTokensAnthropic: respuesta.usage?.input_tokens ?? 0,
      outputTokensAnthropic: respuesta.usage?.output_tokens ?? 0,
      tokensVoyage: tokVoyage,
      costoUsd: costoVoyage + costoAnthropic,
    },
  };
}

export async function listarDocumentos() {
  return prisma.$queryRawUnsafe(
    `SELECT nombre, tipo, COUNT(*) as chunks, MAX("createdAt") as indexado
     FROM "DocumentoRAG" GROUP BY nombre, tipo ORDER BY indexado DESC`,
  );
}
