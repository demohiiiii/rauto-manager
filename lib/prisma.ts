import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function normalizeDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);

    // Keep the current secure pg behavior explicit until pg v9 changes
    // sslmode=require semantics.
    if (
      url.searchParams.get("sslmode") === "require" &&
      !url.searchParams.has("uselibpqcompat")
    ) {
      url.searchParams.set("uselibpqcompat", "true");
      return url.toString();
    }

    return databaseUrl;
  } catch {
    return databaseUrl;
  }
}

// Prisma 7 requires the database connection to be passed through an adapter
function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create the PostgreSQL connection pool
  const pool = new pg.Pool({
    connectionString: normalizeDatabaseUrl(databaseUrl),
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
