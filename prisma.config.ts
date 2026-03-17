import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prefer a direct connection for Prisma CLI operations such as migrate deploy.
    // Fall back to DATABASE_URL when a dedicated direct URL is not provided.
    url: process.env.DIRECT_DATABASE_URL || env("DATABASE_URL"),
  },
});
