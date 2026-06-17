-- AlterTable
ALTER TABLE "tarea" ADD COLUMN     "aprobado_cliente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fecha_aprobacion_cliente" TIMESTAMP(3),
ADD COLUMN     "requiere_aprobacion_cliente" BOOLEAN NOT NULL DEFAULT false;
