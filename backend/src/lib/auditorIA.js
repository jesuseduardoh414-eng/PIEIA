import { anthropic, MODELO_MEMORIA } from './anthropic.js';
import { calcularCostoAnthropic } from './costos.js';
import { obtenerPrompt } from './prompts.js';

// Bajo este umbral, un campo extraído se marca para captura/verificación humana (TRD §4.6).
const UMBRAL_CONFIANZA = 70;

// Campos requeridos por tipo de documento.
const CAMPOS_MECANICA = [
  { clave: 'capacidadCargaAdmisible', label: 'Capacidad de carga admisible', unidad: 'ton/m² o kPa' },
  { clave: 'profundidadDesplante',    label: 'Profundidad de desplante',     unidad: 'm' },
  { clave: 'tipoCimentacion',         label: 'Tipo de cimentación recomendada' },
  { clave: 'nivelFreatico',           label: 'Nivel freático',               unidad: 'm' },
  { clave: 'clasificacionSuelo',      label: 'Clasificación SUCS del suelo' },
  { clave: 'factorSeguridad',         label: 'Factor de seguridad utilizado' },
];

const CAMPOS_TOPOGRAFIA = [
  { clave: 'sistemaReferencia',  label: 'Sistema de referencia / datum' },
  { clave: 'intervaloIsoipsa',   label: 'Intervalo entre curvas de nivel', unidad: 'm' },
  { clave: 'elevacionReferencia',label: 'Elevación de referencia o BM',    unidad: 'msnm' },
  { clave: 'areaPredio',         label: 'Área del predio',                  unidad: 'm²' },
  { clave: 'nivelEsquinas',      label: 'Nivel en esquinas o puntos clave' },
];

export const SYSTEM_MECANICA = `Eres un ingeniero geotécnico senior que revisa estudios de mecánica de suelos en México.
Tu tarea es extraer datos clave y detectar información faltante o inconsistente.

Extrae EXACTAMENTE los campos indicados. Si un campo NO aparece en el documento, devuelve null para ese campo.
Para números: extrae el valor numérico principal (sin unidades en el valor).
Sé preciso — no inventes ni interpoles valores que no están explícitamente en el documento.

Para cada campo requerido que SÍ extraigas, registra en "confianzas" un nivel 0-100:
- 90-100: el valor aparece explícito, literal e inequívoco en el documento.
- 70-89: claro pero requiere interpretar (ej. una tabla o varios sondeos).
- <70: inferido, ambiguo o de una fuente indirecta. Estos se marcarán para revisión humana.
No incluyas confianza para campos que dejaste en null.`;

export const SYSTEM_TOPOGRAFIA = `Eres un ingeniero topógrafo senior que revisa levantamientos topográficos en México.
Tu tarea es extraer datos clave del levantamiento y detectar información faltante o inconsistente.

Extrae EXACTAMENTE los campos indicados. Si un campo NO aparece, devuelve null.
Sé preciso — no inventes valores.

Para cada campo requerido que SÍ extraigas, registra en "confianzas" un nivel 0-100:
- 90-100: el valor aparece explícito e inequívoco.
- 70-89: claro pero requiere interpretar.
- <70: inferido o ambiguo. Estos se marcarán para revisión humana.
No incluyas confianza para campos que dejaste en null.`;

