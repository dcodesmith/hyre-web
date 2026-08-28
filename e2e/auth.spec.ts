import { expect, test } from "@playwright/test";

test("guest navigation offers login and hides log out", async ({ page, viewport }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, "tripdly-cookie-consent:v1");
  await page.goto("/");

  if ((viewport?.width ?? 0) < 768) {
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Log in" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Bookings" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Profile" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Log out" })).toHaveCount(0);
  } else {
    await expect(page.getByRole("link", { name: "Register or Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Bookings" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Profile" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  }
});

test("renders the customer login form", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("link", { name: "Tripdly" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByPlaceholder("Referral code (optional)…")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send verification code" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Terms/ })).toBeVisible();
});

test("logo returns to the home page", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("link", { name: "Tripdly" }).click();
  await expect(page).toHaveURL("/");
});

test("shows inline field errors without native validation", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Send verification code" }).click();

  await expect(page.getByText("Email address is not valid.")).toBeVisible();
  await expect(
    page.getByText("You must accept the Terms of Service and Privacy Policy"),
  ).toBeVisible();
});

test("clears only the terms error after the checkbox is checked", async ({ page }) => {
  await page.goto("/auth");
  await page.reload();
  await page.getByRole("button", { name: "Send verification code" }).click();

  const termsError = page.getByText("You must accept the Terms of Service and Privacy Policy");
  await expect(termsError).toBeVisible();

  const terms = page.getByRole("checkbox", { name: /Terms/ });
  await terms.click();
  await expect(terms).toBeChecked();

  await expect(termsError).toBeHidden();
  await expect(page.getByText("Email address is not valid.")).toBeVisible();
});

test("sends an unauthenticated verify visit back to login", async ({ page }) => {
  await page.goto("/verify");
  await expect(page).toHaveURL(/\/auth$/);
});

test("prefills a valid referral from the URL and leaves an invalid one empty", async ({ page }) => {
  const referral = page.getByPlaceholder("Referral code (optional)…");

  await page.goto("/auth?ref=ABCD2345");
  await expect(referral).toHaveValue("ABCD2345");
  await referral.fill("WXYZ9876");
  await expect(referral).toHaveValue("WXYZ9876");

  await page.goto("/auth?ref=nope");
  await expect(referral).toHaveValue("");
  await expect(referral).toBeEditable();
});

test("keeps redirectTo and referral when verify has no pending OTP", async ({ page }) => {
  await page.goto("/verify?redirectTo=/cars/test-car&ref=ABCD2345");
  await expect(page).toHaveURL((url) => {
    return (
      url.pathname === "/auth" &&
      url.searchParams.get("redirectTo") === "/cars/test-car" &&
      url.searchParams.get("ref") === "ABCD2345"
    );
  });
});
