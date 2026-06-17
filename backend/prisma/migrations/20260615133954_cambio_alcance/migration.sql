-- CreateEnum
CREATE TYPE "DecisionCambio" AS ENUM ('absorbido', 'cotizado', 'rechazado');

-- CreateTable
CREATE TABLE "cambio_alcance" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tarea_raiz_id" TEXT,
    "tareas_afectadas" JSONB NOT NULL,
    "horas_retrabajo" DOUBLE PRECISION NOT NULL,
    "decision" "DecisionCambio" NOT NULL,
    "decidido_por" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambio_alcance_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cambio_alcance" ADD CONSTRAINT "cambio_alcance_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cambio_alcance" ADD CONSTRAINT "cambio_alcance_decidido_por_fkey" FOREIGN KEY ("decidido_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
