import "dotenv/config";
import { defineConfig } from "prisma/config";

const fallbackDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/postgres";
const fallbackShadowDatabaseUrl = "postgresql://postgres:postgres@localhost:5432/afees_shadow";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma 7 reads datasource URL from config. Keep installs/generate working
    // in CI contexts where DATABASE_URL is intentionally not set yet.
    url: process.env.DATABASE_URL ?? fallbackDatabaseUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL ?? fallbackShadowDatabaseUrl,
  },
});
