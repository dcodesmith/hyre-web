import { Queue, Job, JobsOptions } from "bullmq";

type MakeFieldRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export async function addUniqueJob(
  queue: Queue,
  name: string,
  options: MakeFieldRequired<JobsOptions, "jobId">,
) {
  // Check if a job with this ID already exists
  const existingJob = await queue.getJob(options.jobId);

  if (!existingJob) {
    return await queue.add(
      name,
      {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        type: "scheduled-update",
      },
      options,
    );
  }
  return existingJob;
}
