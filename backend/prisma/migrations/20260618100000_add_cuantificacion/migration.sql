CREATE TABLE "cuantificacion" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'v1',
    "origen" TEXT NOT NULL DEFAULT 'manual',
    "creada_por_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "cuantificacion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partida_cuantificacion" (
    "id" TEXT NOT NULL,
    "cuantificacion_id" TEXT NOT NULL,
    "concepto_id" TEXT,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" DECIMAL(12,4) NOT NULL,
    "precio_unitario" DECIMAL(12,2),
    "origen" JSONB,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "partida_cuantificacion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "cuantificacion" ADD CONSTRAINT "cuantificacion_proyecto_id_fkey"
    FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cuantificacion" ADD CONSTRAINT "cuantificacion_creada_por_id_fkey"
    FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partida_cuantificacion" ADD CONSTRAINT "partida_cuantificacion_cuantificacion_id_fkey"
    FOREIGN KEY ("cuantificacion_id") REFERENCES "cuantificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partida_cuantificacion" ADD CONSTRAINT "partida_cuantificacion_concepto_id_fkey"
    FOREIGN KEY ("concepto_id") REFERENCES "concepto_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
