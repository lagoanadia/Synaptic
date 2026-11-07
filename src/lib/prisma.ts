import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One client across dev hot reloads (otherwise a new connection pool per save).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Serverless: many copies of the app run at once and each keeps its own
// pool, so keep each pool small and let idle connections go quickly (a
// suspended copy would otherwise hold them). Without this the database runs
// out of connections and pages fail to load.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DATABASE_POOL_MAX) || 3,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
