import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Singleton — butun app davomida bitta instance
let _prisma: PrismaClient | null = null;

function createPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL environment variable kerak");

  const adapter = new PrismaPg({ connectionString: url });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development"
      ? [{ emit: "stdout", level: "query" }, "warn", "error"]
      : ["warn", "error"],
  });
}

export function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = createPrisma();
  return _prisma;
}

export const prisma = getPrisma();

export async function disconnectPrisma(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
