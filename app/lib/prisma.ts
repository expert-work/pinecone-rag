import { PrismaClient } from '@prisma/client'

export function createPrismaClient() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })
  
  return prisma.$connect().then(() => prisma)
}

// For non-API route usage
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma