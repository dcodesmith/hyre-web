import { type BrowserContext, expect, test } from "@playwright/test";

import {
  MOCK_ADDON_RATE_ID,
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

    await page.goto("/admin/addon-rates");
    await expect(
      page.getByRole("heading", { name: "Add-on rates", exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByText("₦15,000", { exact: true })).toBeVisible();

    const addonForm = page.getByRole("form", { name: "Create add-on rate" });
    await addonForm.getByLabel("Rate amount (NGN)").fill("20000");
    await addonForm.getByLabel("Effective from").fill("2027-04-01T09:00");
    await addonForm.getByRole("button", { name: "Create add-on rate" }).click();

    await expect
      .poll(() => api.requests.rateActions[2])
      .toEqual({
        body: {
          addonType: "SECURITY_DETAIL",
          rateAmount: 20_000,
          effectiveSince: "2027-04-01T09:00:00.000Z",
        },
        method: "POST",
        path: "/api/rates/addon",
      });

    await page.getByRole("button", { name: "End now" }).click();
    await page.getByRole("button", { name: "End rate" }).click();
    await expect
      .poll(() => api.requests.rateActions[3])
      .toEqual({
        body: null,
        method: "PATCH",
        path: `/api/rates/addon/${MOCK_ADDON_RATE_ID}/end`,
      });
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("shows API overlap conflicts without replacing the message", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    await addAdminSession(context);
    await page.goto("/admin/fees");

    const vatForm = page.getByRole("form", { name: "Schedule VAT rate" });
    await vatForm.getByLabel("Rate percentage").fill("8");
    await vatForm.getByLabel("Effective from").fill("2026-09-01T09:00");
    await vatForm.getByLabel("Effective until (optional)").fill("2026-10-01T09:00");
    await vatForm.getByLabel("Description (optional)").fill("Trigger overlap");
    await vatForm.getByRole("button", { name: "Save VAT rate" }).click();

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
  } finally {
    await stopMockAdminAuthApi(api);
  }
});
