import { execSync } from "node:child_process";

/**
 * Playwright global setup — ensures the E2E database exists, is fully migrated,
 * and starts clean (no leftover rows from previous runs).
 *
 * The E2E_DATABASE_URL env var is set by playwright.config.ts before this runs.
 */
export default async function globalSetup() {
  const e2eUrl = process.env.E2E_DATABASE_URL;
  if (!e2eUrl) {
    throw new Error(
      "E2E_DATABASE_URL is not set. The playwright config should derive it from DATABASE_URL.",
    );
  }

  const url = new URL(e2eUrl);
  const dbName = url.pathname.slice(1);

  console.log(`[e2e] Using database: ${dbName}`);
  console.log(`[e2e] URL: ${e2eUrl}`);

  // 1. Create the database if it doesn't exist (idempotent)
  try {
    execSync(`createdb "${dbName}"`, { stdio: "pipe" });
    console.log(`[e2e] Created database "${dbName}"`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : JSON.stringify(error);
    if (msg.includes("already exists")) {
      console.log(`[e2e] Database "${dbName}" already exists`);
    } else {
      throw new Error(`[e2e] failed to create database "${dbName}": ${msg}`);
    }
  }

  // 2. Apply all migrations (fast no-op if already up to date)
  console.log("[e2e] Running prisma migrate deploy …");
  execSync(`DATABASE_URL="${e2eUrl}" npx prisma migrate deploy`, { stdio: "inherit" });

  // 3. Truncate every application table so each run starts clean.
  //    _prisma_migrations is preserved so step 2 stays a no-op on re-runs.
  console.log("[e2e] Truncating all tables …");
  const truncateSql = [
    "DO $$ DECLARE r RECORD;",
    "BEGIN",
    "FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations') LOOP",
    "EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';",
    "END LOOP;",
    "END $$;",
  ].join(" ");

  // psql doesn't support Prisma's ?schema= query param — strip it.
  // Pass SQL via stdin to avoid $$ being expanded by the shell.
  const psqlUrl = e2eUrl.replace(/\?.*$/, "");
  execSync(`psql "${psqlUrl}"`, {
    input: truncateSql,
    stdio: ["pipe", "inherit", "inherit"],
  });

  console.log("[e2e] Database ready.");
}
