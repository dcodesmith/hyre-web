import { execFile } from "node:child_process";
import { glob, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
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

const outputDirectory = await mkdtemp(path.join(tmpdir(), "hyre-web-worker-"));

try {
  const wranglerPath = path.resolve(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "wrangler.cmd" : "wrangler",
  );
  const { stderr, stdout } = await execFileAsync(
    wranglerPath,
    ["deploy", "--dry-run", "--outdir", outputDirectory],
    {
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  process.stdout.write(stdout);
  process.stderr.write(stderr);

  const files = [];
  const findings = [];

  for await (const entry of glob("**/*", { cwd: outputDirectory, withFileTypes: true })) {
    if (entry.isFile() && [".cjs", ".js", ".mjs"].includes(path.extname(entry.name))) {
      files.push(path.join(entry.parentPath, entry.name));
    }
  }

  if (files.length === 0) {
    throw new Error("Wrangler dry run produced no JavaScript Worker bundle files");
  }

  for (const file of files) {
    const contents = await readFile(file, "utf8");

    for (const marker of forbiddenRuntimeMarkers) {
      if (contents.includes(marker)) {
        findings.push(`${path.relative(outputDirectory, file)} contains ${marker}`);
      }
    }
  }

  if (findings.length > 0) {
    throw new Error(`Forbidden backend runtime markers found:\n${findings.join("\n")}`);
  }

  console.log(`Worker bundle check passed (${files.length} files scanned)`);
} finally {
  await rm(outputDirectory, { force: true, recursive: true });
}
