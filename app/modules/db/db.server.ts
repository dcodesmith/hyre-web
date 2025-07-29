import { PrismaClient } from "@prisma/client";
import logger from "~/lib/logger.server";
import { singleton } from "~/utils/server/misc.server";
import { env } from "~/utils/server/env.server";

const prisma = singleton("prisma", () => {
  const client = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
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

  // Enhanced query logging in development for debugging slow queries
  if (process.env.NODE_ENV === "development") {
    client.$on("query", (queryEvent) => {
      // Log queries that take longer than 1000ms (1 second)
      if (queryEvent.duration > 1000) {
        logger.warn(
          `[Prisma] Slow Query (${queryEvent.duration}ms): ${queryEvent.query} -- Params: ${queryEvent.params}`,
        );
      }
    });
  }

  // This helps ensure the connection is established during a "warm" function
  // start, rather than waiting for the very first database query.
  // It can potentially reduce the latency of the first request to the database.
  client.$connect().catch((error) => {
    logger.error("[Prisma] Failed to connect to database on startup:", error);
  });

  // Graceful shutdown
  process.on("beforeExit", async () => {
    await client.$disconnect();
  });

  return client;
});

export { prisma };
