-- CreateTable
CREATE TABLE "checklist_revision_item" (
    "id" TEXT NOT NULL,
    "tipoEntregable" "TipoEntregable" NOT NULL,
    "texto" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checklist_revision_item_pkey" PRIMARY KEY ("id")
);
