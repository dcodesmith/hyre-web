import { expect, type Page, test } from "@playwright/test";

import {
  MOCK_FLEET_CAR_ID,
  startMockFleetOwnerAuthApi,
  stopMockFleetOwnerAuthApi,
} from "./mock-fleet-owner-auth-api";

async function setCookiePreference(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "tripdly-cookie-consent:v1",
      JSON.stringify({ analytics: false, timestamp: 1 }),
    );
  });
}

async function filterCarsToLexus(page: Page) {
  if ((page.viewportSize()?.width ?? 0) >= 640) {
    await page.getByRole("button", { name: /^Make/ }).first().click();
    await page.getByRole("checkbox", { name: /^Lexus/ }).click();
    await expect(page).toHaveURL(/filter\.make=Lexus/);
    await page.keyboard.press("Escape");
  } else {
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("checkbox", { name: /^Lexus/ }).click();
    await expect(page).toHaveURL(/filter\.make=Lexus/);
    await page.getByRole("button", { name: "Done" }).click();
  }
}

test("sends fleet-owner guests to their login route", async ({ page }) => {
  await page.goto("/fleet-owner");

  await expect(page).toHaveURL("/fleet-owner/login");
});

test("completes fleet-owner OTP login, session loading, and logout", async ({ context, page }) => {
  const api = await startMockFleetOwnerAuthApi();

  try {
    await setCookiePreference(page);
    await page.goto("/fleet-owner/login");

    await expect(page.getByRole("heading", { name: "Fleet Owner Login" })).toBeAttached();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Terms of Service/ })).toBeVisible();
    await expect(page.getByLabel("Referral code (optional)")).toHaveCount(0);

    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByRole("checkbox", { name: /Terms of Service/ }).check();
    await page.getByRole("button", { name: "Send verification code" }).click();

    await expect(page).toHaveURL("/fleet-owner/verify");
    await expect(page.getByRole("heading", { name: "Verify Fleet Owner Email" })).toBeAttached();
    await expect
      .poll(() => api.requests.sendOtp)
      .toEqual({
        body: {
          email: "owner@example.com",
          type: "sign-in",
          role: "fleetOwner",
        },
        origin: "http://localhost:5173",
        referer: "http://localhost:5173/fleet-owner/login",
      });

    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Verify email" }).click();

    await expect(page).toHaveURL("/fleet-owner");
    await expect(page.getByRole("heading", { name: "Welcome, Fleet Owner" })).toBeVisible();
    await expect
      .poll(() => api.requests.verifyOtp?.body)
      .toEqual({
        email: "owner@example.com",
        otp: "123456",
        role: "fleetOwner",
      });

    await page.goto("/fleet-owner/cars");
    await expect(page.getByRole("heading", { name: "Your fleet" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Lexus", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "RX 350", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: /ABC123XY/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Toggle columns" })).toBeVisible();

    await page.goto("/fleet-owner/cars?page=2");
    await expect(page.getByText("No cars on this page.")).toBeVisible();
    await page.getByRole("button", { name: "Go to first page" }).click();
    await expect(page).toHaveURL("/fleet-owner/cars");

    await filterCarsToLexus(page);
    await expect(page.getByRole("cell", { name: "Lexus", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Toyota", exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "View details for Lexus RX 350" }).click();
    await expect(page).toHaveURL(`/fleet-owner/cars/${MOCK_FLEET_CAR_ID}`);
    await expect(page.getByRole("heading", { name: "Lexus RX 350" })).toBeVisible();
    await expect(page.getByText("Available", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vehicle details" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    const logoutButton = page.getByRole("button", { name: "Log out" });
    if (!(await logoutButton.isVisible())) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    }
    await logoutButton.click();

    await expect(page).toHaveURL("/fleet-owner/login");
    await expect
      .poll(() => api.requests.signOut)
      .toEqual({
        body: {},
        origin: "http://localhost:5173",
        referer: "http://localhost:5173/fleet-owner/login",
      });
    await expect
      .poll(async () => {
        const cookies = await context.cookies();
        return cookies.some((cookie) => cookie.name === "better-auth.session_token");
      })
      .toBe(false);
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
