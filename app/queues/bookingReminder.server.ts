import {
  sendBookingStartReminderEmails,
  sendBookingEndReminderEmails,
} from "~/services/bookings.server";
import { bookingReminderQueue } from "./config.server";
import { addUniqueJob } from "./utils";

export async function scheduleBookingStartReminderEmails() {
  console.log("Scheduling booking start reminder emails...");

  try {
    // Remove existing repeat jobs to prevent duplicates
    const repeatable = await bookingReminderQueue.getRepeatableJobs();

    for (const job of repeatable) {
      await bookingReminderQueue.removeRepeatableByKey(job.key);
    }

    const job = await addUniqueJob(
      bookingReminderQueue,
      "booking-start-reminder",
      {
        repeat: {
          cron: "0 7-11 * * *", // On the  between 7:00 am and 11:00am
        },
        jobId: "booking-start-reminder",
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await bookingReminderQueue.process(
      "booking-start-reminder",
      async (job) => {
        console.log("Processing job:", job.id);
        await sendBookingStartReminderEmails();
      }
    );

    console.log("Scheduled job:", job.name);

    bookingReminderQueue.on("completed", (job) => {
      console.log(`Job ${job.id} completed:`);
    });

    bookingReminderQueue.on("failed", (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    return job;
  } catch (error) {
    console.error("Error scheduling booking reminder emails:", error);
    throw error;
  }
}

export async function scheduleBookingEndReminderEmails() {
  console.log("Scheduling booking end reminder emails...");

  try {
    // Remove existing repeat jobs to prevent duplicates
    const repeatable = await bookingReminderQueue.getRepeatableJobs();

    for (const job of repeatable) {
      await bookingReminderQueue.removeRepeatableByKey(job.key);
    }

    const job = await addUniqueJob(
      bookingReminderQueue,
      "booking-end-reminder",
      {
        repeat: {
          cron: "0 19-23 * * *", // On the  between 7:00 pm and 11:00pm
        },
        jobId: "booking-end-reminder",
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    await bookingReminderQueue.process("booking-end-reminder", async (job) => {
      console.log("Processing job:", job.id);
      await sendBookingEndReminderEmails();
    });

    console.log("Scheduled job:", job.name);

    bookingReminderQueue.on("completed", (job) => {
      console.log(`Job ${job.id} completed:`);
    });

    bookingReminderQueue.on("failed", (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
    });

    return job;
  } catch (error) {
    console.error("Error scheduling booking end reminder emails:", error);
    throw error;
  }
}

// Export the queue for testing/monitoring
export { bookingReminderQueue };
