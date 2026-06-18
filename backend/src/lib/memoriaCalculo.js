import { anthropic, MODELO_MEMORIA } from './anthropic.js';
import { calcularCostoAnthropic } from './costos.js';

const ESQUEMA_MEMORIA = {
  type: 'object',
  properties: {
    titulo: { type: 'string' },
    secciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          encabezado: { type: 'string' },
          parrafos: { type: 'array', items: { type: 'string' } },
        },
        required: ['encabezado', 'parrafos'],
        additionalProperties: false,
      },
    },
  },
  required: ['titulo', 'secciones'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Eres un redactor tecnico que apoya a un despacho de ingenieria estructural en Monterrey, Nuevo Leon, Mexico, a producir memorias de calculo.

Tu unico trabajo es redactar prosa formal de ingenieria alrededor de los datos numericos que el usuario te entrega. Reglas estrictas:
- NUNCA inventes valores numericos, unidades, dimensiones, cargas, resistencias, factores ni referencias normativas (NTC, RCDF, NOM, etc.) que no esten explicitamente en los "Datos de diseno" proporcionados.
- Si una seccion requiere datos que no fueron proporcionados, escribe un parrafo breve indicando que esa informacion esta pendiente de captura, en vez de inventarla.
- Cita los numeros tal como fueron dados, con sus unidades originales.
- Estilo formal, tecnico, en espanol de Mexico, como el de una memoria de calculo estructural real.
- No agregues firmas, sellos ni declaraciones de responsabilidad profesional: ese documento lo revisa y firma el ingeniero responsable antes de entregarse.

Estructura siempre la memoria en estas secciones, en este orden: "Introduccion y objetivo", "Descripcion del proyecto", "Normativa aplicable", "Bases de diseno e hipotesis", "Resultados del analisis y verificaciones", "Conclusiones".`;

export async function generarMemoriaCalculo({ proyecto, tarea, datosDiseno }) {
  const contexto = `Proyecto: ${proyecto.nombre} (clave ${proyecto.clave})
Cliente: ${proyecto.clienteNombre}
Municipio: ${proyecto.municipio || 'no especificado'}
Tipologia: ${proyecto.tipologia.nombre} (${proyecto.tipologia.disciplina.nombre})
Tarea / componente de la memoria: ${tarea.nombre}

Datos de diseno (unica fuente de numeros permitida):
${datosDiseno}`;

  const respuesta = await anthropic.messages.create({
    model: MODELO_MEMORIA,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_MEMORIA } },
    messages: [{ role: 'user', content: contexto }],
  });

  const bloque = respuesta.content.find((b) => b.type === 'text');
  if (!bloque) throw new Error('Claude no devolvio contenido de texto');
  const resultado = JSON.parse(bloque.text);
  resultado._meta = {
    modelo: MODELO_MEMORIA,
    inputTokens: respuesta.usage?.input_tokens ?? 0,
    outputTokens: respuesta.usage?.output_tokens ?? 0,
    costoUsd: calcularCostoAnthropic(MODELO_MEMORIA, respuesta.usage?.input_tokens ?? 0, respuesta.usage?.output_tokens ?? 0),
  };
  return resultado;
}
