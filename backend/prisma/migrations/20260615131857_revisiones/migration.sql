-- CreateEnum
CREATE TYPE "ResultadoRevision" AS ENUM ('aprobado', 'con_observaciones');

-- CreateEnum
CREATE TYPE "EstadoObservacion" AS ENUM ('abierta', 'resuelta');

-- CreateTable
CREATE TABLE "revision" (
    "id" TEXT NOT NULL,
    "version_entregable_id" TEXT NOT NULL,
    "revisor_id" TEXT NOT NULL,
    "resultado" "ResultadoRevision" NOT NULL,
    "comentario" TEXT,
    "hash_version" TEXT NOT NULL,
    "firmado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observacion" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "anclaje" JSONB,
    "estado" "EstadoObservacion" NOT NULL DEFAULT 'abierta',
    "resuelta_con_version_id" TEXT,
    "justificacion" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observacion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "revision" ADD CONSTRAINT "revision_version_entregable_id_fkey" FOREIGN KEY ("version_entregable_id") REFERENCES "version_entregable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision" ADD CONSTRAINT "revision_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion" ADD CONSTRAINT "observacion_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;
