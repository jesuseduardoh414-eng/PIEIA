import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@r4d-26/core';
import { DATABASE_URL } from './core.env';

const connectionString = DATABASE_URL;

const adapter = new PrismaPg({ connectionString });

// Prisma Client instance
const prisma = new PrismaClient({ adapter, log: ['query', 'info', 'warn', 'error'] });

export { prisma };
