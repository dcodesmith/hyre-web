import { expect, type Page, test } from "@playwright/test";

import { HTTP_STATUS } from "../app/api/http-status";
import { expectVisualScreenshot } from "./expect-visual-screenshot";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

test("renders crawlable car metadata and booking controls from the fixture", async ({
  page,
  viewport,
}) => {
  await setCookiePreference(page);
  const response = await page.goto("/__visual/car?bookingType=DAY");

  expect(response?.status()).toBe(HTTP_STATUS.OK);
  await expect(
    page.getByRole("heading", { level: 1, name: "Lexus UX F-Sport - 2019" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Same Day" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /Pay Now/ })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Cost Breakdown" }).filter({ visible: true }),
  ).toHaveCount(0);

  if ((viewport?.width ?? 0) >= 1024) {
    await expect(page.getByRole("link", { name: /Back to search results/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Car information and features" })).toBeVisible();
  }
});

test("opens the review sheet without changing the car URL", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/car?bookingType=DAY");

  const reviewTrigger = page.getByRole("button", { name: /12 reviews/i });
  await expect(reviewTrigger).toBeVisible();
  await reviewTrigger.evaluate((node) => {
    node.scrollIntoView({ block: "center", inline: "nearest" });
  });
  await reviewTrigger.click();

  await expect(page).toHaveURL(/\/__visual\/car\?bookingType=DAY$/);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("12 reviews for Lexus UX F-Sport")).toBeVisible();
  await expect(page.getByText("Smooth airport pickup and a spotless cabin.")).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();

  await expect(page).toHaveURL(/\/__visual\/car\?bookingType=DAY$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("shows airport pickup flight and address fields when a from date is present", async ({
  page,
}) => {
  await setCookiePreference(page);
  const response = await page.goto(
    "/__visual/car?bookingType=AIRPORT_PICKUP&from=2026-08-21&pickupAddress=MMA2&dropOffAddress=Victoria%20Island&sameLocation=false",
  );

  expect(response?.status()).toBe(HTTP_STATUS.OK);
  await expect(page.getByRole("button", { name: "Airport" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Flight Number")).toBeVisible();
  await expect(page.getByLabel("Pickup Address")).toBeVisible();
  await expect(page.getByLabel("Drop-off Address")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cost Breakdown" }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("Platform Fee (5.0%)").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("VAT (7.5%)").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Total", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay Now as Guest" }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Phone Number")).toBeVisible();

  await page.getByRole("button", { name: "Pay Now as Guest" }).filter({ visible: true }).click();
  await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Phone Number")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Name")).toHaveClass(/border-red-500/);
  const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
    const ids = elements.map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);

  const flightNumber = page.getByLabel("Flight Number");
  await expect(async () => {
    await flightNumber.click();
    await flightNumber.fill("");
    await flightNumber.pressSequentially("BA");
    await expect(page.getByRole("button", { name: /British Airways/ })).toBeVisible();
  }).toPass();
});

test("keeps guest details when booking URL state changes", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto(
    "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM&pickupAddress=Lekki&sameLocation=true",
  );

  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Phone Number").fill("08012345678");
  await page.getByRole("button", { name: "24 Hours" }).click();

  await expect(page.getByLabel("Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("Email")).toHaveValue("ada@example.com");
  await expect(page.getByLabel("Phone Number")).toHaveValue("08012345678");
});

test("invalidates an edited address and disables checkout", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto(
    "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM&pickupAddress=Lekki&sameLocation=true",
  );

  const pickupAddress = page.getByLabel("Pickup Address");
  await page.waitForFunction(() => {
    const input = document.querySelector('input[role="combobox"]');
    return input ? Object.keys(input).some((key) => key.startsWith("__reactProps$")) : false;
  });
  await pickupAddress.click();
  await pickupAddress.press("ControlOrMeta+A");
  await pickupAddress.pressSequentially("X");
  await expect(pickupAddress).toHaveValue("X");
  await expect(page.locator('input[type="hidden"][name="pickupAddress"]')).toHaveValue("");

  const pay = page.getByRole("button", { name: "Pay Now as Guest" }).filter({ visible: true });
  await expect(pay).toBeDisabled();
});

test("returns 404 for a hireApp short slug the API cannot resolve", async ({ page }) => {
  await setCookiePreference(page);
  const response = await page.goto("/cars/2019-lexus-ux-f-sport-cmmz4f7x00000");

  expect(response?.status()).toBe(HTTP_STATUS.NOT_FOUND);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("matches the responsive car detail baseline", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/car?bookingType=DAY");
  await expect(
    page.getByRole("heading", { level: 1, name: "Lexus UX F-Sport - 2019" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => image.getClientRects().length > 0)
        .map((image) => (image.complete ? undefined : image.decode().catch(() => undefined))),
    );
  });

  await expectVisualScreenshot(page, "car-detail.png", {
    fullPage: true,
    mask: [page.locator("[data-visual-dynamic]")],
    maskColor: "#f3f4f6",
  });
});
