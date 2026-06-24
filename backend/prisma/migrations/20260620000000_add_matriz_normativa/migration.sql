-- RF-A05: Matriz de normativa aplicable por jurisdicción y municipio.
CREATE TABLE "matriz_normativa" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "jurisdiccion"    TEXT NOT NULL,
  "nombre"          TEXT NOT NULL,
  "clave"           TEXT,
  "aplica_en"       TEXT[] NOT NULL DEFAULT '{}',
  "descripcion"     TEXT,
  "url_referencia"  TEXT,
  "activo"          BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matriz_normativa_pkey" PRIMARY KEY ("id")
);

-- Seed inicial: normativas de Nuevo León
INSERT INTO "matriz_normativa" ("jurisdiccion", "nombre", "clave", "aplica_en", "descripcion") VALUES
  -- Federales (aplica_en vacío = aplica en todos)
  ('federal', 'Reglamento de Construcciones para el Distrito Federal (NTC)', 'RCDF-NTC', '{}', 'Normas Técnicas Complementarias de referencia para diseño estructural'),
  ('federal', 'Manual de Diseño de Obras Civiles CFE - Diseño por Sismo', 'MDOC-CFE-S', '{}', 'Criterios sísmicos de la Comisión Federal de Electricidad'),
  ('federal', 'Manual de Diseño de Obras Civiles CFE - Diseño por Viento', 'MDOC-CFE-V', '{}', 'Criterios de viento de la Comisión Federal de Electricidad'),
  ('federal', 'NMX-C-414-ONNCCE - Concreto', 'NMX-C-414', '{}', 'Norma Mexicana para especificaciones y métodos de prueba del cemento'),
  -- Estatales Nuevo León
  ('estatal', 'Reglamento de Construcción del Estado de Nuevo León', 'RCNL', '{}', 'Reglamento estatal vigente para construcción en Nuevo León'),
  ('estatal', 'Normas Técnicas Complementarias del Estado de Nuevo León', 'NTC-NL', '{}', 'Complementos técnicos para estructuras, cimentaciones y cargas'),
  -- Municipales Área Metropolitana de Monterrey
  ('municipal', 'Reglamento de Construcción del Municipio de Monterrey', 'RCM-2023', '{"monterrey"}', 'Reglamento vigente para construcción en el municipio de Monterrey'),
  ('municipal', 'Reglamento de Construcción de San Pedro Garza García', 'RC-SPGG', '{"san pedro garza garcia", "san pedro"}', 'Reglamento municipal de San Pedro Garza García'),
  ('municipal', 'Reglamento de Construcción de Guadalupe', 'RC-GUAD', '{"guadalupe"}', 'Reglamento municipal de Guadalupe NL'),
  ('municipal', 'Reglamento de Construcción de Apodaca', 'RC-APOD', '{"apodaca"}', 'Reglamento municipal de Apodaca NL'),
  ('municipal', 'Reglamento de Construcción de Santa Catarina', 'RC-SC', '{"santa catarina"}', 'Reglamento municipal de Santa Catarina NL'),
  ('municipal', 'Reglamento de Construcción de San Nicolás de los Garza', 'RC-SN', '{"san nicolas de los garza", "san nicolas"}', 'Reglamento municipal de San Nicolás de los Garza NL'),
  ('municipal', 'Reglamento de Construcción de General Escobedo', 'RC-ESC', '{"escobedo", "general escobedo"}', 'Reglamento municipal de General Escobedo NL'),
  ('municipal', 'Reglamento de Construcción de García', 'RC-GAR', '{"garcia"}', 'Reglamento municipal de García NL');
