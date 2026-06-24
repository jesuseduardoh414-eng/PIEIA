-- TRD 4.6: Prompts de agentes como artefactos versionados (semver).
-- La tabla se crea vacía; los prompts actuales se siembran con `node prisma/seedPrompts.js`
-- (lee las constantes fallback de los libs para evitar duplicar el texto).
CREATE TABLE "plantilla_prompt" (
  "id"         TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
  "agente"     TEXT    NOT NULL,
  "clave"      TEXT    NOT NULL,
  "version"    TEXT    NOT NULL,
  "contenido"  TEXT    NOT NULL,
  "changelog"  TEXT,
  "activa"     BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plantilla_prompt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plantilla_prompt_agente_clave_version_key"
  ON "plantilla_prompt" ("agente", "clave", "version");

CREATE INDEX "plantilla_prompt_agente_clave_activa_idx"
  ON "plantilla_prompt" ("agente", "clave", "activa");
