import { spawn } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const e2eDevVarsPath = path.join(repositoryRoot, ".dev.vars.e2e");
const e2eDevVars = "API_ORIGIN=http://127.0.0.1:3100\n";
const playwrightExecutable = path.join(repositoryRoot, "node_modules", ".bin", "playwright");

let previousDevVars;

try {
  previousDevVars = await readFile(e2eDevVarsPath);
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
    throw error;
  }
}

await writeFile(e2eDevVarsPath, e2eDevVars, { mode: 0o600 });

const playwrightArgs = process.argv.slice(2);
if (playwrightArgs[0] === "--") {
  playwrightArgs.shift();
}

const playwright = spawn(playwrightExecutable, ["test", ...playwrightArgs], {
  cwd: repositoryRoot,
  env: { ...process.env, CLOUDFLARE_ENV: "e2e" },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    playwright.kill(signal);
  });
}

const exitCode = await new Promise((resolve, reject) => {
  playwright.once("error", reject);
  playwright.once("close", (code) => resolve(code ?? 1));
}).finally(async () => {
  if (previousDevVars) {
    await writeFile(e2eDevVarsPath, previousDevVars, { mode: 0o600 });
  } else {
    await rm(e2eDevVarsPath, { force: true });
  }
});

process.exitCode = exitCode;
