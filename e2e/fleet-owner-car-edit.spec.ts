import { expect, test } from "@playwright/test";

import {
  MOCK_FLEET_CAR_ID,
  startMockFleetOwnerAuthApi,
  stopMockFleetOwnerAuthApi,
} from "./mock-fleet-owner-auth-api";

test("updates a fleet car across responsive viewports", async ({ context, page }) => {
  const api = await startMockFleetOwnerAuthApi();

  try {
    await page.addInitScript(() => {
      localStorage.setItem(
        "tripdly-cookie-consent:v1",
        JSON.stringify({ analytics: false, timestamp: 1 }),
      );
    });
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-session",
        url: "http://localhost:5174",
      },
    ]);

    await page.goto(`/fleet-owner/cars/${MOCK_FLEET_CAR_ID}/edit`);
    await expect(page.getByRole("heading", { name: "Edit Lexus RX 350" })).toBeVisible();
    await expect(page.getByLabel("Daily rate (12 hours)")).toHaveValue("80000");
    await expect(page.getByLabel("Pricing includes fuel")).not.toBeChecked();

    await page.getByLabel("Fuel upgrade rate").fill("");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText("Fuel upgrade rate is required when pricing does not include fuel"),
    ).toBeVisible();
    await expect(page.getByLabel("Pricing includes fuel")).not.toBeChecked();

    await page.getByLabel("Pricing includes fuel").check();
    await expect(page.getByLabel("Fuel upgrade rate")).toHaveCount(0);
    await page.getByLabel("Daily rate (12 hours)").fill("90000");
    await page.getByRole("combobox", { name: "Current status" }).click();
    await page.getByRole("option", { name: "Hold", exact: true }).click();
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page).toHaveURL(`/fleet-owner/cars/${MOCK_FLEET_CAR_ID}`);
    await expect(page.getByRole("heading", { name: "Vehicle details" })).toBeVisible();
    await expect(page.getByText("Hold", { exact: true })).toBeVisible();
    await expect(page.getByText("₦90,000")).toBeVisible();
    await expect(page.getByText("Yes", { exact: true })).toBeVisible();
    await expect
      .poll(() => api.requests.updateCars.at(-1))
      .toEqual({
        carId: MOCK_FLEET_CAR_ID,
        body: {
          dayRate: 90_000,
          hourlyRate: 10_000,
          nightRate: 60_000,
          fullDayRate: 150_000,
          airportPickupRate: 50_000,
          fuelUpgradeRate: null,
          pricingIncludesFuel: true,
          status: "HOLD",
        },
      });
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
