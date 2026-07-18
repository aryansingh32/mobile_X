import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL as string,
      },
    },
  });

// Prevent hot-reload from creating multiple Prisma Client instances
if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
