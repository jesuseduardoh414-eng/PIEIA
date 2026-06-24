// RF-A04: Estimador de horas con recalibración automática.
// Analiza horasReales históricas por tipología+nombre de tarea y actualiza horasTeoricas.

export const MIN_MUESTRAS = 3; // mínimo de muestras para recalibrar

function redondearMediaHora(h) {
  return Math.round(h * 2) / 2; // redondea al 0.5 más cercano
}

/**
 * Calcula la recalibración sin escribir nada (preview).
 * Devuelve un array de { plantillaId, nombre, tipologiaClave, horasActuales, horasNuevas,
 *   muestras, cambia, datos[] } — uno por plantilla.
 */
export async function previsualizarRecalibracion(prisma) {
  const plantillas = await prisma.plantillaTarea.findMany({
    include: { tipologia: { select: { clave: true, nombre: true } } },
    orderBy: [{ tipologiaId: 'asc' }, { orden: 'asc' }],
  });

  const resultados = [];

  for (const pt of plantillas) {
    // Tareas reales completadas (con horasReales) de la misma tipología y nombre.
    const historico = await prisma.tarea.findMany({
      where: {
        nombre: pt.nombre,
        horasReales: { not: null, gt: 0 },
        componente: { proyecto: { tipologiaId: pt.tipologiaId } },
      },
      select: { horasReales: true, complejidad: true, repetitividad: true },
    });

    const muestras = historico.length;

    if (muestras < MIN_MUESTRAS) {
      resultados.push({
        plantillaId: pt.id,
        nombre: pt.nombre,
        tipologiaClave: pt.tipologia.clave,
        tipologiaNombre: pt.tipologia.nombre,
        horasActuales: pt.horasTeoricas,
        horasNuevas: null,
        muestras,
        suficiente: false,
        cambia: false,
      });
      continue;
    }

    // Promedio simple de horas reales.
    const promedio = historico.reduce((s, t) => s + t.horasReales, 0) / muestras;
    const horasNuevas = redondearMediaHora(promedio);
    const cambia = pt.horasTeoricas == null || Math.abs((pt.horasTeoricas ?? 0) - horasNuevas) >= 0.5;

    resultados.push({
      plantillaId: pt.id,
      nombre: pt.nombre,
      tipologiaClave: pt.tipologia.clave,
      tipologiaNombre: pt.tipologia.nombre,
      horasActuales: pt.horasTeoricas,
      horasNuevas,
      muestras,
      suficiente: true,
      cambia,
    });
  }

  return resultados;
}

/**
 * Ejecuta la recalibración: actualiza horasTeoricas en las plantillas con suficientes muestras.
 * Devuelve { actualizadas, sinDatos, preview }.
 */
export async function ejecutarRecalibracion(prisma) {
  const preview = await previsualizarRecalibracion(prisma);
  const aActualizar = preview.filter((r) => r.suficiente && r.cambia);

  for (const r of aActualizar) {
    await prisma.plantillaTarea.update({
      where: { id: r.plantillaId },
      data: { horasTeoricas: r.horasNuevas },
    });
  }

  return {
    actualizadas: aActualizar.length,
    sinDatos: preview.filter((r) => !r.suficiente).length,
    preview,
  };
}
