import { expect, type Page, test } from "@playwright/test";

import { startMockAdminAuthApi, stopMockAdminAuthApi } from "./mock-admin-auth-api";

async function setCookiePreference(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "tripdly-cookie-consent:v1",
      JSON.stringify({ analytics: false, timestamp: 1 }),
    );
  });
}

test("sends admin portal guests to the shared login route", async ({ page }) => {
  await page.goto("/admin");

  await expect(page).toHaveURL("/admin/login");
});

test("completes staff OTP login, protected shell loading, and logout", async ({
  context,
  page,
}) => {
  const api = await startMockAdminAuthApi();

  try {
    await setCookiePreference(page);
    await page.goto("/admin/login");

    await expect(page.getByRole("heading", { name: "Admin Portal Login" })).toBeAttached();
    await expect(page.getByRole("radio", { name: "Administrator" })).toBeChecked();
    await page.getByText("Staff", { exact: true }).click();
    await expect(page.getByRole("radio", { name: "Staff" })).toBeChecked();
    await page.getByLabel("Email").fill("staff@example.com");
    await page.getByRole("checkbox", { name: /Terms of Service/ }).check();
    await page.getByRole("button", { name: "Send verification code" }).click();

    await expect(page).toHaveURL("/admin/verify");
    await expect(page.getByRole("heading", { name: "Verify Admin Portal Email" })).toBeAttached();
    await expect
      .poll(() => api.requests.sendOtp)
      .toEqual({
        body: {
          email: "staff@example.com",
          type: "sign-in",
          role: "staff",
        },
        origin: "http://localhost:5173",
        referer: "http://localhost:5173/admin/login",
      });

    await page.getByLabel("Verification code").fill("123456");
    await page.getByRole("button", { name: "Verify email" }).click();

    await expect(page).toHaveURL("/admin");
    await expect(page.getByRole("heading", { name: "Welcome back, Staff User" })).toBeVisible();
    await expect(page.getByText("Staff", { exact: true }).first()).toBeVisible();
    await expect
      .poll(() => api.requests.verifyOtp?.body)
      .toEqual({
        email: "staff@example.com",
        otp: "123456",
        role: "staff",
      });

    const logoutButton = page.getByRole("button", { name: "Log out" });
    if (!(await logoutButton.isVisible())) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    }
    await logoutButton.click();

    await expect(page).toHaveURL("/admin/login");
    await expect
      .poll(() => api.requests.signOut)
      .toEqual({
        body: {},
        origin: "http://localhost:5173",
        referer: "http://localhost:5173/admin/login",
      });
    await expect
      .poll(async () => {
        const cookies = await context.cookies();
        return cookies.some((cookie) => cookie.name === "better-auth.session_token");
      })
      .toBe(false);
  } finally {
    await stopMockAdminAuthApi(api);
  }
});
