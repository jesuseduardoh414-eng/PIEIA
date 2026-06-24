// Generador de plano ESQUEMÁTICO desde un prompt (asistente conceptual con IA).
// IMPORTANTE: produce un BOCETO de distribución (recámaras, baños, áreas aproximadas),
// NO un plano arquitectónico/estructural con validez constructiva. El principio de PIEIA
// sigue vigente: la IA propone, el ingeniero firma. El PDF lleva la etiqueta "Borrador IA".
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { anthropic } from './anthropic.js';
import { calcularCostoAnthropic } from './costos.js';

const ESQUEMA_PLANO = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Nombre corto del plano segun el pedido (ej. "Casa 3 recamaras")' },
    anchoM: { type: 'number', description: 'Ancho del footprint en metros (ej. 12)' },
    altoM: { type: 'number', description: 'Alto del footprint en metros (ej. 9)' },
    habitaciones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          x: { type: 'number', description: 'Esquina inferior-izquierda X en metros (origen abajo-izquierda)' },
          y: { type: 'number', description: 'Esquina inferior-izquierda Y en metros' },
          w: { type: 'number', description: 'Ancho en metros' },
          h: { type: 'number', description: 'Alto en metros' },
        },
        required: ['nombre', 'x', 'y', 'w', 'h'],
        additionalProperties: false,
      },
    },
    notas: { type: 'array', items: { type: 'string' } },
  },
  required: ['titulo', 'anchoM', 'altoM', 'habitaciones', 'notas'],
  additionalProperties: false,
};

const SYSTEM_PROMPT_PLANO = `Eres un arquitecto. A partir del pedido del usuario, disenas la DISTRIBUCION ESQUEMATICA de una planta (boceto conceptual, no plano constructivo).

REGLAS DE LAYOUT (obligatorias):
- Define un footprint rectangular (anchoM x altoM) con medidas realistas para lo pedido.
- Las habitaciones TESELAN el footprint: cubren todo el rectangulo SIN huecos y SIN traslapes (como una cuadricula). Cada habitacion es un rectangulo (x,y,w,h) en metros, origen abajo-izquierda.
- Suma de areas de habitaciones = area del footprint.
- Incluye TODOS los espacios que pida el usuario (recamaras, banos, cocina, sala-comedor, cochera, pasillo si hace falta para conectar).
- Medidas realistas: recamara 9-16 m2, recamara principal 14-20, bano 3-6, cocina 6-12, sala-comedor 18-40, cochera por auto ~12.5, pasillo angosto.
- Para edificios de varios departamentos, reparte el footprint en N modulos (un depto por modulo) mas un pasillo comun; nombra cada espacio con su modulo (ej. "Depto A - Recamara").

No inventes cumplimiento normativo. Esto es un boceto de distribucion para revision del ingeniero/arquitecto.`;

export async function generarLayoutPlano(promptUsuario) {
  const respuesta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: SYSTEM_PROMPT_PLANO,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_PLANO } },
    messages: [{ role: 'user', content: `Disena la distribucion esquematica para: ${promptUsuario}` }],
  });
  const bloque = respuesta.content.find((b) => b.type === 'text');
  if (!bloque) throw new Error('La IA no devolvio un layout');
  const layout = JSON.parse(bloque.text);
  layout._meta = {
    modelo: 'claude-sonnet-4-6',
    inputTokens: respuesta.usage?.input_tokens ?? 0,
    outputTokens: respuesta.usage?.output_tokens ?? 0,
    costoUsd: calcularCostoAnthropic('claude-sonnet-4-6', respuesta.usage?.input_tokens ?? 0, respuesta.usage?.output_tokens ?? 0),
  };
  return layout;
}

// Renderiza el layout a un PDF (A4 horizontal). Devuelve un Buffer.
export async function construirPdfPlano(layout) {
  const W = 842, H = 595;
  const BLACK = rgb(0.1, 0.1, 0.1), GRAY = rgb(0.45, 0.45, 0.45), BLUE = rgb(0.15, 0.3, 0.55), AMBER = rgb(0.6, 0.4, 0.05);
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const center = (txt, font, size, cx, cy) => {
    const w = font.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: cx - w / 2, y: cy - size / 2, size, font, color: BLACK });
  };

  page.drawRectangle({ x: 25, y: 25, width: W - 50, height: H - 50, borderColor: BLACK, borderWidth: 1.5 });
  page.drawText(layout.titulo || 'Plano esquematico', { x: 45, y: H - 58, size: 16, font: fb, color: BLUE });
  page.drawText('BORRADOR IA — Distribucion esquematica (boceto conceptual, sin validez constructiva)', { x: 45, y: H - 74, size: 8, font: fb, color: AMBER });

  // área de dibujo y escala (ajusta el footprint preservando proporción)
  const areaX = 60, areaY = 110, areaW = 540, areaH = 380;
  const anchoM = Math.max(1, layout.anchoM || 12), altoM = Math.max(1, layout.altoM || 9);
  const scale = Math.min(areaW / anchoM, areaH / altoM);
  const fw = anchoM * scale, fh = altoM * scale;
  const fx = areaX, fy = areaY;

  for (const r of (layout.habitaciones || [])) {
    const x = fx + (r.x || 0) * scale, y = fy + (r.y || 0) * scale, w = (r.w || 0) * scale, h = (r.h || 0) * scale;
    if (w <= 0 || h <= 0) continue;
    page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 1 });
    const cx = x + w / 2, cy = y + h / 2;
    // etiqueta con wrap simple si es muy ancha
    const nombre = String(r.nombre || '').slice(0, 38);
    center(nombre, fb, w > 90 ? 9 : 7.5, cx, cy + 6);
    const m2 = (r.w || 0) * (r.h || 0);
    center(m2.toFixed(1) + ' m2', f, 7, cx, cy - 7);
  }
  // muro exterior grueso
  page.drawRectangle({ x: fx, y: fy, width: fw, height: fh, borderColor: BLACK, borderWidth: 3 });
  center(anchoM.toFixed(2) + ' m', fb, 9, fx + fw / 2, fy - 14);
  page.drawText(altoM.toFixed(2) + ' m', { x: fx - 30, y: fy + fh / 2, size: 9, font: fb, color: BLACK, rotate: { type: 'degrees', angle: 90 } });

  // norte
  page.drawText('N', { x: W - 70, y: H - 70, size: 12, font: fb, color: BLACK });
  page.drawText('^', { x: W - 69, y: H - 88, size: 14, font: fb, color: BLACK });

  // cuadro de titulo
  const bx = W - 265, by = 45, bw = 240, bh = 78;
  page.drawRectangle({ x: bx, y: by, width: bw, height: bh, borderColor: BLACK, borderWidth: 1.2 });
  page.drawText('PIEIA — Asistente de plano (IA)', { x: bx + 8, y: by + 60, size: 8, font: fb, color: BLUE });
  page.drawText((layout.titulo || 'Plano').slice(0, 40), { x: bx + 8, y: by + 44, size: 9, font: fb, color: BLACK });
  page.drawText('BORRADOR IA — esquematico', { x: bx + 8, y: by + 31, size: 7.5, font: fb, color: AMBER });
  page.drawText('Fecha: ' + new Date().toLocaleDateString('es-MX'), { x: bx + 8, y: by + 19, size: 7.5, font: f, color: BLACK });
  page.drawText('Requiere validacion del ingeniero', { x: bx + 8, y: by + 8, size: 7, font: f, color: GRAY });

  return Buffer.from(await doc.save());
}
