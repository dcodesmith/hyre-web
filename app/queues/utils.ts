import Bull from "bull";

type MakeFieldRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export async function addUniqueJob(
  queue: Bull.Queue,
  name: string,
  options: MakeFieldRequired<Bull.JobOptions, "jobId">,
) {
  // Check if a job with this ID already exists
  const existingJob = await queue.getJob(options.jobId);

  if (!existingJob) {
    // Add the job if it doesn't exist
    console.log(`Job ${name} added to the queue`);
    return await queue.add(
      name,
      {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        type: "scheduled-update",
      },
      options,
    );
  } else {
    console.log(`Job ${name} already exists in the queue`);
    return existingJob;
  }
}
