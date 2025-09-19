import PQueue from "p-queue";
import logger from "~/lib/logger.server";

export const emailQueue = new PQueue({
  intervalCap: 2, // Max 2 emails
  interval: 1000, // per 1000ms (1 second)
  concurrency: 1, // Process 1 email at a time
});

emailQueue.on("error", (error) =>
  logger.error("Email queue error:", {
    error: error.message,
    stack: error.stack,
    queueSize: emailQueue.size,
    pending: emailQueue.pending,
  }),
);

emailQueue.on("add", () =>
  logger.debug(
    `Email job added to queue. Queue size: ${emailQueue.size}, pending: ${emailQueue.pending}`,
  ),
);

emailQueue.on("next", () =>
  logger.debug(
    `Email job completed. Remaining: ${emailQueue.size}, pending: ${emailQueue.pending}`,
  ),
);
