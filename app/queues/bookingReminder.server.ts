// import logger from "~/lib/logger.server";
// import { bookingReminderQueue } from "./config.server";
// import { initializeBookingReminderQueue } from "./queue-setup.server";
// import { addUniqueJob } from "./utils";

// let isInitialized = false;

// function ensureQueueInitialized() {
//   if (!isInitialized) {
//     initializeBookingReminderQueue();
//     isInitialized = true;
//   }
// }

// export async function scheduleBookingStartReminderEmails() {
//   ensureQueueInitialized();

//   try {
//     // Remove any existing booking-start-reminder repeatable job.
//     const repeatable = await bookingReminderQueue.getRepeatableJobs();

//     for (const job of repeatable) {
//       if (job.name === "booking-start-reminder") {
//         await bookingReminderQueue.removeRepeatableByKey(job.key);
//       }
//     }

//     return addUniqueJob(bookingReminderQueue, "booking-start-reminder", {
//       repeat: {
//         pattern: "0 7-11 * * *", // On the hour between 7:00 am and 11:00am
//       },
//       jobId: "booking-start-reminder",
//       removeOnComplete: true,
//       removeOnFail: true,
//     });
//   } catch (error) {
//     logger.error(`Error scheduling booking start reminder emails: ${error}`);
//     throw error;
//   }
// }

// export async function scheduleBookingEndReminderEmails() {
//   ensureQueueInitialized();

//   try {
//     const repeatable = await bookingReminderQueue.getRepeatableJobs();

//     for (const job of repeatable) {
//       if (job.name === "booking-end-reminder") {
//         await bookingReminderQueue.removeRepeatableByKey(job.key);
//       }
//     }

//     return addUniqueJob(bookingReminderQueue, "booking-end-reminder", {
//       repeat: {
//         pattern: "0 19-23 * * *", // On the hour between 7:00 pm and 11:00pm
//       },
//       jobId: "booking-end-reminder",
//       removeOnComplete: true,
//       removeOnFail: true,
//     });
//   } catch (error) {
//     logger.error(`Error scheduling booking end reminder emails: ${error}`);
//     throw error;
//   }
// }
