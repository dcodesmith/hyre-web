// import { createBullBoard } from "@bull-board/api";
// import { BullAdapter } from "@bull-board/api/bullAdapter";
// import { ExpressAdapter } from "@bull-board/express";
import { Redis as UpstashRedis } from "@upstash/redis";
import Bull from "bull";
import Redis from "ioredis";
import logger from "~/lib/logger.server";

// Import Redis client based on environment
// let redisClient;

// if (process.env.NODE_ENV === "development") {
//   // Use local Redis in development
//   redisClient = new Redis(process.env.REDIS_URL);
// } else {
//   // Use Upstash KV in production
//   if (
//     !process.env.UPSTASH_REDIS_REST_URL ||
//     !process.env.UPSTASH_REDIS_REST_TOKEN
//   ) {
//     throw new Error("Upstash Redis credentials are required in production");
//   }

//   redisClient = new UpstashRedis({
//     url: process.env.UPSTASH_REDIS_REST_URL,
//     token: process.env.UPSTASH_REDIS_REST_TOKEN,
//   });
// }

// Redis connection configuration
// const REDIS_URL = process.env.REDIS_URL;

// if (!REDIS_URL) {
//   throw new Error("REDIS_URL is required");
// }

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

if (process.env.NODE_ENV === "production") {
  logger.info("Checking Upstash Redis connection...", process.env.KV_URL);
  const redis = new Redis(process.env.KV_URL!);
  redis
    .ping()
    .then((res) => console.log("Ping response:", res))
    .catch((err) => console.error("Redis connection test error:", err));
}

const bullOptions = {
  redis: process.env.NODE_ENV === "production" ? process.env.KV_URL : process.env.REDIS_URL,
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
  },
  settings: {
    stalledInterval: 300000, // 5 minutes
    maxStalledCount: 0,
  },
};

export const bookingStatusQueue = new Bull("booking-status-updates", bullOptions);
export const bookingReminderQueue = new Bull("booking-reminder", bullOptions);

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

bookingStatusQueue.on("ready", () => {
  logger.info("Bull queue (booking-status-updates) is ready and connected to Redis!");
});

bookingStatusQueue
  .isReady()
  .then(() => {
    logger.info("Bull queue is ready!");
  })
  .catch((error) => {
    logger.error("Failed to connect Bull queue to Redis:", error);
  });

// Handle Bull queue events
bookingStatusQueue.on("error", (error) => {
  const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
  logger.error(`Bull queue error: ${errorString}`);
});

// bookingStatusQueue.on("waiting", (jobId) => {});

export { Bull };
