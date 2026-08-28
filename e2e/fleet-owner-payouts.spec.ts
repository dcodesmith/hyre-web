import { expect, test } from "@playwright/test";

import { startMockFleetOwnerAuthApi, stopMockFleetOwnerAuthApi } from "./mock-fleet-owner-auth-api";

test("lists and filters fleet-owner payouts", async ({ context, page }) => {
  const api = await startMockFleetOwnerAuthApi();

  try {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "e2e-session",
        url: "http://localhost:5174",
      },
    ]);

    await page.goto("/fleet-owner/payout-transactions");

    await expect(
      page.getByRole("heading", { name: "Payout transactions", level: 2 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "All-time summary", level: 3 })).toBeVisible();
    await expect(page.getByText("₦1,020,000")).toBeVisible();
    await expect(page.getByText("Page 1 of 2 · 21 transactions")).toBeVisible();
    await expect(
      page.getByText("payout-01", { exact: true }).filter({ visible: true }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL("/fleet-owner/payout-transactions?page=2");
    await expect(
      page.getByText("payout-21", { exact: true }).filter({ visible: true }),
    ).toBeVisible();

    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Paid Out" }).click();
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL("/fleet-owner/payout-transactions?status=PAID_OUT");
    await expect(page.getByText("Page 1 of 1 · 20 transactions")).toBeVisible();
    await expect
      .poll(() => api.requests.payoutQueries.at(-1))
      .toEqual({ page: "1", limit: "20", status: "PAID_OUT" });

    await page.goto("/fleet-owner/payout-transactions?status=PAID_OUT&page=99");
    await expect(page).toHaveURL("/fleet-owner/payout-transactions?status=PAID_OUT");

    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "All statuses" }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL("/fleet-owner/payout-transactions");
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
