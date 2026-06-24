import XLSX from 'xlsx';
import { anthropic } from './anthropic.js';
import { calcularCostoAnthropic } from './costos.js';
import { obtenerPrompt } from './prompts.js';

const ESQUEMA_CATALOGO = {
  type: 'object',
  properties: {
    conceptos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clave: { type: 'string' },
          concepto: { type: 'string' },
          unidad: { type: 'string' },
          cantidad: { type: 'number' },
          confianza: { type: 'number', description: 'Confianza 0-100 de la cantidad y el mapeo de este concepto (100=dato directo del Excel; <70=interpolado o ambiguo)' },
        },
        required: ['clave', 'concepto', 'unidad', 'cantidad', 'confianza'],
        additionalProperties: false,
      },
    },
    advertencias: { type: 'array', items: { type: 'string' } },
  },
  required: ['conceptos', 'advertencias'],
  additionalProperties: false,
};

export const SYSTEM_PROMPT_AG01 = `Eres un ingeniero estructural senior con experiencia en cuantificacion de obra en Mexico (Nuevo Leon). Recibes datos tabulares de cuantificacion estructural y generas un catalogo de conceptos de obra con cantidades calculadas.

CALCULOS REQUERIDOS:
- Concreto (M3): para cada elemento suma cantidad × volumen. Pilotes: π×(D/2)²×L÷1e6. Dados/columnas/trabes/muros: B×H×L×N÷1e6. Losas: area×t÷100. Convierte cm→m.
- Acero de refuerzo (KG): usa la tabla de varillas del Excel (peso kg/m por VR). Para cada elemento: N_barras × CANT_elem × L_prom(m) × peso(kg/m). Suma todo.
- Cimbra (M2): perimetro_contacto × longitud para elementos lineales; area_superficial para muros y losas.
- Otros materiales con unidad y cantidad tal como aparecen (blocks M2, malla M2, placas KG, anclas PZA, etc.).

FORMATO DEL CATALOGO:
- Claves: I. Cimentacion (I-A.01...), II. Estructura (II-A.01...), III. Mamposteria (III-A.01...), IV. Elementos especiales (IV-A.01...)
- Unidades: M3, KG, M2, ML, PZA
- Cantidades redondeadas a 2 decimales
- Si no puedes calcular algo con certeza, agrega una advertencia y omite ese concepto o usa 0.

CONFIANZA POR CONCEPTO:
- Para cada concepto asigna "confianza" 0-100: 90-100 si la cantidad sale directa y clara del Excel; 70-89 si requiere un calculo simple bien soportado; <70 si interpolaste, asumiste algo o el dato es ambiguo.
- Los conceptos con confianza <70 se marcaran para revision humana del ingeniero.

IMPORTANTE: Solo usa numeros del Excel. No inventes valores.`;

function excelToText(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  let texto = '';
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    texto += `\n=== HOJA: ${sheetName} ===\n`;
    for (const row of data) {
      const rowStr = row.map((c) => String(c).trim()).join('\t');
      if (rowStr.replace(/\t/g, '').trim()) texto += rowStr + '\n';
    }
  }
  return texto;
}

export async function generarCatalogoCuantificacion(buffer) {
  const textoExcel = excelToText(buffer);
  const prompt = await obtenerPrompt('AG-01', 'system', SYSTEM_PROMPT_AG01);

  const respuesta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: prompt.contenido,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_CATALOGO } },
    messages: [
      {
        role: 'user',
        content: `Analiza esta hoja de cuantificacion estructural y genera el catalogo de conceptos:\n\n${textoExcel}`,
      },
    ],
  });

  const bloque = respuesta.content.find((b) => b.type === 'text');
  if (!bloque) throw new Error('Claude no devolvio respuesta');
  const resultado = JSON.parse(bloque.text);
  resultado._meta = {
    modelo: 'claude-sonnet-4-6',
    versionPrompt: prompt.version,
    inputTokens: respuesta.usage?.input_tokens ?? 0,
    outputTokens: respuesta.usage?.output_tokens ?? 0,
    costoUsd: calcularCostoAnthropic('claude-sonnet-4-6', respuesta.usage?.input_tokens ?? 0, respuesta.usage?.output_tokens ?? 0),
  };
  return resultado;
}
