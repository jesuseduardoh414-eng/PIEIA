-- TRD 4.6: Cola durable de trabajos de agentes (equivalente Node-native de pgmq).
CREATE TABLE "trabajo_agente" (
  "id"            TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "tipo"          TEXT    NOT NULL,
  "payload"       JSONB   NOT NULL,
  "archivo"       BYTEA,
  "prioridad"     INTEGER NOT NULL DEFAULT 5,
  "estado"        TEXT    NOT NULL DEFAULT 'encolado',
  "intentos"      INTEGER NOT NULL DEFAULT 0,
  "max_intentos"  INTEGER NOT NULL DEFAULT 3,
  "resultado"     JSONB,
  "error"         TEXT,
  "ejecucion_id"  TEXT,
  "disponible_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "iniciado_en"   TIMESTAMP(3),
  "completado_en" TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trabajo_agente_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "trabajo_agente_estado_disponible_prioridad_idx"
  ON "trabajo_agente" ("estado", "disponible_en", "prioridad");
