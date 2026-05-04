import { PrismaClient } from '@prisma/client';

const g = globalThis as typeof globalThis & { prisma?: PrismaClient };
const prisma = g.prisma ?? (g.prisma = new PrismaClient());
export default prisma;
