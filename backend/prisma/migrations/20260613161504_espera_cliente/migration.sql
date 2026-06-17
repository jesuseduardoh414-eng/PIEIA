-- AlterTable
ALTER TABLE "tarea" ADD COLUMN     "espera_cliente_desde" TIMESTAMP(3),
ADD COLUMN     "espera_cliente_segundos" INTEGER NOT NULL DEFAULT 0;
