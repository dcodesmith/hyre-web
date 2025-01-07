// import { createBullBoard } from "@bull-board/api";
// import { BullAdapter } from "@bull-board/api/bullAdapter";
// import { ExpressAdapter } from "@bull-board/express";
import { Redis as UpstashRedis } from "@upstash/redis";
import { Queue, QueueEvents, QueueOptions } from "bullmq";
import Redis from "ioredis";
import logger from "~/lib/logger.server";

function createRedisClient() {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      throw new Error("Upstash Redis credentials are missing in production environment.");
    }

    return new UpstashRedis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }

  if (!process.env.REDIS_URL) {
    throw new Error("Redis URL is missing in development environment.");
  }

  return new Redis(process.env.REDIS_URL);
}

const redisClient = createRedisClient();

if (process.env.NODE_ENV === "production" && process.env.KV_URL) {
  logger.info(
    "Checking Upstash Redis connection...",
    process.env.KV_URL ? process.env.KV_URL : "No KV URL",
  );
  const redis = new Redis(process.env.KV_URL);
  redis
    .ping()
    .then((res) => console.log("Ping response:", res))
    .catch((err) => console.error("Redis connection test error:", err));
}

// tls: {
//   rejectUnauthorized: false,
// },

// rediss://default:AWTiAAIjcDE0Y2NhMzM2MWQ2N2Y0YjJkOGE4NTE3NzUzNWMyNzRiMnAxMA@pleasant-parakeet-25826.upstash.io:6379"
export const bullMQOptions: QueueOptions = {
  connection: {
    url: process.env.NODE_ENV === "production" ? process.env.KV_URL : process.env.REDIS_URL,
    tls:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  },
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
  },
};

// export const bookingStatusQueue = new Queue("booking-status-updates", bullMQOptions);
// export const bookingReminderQueue = new Queue("booking-reminder", bullMQOptions);

// Event listener for queue events
const queueEvents = new QueueEvents("booking-status-updates", {
  connection: bullMQOptions.connection,
});

queueEvents.on("completed", (event) => {
  logger.info(`Job ${event.jobId} completed successfully`);
});

queueEvents.on("failed", (event) => {
  logger.error(`Job ${event.jobId} failed`);
});

// Setup Bull Board (monitoring UI)
// export const serverAdapter = new ExpressAdapter();

// createBullBoard({
//   queues: [new BullAdapter(bookingStatusQueue)],
//   serverAdapter,
// });

// serverAdapter.setBasePath("/admin/queues");

if (redisClient instanceof Redis) {
  redisClient.on("connect", () => {
    logger.info("Redis connection established");
  });

  redisClient.on("error", (error) => {
    logger.error("Redis connection error:", error);
  });
}

if (redisClient instanceof UpstashRedis) {
  async function checkUpstashConnection() {
    try {
      const pong = await redisClient.ping(); // returns "PONG" if successful
      logger.info("Upstash Redis is working:", pong === "PONG");
    } catch (error) {
      logger.error("Error checking Upstash Redis connection:", error);
    }
  }
  checkUpstashConnection();
}
// Handle Redis connection events

// bookingStatusQueue
//   .isReady()
//   .then(() => {
//     logger.info("Bull queue is ready!");
//   })
//   .catch((error) => {
//     logger.error("Failed to connect Bull queue to Redis:", error);
//   });

// Handle Bull queue events
// bookingStatusQueue.on("error", (error) => {
// const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
// logger.info(`Upstash Redis URL - ${process.env.KV_URL ? process.env.KV_URL : "No KV URL"}`);
// logger.error(`BullMQ queue error: ${errorString}`);
// console.error("Redis Connection Details:", {
//   url: process.env.KV_URL ? process.env.KV_URL : "KV_URL is missing",
//   env: process.env.NODE_ENV,
//   error: error.message,
//   stack: error.stack,
// });
// });

// Changed to use BullMQ's connection events
// bookingStatusQueue.on("waiting", () => {
//   logger.info("BullMQ queue (booking-status-updates) is ready and connected to Redis!");
// });

// bookingStatusQueue.on("removed", () => {
//   logger.warn("Queue disconnected from Redis");
// });

export { Queue };
