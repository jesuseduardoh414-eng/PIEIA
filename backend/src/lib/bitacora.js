import { prisma } from './prisma.js';

export async function registrarEjecucion({ agente, proyectoId, tareaId, modelo, inputs }) {
  return prisma.ejecucionAgente.create({
    data: {
      agente,
      proyectoId: proyectoId ?? null,
      tareaId: tareaId ?? null,
      modelo,
      inputs,
      estado: 'en_proceso',
    },
  });
}

export async function completarEjecucion(id, { outputs, scoreConfianza, costoUsd, duracionMs, estado = 'pendiente_validacion' }) {
  return prisma.ejecucionAgente.update({
    where: { id },
    data: { outputs, scoreConfianza, costoUsd, duracionMs, estado },
  });
}

export async function fallarEjecucion(id, error) {
  return prisma.ejecucionAgente.update({
    where: { id },
    data: { outputs: { error: error?.message || String(error) }, estado: 'rechazada' },
  });
}
