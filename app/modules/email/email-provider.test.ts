import { describe, expect, it } from "vitest";
import { resolveEmailProvider } from "./email-provider";

describe("resolveEmailProvider", () => {
  it("returns resend on Vercel regardless of EMAIL_PROVIDER", () => {
    const provider = resolveEmailProvider({
      VERCEL: "1",
      EMAIL_PROVIDER: "smtp",
      NODE_ENV: "development",
    });

    expect(provider).toBe("resend");
  });

  it("uses EMAIL_PROVIDER when not on Vercel", () => {
    const provider = resolveEmailProvider({
      VERCEL: "0",
      EMAIL_PROVIDER: "console",
      NODE_ENV: "production",
    });

    expect(provider).toBe("console");
  });

  it("defaults to resend in production when EMAIL_PROVIDER is not set", () => {
    const provider = resolveEmailProvider({
      NODE_ENV: "production",
    });

    expect(provider).toBe("resend");
  });

  it("defaults to smtp outside production when EMAIL_PROVIDER is not set", () => {
    const provider = resolveEmailProvider({
      NODE_ENV: "test",
    });

    expect(provider).toBe("smtp");
  });
});
