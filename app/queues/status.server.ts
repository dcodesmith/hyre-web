import { Queue, Worker } from "bullmq";
import logger from "~/lib/logger.server";
import {
  updateBookingsFromActiveToCompleted,
  updateBookingsFromConfirmedToActive,
} from "~/services/bookings.server";
import { bullMQOptions } from "./config.server";

export const statusUpdateQueue = new Queue("status-update", bullMQOptions);

async function startStatusUpdates() {
  logger.info("Adding status updates to queue");

  // Add repeatable jobs for status transitions
  await statusUpdateQueue.add(
    "confirmed-to-active",
    {},
    {
      repeat: {
        pattern: "0 8-12 * * *", // At minute 0 of every hour from 8 through 12 (8am-12pm)
      },
    },
  );

  await statusUpdateQueue.add(
    "active-to-completed",
    {},
    {
      repeat: {
        pattern: "0 20-23,0 * * *", // At minute 0 of every hour from 20 through 0 (8pm-12am)
      },
    },
  );

  statusUpdateQueue.on("waiting", () => {
    logger.info("BullMQ queue (status-update) is ready and connected to Redis!");
  });

  statusUpdateQueue.on("removed", () => {
    logger.warn("Queue disconnected from Redis");
  });
}

// Worker to process jobs
let isWorkerInitialized = false;

export const startStatusUpdateWorker = async () => {
  if (isWorkerInitialized) {
    return;
  }

  await startStatusUpdates();

  const statusUpdateWorker = new Worker(
    "status-update",
    async (job) => {
      switch (job.name) {
        case "confirmed-to-active":
          logger.info(`Starting ${job.name} status update job`);
          await updateBookingsFromConfirmedToActive();
          break;
        case "active-to-completed":
          logger.info(`Starting ${job.name} status update job`);
          await updateBookingsFromActiveToCompleted();
          break;
        default:
          logger.warn(`Unknown job name: ${job.name}`);
      }
    },
    { connection: bullMQOptions.connection },
  );

  statusUpdateWorker.on("error", (err) => {
    logger.error("Worker encountered an error:", err);
  });

  statusUpdateWorker.on("completed", (job) => {
    logger.info(`Job ${job.name} completed successfully`);
  });

  statusUpdateWorker.on("failed", (job, err) => {
    logger.error(`Job ${job?.name} failed:`, err);
  });

  isWorkerInitialized = true;
  logger.info("Status Update Worker started!");
};
