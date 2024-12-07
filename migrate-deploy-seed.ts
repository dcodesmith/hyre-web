import { exec } from "node:child_process";

exec("npx prisma migrate deploy", (error, stdout, stderr) => {
  if (error) {
    console.error(`Error running migrations: ${stderr}`);
    process.exit(1);
  }

  if (stdout.includes("No pending migrations to apply")) {
    console.log("No pending migrations. Skipping seed script.");
  } else {
    console.log("Migrations applied. Running seed script...");
    // Run your seed script here
    exec("npx prisma db seed", (seedError, seedStdout, seedStderr) => {
      if (seedError) {
        console.error(`Error running seed script: ${seedStderr}`);
        process.exit(1);
      }
      console.log(seedStdout);
    });
  }
});
