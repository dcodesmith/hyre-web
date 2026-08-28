import { expect, test } from "@playwright/test";

import {
  MOCK_FLEET_CAR_ID,
  startMockFleetOwnerAuthApi,
  stopMockFleetOwnerAuthApi,
} from "./mock-fleet-owner-auth-api";

test("creates and deactivates a fleet-owner promotion", async ({ context, page }) => {
  const api = await startMockFleetOwnerAuthApi();

  try {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-session",
        url: "http://localhost:5174",
      },
    ]);

    await page.goto("/fleet-owner/promotions");
    await expect(page.getByRole("heading", { name: "Promotions", level: 2 })).toBeVisible();
    await expect(page.getByText("No promotions yet")).toBeVisible();

    await page.getByRole("link", { name: "New promotion" }).click();
    await expect(page).toHaveURL("/fleet-owner/promotions?create=1");

    await page.getByLabel("Promotion name (optional)").fill("October special");
    await page.getByLabel("Apply to").click();
    await page.getByRole("option", { name: /Lexus RX 350 2023/ }).click();
    await page.getByLabel("Discount (%)").fill("60");
    await page.getByLabel("Start date").fill("2027-10-01");
    await page.getByLabel("End date (inclusive)").fill("2027-09-30");
    await page.getByRole("button", { name: "Create promotion" }).click();

    await expect(page).toHaveURL("/fleet-owner/promotions?create=1");
    await expect(page.getByText("Discount cannot exceed 50%")).toBeVisible();
    await expect(page.getByText("End date must be on or after start date")).toBeVisible();

    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("link", { name: "New promotion" }).click();
    await expect(page.getByText("Discount cannot exceed 50%")).toHaveCount(0);

    await page.getByLabel("Promotion name (optional)").fill("October special");
    await page.getByLabel("Apply to").click();
    await page.getByRole("option", { name: /Lexus RX 350 2023/ }).click();
    await page.getByLabel("Discount (%)").fill("15");
    await page.getByLabel("Start date").fill("2027-10-01");
    await page.getByLabel("End date (inclusive)").fill("2027-10-03");
    await page.getByRole("button", { name: "Create promotion" }).click();

    await expect(page).toHaveURL("/fleet-owner/promotions");
    await expect(page.getByText("October special")).toBeVisible();
    await expect(page.getByText("15% off")).toBeVisible();
    await expect(page.getByText("Upcoming")).toBeVisible();
    await expect(page.getByText(/Lexus RX 350 \(ABC123XY\)/)).toBeVisible();
    await expect
      .poll(() => api.requests.createPromotions.at(-1))
      .toEqual({
        name: "October special",
        scope: "CAR",
        carId: MOCK_FLEET_CAR_ID,
        discountValue: 15,
        startDate: "2027-10-01",
        endDate: "2027-10-03",
      });

    await page.getByRole("button", { name: "Deactivate October special" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Deactivate", exact: true })
      .click();

    await expect(page.getByText("Inactive")).toBeVisible();
    await expect.poll(() => api.requests.deactivatedPromotionIds.at(-1)).toMatch(/^cm\d+$/);

    await page.getByRole("link", { name: "New promotion" }).click();
    await page.getByLabel("Promotion name (optional)").fill("Fleet deal");
    await page.getByLabel("Discount (%)").fill("10");
    await page.getByLabel("Start date").fill("2028-11-01");
    await page.getByLabel("End date (inclusive)").fill("2028-11-02");
    await page.getByRole("button", { name: "Create promotion" }).click();

    await expect(page.getByText("Fleet deal")).toBeVisible();
    await expect(
      page
        .locator('[data-slot="card"]')
        .filter({ hasText: "Fleet deal" })
        .getByText("All cars", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => api.requests.createPromotions.at(-1))
      .toEqual({
        name: "Fleet deal",
        scope: "FLEET",
        discountValue: 10,
        startDate: "2028-11-01",
        endDate: "2028-11-02",
      });
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
