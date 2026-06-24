// Generador de plano ESQUEMÁTICO desde un prompt (asistente conceptual con IA).
// IMPORTANTE: produce un BOCETO de distribución (recámaras, baños, áreas aproximadas),
// NO un plano arquitectónico/estructural con validez constructiva. La IA propone, el
// ingeniero firma. El PDF lleva la etiqueta "Borrador IA".
//
// Diseño: la IA SOLO decide qué cuartos hay y su área (es buena en eso); el ACOMODO lo
// hace un algoritmo determinista (treemap por bisección) que garantiza que las habitaciones
// TESELAN el footprint sin huecos ni traslapes. Así nunca se enciman ni quedan en 0 m².
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { anthropic } from './anthropic.js';
import { calcularCostoAnthropic } from './costos.js';

const ESQUEMA_PLANO = {
  type: 'object',
  properties: {
    titulo: { type: 'string', description: 'Nombre corto del plano (ej. "Casa 3 recamaras")' },
    habitaciones: {
      type: 'array',
      description: 'Espacios de UN SOLO NIVEL (planta baja). Cada uno con su area objetivo en m2.',
      items: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          areaM2: { type: 'number', description: 'Area objetivo en m2 (realista para el espacio)' },
        },
        required: ['nombre', 'areaM2'],
        additionalProperties: false,
      },
    },
    notas: { type: 'array', items: { type: 'string' } },
  },
  required: ['titulo', 'habitaciones', 'notas'],
  additionalProperties: false,
};

const SYSTEM_PROMPT_PLANO = `Eres un arquitecto. A partir del pedido del usuario, defines la lista de espacios de UNA planta (boceto conceptual, no plano constructivo).

REGLAS:
- Devuelve SOLO UN NIVEL (planta baja). Si el usuario pide varios niveles, disena solo la planta baja y agrega una nota diciendo que es la planta baja.
- Lista cada espacio con un area objetivo REALISTA en m2: recamara 9-16, recamara principal 14-20, bano 3-6, medio bano 2-4, cocina 6-14, sala-comedor 18-40, cochera ~12.5 por auto, pasillo/circulacion 4-10, estudio 8-12, cuarto de lavado 4-7, patio/jardin segun el caso.
- Incluye TODOS los espacios que pida el usuario. Agrega una circulacion/pasillo si hace falta.
- NO des coordenadas; solo nombre y area. El sistema arma la distribucion.
- Entre 4 y 14 espacios. No inventes cumplimiento normativo: es un boceto para revision del ingeniero.`;

