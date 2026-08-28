import { expect, test } from "@playwright/test";

import { startMockFleetOwnerAuthApi, stopMockFleetOwnerAuthApi } from "./mock-fleet-owner-auth-api";

test("shows and filters the fleet-owner dashboard across viewports", async ({ context, page }) => {
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

    await page.goto("/fleet-owner");

    await expect(
      page.getByRole("heading", { name: "Welcome back, Fleet Owner", level: 2 }),
    ).toBeVisible();
    await expect(page.getByText("Fleet vehicles", { exact: true })).toBeVisible();
    await expect(page.getByText("1 available", { exact: true })).toBeVisible();
    await expect(page.getByText("1 in maintenance", { exact: true })).toBeVisible();
    await expect(page.getByText("0 booked", { exact: true })).toBeVisible();
    await expect(page.getByText("₦920,000")).toBeVisible();
    await expect(page.getByText("₦540,000")).toBeVisible();
    await expect(page.getByText("₦41,000")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payout overview", level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quick actions", level: 3 })).toBeVisible();
    await expect(page.getByText("4 active", { exact: true })).toBeVisible();
    await expect(page.getByText("7 owner-driven", { exact: true })).toBeVisible();
    await expect(page.getByText("Week of 24 Aug")).toBeVisible();
    await expect
      .poll(() => api.requests.earningsQueries.at(-1))
      .toEqual({ range: "30d", groupBy: "week" });
    await expect(page.getByRole("button", { name: "Apply" })).toBeDisabled();

    await page.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "Last 7 days" }).click();
    await expect(page.getByRole("button", { name: "Apply" })).toBeEnabled();
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL("/fleet-owner?range=7d");
    await expect(page.getByText("24 Aug", { exact: true })).toBeVisible();
    await expect
      .poll(() => api.requests.earningsQueries.at(-1))
      .toEqual({ range: "7d", groupBy: "day" });

    await page.getByRole("combobox", { name: "Period" }).click();
    await page.getByRole("option", { name: "Last 90 days" }).click();
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL("/fleet-owner?range=90d");
    await expect(page.getByText("August 2026")).toBeVisible();
    await expect
      .poll(() => api.requests.earningsQueries.at(-1))
      .toEqual({ range: "90d", groupBy: "month" });
    expect({
      dashboard: api.requests.dashboardOverviewRequests,
      fleetCars: api.requests.fleetCarsRequests,
      payoutSummary: api.requests.payoutSummaryRequests,
    }).toEqual({ dashboard: 1, fleetCars: 1, payoutSummary: 1 });

    await page.goto("/fleet-owner?range=30d");
    await expect(page).toHaveURL("/fleet-owner");

    await page.goto("/fleet-owner?range=year");
    await expect(page).toHaveURL("/fleet-owner");
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
