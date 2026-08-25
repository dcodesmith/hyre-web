import { expect, test } from "@playwright/test";

test("sends guests from /profile to login", async ({ page }) => {
  await page.goto("/profile");

  await expect(page).toHaveURL((url) => {
    return url.pathname === "/auth" && url.searchParams.get("redirectTo") === "/profile";
  });
});

test("renders the profile form fixture", async ({ page }) => {
  await page.goto("/__visual/profile");

  await expect(page.getByRole("heading", { name: "Edit Profile" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com");
  await expect(page.getByLabel("Email")).toBeDisabled();
  await expect(page.getByLabel("Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("Phone")).toHaveValue("+2348012345678");
  await expect(page.getByRole("checkbox", { name: /Marketing communications/ })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();
});
