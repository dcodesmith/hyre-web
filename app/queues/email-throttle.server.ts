import PQueue from "p-queue";

export const emailQueue = new PQueue({
  intervalCap: 2, // Max 2 emails
  interval: 1000, // per 1000ms (1 second)
  concurrency: 1, // Process 1 email at a time
});
