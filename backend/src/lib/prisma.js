import { PrismaClient } from '@prisma/client';

// Cliente Prisma unico reutilizable en toda la app.
export const prisma = new PrismaClient();
