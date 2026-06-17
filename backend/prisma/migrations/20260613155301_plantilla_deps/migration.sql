-- AlterTable
ALTER TABLE "plantilla_tarea" ADD COLUMN     "depende_de_ordenes" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