const ESQUEMA_MECANICA = {
  type: 'object',
  properties: {
    proyecto:               { type: ['string', 'null'] },
    ubicacion:              { type: ['string', 'null'] },
    fechaEstudio:           { type: ['string', 'null'] },
    capacidadCargaAdmisible:{ type: ['number', 'null'] },
    unidadCapacidadCarga:   { type: ['string', 'null'] },
    profundidadDesplante:   { type: ['number', 'null'] },
    tipoCimentacion:        { type: ['string', 'null'] },
    nivelFreatico:          { type: ['number', 'null'] },
    clasificacionSuelo:     { type: ['string', 'null'] },
    factorSeguridad:        { type: ['number', 'null'] },
    sptN:                   { type: ['number', 'null'], description: 'Valor N del SPT representativo' },
    numSondeos:             { type: ['number', 'null'] },
    observaciones:          { type: ['string', 'null'], description: 'Recomendaciones especiales del estudio' },
    confianzas: {
      type: 'object',
      description: 'Confianza 0-100 por cada campo requerido extraído (100=explícito y claro, <70=inferido o ambiguo). Omite los campos null.',
      properties: {
        capacidadCargaAdmisible: { type: 'number' },
        profundidadDesplante:    { type: 'number' },
        tipoCimentacion:         { type: 'number' },
        nivelFreatico:           { type: 'number' },
        clasificacionSuelo:      { type: 'number' },
        factorSeguridad:         { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  required: ['capacidadCargaAdmisible', 'profundidadDesplante', 'tipoCimentacion', 'nivelFreatico', 'clasificacionSuelo', 'factorSeguridad', 'confianzas'],
  additionalProperties: false,
};

const ESQUEMA_TOPOGRAFIA = {
  type: 'object',
  properties: {
    proyecto:           { type: ['string', 'null'] },
    ubicacion:          { type: ['string', 'null'] },
    fechaLevantamiento: { type: ['string', 'null'] },
    sistemaReferencia:  { type: ['string', 'null'] },
    intervaloIsoipsa:   { type: ['number', 'null'] },
    elevacionReferencia:{ type: ['number', 'null'] },
    areaPredio:         { type: ['number', 'null'] },
    nivelEsquinas:      { type: ['string', 'null'], description: 'Niveles de esquinas o puntos de control' },
    observaciones:      { type: ['string', 'null'] },
    confianzas: {
      type: 'object',
      description: 'Confianza 0-100 por cada campo requerido extraído (100=explícito y claro, <70=inferido o ambiguo). Omite los campos null.',
      properties: {
        sistemaReferencia:   { type: 'number' },
        intervaloIsoipsa:    { type: 'number' },
        elevacionReferencia: { type: 'number' },
        areaPredio:          { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  required: ['sistemaReferencia', 'intervaloIsoipsa', 'elevacionReferencia', 'areaPredio', 'confianzas'],
  additionalProperties: false,
};

export async function auditarDocumentoInicial(buffer, tipo) {
  const esMecanica = tipo === 'mecanica_suelos';
  const clave = esMecanica ? 'mecanica' : 'topografia';
  const fallback = esMecanica ? SYSTEM_MECANICA : SYSTEM_TOPOGRAFIA;
  const prompt = await obtenerPrompt('AG-02', clave, fallback);
  const systemPrompt = prompt.contenido;
  const esquema = esMecanica ? ESQUEMA_MECANICA : ESQUEMA_TOPOGRAFIA;
  const camposRequeridos = esMecanica ? CAMPOS_MECANICA : CAMPOS_TOPOGRAFIA;

  const userText = esMecanica
    ? `Analiza este estudio de mecánica de suelos. Extrae todos los datos disponibles según el esquema JSON solicitado.
       Si falta algún campo requerido, déjalo como null — no lo estimes.`
    : `Analiza este levantamiento topográfico. Extrae todos los datos disponibles según el esquema JSON solicitado.
       Si falta algún campo requerido, déjalo como null — no lo estimes.`;

  const response = await anthropic.messages.create({
    model: MODELO_MEMORIA,
    max_tokens: 1500,
    system: systemPrompt,
    tools: [{
      name: 'extraer_datos',
      description: 'Extrae los datos estructurados del documento',
      input_schema: esquema,
    }],
    tool_choice: { type: 'tool', name: 'extraer_datos' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') },
        },
        { type: 'text', text: userText },
      ],
    }],
  });

  const toolUse = response.content.find(b => b.type === 'tool_use');
  const datos = toolUse?.input ?? {};
  const confianzas = datos.confianzas ?? {};
  const costo = calcularCostoAnthropic(MODELO_MEMORIA, response.usage.input_tokens, response.usage.output_tokens);

  // Detectar campos faltantes
  const camposFaltantes = camposRequeridos
    .filter(c => datos[c.clave] === null || datos[c.clave] === undefined)
    .map(c => ({ ...c, valor: null }));

  // Campos presentes, con su confianza 0-100 por campo (TRD §4.6, §7.0).
  const camposPresentes = camposRequeridos
    .filter(c => datos[c.clave] !== null && datos[c.clave] !== undefined)
    .map(c => {
      const conf = typeof confianzas[c.clave] === 'number' ? Math.round(confianzas[c.clave]) : null;
      return { ...c, valor: datos[c.clave], confianza: conf, bajaConfianza: conf !== null && conf < UMBRAL_CONFIANZA };
    });

  // Campos que requieren captura/verificación humana por baja confianza.
  const camposBajaConfianza = camposPresentes.filter(c => c.bajaConfianza);

  // Generar texto de solicitud de información faltante
  let solicitudTexto = null;
  if (camposFaltantes.length > 0) {
    solicitudTexto = generarSolicitudTexto(tipo, datos, camposFaltantes);
  }

  return {
    tipo,
    datos,
    camposPresentes,
    camposFaltantes,
    camposBajaConfianza,
    umbralConfianza: UMBRAL_CONFIANZA,
    solicitudTexto,
    completo: camposFaltantes.length === 0,
    requiereRevision: camposBajaConfianza.length > 0,
    _meta: { costoUsd: costo, versionPrompt: prompt.version, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
  };
}

function generarSolicitudTexto(tipo, datos, faltantes) {
  const tipoLabel = tipo === 'mecanica_suelos' ? 'Estudio de Mecánica de Suelos' : 'Levantamiento Topográfico';
  const proyecto = datos.proyecto ?? 'el proyecto';
  const fecha = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

  const items = faltantes.map((f, i) =>
    `  ${i + 1}. ${f.label}${f.unidad ? ` (${f.unidad})` : ''}`
  ).join('\n');

  return `SOLICITUD DE INFORMACIÓN FALTANTE
Fecha: ${fecha}
Proyecto: ${proyecto}
Documento revisado: ${tipoLabel}

Estimado equipo:

Durante la revisión del ${tipoLabel} recibido, se identificaron los siguientes campos requeridos que no están presentes o no se pueden extraer del documento:

${items}

Por favor, complementar el documento con esta información o proporcionar los datos por separado para continuar con el proceso de diseño estructural.

En caso de duda, contactar al responsable del proyecto.

Atentamente,
PIEIA — Sistema de revisión automatizada AG-02`;
}
