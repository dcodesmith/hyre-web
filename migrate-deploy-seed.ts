import { exec } from "node:child_process";

// Function to execute a command and return a promise
const execPromise = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error running command: ${stderr}`);
        console.error(`Error running command: ${error.message}`);
        console.error(`Error running command: ${stdout}`);

        reject(new Error(stderr));
      } else {
        resolve(stdout);
      }
    });
  });
};

const runMigrationsAndSeed = async () => {
  try {
    // const forceResetOutput = await execPromise("npx prisma migrate reset --force");
    // console.log("Force Reset Output:", forceResetOutput);

    // Generate and apply migrations if schema changes are detected
    const migrationOutput = await execPromise("npx prisma migrate dev");
    console.log("Migration Output:", migrationOutput);

    // if (migrationOutput.includes("No pending migrations to apply")) {
    //   console.log("No migrations were needed");
    // } else {
    // Run the seed script after applying migrations
    // const seedOutput = await execPromise("npx prisma db seed");
    // console.log("Seed Output:", seedOutput);
    // }
  } catch (error: any) {
    console.error(`Error running migrations or seed script: ${error.message}`);
    process.exit(1);
  }
};

runMigrationsAndSeed();
