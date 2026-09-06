import { type BrowserContext, expect, test } from "@playwright/test";

import {
  MOCK_ADMIN_STAFF_ID,
  MOCK_REVOKED_STAFF_ID,
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

test("lists staff from the API and adds a staff member", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    await addAdminSession(context);

    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "Staff Management" })).toBeVisible();
    await expect.poll(() => api.requests.staffListQuery).toBe("?page=1&limit=20");
    await expect(page.getByText("Grace Hopper")).toBeVisible();

    await page.getByRole("link", { name: "Active" }).click();
    await expect(page).toHaveURL(/status=active/);
    await expect.poll(() => api.requests.staffListQuery).toBe("?page=1&limit=20&status=active");

    await page.getByRole("link", { name: "Add Staff" }).click();
    const form = page.getByRole("form", { name: "Add staff member" });
    await expect(page).toHaveURL(/add=1/);
    await form.getByLabel("Full Name").fill("Ada Lovelace");
    await form.getByLabel("Email").fill("Ada@Example.com");
    await form.getByLabel("Phone Number").fill("08012345678");
    await form.getByRole("button", { name: "Add another" }).click();

    await expect
      .poll(() => api.requests.staffActions[0])
      .toEqual({
        body: {
          name: "Ada Lovelace",
          email: "ada@example.com",
          phoneNumber: "08012345678",
        },
        method: "POST",
        path: "/api/admin/staff",
      });
    await expect(form.getByText("Staff member added.")).toBeVisible();
    await expect(form.getByLabel("Full Name")).toHaveValue("");
    await expect(page.getByText("Ada Lovelace")).toBeVisible();

    await form.getByLabel("Full Name").fill("Charles Babbage");
    await form.getByLabel("Email").fill("charles@example.com");
    await form.getByLabel("Phone Number").fill("08087654321");
    await form.getByRole("button", { name: "Add", exact: true }).click();

    await expect
      .poll(() => api.requests.staffActions[1])
      .toEqual({
        body: {
          name: "Charles Babbage",
          email: "charles@example.com",
          phoneNumber: "08087654321",
        },
        method: "POST",
        path: "/api/admin/staff",
      });
    await expect(form).toBeHidden();
    await expect(page).not.toHaveURL(/add=1/);
    await expect(page.getByText("Charles Babbage")).toBeVisible();
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("revokes and reinstates staff from the list", async ({ context, page }) => {
  const api = await startMockAdminAuthApi();

  try {
    await addAdminSession(context);
    await page.goto("/admin/staff");
    await expect(page.getByText("Grace Hopper")).toBeVisible();

    const revokeButton = page.getByRole("button", { name: "Revoke Grace Hopper" });
    const revokeDialog = page.getByRole("alertdialog");
    await expect(async () => {
      if (await revokeDialog.isVisible()) {
        return;
      }

      await revokeButton.scrollIntoViewIfNeeded();
      await revokeButton.click();
      await expect(revokeDialog).toBeVisible({ timeout: 1500 });
    }).toPass();
    await revokeDialog.getByRole("button", { name: "Revoke access" }).click();
    await expect
      .poll(() => api.requests.staffActions[0])
      .toEqual({
        body: null,
        method: "POST",
        path: `/api/admin/staff/${MOCK_ADMIN_STAFF_ID}/revoke`,
      });
    await expect(page.getByRole("button", { name: "Reinstate Grace Hopper" })).toBeVisible();

    await page.getByRole("button", { name: "Reinstate Alan Turing" }).click();
    await expect
      .poll(() => api.requests.staffActions[1])
      .toEqual({
        body: null,
        method: "POST",
        path: `/api/admin/staff/${MOCK_REVOKED_STAFF_ID}/reinstate`,
      });
    await expect(page.getByRole("button", { name: "Revoke Alan Turing" })).toBeVisible();
  } finally {
    await stopMockAdminAuthApi(api);
  }
});

test("blocks staff from the admin-only staff route", async ({ context, page, request }) => {
  const api = await startMockAdminAuthApi();

  try {
    await request.post("http://127.0.0.1:3100/api/auth/sign-in/email-otp", {
      data: { role: "staff" },
    });
    await addAdminSession(context);

    const mutationResponse = await page.request.post("/admin/staff", {
      headers: {
        origin: "http://localhost:5174",
        "sec-fetch-site": "same-origin",
      },
      form: {
        intent: "create",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phoneNumber: "08012345678",
      },
    });
    expect(mutationResponse.status()).toBe(403);

    await page.goto("/admin/staff");
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
    expect(api.requests.staffActions).toEqual([]);
  } finally {
    await stopMockAdminAuthApi(api);
  }
});
