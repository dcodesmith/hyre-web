// import { createBullBoard } from "@bull-board/api";
// import { BullAdapter } from "@bull-board/api/bullAdapter";
// import { ExpressAdapter } from "@bull-board/express";
import { Redis as UpstashRedis } from "@upstash/redis";
import Bull from "bull";
import Redis from "ioredis";

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
      throw new Error(
        "Upstash Redis credentials are missing in production environment."
      );
    }

    return new UpstashRedis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }

  return new Redis(process.env.REDIS_URL);
}

const redisClient = createRedisClient();

console.log("Initializing Redis connection");

// Create Redis connection with retry strategy
// export const redis = new Redis(REDIS_URL, {
//   maxRetriesPerRequest: null,
//   retryStrategy(times) {
//     const delay = Math.min(times * 50, 2000);
//     return delay;
//   },
// });

console.log("Initializing Bull queue");

// Create the booking status queue
export const bookingStatusQueue = new Bull("booking-status-updates", {
  redis:
    process.env.NODE_ENV === "production"
      ? process.env.KV_URL
      : process.env.REDIS_URL,
  defaultJobOptions: {
    removeOnComplete: true,
    attempts: 3,
  },
  settings: {
    stalledInterval: 300000, // 5 minutes
    maxStalledCount: 0,
  },
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
    console.log("Redis connected");
  });

  redisClient.on("error", (error) => {
    console.error("Redis connection error:", error);
  });
}
// Handle Redis connection events

// Handle Bull queue events
bookingStatusQueue.on("error", (error) => {
  console.error("Bull queue error:", error);
});

bookingStatusQueue.on("waiting", (jobId) => {
  console.log("Job waiting:", jobId);
});

export { Bull };
