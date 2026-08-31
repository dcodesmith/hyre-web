import { type BrowserContext, expect, test } from "@playwright/test";

import {
  MOCK_ADMIN_PAYOUT_ID,
  MOCK_ADMIN_REFUND_ID,
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

test("reviews and reconciles refund and payout operations", async ({ context, page }) => {
  const api = await startMockAdminAuthApi(3100, null);

  try {
    await addAdminSession(context);
    await page.goto("/admin/financials");

    await expect(
      page.getByRole("heading", { name: "Financials", exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByText("Booking HYR-REF-001").filter({ visible: true })).toBeVisible();
    await expect
      .poll(() => api.requests.financialListQueries[0])
      .toBe("?attentionOnly=true&page=1&limit=20");

    await page
      .getByRole("link", { name: /Booking HYR-REF-001|View/ })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(`/admin/financials/refunds/${MOCK_ADMIN_REFUND_ID}`);
    await expect(page.getByRole("heading", { name: "Refund HYRE-REFUND-001" })).toBeVisible();
    await expect(page.getByText("Unresolved", { exact: true })).toBeVisible();

    const reconcileRefund = page.getByRole("button", { name: "Reconcile refund" });
    const refundDialog = page.getByRole("alertdialog");
    await expect(async () => {
      if (await refundDialog.isVisible()) {
        return;
      }

      await reconcileRefund.scrollIntoViewIfNeeded();
      await reconcileRefund.click();
      await expect(refundDialog).toBeVisible({ timeout: 1500 });
    }).toPass();
    await refundDialog.getByLabel("Flutterwave refund ID").fill("refund-recovered");
    await refundDialog.getByRole("button", { name: "Reconcile", exact: true }).click();
    await expect
      .poll(() => api.requests.financialActions[0])
      .toEqual({
        body: { refundProviderId: "refund-recovered" },
        method: "POST",
        path: `/api/admin/financial-operations/refunds/${MOCK_ADMIN_REFUND_ID}/reconcile`,
      });
    await expect(page.getByText("Refund reconciled with the provider.")).toBeVisible();
    await expect(page.getByText("Refunded", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconcile refund" })).toHaveCount(0);

    await page.getByRole("link", { name: "Back to financials" }).click();
    await page.getByRole("link", { name: "Payouts" }).click();
    await expect(page).toHaveURL("/admin/financials?type=payouts");
    await expect(page.getByText("Ada Fleet").filter({ visible: true })).toBeVisible();
    await expect
      .poll(() => api.requests.financialListQueries[1])
      .toBe("?attentionOnly=true&page=1&limit=20");

    await page
      .getByRole("link", { name: /Booking HYR-PAY-001|View/ })
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(`/admin/financials/payouts/${MOCK_ADMIN_PAYOUT_ID}?type=payouts`);

    const reconcilePayout = page.getByRole("button", { name: "Reconcile payout" });
    const payoutDialog = page.getByRole("alertdialog");
    await expect(async () => {
      if (await payoutDialog.isVisible()) {
        return;
      }

      await reconcilePayout.scrollIntoViewIfNeeded();
      await reconcilePayout.click();
      await expect(payoutDialog).toBeVisible({ timeout: 1500 });
    }).toPass();
    await payoutDialog.getByRole("button", { name: "Reconcile", exact: true }).click();
    await expect
      .poll(() => api.requests.financialActions[1])
      .toEqual({
        body: null,
        method: "POST",
        path: `/api/admin/financial-operations/payouts/${MOCK_ADMIN_PAYOUT_ID}/reconcile`,
      });
    await expect(page.getByText("Payout reconciled with the provider.")).toBeVisible();
    await expect(page.getByText("Paid out", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconcile payout" })).toHaveCount(0);
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("keeps queue filters synchronized with the URL", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    await addAdminSession(context);
    await page.goto("/admin/financials");

    await page.locator('select[name="scope"]').selectOption("all");
    await page.locator('select[name="status"]').selectOption("REFUND_PROCESSING");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL("/admin/financials?scope=all&status=REFUND_PROCESSING");
    await expect
      .poll(() => api.requests.financialListQueries[1])
      .toBe("?attentionOnly=false&page=1&limit=20&status=REFUND_PROCESSING");

    await page.goBack();
    await expect(page).toHaveURL("/admin/financials");
    await expect(page.locator("#financial-scope")).toHaveText("Needs attention");
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("keeps staff financial access read-only", async ({ context, page, request }) => {
  const api = await startMockAdminAuthApi();

  try {
    await request.post("http://127.0.0.1:3100/api/auth/sign-in/email-otp", {
      data: { role: "staff" },
    });
    await addAdminSession(context);
    await page.goto(`/admin/financials/refunds/${MOCK_ADMIN_REFUND_ID}`);

    await expect(
      page.getByText(
        "You can review financial operations. Reconciliation requires an administrator.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconcile refund" })).toHaveCount(0);

    const response = await page.request.post(`/admin/financials/refunds/${MOCK_ADMIN_REFUND_ID}`, {
      form: { intent: "reconcile-refund" },
    });
    expect(response.status()).toBe(403);

    const payoutResponse = await page.request.post(
      `/admin/financials/payouts/${MOCK_ADMIN_PAYOUT_ID}?type=payouts`,
      { form: { intent: "reconcile-payout" } },
    );
    expect(payoutResponse.status()).toBe(403);
    expect(api.requests.financialActions).toEqual([]);
  } finally {
    await stopMockAdminAuthApi(api);
  }
});
