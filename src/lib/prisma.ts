import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js hot-reloads modules in dev, which would otherwise create a fresh
// PrismaClient (and a fresh pool of DB connections) on every file save.
// Stashing the instance on `globalThis` survives the reload, so we always
// reuse the same client in development. In production this runs once anyway.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
