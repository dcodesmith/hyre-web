import { exec } from "node:child_process";

exec("npx prisma migrate deploy", (error, stdout, stderr) => {
  if (error) {
    console.error(`Error running migrations: ${stderr}`);
    process.exit(1);
  }

  // Log all migration output
  console.log("Migration Output:", stdout);

  if (stdout.includes("No pending migrations to apply")) {
    console.log("No migrations were needed");
  } else {
    // Run your seed script here
    exec("npx prisma db seed", (seedError, seedStdout, seedStderr) => {
      if (seedError) {
        console.error(`Error running seed script: ${seedStderr}`);
        process.exit(1);
      }
      // Log seed output
      console.log("Seed Output:", seedStdout);
    });
  }
});
