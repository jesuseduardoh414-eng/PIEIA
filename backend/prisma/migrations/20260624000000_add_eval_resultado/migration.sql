-- TRD §8: historial de corridas de evals contra datasets dorados (append-only).
CREATE TABLE "eval_resultado" (
  "id"             TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "corrida_id"     TEXT    NOT NULL,
  "caso_id"        TEXT    NOT NULL,
  "agente"         TEXT    NOT NULL,
  "version_prompt" TEXT,
  "aprobado"       BOOLEAN NOT NULL,
  "score"          DOUBLE PRECISION,
  "metricas"       JSONB   NOT NULL,
  "detalle"        JSONB,
  "error"          TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eval_resultado_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "eval_resultado_agente_created_at_idx" ON "eval_resultado" ("agente", "created_at");
CREATE INDEX "eval_resultado_corrida_id_idx" ON "eval_resultado" ("corrida_id");
