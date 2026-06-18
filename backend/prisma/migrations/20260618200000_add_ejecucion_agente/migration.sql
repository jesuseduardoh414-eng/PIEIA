CREATE TABLE "ejecucion_agente" (
    "id"              TEXT NOT NULL,
    "agente"          TEXT NOT NULL,
    "proyecto_id"     TEXT,
    "tarea_id"        TEXT,
    "version_prompt"  TEXT NOT NULL DEFAULT '1.0.0',
    "modelo"          TEXT NOT NULL,
    "inputs"          JSONB NOT NULL,
    "outputs"         JSONB,
    "score_confianza" DOUBLE PRECISION,
    "costo_usd"       DOUBLE PRECISION,
    "duracion_ms"     INTEGER,
    "estado"          TEXT NOT NULL DEFAULT 'en_proceso',
    "validado_por_id" TEXT,
    "feedback"        TEXT,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "ejecucion_agente_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ejecucion_agente" ADD CONSTRAINT "ejecucion_agente_proyecto_id_fkey"
    FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ejecucion_agente" ADD CONSTRAINT "ejecucion_agente_tarea_id_fkey"
    FOREIGN KEY ("tarea_id") REFERENCES "tarea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ejecucion_agente" ADD CONSTRAINT "ejecucion_agente_validado_por_id_fkey"
    FOREIGN KEY ("validado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ejecucion_agente_estado_idx" ON "ejecucion_agente"("estado");
CREATE INDEX "ejecucion_agente_proyecto_id_idx" ON "ejecucion_agente"("proyecto_id");
