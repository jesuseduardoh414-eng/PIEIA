import { prisma } from './prisma.js';

export async function agenteActivo(agente) {
  const flag = await prisma.agenteFlag.findUnique({ where: { agente } });
  return flag?.activo ?? true;
}

export async function verificarAgente(agente, res) {
  const activo = await agenteActivo(agente);
  if (!activo) {
    res.status(503).json({ error: `El agente ${agente} esta desactivado por el administrador` });
    return false;
  }
  return true;
}
