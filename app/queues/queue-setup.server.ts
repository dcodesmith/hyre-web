// import logger from "~/lib/logger.server";
// import {
//   sendBookingEndReminderEmails,
//   sendBookingStartReminderEmails,
//   updateBookingsFromActiveToCompleted,
//   updateBookingsFromConfirmedToActive,
// } from "~/services/bookings.server";
// import { bookingStatusQueue } from "./config.server";

// // Ensure we only register processors one time.
// // let isBookingReminderQueueInitialized = false;
// let isBookingStatusQueueInitialized = false;

// // export function initializeBookingReminderQueue() {
// //   if (isBookingReminderQueueInitialized) return;
// //   isBookingReminderQueueInitialized = true;

// //   // Define process handlers
// //   bookingReminderQueue.process("booking-start-reminder", async (job) => {
// //     logger.info("Starting booking-start-reminder job");
// //     await sendBookingStartReminderEmails();
// //     logger.info("Completed booking-start-reminder job");
// //   });

// //   bookingReminderQueue.process("booking-end-reminder", async (job) => {
// //     logger.info("Starting booking-end-reminder job");
// //     await sendBookingEndReminderEmails();
// //     logger.info("Completed booking-end-reminder job");
// //   });

// //   // Global error/complete handlers
// //   bookingReminderQueue.on("completed", (job) => {
// //     logger.info(`Job ${job.name} completed successfully`);
// //   });

// //   bookingReminderQueue.on("failed", (job, err) => {
// //     logger.error(`Job ${job.name} failed:`, err);
// //   });
// // }

// export async function initializeBookingStatusQueue() {
//   if (isBookingStatusQueueInitialized) return;
//   isBookingStatusQueueInitialized = true;

//   // Define process handlers
//   bookingStatusQueue.process("confirmed-to-active", async (job) => {
//     logger.info("Starting confirmed-to-active job");
//     await updateBookingsFromConfirmedToActive();
//     logger.info("Completed confirmed-to-active job");
//   });

//   bookingStatusQueue.process("active-to-completed", async (job) => {
//     logger.info("Starting active-to-completed job");
//     await updateBookingsFromActiveToCompleted();
//     logger.info("Completed active-to-completed job");
//   });

//   // Global error handlers
//   bookingStatusQueue.on("completed", (job) => {
//     logger.info(`Job ${job.id} completed successfully`);
//   });

//   bookingStatusQueue.on("failed", (job, err) => {
//     logger.error(`Job ${job.id} failed: ${err}`);
//   });
// }
