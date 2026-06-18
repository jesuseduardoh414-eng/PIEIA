-- Habilitar extension pgvector (ya disponible en Supabase por defecto)
CREATE EXTENSION IF NOT EXISTS vector;

-- Tabla de chunks indexados para RAG
CREATE TABLE IF NOT EXISTS "DocumentoRAG" (
  "id"          TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "nombre"      TEXT        NOT NULL,
  "tipo"        TEXT        NOT NULL DEFAULT 'documento',
  "chunkIndex"  INTEGER     NOT NULL,
  "contenido"   TEXT        NOT NULL,
  "embedding"   vector(1024),
  "metadata"    JSONB,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "DocumentoRAG_pkey" PRIMARY KEY ("id")
);

-- Indice para busqueda por similitud coseno
CREATE INDEX IF NOT EXISTS "DocumentoRAG_embedding_idx"
  ON "DocumentoRAG" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 10);
