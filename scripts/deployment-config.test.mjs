import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readRepositoryFile = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const githubExpression = (value) => `\${{ ${value} }}`;

describe("deployment configuration", () => {
  it("keeps development and production API origins isolated", () => {
    const wrangler = readRepositoryFile("wrangler.jsonc");

    expect(wrangler).toContain('"development"');
    expect(wrangler).toContain('"API_ORIGIN": "https://hyre-worker-nestjs.fly.dev"');
    expect(wrangler).toContain('"APP_ENV": "development"');
    expect(wrangler).toContain('"API_ORIGIN": "https://hyre-worker-nestjs-production.fly.dev"');
    expect(wrangler).toContain('"APP_ENV": "production"');
  });

  it("deploys main automatically only to development", () => {
    const development = readRepositoryFile(".github/workflows/deploy-development.yml");

    expect(development).toContain("branches: [main]");
    expect(development).toContain("name: development");
    expect(development).toContain("CLOUDFLARE_ENV: development");
    expect(development).toContain(
      "if: github.event_name != 'workflow_dispatch' || github.ref == 'refs/heads/main'",
    );
  });

  it("keeps production promotion manual and approval-gated", () => {
    const production = readRepositoryFile(".github/workflows/deploy-production.yml");

    expect(production).toContain("workflow_dispatch:");
    expect(production).not.toContain("branches: [main]");
    expect(production).toContain("name: production");
    expect(production).toContain("type: string");
    expect(production).toContain("The first stable production release must be v1.0.0.");
    expect(production).toContain("gh release create");
    expect(production).toContain("CLOUDFLARE_ENV: production");
    expect(production).toContain(
      `CLOUDFLARE_API_TOKEN: ${githubExpression("secrets.CLOUDFLARE_PRODUCTION_API_TOKEN")}`,
    );
  });
});
