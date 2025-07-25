import { PrismaClient } from "@prisma/client";
import { singleton } from "~/utils/misc.server";

const prisma = singleton("prisma", () => {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log:
      process.env.NODE_ENV === "development"
        ? [
            { level: "query", emit: "event" },
            { level: "info", emit: "stdout" },
            { level: "warn", emit: "stdout" },
            { level: "error", emit: "stdout" },
          ]
        : [
            { level: "warn", emit: "stdout" },
            { level: "error", emit: "stdout" },
          ],
  });

  // Enhanced query logging in development
  if (process.env.NODE_ENV === "development") {
    client.$on("query", (e) => {
      if (e.duration > 1000) {
        // Log slow queries (>1s)
        console.log(`🐌 Slow Query (${e.duration}ms): ${e.query}`);
      }
    });
  }

  // Graceful shutdown
  process.on("beforeExit", async () => {
    await client.$disconnect();
  });

  return client;
});

export { prisma };
