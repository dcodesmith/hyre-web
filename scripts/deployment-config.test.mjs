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
    expect(wrangler).toContain('"DEPLOYMENT_COMMIT": "local"');
    expect(wrangler).toContain('"DEPLOYMENT_VERSION": "local"');
  });

  it("identifies preview deployments by pull request and commit", () => {
    const preview = readRepositoryFile(".github/workflows/preview.yml");

    expect(preview).toContain(`DEPLOYMENT_COMMIT: ${githubExpression("github.sha")}`);
    expect(preview).toContain(`deployment_version="pr-\${PR_NUMBER}-\${DEPLOYMENT_COMMIT:0:7}"`);
    expect(preview).toContain(
      `DEPLOYMENT_COMMIT:${githubExpression("steps.preview.outputs.commit")}`,
    );
    expect(preview).toContain(
      `DEPLOYMENT_VERSION:${githubExpression("steps.preview.outputs.version")}`,
    );
    expect(preview).toContain("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7");
    expect(preview).toContain(
      "pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10",
    );
    expect(preview).toContain("actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7");
    expect(preview).toContain("EXPECTED_DEPLOYMENT_COMMIT");
    expect(preview).toContain("EXPECTED_DEPLOYMENT_VERSION");
  });

  it("deploys main automatically only to development", () => {
    const development = readRepositoryFile(".github/workflows/deploy-development.yml");

    expect(development).toContain("branches: [main]");
    expect(development).toContain("name: development");
    expect(development).toContain("CLOUDFLARE_ENV: development");
    expect(development).toContain(`version=dev-\${DEPLOYMENT_COMMIT:0:7}`);
    expect(development).toContain("EXPECTED_DEPLOYMENT_COMMIT");
    expect(development).toContain("EXPECTED_DEPLOYMENT_VERSION");
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
    expect(production).toContain("gh api --paginate --method GET");
    expect(production).toContain("sort -V");
    expect(production).toContain("CLOUDFLARE_ENV: production");
    expect(production).toContain(
      `DEPLOYMENT_COMMIT: ${githubExpression("needs.verify.outputs.deploy_sha")}`,
    );
    expect(production).toContain(
      `DEPLOYMENT_VERSION: ${githubExpression("needs.verify.outputs.release_version")}`,
    );
    expect(production).toContain("EXPECTED_DEPLOYMENT_COMMIT");
    expect(production).toContain("EXPECTED_DEPLOYMENT_VERSION");
    expect(production).toContain(
      `CLOUDFLARE_ACCOUNT_ID: ${githubExpression("secrets.CLOUDFLARE_ACCOUNT_ID")}`,
    );
    expect(production).not.toContain("CLOUDFLARE_PRODUCTION_ACCOUNT_ID");
    expect(production).toContain(
      `CLOUDFLARE_API_TOKEN: ${githubExpression("secrets.CLOUDFLARE_PRODUCTION_API_TOKEN")}`,
    );
    expect(production).toContain(
      `PRODUCTION_WORKER_ORIGIN: ${githubExpression("vars.PRODUCTION_WORKER_ORIGIN")}`,
    );
  });

  it("runs the dependency audit without consuming a duplicate Snyk test", () => {
    const security = readRepositoryFile(".github/workflows/snyk.yml");

    expect(security).toContain("run: pnpm audit --audit-level high");
    expect(security).not.toContain("snyk/actions");
  });
});
