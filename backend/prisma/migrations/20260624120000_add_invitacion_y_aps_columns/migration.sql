-- Migracion de reparacion: estas estructuras existian en la BD vieja (agregadas con
-- db push en dev) pero NUNCA quedaron en una migracion, asi que faltaban en la BD nueva.
-- Esto repara el historial: columnas APS del visor + tabla de invitaciones.

-- AlterTable: columnas del visor APS en version_entregable
ALTER TABLE "version_entregable" ADD COLUMN IF NOT EXISTS "aps_urn" TEXT,
ADD COLUMN IF NOT EXISTS "aps_listo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: invitaciones (alta de usuarios por invitacion)
CREATE TABLE IF NOT EXISTS "invitacion" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "rol" "RolProyecto" NOT NULL DEFAULT 'lectura',
    "es_admin" BOOLEAN NOT NULL DEFAULT false,
    "proyecto_id" TEXT,
    "invitado_por_id" TEXT NOT NULL,
    "expira_en" TIMESTAMP(3) NOT NULL,
    "usada_en" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invitacion_token_key" ON "invitacion"("token");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "invitacion" ADD CONSTRAINT "invitacion_invitado_por_id_fkey" FOREIGN KEY ("invitado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
