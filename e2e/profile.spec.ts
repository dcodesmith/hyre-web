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
  await expect(page.getByRole("heading", { name: "Danger Zone" })).toBeVisible();

  await page.getByRole("button", { name: "Delete Account" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Are you absolutely sure?" })).toBeVisible();
  await expect(dialog).toContainText("This action cannot be undone.");

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  let deletionRequests = 0;
  await page.route("**/api/account/delete*", async (route) => {
    deletionRequests += 1;
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ status: 204 });
  });

  await page.getByRole("button", { name: "Delete Account" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete Account" }).click();

  await expect.poll(() => deletionRequests).toBe(1);
});
