import { exec } from "node:child_process";
import { PrismaClient } from "@prisma/client";

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
  // Check if DATABASE_URL is available
  if (!process.env.DATABASE_URL) {
    console.info(
      "⚠️  DATABASE_URL not found. Skipping migrations and seeding.",
      "This is normal during package installation when database is not available.",
    );
    return;
  }

  const prisma = new PrismaClient();

  try {
    // Apply pending migrations (production-safe)
    const migrationOutput = await execPromise("npx --no-install prisma migrate deploy");
    // biome-ignore lint/suspicious/noConsoleLog: operational startup logging; keep console output
    console.log("Migration Output:", migrationOutput);

    // Check for force seed flag
    const forceSeed = process.env.FORCE_SEED === "true";

    // Check if database is empty before seeding
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();

    if (forceSeed) {
      // biome-ignore lint/suspicious/noConsoleLog: operational startup logging; keep console output
      console.log(
        "🔄 FORCE_SEED=true detected. Running seed script (this will wipe existing data)...",
      );
      const seedOutput = await execPromise("npx --no-install prisma db seed");
      console.info("Seed Output:", seedOutput);
    } else if (userCount === 0 && roleCount === 0) {
      console.info("Database is empty, running seed script...");
      const seedOutput = await execPromise("npx --no-install prisma db seed");
      console.info("Seed Output:", seedOutput);
    } else {
      console.info(
        `Database already has data (${userCount} users, ${roleCount} roles). Skipping seed.`,
      );
      console.info("💡 To force seed anyway, set FORCE_SEED=true environment variable");
    }
  } catch (error) {
    console.error(
      `Error running migrations or seed script: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

runMigrationsAndSeed();
