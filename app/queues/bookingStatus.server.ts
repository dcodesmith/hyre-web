// import logger from "~/lib/logger.server";
// import { bookingStatusQueue } from "./config.server";
// import { initializeBookingStatusQueue } from "./queue-setup.server";
// import { addUniqueJob } from "./utils";

// let isInitialized = false;

// function ensureQueueInitialized() {
//   if (!isInitialized) {
//     initializeBookingStatusQueue();
//     isInitialized = true;
//   }
// }

// export async function scheduleConfirmedToActiveUpdates() {
//   ensureQueueInitialized();

//   try {
//     // Remove existing repeat jobs to prevent duplicates
//     const repeatable = await bookingStatusQueue.getRepeatableJobs();

//     for (const job of repeatable) {
//       if (job.name === "confirmed-to-active") {
//         await bookingStatusQueue.removeRepeatableByKey(job.key);
//       }
//     }

//     await bookingStatusQueue.add(
//       "confirmed-to-active",
//       { userId: 123 },
//       {
//         repeat: {
//           pattern: "*/55 7-11 * * *", // Every 55 minute between 7:00 am and 11:59 am
//         },
//       },
//     );

//     // return addUniqueJob(bookingStatusQueue, "confirmed-to-active", {
//     //   repeat: {
//     //     cron: "*/55 7-11 * * *", // Every 55 minute between 7:00 am and 11:59 am
//     //   },
//     //   jobId: "confirmed-to-active",
//     //   removeOnComplete: true,
//     //   removeOnFail: true,
//     // });
//   } catch (error) {
//     logger.error(`Error scheduling booking status updates from confirmed to active: ${error}`);
//     throw error;
//   }
// }

// export async function scheduleActiveToCompletedUpdates() {
//   ensureQueueInitialized();

//   try {
//     // Remove existing repeat jobs to prevent duplicates
//     const repeatable = await bookingStatusQueue.getRepeatableJobs();

//     for (const job of repeatable) {
//       if (job.name === "active-to-completed") {
//         await bookingStatusQueue.removeRepeatableByKey(job.key);
//       }
//     }

//     return addUniqueJob(bookingStatusQueue, "active-to-completed", {
//       repeat: {
//         cron: "*/55 20-23 * * *", // Every 55 minute between 8:00 pm and 11:59 pm
//       },
//       jobId: "active-to-completed",
//       removeOnComplete: true,
//       removeOnFail: true,
//     });
//   } catch (error) {
//     logger.error(`Error scheduling booking status updates from active to completed: ${error}`);
//     throw error;
//   }
// }
