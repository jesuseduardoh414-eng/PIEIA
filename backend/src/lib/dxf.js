// Parser de DXF en Node puro (sin dependencias, sin Python).
// Extrae capas, textos, bloques y dimensiones de un DXF ASCII — el paso
// "DXF → entidades" del pipeline del TRD §4.5. El paso previo DWG→DXF usa
// ODA File Converter (ver convertirDwgADxf) cuando está instalado.
//
// Formato DXF ASCII: pares de líneas (código de grupo entero, valor).
// Las entidades viven en la sección ENTITIES; cada una empieza con código 0.

import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Limpia los códigos de formato de MTEXT (\A1; \fArial; {\...} \P, etc.).
function limpiarMtext(s) {
  if (!s) return '';
  return s
    .replace(/\\P/g, '\n')            // salto de párrafo
    .replace(/\\[A-Za-z][^;]*;/g, '') // \A1;  \fArial|...;  \H2.5x;  etc.
    .replace(/[{}]/g, '')             // grupos de formato
    .replace(/\\[\\{}]/g, (m) => m[1]) // escapes
    .trim();
}

// Convierte el texto DXF en una lista plana de pares { code, value }.
function tokenizar(texto) {
  const lineas = texto.split(/\r\n|\r|\n/);
  const pares = [];
  for (let i = 0; i + 1 < lineas.length; i += 2) {
    const code = parseInt(lineas[i].trim(), 10);
    if (Number.isNaN(code)) { i -= 1; continue; } // resincroniza si hay línea impar
    pares.push({ code, value: lineas[i + 1] ?? '' });
  }
  return pares;
}

// Agrupa los pares en bloques de entidad (cada uno empieza en code 0).
function agruparPorCodigo0(pares, desde, hasta) {
  const grupos = [];
  let actual = null;
  for (let i = desde; i < hasta; i++) {
    const p = pares[i];
    if (p.code === 0) {
      if (actual) grupos.push(actual);
      actual = { tipo: p.value.trim(), pares: [] };
    } else if (actual) {
      actual.pares.push(p);
    }
  }
  if (actual) grupos.push(actual);
  return grupos;
}

function valor(grupo, code) {
  const p = grupo.pares.find((x) => x.code === code);
  return p ? p.value.trim() : null;
}
function valores(grupo, code) {
  return grupo.pares.filter((x) => x.code === code).map((x) => x.value);
}

// Encuentra el rango [inicio, fin) de una sección por nombre (ej. "ENTITIES").
function rangoSeccion(pares, nombre) {
  for (let i = 0; i < pares.length - 1; i++) {
    if (pares[i].code === 0 && pares[i].value.trim() === 'SECTION' &&
        pares[i + 1].code === 2 && pares[i + 1].value.trim() === nombre) {
      const inicio = i + 2;
      for (let j = inicio; j < pares.length; j++) {
        if (pares[j].code === 0 && pares[j].value.trim() === 'ENDSEC') return [inicio, j];
      }
      return [inicio, pares.length];
    }
  }
  return null;
}

