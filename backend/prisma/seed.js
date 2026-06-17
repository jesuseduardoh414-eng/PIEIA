// Seed: disciplina "Estructural" + tipologias T1-T5 + un checklist de plantilla_tarea
// por tipologia (starter realista). El detalle fino lo define el socio (tarea #20).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TIPOLOGIAS = [
  { clave: 'T1', nombre: 'Reforzamiento / dictamen de estructuras existentes', descripcion: 'Caso de referencia: Bodega DS-104', primera: 'Levantamiento fisico y deteccion de patologias' },
  { clave: 'T2', nombre: 'Revision estructural externa / auditoria tecnica', descripcion: 'Caso de referencia: Fuller 2', primera: 'Confrontacion de inconsistencias (planos, memoria, modelo)' },
  { clave: 'T3', nombre: 'Infraestructura vial y puentes', descripcion: 'Caso de referencia: PSV Dia del Empresario', primera: 'Definicion de cargas moviles (camion de diseno) y revision de informacion' },
  { clave: 'T4', nombre: 'Edificacion compleja y obras de contencion', descripcion: 'Caso de referencia: Castanos de Vergel', primera: 'Recepcion de informacion y revision de interconexion con existente' },
  { clave: 'T5', nombre: 'Proyectos multicomponente / institucionales', descripcion: 'Caso de referencia: Academia de Policia', primera: 'Definicion de componentes y revision de informacion inicial' },
];

// Checklist base comun (orden, dependencias por orden). Aplica a todas las tipologias;
// la tarea 1 se ajusta segun la tipologia (campo "primera").
const checklistBase = () => [
  { orden: 1, nombre: 'Recepcion y revision de informacion inicial', complejidad: 2, repetitividad: 8, horasTeoricas: 4, rolSugerido: 'calculista', esCritica: true, dependeDeOrdenes: [] },
  { orden: 2, nombre: 'Analisis de cargas y combinaciones', complejidad: 5, repetitividad: 6, horasTeoricas: 8, rolSugerido: 'calculista', esCritica: false, dependeDeOrdenes: [1] },
  { orden: 3, nombre: 'Modelado estructural (STAAD)', complejidad: 7, repetitividad: 5, horasTeoricas: 16, rolSugerido: 'calculista', esCritica: true, dependeDeOrdenes: [1] },
  { orden: 4, nombre: 'Analisis e iteracion de esfuerzos', complejidad: 7, repetitividad: 5, horasTeoricas: 12, rolSugerido: 'calculista', esCritica: false, dependeDeOrdenes: [2, 3] },
  { orden: 5, nombre: 'Diseno de cimentacion', complejidad: 7, repetitividad: 5, horasTeoricas: 16, rolSugerido: 'calculista', esCritica: true, dependeDeOrdenes: [4] },
  { orden: 6, nombre: 'Diseno de elementos (trabes, columnas, losas)', complejidad: 8, repetitividad: 5, horasTeoricas: 24, rolSugerido: 'calculista', esCritica: true, dependeDeOrdenes: [4] },
  { orden: 7, nombre: 'Elaboracion de planos estructurales', complejidad: 6, repetitividad: 6, horasTeoricas: 24, rolSugerido: 'dibujante', esCritica: true, dependeDeOrdenes: [5, 6] },
  { orden: 8, nombre: 'Revision cruzada de planos', complejidad: 5, repetitividad: 6, horasTeoricas: 8, rolSugerido: 'coordinador', esCritica: false, dependeDeOrdenes: [7] },
  { orden: 9, nombre: 'Memoria de calculo', complejidad: 6, repetitividad: 6, horasTeoricas: 16, rolSugerido: 'calculista', esCritica: true, dependeDeOrdenes: [5, 6] },
  { orden: 10, nombre: 'Cuantificacion y catalogo de conceptos', complejidad: 5, repetitividad: 7, horasTeoricas: 10, rolSugerido: 'calculista', esCritica: false, dependeDeOrdenes: [7, 9] },
  { orden: 11, nombre: 'Revision final y liberacion', complejidad: 4, repetitividad: 7, horasTeoricas: 6, rolSugerido: 'coordinador', esCritica: true, dependeDeOrdenes: [8, 10] },
];

async function main() {
  console.log('Seed: disciplina Estructural...');
  const estructural = await prisma.disciplina.upsert({
    where: { nombre: 'Estructural' },
    update: {},
    create: { nombre: 'Estructural', activa: true },
  });

  for (const t of TIPOLOGIAS) {
    console.log(`Seed: tipologia ${t.clave} + plantillas...`);
    const tip = await prisma.tipologia.upsert({
      where: { clave: t.clave },
      update: { nombre: t.nombre, descripcion: t.descripcion },
      create: { clave: t.clave, nombre: t.nombre, descripcion: t.descripcion, disciplinaId: estructural.id, activa: true },
    });

    // Regenera el checklist de forma idempotente.
    await prisma.plantillaTarea.deleteMany({ where: { tipologiaId: tip.id } });
    const checklist = checklistBase();
    checklist[0].nombre = t.primera; // primera tarea segun tipologia
    await prisma.plantillaTarea.createMany({
      data: checklist.map((c) => ({ ...c, tipologiaId: tip.id })),
    });
  }

  console.log('Seed completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
