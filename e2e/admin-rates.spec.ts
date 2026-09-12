import { type BrowserContext, expect, test } from "@playwright/test";

import {
  MOCK_ADDON_ID,
  MOCK_ADDON_PRICE_ID,
  startMockAdminAuthApi,
  stopMockAdminAuthApi,
} from "./mock-admin-auth-api";

function addAdminSession(context: BrowserContext) {
  return context.addCookies([
    {
      name: "better-auth.session_token",
      value: "admin-e2e-session",
      url: "http://localhost:5174",
    },
  ]);
}

function utcDateTimeLocalDaysFromNow(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString().slice(0, 16);
}

test("manages admin fee, VAT, and add-on rate windows", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    await addAdminSession(context);

    await page.goto("/admin/fees");
    await expect(
      page.getByRole("heading", { name: "Fees and VAT", exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: "7.5%" })).toBeVisible();

    const vatForm = page.getByRole("form", { name: "Schedule VAT rate" });
    await vatForm.getByLabel("Rate percentage").fill("8");
    await vatForm.getByLabel("Effective from").fill("2027-01-01T09:00");
    await vatForm.getByLabel("Effective until (optional)").fill("2027-02-01T09:00");
    await vatForm.getByLabel("Description (optional)").fill("Updated VAT");
    await vatForm.getByRole("button", { name: "Save VAT rate" }).click();

    await expect
      .poll(() => api.requests.rateActions[0])
      .toEqual({
        body: {
          ratePercent: 8,
          effectiveSince: "2027-01-01T09:00:00.000Z",
          effectiveUntil: "2027-02-01T09:00:00.000Z",
          description: "Updated VAT",
        },
        method: "POST",
        path: "/api/rates/vat",
      });
    await expect(page.getByText("VAT rate scheduled.")).toBeVisible();
    const vatCard = page.locator("[data-slot=card]").filter({ hasText: "VAT rate" });
    await vatCard.getByText("Existing rate windows (2)").click();
    await expect(vatCard.getByRole("listitem").filter({ hasText: "8%" })).toBeVisible();

    const platformForm = page.getByRole("form", { name: "Schedule platform fee" });
    await platformForm.getByLabel("Fee type").click();
    await page.getByRole("option", { name: "Fleet owner commission" }).click();
    await platformForm.getByLabel("Rate percentage").fill("6");
    await platformForm.getByLabel("Effective from").fill("2027-03-01T09:00");
    await platformForm.getByRole("button", { name: "Save platform fee" }).click();

    await expect
      .poll(() => api.requests.rateActions[1])
      .toEqual({
        body: {
          feeType: "FLEET_OWNER_COMMISSION",
          ratePercent: 6,
          effectiveSince: "2027-03-01T09:00:00.000Z",
        },
        method: "POST",
        path: "/api/rates/platform-fee",
      });
    const platformCard = page.locator("[data-slot=card]").filter({ hasText: "Platform fees" });
    await expect(platformCard.getByText("Existing rate windows (3)")).toBeVisible();

    await page.goto("/admin/addon-rates");
    await expect(page.getByRole("heading", { name: "Add-ons", exact: true }).last()).toBeVisible();
    await expect(page.getByText("Protocol service")).toBeVisible();
    const protocolCard = page.locator("[data-slot=card]").filter({ hasText: "Protocol service" });
    await expect(protocolCard.locator("[data-slot=badge]", { hasText: "Enabled" })).toBeVisible();

    const createForm = page.locator("#create-addon-form");
    await createForm.getByLabel("Name").fill("Meet and greet");
    await createForm.getByLabel("Code").fill("MEET_AND_GREET");
    await createForm.getByRole("checkbox", { name: "day", exact: true }).check();
    await createForm.getByRole("button", { name: "Create add-on" }).click();

    await expect
      .poll(() => api.requests.addonActions[0])
      .toEqual({
        body: {
          code: "MEET_AND_GREET",
          name: "Meet and greet",
          bookingTypes: ["DAY"],
          pricingUnit: "PER_BOOKING",
          financialTreatment: "PLATFORM",
          isActive: true,
        },
        method: "POST",
        path: "/api/admin/addons",
      });
    await expect(page.getByText("Add-on created.")).toBeVisible();

    const createdCard = page.locator("[data-slot=card]").filter({ hasText: "Meet and greet" });
    await createdCard.getByText("Prices (0)").click();
    await createdCard.getByLabel("Amount (NGN)").fill("20000");
    const scheduledFrom = utcDateTimeLocalDaysFromNow(30);
    await createdCard.getByLabel("Effective from (UTC)").fill(scheduledFrom);
    await createdCard.getByRole("button", { name: "Add price" }).click();

    await expect
      .poll(() => api.requests.addonActions[1])
      .toMatchObject({
        body: {
          amount: 20_000,
          effectiveSince: `${scheduledFrom}:00.000Z`,
        },
        method: "POST",
      });
    expect(api.requests.addonActions[1]?.path).toMatch(
      /^\/api\/admin\/addons\/cmcreatedadd.+\/prices$/,
    );
    await expect(createdCard.locator("[data-slot=badge]", { hasText: "Enabled" })).toBeVisible();
    await expect(createdCard.getByText("₦20,000")).toBeVisible();
    const scheduledPrice = createdCard.getByRole("listitem").filter({ hasText: "₦20,000" });
    await expect(scheduledPrice.getByText("Scheduled", { exact: true })).toBeVisible();
    await expect(scheduledPrice.getByText("Active", { exact: true })).toHaveCount(0);
    await expect(createdCard.getByRole("button", { name: "End now" })).toHaveCount(0);

    await protocolCard.getByText("Prices (1)").click();
    await expect(
      protocolCard.getByText("Customers can select this add-on only while a price is active."),
    ).toBeVisible();
    const currentPrice = protocolCard.getByRole("listitem").filter({ hasText: "₦15,000" });
    await expect(currentPrice.getByText("Active", { exact: true })).toBeVisible();
    await protocolCard.getByRole("button", { name: "End now" }).click();
    await page.getByRole("button", { name: "End price" }).click();
    await expect
      .poll(() => api.requests.addonActions[2])
      .toEqual({
        body: null,
        method: "PATCH",
        path: `/api/admin/addons/${MOCK_ADDON_ID}/prices/${MOCK_ADDON_PRICE_ID}/end`,
      });
    await expect(protocolCard.getByRole("button", { name: "End now" })).toHaveCount(0);
    await expect(currentPrice.getByText("Ended", { exact: true })).toBeVisible();
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("shows an error when ending an add-on price fails", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    api.failEndPrice.current = true;
    await addAdminSession(context);
    await page.goto("/admin/addon-rates");
    await expect(page.getByRole("heading", { name: "Add-ons", exact: true }).last()).toBeVisible();

    const protocolCard = page.locator("[data-slot=card]").filter({ hasText: "Protocol service" });
    await protocolCard.getByText("Prices (1)").click();
    await protocolCard.getByRole("button", { name: "End now" }).click();
    await page.getByRole("button", { name: "End price" }).click();

    await expect
      .poll(() => api.requests.addonActions[0])
      .toEqual({
        body: null,
        method: "PATCH",
        path: `/api/admin/addons/${MOCK_ADDON_ID}/prices/${MOCK_ADDON_PRICE_ID}/end`,
      });
    await expect(protocolCard.getByText("Price not ended")).toBeVisible();
    await expect(protocolCard.getByText("This add-on price has already ended")).toBeVisible();
    await expect(protocolCard.getByRole("button", { name: "End now" })).toBeVisible();
    await expect(
      protocolCard.getByRole("listitem").filter({ hasText: "₦15,000" }).getByText("Active", {
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("shows API overlap conflicts without replacing the message", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    await addAdminSession(context);
    await page.goto("/admin/fees");
    await expect(
      page.getByRole("heading", { name: "Fees and VAT", exact: true }).last(),
    ).toBeVisible();

    const vatForm = page.getByRole("form", { name: "Schedule VAT rate" });
    await vatForm.getByLabel("Rate percentage").fill("8");
    await vatForm.getByLabel("Effective from").fill("2026-09-01T09:00");
    await vatForm.getByLabel("Effective until (optional)").fill("2026-10-01T09:00");
    await vatForm.getByLabel("Description (optional)").fill("Trigger overlap");
    const saveButton = vatForm.getByRole("button", { name: "Save VAT rate" });
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();

    await expect
      .poll(() => api.requests.rateActions[0])
      .toEqual({
        body: {
          ratePercent: 8,
          effectiveSince: "2026-09-01T09:00:00.000Z",
          effectiveUntil: "2026-10-01T09:00:00.000Z",
          description: "Trigger overlap",
        },
        method: "POST",
        path: "/api/rates/vat",
      });
    await expect(
      page.getByText("The VAT rate overlaps an existing effective window."),
    ).toBeVisible();
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("blocks staff from admin-only rate routes", async ({ context, page, request }) => {
  const api = await startMockAdminAuthApi();

  try {
    await request.post("http://127.0.0.1:3100/api/auth/sign-in/email-otp", {
      data: { role: "staff" },
    });
    await addAdminSession(context);

    const mutationResponse = await page.request.post("/admin/fees", {
      form: {
        intent: "vat",
        ratePercent: "8",
        effectiveSince: "2027-01-01T09:00",
      },
    });
    expect(mutationResponse.status()).toBe(403);

    await page.goto("/admin/fees");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    expect(api.requests.rateActions).toEqual([]);

    await page.goto("/admin/addon-rates");
    await expect(page.getByRole("heading", { name: "Add-ons", exact: true }).last()).toBeVisible();
    await expect(page.getByText("Protocol service")).toBeVisible();
  } finally {
    await stopMockAdminAuthApi(api);
  }
});
