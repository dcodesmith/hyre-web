import { glob, readFile } from "node:fs/promises";
import path from "node:path";

const buildDirectory = path.resolve("build");
const forbiddenRuntimeMarkers = [
  "@aws-sdk/client-s3",
  "@prisma/client",
  "AWS_SECRET_ACCESS_KEY",
  "BEGIN PRIVATE KEY",
  "BEGIN RSA PRIVATE KEY",
  "DATABASE_URL",
  "NEON_",
  "REDIS_URL",
  "ioredis",
  "nodemailer",
  "pdfkit",
  "sk_live_",
  "twilio",
];

const files = [];
const findings = [];

for await (const entry of glob("**/*", { cwd: buildDirectory, withFileTypes: true })) {
  if (entry.isFile()) {
    files.push(path.join(entry.parentPath, entry.name));
  }
}

for (const file of files) {
  if (file.endsWith(".map")) {
    continue;
  }

  const contents = await readFile(file, "utf8");

  for (const marker of forbiddenRuntimeMarkers) {
    if (contents.includes(marker)) {
      findings.push(`${path.relative(process.cwd(), file)} contains ${marker}`);
    }
  }
}

if (findings.length > 0) {
  throw new Error(`Forbidden backend runtime markers found:\n${findings.join("\n")}`);
}

console.log(`Worker bundle check passed (${files.length} files scanned)`);
