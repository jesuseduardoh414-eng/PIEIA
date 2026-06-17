-- CreateEnum
CREATE TYPE "RolProyecto" AS ENUM ('admin', 'coordinador', 'calculista', 'dibujante', 'cliente', 'lectura');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('bloqueada', 'pendiente', 'en_desarrollo', 'en_espera_cliente', 'en_revision', 'con_observaciones', 'aprobada', 'invalidada');

-- CreateEnum
CREATE TYPE "TipoDependencia" AS ENUM ('fin_a_inicio', 'entregable_aprobado');

-- CreateTable
CREATE TABLE "disciplina" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disciplina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipologia" (
    "id" TEXT NOT NULL,
    "disciplina_id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipologia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plantilla_tarea" (
    "id" TEXT NOT NULL,
    "tipologia_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "complejidad" INTEGER NOT NULL DEFAULT 1,
    "repetitividad" INTEGER NOT NULL DEFAULT 1,
    "horas_teoricas" DOUBLE PRECISION,
    "rol_sugerido" TEXT,
    "es_critica" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plantilla_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "es_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proyecto" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cliente_nombre" TEXT NOT NULL,
    "estado" TEXT,
    "municipio" TEXT,
    "tipologia_id" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3),
    "fecha_compromiso" TIMESTAMP(3),
    "estado_proyecto" TEXT NOT NULL DEFAULT 'activo',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "componente" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'General',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "componente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea" (
    "id" TEXT NOT NULL,
    "componente_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "asignado_a" TEXT,
    "estado" "EstadoTarea" NOT NULL DEFAULT 'bloqueada',
    "complejidad" INTEGER NOT NULL DEFAULT 1,
    "repetitividad" INTEGER NOT NULL DEFAULT 1,
    "horas_estimadas" DOUBLE PRECISION,
    "horas_reales" DOUBLE PRECISION,
    "es_critica" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "fecha_limite" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependencia" (
    "id" TEXT NOT NULL,
    "tarea_predecesora_id" TEXT NOT NULL,
    "tarea_sucesora_id" TEXT NOT NULL,
    "tipo" "TipoDependencia" NOT NULL DEFAULT 'fin_a_inicio',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dependencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembro_proyecto" (
    "id" TEXT NOT NULL,
    "proyecto_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "rol" "RolProyecto" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembro_proyecto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disciplina_nombre_key" ON "disciplina"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tipologia_clave_key" ON "tipologia"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "proyecto_clave_key" ON "proyecto"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "dependencia_tarea_predecesora_id_tarea_sucesora_id_key" ON "dependencia"("tarea_predecesora_id", "tarea_sucesora_id");

-- CreateIndex
CREATE UNIQUE INDEX "miembro_proyecto_proyecto_id_usuario_id_key" ON "miembro_proyecto"("proyecto_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "tipologia" ADD CONSTRAINT "tipologia_disciplina_id_fkey" FOREIGN KEY ("disciplina_id") REFERENCES "disciplina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plantilla_tarea" ADD CONSTRAINT "plantilla_tarea_tipologia_id_fkey" FOREIGN KEY ("tipologia_id") REFERENCES "tipologia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proyecto" ADD CONSTRAINT "proyecto_tipologia_id_fkey" FOREIGN KEY ("tipologia_id") REFERENCES "tipologia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "componente" ADD CONSTRAINT "componente_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_componente_id_fkey" FOREIGN KEY ("componente_id") REFERENCES "componente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_asignado_a_fkey" FOREIGN KEY ("asignado_a") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencia" ADD CONSTRAINT "dependencia_tarea_predecesora_id_fkey" FOREIGN KEY ("tarea_predecesora_id") REFERENCES "tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dependencia" ADD CONSTRAINT "dependencia_tarea_sucesora_id_fkey" FOREIGN KEY ("tarea_sucesora_id") REFERENCES "tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_proyecto" ADD CONSTRAINT "miembro_proyecto_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembro_proyecto" ADD CONSTRAINT "miembro_proyecto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
