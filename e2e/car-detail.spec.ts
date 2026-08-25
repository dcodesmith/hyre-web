import { expect, type Page, test } from "@playwright/test";

import { HTTP_STATUS } from "../app/api/http-status";
import { expectVisualScreenshot } from "./expect-visual-screenshot";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

test("renders crawlable car metadata and booking chrome from the fixture", async ({
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
  const response = await page.goto("/__visual/car?bookingType=AIRPORT_PICKUP&from=2026-08-21");

  expect(response?.status()).toBe(HTTP_STATUS.OK);
  await expect(page.getByRole("button", { name: "Airport" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByLabel("Flight Number")).toBeVisible();
  await expect(page.getByLabel("Pickup Address")).toBeVisible();
  await expect(page.getByLabel("Drop-off Address")).toBeVisible();

  const flightNumber = page.getByLabel("Flight Number");
  await expect(async () => {
    await flightNumber.click();
    await flightNumber.fill("");
    await flightNumber.pressSequentially("BA");
    await expect(page.getByRole("button", { name: /British Airways/ })).toBeVisible();
  }).toPass();
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
