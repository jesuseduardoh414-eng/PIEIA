-- Feature flags por agente
CREATE TABLE "agente_flag" (
    "agente"              TEXT NOT NULL,
    "activo"              BOOLEAN NOT NULL DEFAULT true,
    "actualizado_por_id"  TEXT,
    "updated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "agente_flag_pkey" PRIMARY KEY ("agente")
);

ALTER TABLE "agente_flag" ADD CONSTRAINT "agente_flag_actualizado_por_id_fkey"
    FOREIGN KEY ("actualizado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed: todos los agentes activos por defecto
INSERT INTO "agente_flag" ("agente", "activo") VALUES
    ('AG-01', true), ('AG-02', true), ('AG-03', true), ('AG-04', true), ('AG-05', true);

-- RF-H06: Candado de auto-aprobacion a nivel BD
-- Impide que ejecucion_agente pase a 'aceptada' o 'editada' sin validado_por_id
CREATE OR REPLACE FUNCTION check_validacion_agente()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.estado IN ('aceptada', 'editada') AND NEW.validado_por_id IS NULL THEN
        RAISE EXCEPTION 'Un output de agente no puede aprobarse sin validacion humana (RF-H06)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_validacion_agente
    BEFORE UPDATE ON "ejecucion_agente"
    FOR EACH ROW
    WHEN (NEW.estado IN ('aceptada', 'editada'))
    EXECUTE FUNCTION check_validacion_agente();
