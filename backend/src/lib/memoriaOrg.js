import { prisma } from './prisma.js';
import { embedTexto } from './voyage.js';
import { calcularCostoVoyage } from './costos.js';

const TOP_K = 4;

// Genera el texto que se embeddea combinando resumen + metadatos clave.
function textoParaEmbedding({ tipologia, municipio, resumen, metadatos }) {
  const partes = [];
  if (tipologia) partes.push(`Tipología: ${tipologia}`);
  if (municipio) partes.push(`Municipio: ${municipio}`);
  if (metadatos?.tipoCimentacion) partes.push(`Cimentación: ${metadatos.tipoCimentacion}`);
  if (metadatos?.sistemaEstructural) partes.push(`Sistema estructural: ${metadatos.sistemaEstructural}`);
  partes.push(resumen);
  if (metadatos?.problemas?.length) partes.push(`Problemas: ${metadatos.problemas.join(', ')}`);
  if (metadatos?.observaciones) partes.push(metadatos.observaciones);
  return partes.join('\n');
}

export async function indexarMemoria({ slug, tipologia, municipio, resumen, metadatos = {} }) {
  if (!slug?.trim() || !resumen?.trim()) throw new Error('slug y resumen son requeridos');

  const texto = textoParaEmbedding({ tipologia, municipio, resumen, metadatos });
  const { embedding, totalTokens } = await embedTexto(texto);
  const vec = `[${embedding.join(',')}]`;
  const costo = calcularCostoVoyage('voyage-3', totalTokens);

  // Upsert por slug — re-indexar sobreescribe la entrada anterior.
  await prisma.$executeRawUnsafe(`DELETE FROM "memoria_organizacional" WHERE slug = $1`, slug);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "memoria_organizacional"
       ("id","slug","tipologia","municipio","resumen","embedding","metadatos","created_at")
     VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5::vector,$6::jsonb,NOW())`,
    slug,
    tipologia ?? null,
    municipio ?? null,
    resumen,
    vec,
    JSON.stringify(metadatos),
  );

  return { slug, tokensVoyage: totalTokens, costoUsd: costo };
}

export async function buscarSimilares({ consulta, tipologia = null, topK = TOP_K }) {
  if (!consulta?.trim()) return [];

  const { embedding, totalTokens } = await embedTexto(consulta);
  const vec = `[${embedding.join(',')}]`;
  const costo = calcularCostoVoyage('voyage-3', totalTokens);

  // Filtra por tipología si se especifica, para resultados más relevantes.
  const filtroTipo = tipologia
    ? `AND tipologia = '${tipologia.replace(/'/g, "''")}'`
    : '';

  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, slug, tipologia, municipio, resumen, metadatos,
            (1 - (embedding <=> $1::vector))::float8 AS similitud
     FROM "memoria_organizacional"
     WHERE activo = true AND embedding IS NOT NULL ${filtroTipo}
     ORDER BY embedding <=> $1::vector
     LIMIT ${topK}`,
    vec,
  );

  return {
    resultados: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      tipologia: r.tipologia,
      municipio: r.municipio,
      resumen: r.resumen,
      metadatos: typeof r.metadatos === 'string' ? JSON.parse(r.metadatos) : r.metadatos,
      similitud: Number(r.similitud),
      similitudPct: Math.round(Number(r.similitud) * 100),
    })),
    _meta: { tokensVoyage: totalTokens, costoUsd: costo },
  };
}

export async function listarMemorias() {
  return prisma.$queryRawUnsafe(
    `SELECT id, slug, tipologia, municipio, metadatos, activo, created_at
     FROM "memoria_organizacional"
     ORDER BY created_at DESC`,
  );
}

export async function eliminarMemoria(id) {
  await prisma.$executeRawUnsafe(`DELETE FROM "memoria_organizacional" WHERE id = $1`, id);
}
