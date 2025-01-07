import { Queue, Worker } from "bullmq";
import logger from "~/lib/logger.server";
import {
  sendBookingEndReminderEmails,
  sendBookingStartReminderEmails,
} from "~/services/bookings.server";
import { bullMQOptions } from "./config.server";

export const bookingReminderQueue = new Queue("booking-reminder", bullMQOptions);

// Add repeatable jobs
async function startBookingReminders() {
  logger.info("Adding booking reminders to queue");

  await bookingReminderQueue.add(
    "booking-start-reminder",
    {},
    {
      repeat: {
        pattern: "0 7-11 * * *", // At 7am, 8am, 9am, 10am, and 11am
      },
    },
  );

  await bookingReminderQueue.add(
    "booking-end-reminder",
    {},
    {
      repeat: {
        pattern: "0 19-23 * * *", // On the hour between 7:00 pm and 11:00pm
      },
    },
  );

  bookingReminderQueue.on("waiting", () => {
    logger.info("BullMQ queue (booking-reminder) is ready and connected to Redis!");
  });

  bookingReminderQueue.on("removed", () => {
    logger.warn("Queue disconnected from Redis");
  });
}

// Worker to process jobs
let isWorkerInitialized = false;

export const startBookingReminderWorker = async () => {
  if (isWorkerInitialized) {
    return;
  }

  await startBookingReminders();

  const bookingReminderWorker = new Worker(
    "booking-reminder",
    async (job) => {
      if (job.name === "booking-start-reminder") {
        logger.info(`Starting ${job.name} job`);
        await sendBookingStartReminderEmails();
      } else if (job.name === "booking-end-reminder") {
        logger.info(`Starting ${job.name} job`);
        await sendBookingEndReminderEmails();
      } else {
        logger.warn(`Unknown job name: ${job.name}`);
      }
    },
    { connection: bullMQOptions.connection },
  );

  bookingReminderWorker.on("error", (err) => {
    logger.error("Worker encountered an error:", err);
  });

  bookingReminderWorker.on("completed", (job) => {
    logger.info(`Job ${job.name} completed successfully`);
  });

  bookingReminderWorker.on("failed", (job, err) => {
    logger.error(`Job ${job?.name} failed:`, err);
  });

  isWorkerInitialized = true;
  logger.info("Booking Reminder Worker started!");
};
