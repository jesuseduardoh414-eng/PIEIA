import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const pdfParse = _require('pdf-parse');
import { prisma } from './prisma.js';
import { embedTextos, embedTexto } from './voyage.js';
import { anthropic } from './anthropic.js';

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
      // solapamiento: tomar los ultimos CHUNK_OVERLAP caracteres del chunk anterior
      actual = actual.slice(-CHUNK_OVERLAP) + '\n' + p;
    } else {
      actual = actual ? actual + '\n' + p : p;
    }
  }
  if (actual.trim()) chunks.push(actual.trim());
  return chunks;
}

export async function indexarPDF(buffer, nombre, tipo = 'documento') {
  const { text } = await pdfParse(buffer);
  const chunks = chunksDeTexto(text);
  if (chunks.length === 0) throw new Error('El PDF no contiene texto extraible');

  // Embeddings en lotes de 20 (limite Voyage AI)
  const embeddings = [];
  for (let i = 0; i < chunks.length; i += 5) {
    const lote = chunks.slice(i, i + 5);
    const embs = await embedTextos(lote);
    embeddings.push(...embs);
    if (i + 5 < chunks.length) await new Promise(r => setTimeout(r, 21000)); // 21s entre lotes (3 RPM)
  }

  // Borrar indexacion previa del mismo archivo
  await prisma.$executeRawUnsafe(`DELETE FROM "DocumentoRAG" WHERE nombre = $1`, nombre);

  // Insertar chunks
  for (let i = 0; i < chunks.length; i++) {
    const vec = `[${embeddings[i].join(',')}]`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentoRAG" ("id","nombre","tipo","chunkIndex","contenido","embedding","metadata","createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::vector, $6::jsonb, NOW())`,
      nombre,
      tipo,
      i,
      chunks[i],
      vec,
      JSON.stringify({ paginas: null }),
    );
  }

  return { nombre, tipo, chunks: chunks.length };
}

export async function consultarRAG(pregunta, tipo = null) {
  const embPregunta = await embedTexto(pregunta);
  const vec = `[${embPregunta.join(',')}]`;

  const filtroTipo = tipo ? `AND tipo = '${tipo.replace(/'/g, "''")}'` : '';
  const resultados = await prisma.$queryRawUnsafe(
    `SELECT contenido, nombre, tipo, (1 - (embedding <=> $1::vector))::float8 AS similitud
     FROM "DocumentoRAG"
     WHERE embedding IS NOT NULL ${filtroTipo}
     ORDER BY embedding <=> $1::vector
     LIMIT ${TOP_K}`,
    vec,
  );

  if (!resultados.length) throw new Error('No se encontraron documentos indexados');

  const contexto = resultados
    .map((r, i) => `[${i + 1}] Fuente: ${r.nombre}\n${r.contenido}`)
    .join('\n\n---\n\n');

  const respuesta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: `Eres un asistente tecnico de ingenieria estructural. Responde preguntas basandote EXCLUSIVAMENTE en los fragmentos de documentos proporcionados.
Si la respuesta no esta en los fragmentos, di claramente que no encontraste esa informacion en los documentos disponibles.
Cita la fuente entre parentesis al final de cada dato relevante. Responde en espanol formal tecnico.`,
    messages: [
      {
        role: 'user',
        content: `Documentos disponibles:\n\n${contexto}\n\n---\n\nPregunta: ${pregunta}`,
      },
    ],
  });

  const texto = respuesta.content.find((b) => b.type === 'text')?.text;
  return {
    respuesta: texto,
    fuentes: resultados.map((r) => ({ nombre: r.nombre, similitud: Number(r.similitud).toFixed(3) })),
  };
}

export async function listarDocumentos() {
  return prisma.$queryRawUnsafe(
    `SELECT nombre, tipo, COUNT(*) as chunks, MAX("createdAt") as indexado
     FROM "DocumentoRAG" GROUP BY nombre, tipo ORDER BY indexado DESC`,
  );
}
