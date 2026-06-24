-- MOD-I: Memoria organizacional — búsqueda semántica en proyectos entregados.
-- Cada fila = un proyecto cerrado indexado (anonimizado).
-- La columna "embedding" es un vector voyage-3 de 1024 dimensiones.
CREATE TABLE "memoria_organizacional" (
  "id"          TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "slug"        TEXT    NOT NULL,          -- nombre anonimizado (ej: "Casa Hab. NL-001")
  "tipologia"   TEXT,                      -- clave de tipología (ej: "T1")
  "municipio"   TEXT,
  "resumen"     TEXT    NOT NULL,          -- texto libre que se embeddea
  "embedding"   vector(1024),
  "metadatos"   JSONB   NOT NULL DEFAULT '{}',
  "activo"      BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memoria_organizacional_pkey" PRIMARY KEY ("id")
);

-- Índice IVFFlat para búsqueda por similitud coseno (eficiente con pocos registros).
CREATE INDEX "memoria_org_embedding_idx"
  ON "memoria_organizacional"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 10);
