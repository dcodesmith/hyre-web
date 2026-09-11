import { describe, expect, it, vi } from "vitest";

type SessionTestEnv = {
  APP_ENV: string;
  APP_ORIGIN: string;
  WEB_SESSION_SECRET: string;
};

const env = vi.hoisted(
  (): SessionTestEnv => ({
    APP_ENV: "local",
    APP_ORIGIN: "http://localhost:5173",
    WEB_SESSION_SECRET: crypto.randomUUID(),
  }),
);

vi.mock("cloudflare:workers", () => ({ env }));

import {
  chauffeurOnboardingClearCookie,
  chauffeurOnboardingSetCookie,
  createChauffeurOnboardingSession,
  readChauffeurOnboardingSession,
} from "./chauffeur-onboarding-session.server";

const TOKEN = "chauffeur-session-token";
const ONBOARDING_URL = "http://localhost:5173/chauffeur/onboarding";

function cookieHeader(setCookie: string) {
  return setCookie.split(";")[0] ?? "";
}

describe("chauffeur onboarding session", () => {
  it("returns null when the cookie is missing", async () => {
    await expect(readChauffeurOnboardingSession(new Request(ONBOARDING_URL))).resolves.toBeNull();
  });

  it("encrypts and restores the session in an HttpOnly cookie", async () => {
    const session = createChauffeurOnboardingSession({
      token: TOKEN,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    const setCookie = await chauffeurOnboardingSetCookie(session);
    const cookie = cookieHeader(setCookie);

    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).not.toContain("Path=/chauffeur");
    expect(setCookie).not.toContain("Secure");
    expect(setCookie).not.toContain(TOKEN);
    await expect(
      readChauffeurOnboardingSession(new Request(ONBOARDING_URL, { headers: { Cookie: cookie } })),
    ).resolves.toEqual(session);
  });

  it("rejects an expired session and creates a clearing cookie", async () => {
    const now = new Date("2026-09-11T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    try {
      const session = createChauffeurOnboardingSession({
        token: TOKEN,
        expiresAt: new Date(now.getTime() + 1000).toISOString(),
      });
      const cookie = cookieHeader(await chauffeurOnboardingSetCookie(session));
      vi.setSystemTime(new Date(now.getTime() + 2000));

      await expect(
        readChauffeurOnboardingSession(
          new Request(ONBOARDING_URL, { headers: { Cookie: cookie } }),
        ),
      ).resolves.toBeNull();
      expect(chauffeurOnboardingClearCookie()).toContain("Max-Age=0");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a tampered cookie", async () => {
    const session = createChauffeurOnboardingSession({
      token: TOKEN,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    const cookie = cookieHeader(await chauffeurOnboardingSetCookie(session));
    const [name, value = ""] = cookie.split("=");
    const tampered = `${name}=${value.slice(0, -4)}xxxx`;

    await expect(
      readChauffeurOnboardingSession(
        new Request(ONBOARDING_URL, { headers: { Cookie: tampered } }),
      ),
    ).resolves.toBeNull();
  });

  it("adds Secure on HTTPS origins and omits it for local HTTP", async () => {
    const session = createChauffeurOnboardingSession({
      token: TOKEN,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    expect(await chauffeurOnboardingSetCookie(session)).not.toContain("Secure");
    expect(chauffeurOnboardingClearCookie()).not.toContain("Secure");

    env.APP_ORIGIN = "https://tripdly.com";
    try {
      expect(await chauffeurOnboardingSetCookie(session)).toContain("Secure");
      expect(chauffeurOnboardingClearCookie()).toContain("Secure");
    } finally {
      env.APP_ORIGIN = "http://localhost:5173";
    }
  });

  it("requires WEB_SESSION_SECRET", async () => {
    const previous = env.WEB_SESSION_SECRET;
    env.WEB_SESSION_SECRET = "  ";

    try {
      await expect(
        chauffeurOnboardingSetCookie(
          createChauffeurOnboardingSession({
            token: TOKEN,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          }),
        ),
      ).rejects.toThrow("WEB_SESSION_SECRET is required");
    } finally {
      env.WEB_SESSION_SECRET = previous;
    }
  });
});
