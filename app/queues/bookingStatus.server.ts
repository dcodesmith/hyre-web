import {
  updateBookingsFromActiveToCompleted,
  updateBookingsFromConfirmedToActive,
} from "~/services/bookings.server";
import { bookingStatusQueue } from "./config.server";
import { addUniqueJob } from "./utils";

export async function scheduleConfirmedToActiveUpdates() {
  try {
    // Remove existing repeat jobs to prevent duplicates
    const repeatable = await bookingStatusQueue.getRepeatableJobs();

    for (const job of repeatable) {
      await bookingStatusQueue.removeRepeatableByKey(job.key);
    }

    const job = await addUniqueJob(bookingStatusQueue, "confirmed-to-active", {
      repeat: {
        cron: "*/55 7-11 * * *", // Every 55 minute between 7:00 am and 11:59 am
      },
      jobId: "confirmed-to-active",
      removeOnComplete: true,
      removeOnFail: true,
    });

    // Add new repeat job
    // const job = await bookingStatusQueue.add(
    //   "confirmed-to-active",
    //   {
    //     timestamp: new Date().toISOString(),
    //     type: "scheduled-update",
    //   },
    //   {
    //     repeat: {
    //       cron: "*/59 7-11 * * *", // Every 59 minute between 7:00 am and 11:59 am
    //     },
    //     jobId: "confirmed-to-active",
    //     removeOnComplete: true,
    //     removeOnFail: true,
    //   }
    // );

    await bookingStatusQueue.process("confirmed-to-active", async (job) => {
      await updateBookingsFromConfirmedToActive();
    });

    bookingStatusQueue.on("completed", (job) => {});

    bookingStatusQueue.on("failed", (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    return job;
  } catch (error) {
    console.error("Error scheduling booking status updates:", error);
    throw error;
  }
}

export async function scheduleActiveToCompletedUpdates() {
  try {
    // Remove existing repeat jobs to prevent duplicates
    const repeatable = await bookingStatusQueue.getRepeatableJobs();

    for (const job of repeatable) {
      await bookingStatusQueue.removeRepeatableByKey(job.key);
    }

    const job = await addUniqueJob(bookingStatusQueue, "active-to-completed", {
      repeat: {
        cron: "*/55 20-23 * * *", // Every 55 minute between 8:00 pm and 11:59 pm
      },
      jobId: "active-to-completed",
      removeOnComplete: true,
      removeOnFail: true,
    });

    // Add new repeat job
    // const job = await bookingStatusQueue.add(
    //   "active-to-completed",
    //   {
    //     timestamp: new Date().toISOString(),
    //     type: "scheduled-update",
    //     },
    //     {
    //       repeat: {
    //         cron: "*/59 20-23 * * *", // Every 59 minute between 8:00 pm and 11:59 pm
    //       },
    //       jobId: "active-to-completed",
    //       removeOnComplete: true,
    //       removeOnFail: true,
    //   }
    // );

    await bookingStatusQueue.process("active-to-completed", async (job) => {
      await updateBookingsFromActiveToCompleted();
    });

    bookingStatusQueue.on("completed", (job) => {});

    bookingStatusQueue.on("failed", (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    return job;
  } catch (error) {
    console.error("Error scheduling booking status updates:", error);
    throw error;
  }
}

// Export the queue for testing/monitoring
export { bookingStatusQueue };