export function extraerDeDxf(buffer) {
  const texto = buffer.toString('latin1'); // DXF suele venir en ANSI/latin1
  const pares = tokenizar(texto);

  // ----- Capas (TABLES → LAYER) -----
  const capas = [];
  const rTables = rangoSeccion(pares, 'TABLES');
  if (rTables) {
    const grupos = agruparPorCodigo0(pares, rTables[0], rTables[1]);
    for (const g of grupos) {
      if (g.tipo === 'LAYER') {
        const nombre = valor(g, 2);
        if (nombre) capas.push({ nombre, color: valor(g, 62) });
      }
    }
  }

  // ----- Entidades (ENTITIES) -----
  const textos = [];      // { texto, capa, x, y }
  const bloques = {};     // nombre -> conteo
  const dimensiones = []; // { texto, capa, medida }
  let nLineas = 0, nPolilineas = 0, nCirculos = 0;

  const rEnt = rangoSeccion(pares, 'ENTITIES');
  if (rEnt) {
    const grupos = agruparPorCodigo0(pares, rEnt[0], rEnt[1]);
    for (const g of grupos) {
      const capa = valor(g, 8) || '0';
      const x = parseFloat(valor(g, 10)) || null;
      const y = parseFloat(valor(g, 20)) || null;
      switch (g.tipo) {
        case 'TEXT': {
          const t = (valor(g, 1) || '').trim();
          if (t) textos.push({ texto: t, capa, x, y });
          break;
        }
        case 'MTEXT': {
          // El texto puede venir fragmentado en code 3 (continuación) + code 1 (final).
          const partes = [...valores(g, 3), ...(valor(g, 1) ? [valor(g, 1)] : [])];
          const t = limpiarMtext(partes.join(''));
          if (t) textos.push({ texto: t, capa, x, y });
          break;
        }
        case 'INSERT': {
          const nombre = valor(g, 2) || '(sin nombre)';
          bloques[nombre] = (bloques[nombre] || 0) + 1;
          break;
        }
        case 'DIMENSION': {
          const override = (valor(g, 1) || '').trim();
          const medida = parseFloat(valor(g, 42));
          dimensiones.push({ texto: override, capa, medida: Number.isNaN(medida) ? null : medida });
          break;
        }
        case 'LINE': nLineas++; break;
        case 'LWPOLYLINE': case 'POLYLINE': nPolilineas++; break;
        case 'CIRCLE': case 'ARC': nCirculos++; break;
        default: break;
      }
    }
  }

  // Agrupa textos por capa (útil para detectar cuadros de armados, notas, etc.)
  const textosPorCapa = {};
  for (const t of textos) (textosPorCapa[t.capa] ??= []).push(t.texto);

  return {
    resumen: {
      capas: capas.length,
      textos: textos.length,
      tiposBloque: Object.keys(bloques).length,
      bloquesTotal: Object.values(bloques).reduce((a, b) => a + b, 0),
      dimensiones: dimensiones.length,
      lineas: nLineas,
      polilineas: nPolilineas,
      circulosArcos: nCirculos,
    },
    capas,
    textos,
    textosPorCapa,
    bloques,
    dimensiones,
  };
}

// DWG → DXF usando ODA File Converter (freeware). Requiere ODA_CONVERTER_PATH en .env
// apuntando al ejecutable. Devuelve un Buffer DXF, o lanza error si no está configurado.
export function convertirDwgADxf(bufferDwg, nombre = 'plano.dwg') {
  const odaPath = process.env.ODA_CONVERTER_PATH;
  if (!odaPath) {
    const err = new Error('Para procesar DWG instala ODA File Converter y define ODA_CONVERTER_PATH en el .env. Mientras tanto, sube el archivo en formato DXF.');
    err.code = 'ODA_NO_CONFIGURADO';
    throw err;
  }
  const dirIn = mkdtempSync(join(tmpdir(), 'pieia-dwg-in-'));
  const dirOut = mkdtempSync(join(tmpdir(), 'pieia-dxf-out-'));
  try {
    writeFileSync(join(dirIn, nombre.replace(/[^\w.\-]/g, '_')), bufferDwg);
    // ODAFileConverter <in> <out> <outVer> <outType> <recurse> <audit> [filter]
    spawnSync(odaPath, [dirIn, dirOut, 'ACAD2018', 'DXF', '0', '1', '*.DWG'], { timeout: 120000 });
    const salida = readdirSync(dirOut).find((f) => f.toLowerCase().endsWith('.dxf'));
    if (!salida) throw new Error('ODA File Converter no produjo un DXF (¿versión o licencia?)');
    return readFileSync(join(dirOut, salida));
  } finally {
    rmSync(dirIn, { recursive: true, force: true });
    rmSync(dirOut, { recursive: true, force: true });
  }
}