export async function generarLayoutPlano(promptUsuario) {
  const respuesta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: SYSTEM_PROMPT_PLANO,
    output_config: { format: { type: 'json_schema', schema: ESQUEMA_PLANO } },
    messages: [{ role: 'user', content: `Define los espacios (un nivel) para: ${promptUsuario}` }],
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

// Treemap por biseccion: reparte el rectangulo (x,y,w,h) entre las habitaciones segun su
// area, sin huecos ni traslapes. Empuja {nombre, area, x, y, w, h} a `out`.
function teselar(habs, x, y, w, h, out) {
  if (habs.length === 1) { out.push({ ...habs[0], x, y, w, h }); return; }
  const total = habs.reduce((s, r) => s + r.area, 0);
  let acc = 0, i = 0;
  for (; i < habs.length - 1; i++) {
    if (acc + habs[i].area >= total / 2) break;
    acc += habs[i].area;
  }
  const a = habs.slice(0, i + 1), b = habs.slice(i + 1);
  const frac = a.reduce((s, r) => s + r.area, 0) / total;
  if (w >= h) {            // corte vertical (lado mas largo)
    teselar(a, x, y, w * frac, h, out);
    teselar(b, x + w * frac, y, w * (1 - frac), h, out);
  } else {                 // corte horizontal
    teselar(a, x, y + h * (1 - frac), w, h * frac, out);
    teselar(b, x, y, w, h * (1 - frac), out);
  }
}

// Renderiza el layout a un PDF (A4 horizontal). Devuelve un Buffer.
export async function construirPdfPlano(layout) {
  const W = 842, H = 595;
  const BLACK = rgb(0.1, 0.1, 0.1), GRAY = rgb(0.45, 0.45, 0.45), BLUE = rgb(0.15, 0.3, 0.55), AMBER = rgb(0.6, 0.4, 0.05);

  // 1) normaliza habitaciones (areas validas, ordenadas desc) y calcula footprint real
  let habs = (layout.habitaciones || [])
    .map((r) => ({ nombre: String(r.nombre || 'Espacio').slice(0, 40), area: Math.max(2, Number(r.areaM2) || 6) }))
    .slice(0, 14)
    .sort((a, b) => b.area - a.area);
  if (habs.length === 0) habs = [{ nombre: 'Espacio', area: 20 }];
  const totalM2 = habs.reduce((s, r) => s + r.area, 0);
  const aspecto = 1.4;
  const anchoM = Math.sqrt(totalM2 * aspecto);
  const altoM = totalM2 / anchoM;

  // 2) acomodo determinista
  const rects = [];
  teselar(habs, 0, 0, anchoM, altoM, rects);

  // 3) dibujo
  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fb = await doc.embedFont(StandardFonts.HelveticaBold);
  const fit = (txt, font, size, maxW) => {
    let s = size;
    while (s > 5 && font.widthOfTextAtSize(txt, s) > maxW) s -= 0.5;
    return s;
  };
  const center = (txt, font, size, cx, cy, maxW) => {
    const s = fit(txt, font, size, maxW);
    const w = font.widthOfTextAtSize(txt, s);
    page.drawText(txt, { x: cx - w / 2, y: cy - s / 2, size: s, font, color: BLACK });
  };

  page.drawRectangle({ x: 25, y: 25, width: W - 50, height: H - 50, borderColor: BLACK, borderWidth: 1.5 });
  page.drawText(layout.titulo || 'Plano esquematico', { x: 45, y: H - 58, size: 16, font: fb, color: BLUE });
  page.drawText('BORRADOR IA — Distribucion esquematica de planta baja (boceto, sin validez constructiva)', { x: 45, y: H - 74, size: 8, font: fb, color: AMBER });

  const areaX = 70, areaY = 105, areaW = 485, areaH = 370;
  const scale = Math.min(areaW / anchoM, areaH / altoM);
  const fw = anchoM * scale, fh = altoM * scale, fx = areaX, fy = areaY;

  for (const r of rects) {
    const x = fx + r.x * scale, y = fy + r.y * scale, w = r.w * scale, h = r.h * scale;
    page.drawRectangle({ x, y, width: w, height: h, borderColor: BLACK, borderWidth: 1 });
    const cx = x + w / 2, cy = y + h / 2;
    center(r.nombre, fb, 9, cx, cy + 6, w - 8);
    if (h > 26) center(r.area.toFixed(1) + ' m2', f, 7.5, cx, cy - 7, w - 8);
  }
  page.drawRectangle({ x: fx, y: fy, width: fw, height: fh, borderColor: BLACK, borderWidth: 3 });
  center(anchoM.toFixed(2) + ' m (aprox)', fb, 9, fx + fw / 2, fy - 14, fw);
  page.drawText(altoM.toFixed(2) + ' m', { x: fx - 32, y: fy + fh / 2, size: 9, font: fb, color: BLACK, rotate: { type: 'degrees', angle: 90 } });

  page.drawText('N', { x: W - 70, y: H - 70, size: 12, font: fb, color: BLACK });
  page.drawText('^', { x: W - 69, y: H - 88, size: 14, font: fb, color: BLACK });

  const bx = W - 265, by = 45, bw = 240, bh = 86;
  page.drawRectangle({ x: bx, y: by, width: bw, height: bh, borderColor: BLACK, borderWidth: 1.2 });
  page.drawText('PIEIA — Asistente de plano (IA)', { x: bx + 8, y: by + 68, size: 8, font: fb, color: BLUE });
  page.drawText((layout.titulo || 'Plano').slice(0, 40), { x: bx + 8, y: by + 52, size: 9, font: fb, color: BLACK });
  page.drawText('BORRADOR IA — esquematico', { x: bx + 8, y: by + 39, size: 7.5, font: fb, color: AMBER });
  page.drawText('Area total aprox: ' + totalM2.toFixed(0) + ' m2', { x: bx + 8, y: by + 27, size: 7.5, font: f, color: BLACK });
  page.drawText('Fecha: ' + new Date().toLocaleDateString('es-MX'), { x: bx + 8, y: by + 16, size: 7.5, font: f, color: BLACK });
  page.drawText('Requiere validacion del ingeniero', { x: bx + 8, y: by + 6, size: 7, font: f, color: GRAY });

  return Buffer.from(await doc.save());
}
