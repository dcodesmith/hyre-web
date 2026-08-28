import { expect, test } from "@playwright/test";

import {
  MOCK_ADMIN_CAR_ID,
  MOCK_ADMIN_DOCUMENT_ID,
  MOCK_ADMIN_IMAGE_ID,
  startMockAdminAuthApi,
  stopMockAdminAuthApi,
} from "./mock-admin-auth-api";

test("reviews admin cars and their submitted assets", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: "admin-e2e-session",
        url: "http://localhost:5173",
      },
    ]);

    await page.goto("/admin/cars?approvalStatus=PENDING");

    await expect(
      page.getByRole("heading", { name: "Car reviews", exact: true }).last(),
    ).toBeVisible();
    await expect(
      page.getByText("2023 Lexus RX 350", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect
      .poll(() => api.requests.carListQuery)
      .toBe("?page=1&limit=20&approvalStatus=PENDING");

    await page
      .getByRole("link", { name: /2023 Lexus RX 350|Review/ })
      .filter({ visible: true })
      .click();

    await expect(page).toHaveURL(`/admin/cars/${MOCK_ADMIN_CAR_ID}?approvalStatus=PENDING`);
    await expect(page.getByRole("heading", { name: "Vehicle images" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByText("MOT certificate", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View document" })).toHaveAttribute(
      "href",
      `/admin/documents/${MOCK_ADMIN_DOCUMENT_ID}`,
    );
    const documentResponse = await page.request.get(`/admin/documents/${MOCK_ADMIN_DOCUMENT_ID}`);
    expect(documentResponse.ok()).toBe(true);
    expect(documentResponse.headers()["content-type"]).toBe("application/pdf");
    expect((await documentResponse.body()).toString()).toBe("%PDF-1.4 mock");

    await page
      .getByRole("region", { name: "Vehicle images" })
      .getByRole("button", { name: "Approve", exact: true })
      .click();
    await expect
      .poll(() => api.requests.carActions[0])
      .toEqual({
        body: null,
        method: "POST",
        path: `/api/admin/cars/${MOCK_ADMIN_CAR_ID}/images/${MOCK_ADMIN_IMAGE_ID}/approve`,
      });

    await page.getByText("Reject document", { exact: true }).first().click();
    await page.getByLabel("Reason for rejecting this document").fill("Certificate expired");
    await page.getByRole("button", { name: "Reject document", exact: true }).click();
    await expect
      .poll(() => api.requests.carActions[1])
      .toEqual({
        body: { notes: "Certificate expired" },
        method: "POST",
        path: `/api/admin/documents/${MOCK_ADMIN_DOCUMENT_ID}/reject`,
      });
  } finally {
    await stopMockAdminAuthApi(api);
  }
});
