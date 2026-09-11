import { expect, type Page, test } from "@playwright/test";

import {
  MOCK_CHAUFFEUR_INVITE_TOKEN,
  MOCK_CHAUFFEUR_SESSION_TOKEN,
  startMockChauffeurOnboardingApi,
  stopMockChauffeurOnboardingApi,
} from "./mock-chauffeur-onboarding-api";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

test("shows an unavailable invitation without a session", async ({ page }) => {
  const api = await startMockChauffeurOnboardingApi();

  try {
    await setCookiePreference(page);
    await page.goto("/chauffeur/onboarding");

    await expect(
      page.getByRole("heading", { name: "This invitation is unavailable" }),
    ).toBeVisible();
    expect(api.requests.invitationTokens).toEqual([]);
    expect(api.requests.authorization).toEqual([]);
  } finally {
    await stopMockChauffeurOnboardingApi(api);
  }
});

test("removes an invalid invite token from the browser URL", async ({ page }) => {
  const api = await startMockChauffeurOnboardingApi();

  try {
    await setCookiePreference(page);
    await page.goto(`/chauffeur/onboarding?token=${"x".repeat(32)}`);

    await expect(page).toHaveURL("/chauffeur/onboarding");
    await expect(
      page.getByRole("heading", { name: "This invitation is unavailable" }),
    ).toBeVisible();
    expect(api.requests.invitationTokens).toEqual(["x".repeat(32)]);
  } finally {
    await stopMockChauffeurOnboardingApi(api);
  }
});

test("completes staged chauffeur verification through consent, phone, identity, and driving", async ({
  context,
  page,
}) => {
  const api = await startMockChauffeurOnboardingApi();

  try {
    await setCookiePreference(page);
    await page.goto(`/chauffeur/onboarding?token=${MOCK_CHAUFFEUR_INVITE_TOKEN}`);

    await expect(page).toHaveURL("/chauffeur/onboarding");
    await expect(page.getByRole("heading", { name: "Welcome, Bola Adebayo" })).toBeVisible();
    await expect(page.getByText("Invited by Ada Lovelace")).toBeVisible();
    await expect(page.getByText("Before you begin", { exact: true })).toBeVisible();
    const guestCookie = (await context.cookies()).find(
      (cookie) => cookie.name === "chauffeur_onboarding",
    );
    expect(guestCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(guestCookie?.value).not.toContain(MOCK_CHAUFFEUR_SESSION_TOKEN);
    expect(api.requests.invitationTokens).toEqual([MOCK_CHAUFFEUR_INVITE_TOKEN]);

    await page.getByRole("checkbox", { name: /Terms of Service/ }).check();
    await page.getByRole("checkbox", { name: /Privacy Policy/ }).check();
    await page.getByRole("button", { name: "Agree and continue" }).click();
    await expect(page.getByText("Verify your phone", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Send verification code" }).click();
    await expect(page.getByText("Code sent to +2348012345678")).toBeVisible();
    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Verify phone" }).click();
    await expect(page.getByText("Verify your identity", { exact: true })).toBeVisible();

    await page.getByLabel("National Identification Number (NIN)").fill("12345678901");
    await page.getByRole("button", { name: "Verify NIN" }).click();
    await expect(page.getByText("Verify your driving credentials", { exact: true })).toBeVisible();

    await page.getByLabel("Driver's licence number").fill("ABC-12345");
    const selfieInput = page.getByLabel("Passport photograph or selfie");
    await selfieInput.setInputFiles({
      name: "selfie.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("selfie"),
    });
    await expect(page.getByRole("img", { name: "Selected selfie preview" })).toBeVisible();
    await expect
      .poll(() => selfieInput.evaluate((input: HTMLInputElement) => input.files?.length ?? 0))
      .toBe(1);
    await page.getByRole("button", { name: "Complete verification" }).click();
    await expect(page.getByRole("heading", { name: "Verification complete" })).toBeVisible();
    await expect(page.getByText("You are approved to drive for Ada Lovelace")).toBeVisible();
    expect(api.requests.drivingIdempotencyKeys).toHaveLength(1);
    expect(api.requests.drivingIdempotencyKeys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(
      api.requests.authorization.every(
        (value) => value === `Bearer ${MOCK_CHAUFFEUR_SESSION_TOKEN}`,
      ),
    ).toBe(true);
    expect(api.requests.ninIdempotencyKeys[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  } finally {
    await stopMockChauffeurOnboardingApi(api);
  }
});
