// Sincroniza los prompts del código (constantes en los libs) con la BD.
// - Si no existe ninguna versión: crea 1.0.0 activa.
// - Si la versión activa tiene el mismo contenido: no hace nada.
// - Si el contenido del código cambió: crea la siguiente versión patch y la activa.
// Idempotente y seguro de correr varias veces. Uso: node prisma/seedPrompts.js
import { PrismaClient } from '@prisma/client';
import { SYSTEM_PROMPT_AG01 } from '../src/lib/cuantificacionIA.js';
import { SYSTEM_MECANICA, SYSTEM_TOPOGRAFIA } from '../src/lib/auditorIA.js';
import { SYSTEM_PROMPT_AG03 } from '../src/lib/memoriaCalculo.js';
import { SYSTEM_PROMPT_AG04 } from '../src/lib/ragPDF.js';

const prisma = new PrismaClient();

const PROMPTS = [
  { agente: 'AG-01', clave: 'system',     contenido: SYSTEM_PROMPT_AG01 },
  { agente: 'AG-02', clave: 'mecanica',   contenido: SYSTEM_MECANICA },
  { agente: 'AG-02', clave: 'topografia', contenido: SYSTEM_TOPOGRAFIA },
  { agente: 'AG-03', clave: 'system',     contenido: SYSTEM_PROMPT_AG03 },
  { agente: 'AG-04', clave: 'system',     contenido: SYSTEM_PROMPT_AG04 },
];

function siguientePatch(version) {
  const p = version.split('.').map(Number);
  p[2] = (p[2] || 0) + 1;
  return p.join('.');
}

async function main() {
  for (const p of PROMPTS) {
    const versiones = await prisma.plantillaPrompt.findMany({
      where: { agente: p.agente, clave: p.clave },
      orderBy: { createdAt: 'desc' },
    });

    if (versiones.length === 0) {
      await prisma.plantillaPrompt.create({
        data: { agente: p.agente, clave: p.clave, version: '1.0.0', contenido: p.contenido, changelog: 'Versión inicial migrada desde el código.', activa: true },
      });
      console.log(`+ ${p.agente}/${p.clave} v1.0.0 (activa)`);
      continue;
    }

    const activa = versiones.find(v => v.activa) ?? versiones[0];
    if (activa.contenido === p.contenido) {
      console.log(`= ${p.agente}/${p.clave} sin cambios (v${activa.version})`);
      continue;
    }

    // El código cambió respecto a la versión activa: crea y activa una nueva.
    const nuevaVersion = siguientePatch(versiones[0].version);
    await prisma.plantillaPrompt.updateMany({ where: { agente: p.agente, clave: p.clave }, data: { activa: false } });
    await prisma.plantillaPrompt.create({
      data: { agente: p.agente, clave: p.clave, version: nuevaVersion, contenido: p.contenido, changelog: 'Actualizado desde el código (seed).', activa: true },
    });
    console.log(`↑ ${p.agente}/${p.clave} v${nuevaVersion} (activa, antes v${activa.version})`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
