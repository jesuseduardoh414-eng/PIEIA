-- CreateEnum
CREATE TYPE "TipoEntregable" AS ENUM ('dwg_arquitectonico', 'dwg_topografia', 'pdf_mecanica_suelos', 'std_modelo', 'xlsx_diseno', 'dwg_planos', 'pdf_memoria', 'xlsx_catalogo', 'otro');

-- CreateEnum
CREATE TYPE "OrigenVersion" AS ENUM ('humano', 'agente');

-- CreateTable
CREATE TABLE "entregable" (
    "id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoEntregable" NOT NULL DEFAULT 'otro',
    "obligatorio" BOOLEAN NOT NULL DEFAULT false,
    "version_actual_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entregable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_entregable" (
    "id" TEXT NOT NULL,
    "entregable_id" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "nombre_archivo" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "hash_sha256" TEXT NOT NULL,
    "subido_por" TEXT NOT NULL,
    "origen" "OrigenVersion" NOT NULL DEFAULT 'humano',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_entregable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entregable_version_actual_id_key" ON "entregable"("version_actual_id");

-- CreateIndex
CREATE UNIQUE INDEX "version_entregable_entregable_id_numero_key" ON "version_entregable"("entregable_id", "numero");

-- AddForeignKey
ALTER TABLE "entregable" ADD CONSTRAINT "entregable_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregable" ADD CONSTRAINT "entregable_version_actual_id_fkey" FOREIGN KEY ("version_actual_id") REFERENCES "version_entregable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_entregable" ADD CONSTRAINT "version_entregable_entregable_id_fkey" FOREIGN KEY ("entregable_id") REFERENCES "entregable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_entregable" ADD CONSTRAINT "version_entregable_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
