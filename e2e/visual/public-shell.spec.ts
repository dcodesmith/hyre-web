import { expect, type Page, test } from "@playwright/test";

const consentKey = "tripdly-cookie-consent:v1";
const legacyConsentKey = "tripdly-cookie-consent";

async function visitShellWithConsent(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
  await page.goto("/__visual/public-shell");
  await page.evaluate(() => document.fonts.ready);
}

test("renders the public shell at its responsive breakpoint", async ({ page, viewport }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await visitShellWithConsent(page);

  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();

  if ((viewport?.width ?? 0) < 768) {
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
  } else {
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  }

  await expect(page).toHaveScreenshot("public-shell.png", {
    fullPage: true,
    mask: [page.locator("[data-visual-dynamic]")],
    maskColor: "#f3f4f6",
  });
  expect(consoleErrors).toEqual([]);
});

test("supports keyboard access to the main content", async ({ page }) => {
  await visitShellWithConsent(page);

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.getByRole("main")).toBeFocused();
});

test("persists a cookie preference", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "tablet-768", "Covered at mobile and desktop widths.");

  await page.addInitScript(
    ({ currentKey, oldKey }) => {
      localStorage.removeItem(currentKey);
      localStorage.removeItem(oldKey);
    },
    { currentKey: consentKey, oldKey: legacyConsentKey },
  );
  await page.goto("/__visual/public-shell");
  await page.evaluate(() => document.fonts.ready);

  const banner = page.getByRole("region", { name: "Cookie consent" });
  await expect(banner).toBeVisible();
  await expect(banner).toHaveScreenshot("cookie-consent.png");

  await page.getByRole("button", { name: "Essential Only" }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(banner).toBeHidden();
});

test("renders the parity 404 page", async ({ page }) => {
  await page.goto("/missing-page-for-visual-test");
  await page.evaluate(() => document.fonts.ready);

  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page).toHaveScreenshot("not-found.png", {
    fullPage: true,
    mask: [page.locator("[data-visual-dynamic]")],
    maskColor: "#ffffff",
  });
});
