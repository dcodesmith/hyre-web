import Bull from "bull";
import { createBullBoard } from "@bull-board/api";
import { ExpressAdapter } from "@bull-board/express";
import { BullAdapter } from "@bull-board/api/bullAdapter";
import Redis from "ioredis";

// Redis connection configuration
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL is required");
}

console.log("Initializing Redis connection");

// Create Redis connection with retry strategy
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

console.log("Initializing Bull queue");

// Create the booking status queue
export const bookingStatusQueue = new Bull("booking-status-updates", {
  redis: REDIS_URL,
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
export const serverAdapter = new ExpressAdapter();

createBullBoard({
  queues: [new BullAdapter(bookingStatusQueue)],
  serverAdapter,
});

serverAdapter.setBasePath("/admin/queues");

// Handle Redis connection events
redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (error) => {
  console.error("Redis connection error:", error);
});

// Handle Bull queue events
bookingStatusQueue.on("error", (error) => {
  console.error("Bull queue error:", error);
});

bookingStatusQueue.on("waiting", (jobId) => {
  console.log("Job waiting:", jobId);
});

export { Bull };
