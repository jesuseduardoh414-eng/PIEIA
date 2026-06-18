CREATE TABLE "concepto_catalogo" (
    "id" TEXT NOT NULL,
    "disciplina_id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "alias" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "concepto_catalogo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "precio_unitario" (
    "id" TEXT NOT NULL,
    "concepto_id" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'Noreste',
    "precio" DECIMAL(12,2) NOT NULL,
    "fuente" TEXT,
    "vigencia_desde" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "precio_unitario_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "concepto_catalogo" ADD CONSTRAINT "concepto_catalogo_disciplina_id_fkey"
    FOREIGN KEY ("disciplina_id") REFERENCES "disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "precio_unitario" ADD CONSTRAINT "precio_unitario_concepto_id_fkey"
    FOREIGN KEY ("concepto_id") REFERENCES "concepto_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "concepto_catalogo_disciplina_id_clave_key" ON "concepto_catalogo"("disciplina_id", "clave");
