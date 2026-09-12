import { expect, type Page, test } from "@playwright/test";

import { HTTP_STATUS } from "../app/api/http-status";
import { clickUntilVisible } from "./click-until";

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
  await expect(page.getByLabel("Pickup Time")).toBeVisible();
  await expect(page.getByLabel("Pickup Address")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Cost Breakdown" }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("₦90,000 × 1 day").filter({ visible: true }).first()).toBeVisible();
  await expect(
    page.getByText("Platform Fee (5.0%)").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("VAT (7.5%)").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Phone Number")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay Now as Guest" }).filter({ visible: true }),
  ).toBeDisabled();

  await page
    .getByRole("group", { name: "Booking type" })
    .getByRole("button", { name: "Full Day" })
    .click();
  await expect(page).toHaveURL(/bookingType=FULL_DAY/);
  await expect(page.getByLabel("Pickup Time")).toBeVisible();
  await expect(page.getByLabel("Pickup Address")).toBeVisible();
  await expect(page.getByText("₦144,000 × 1 full day").filter({ visible: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay Now as Guest" }).filter({ visible: true }),
  ).toBeDisabled();

  if ((viewport?.width ?? 0) >= 1024) {
    await expect(page.getByRole("link", { name: /Back to search results/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Car information and features" })).toBeVisible();
  }
});

test("opens the review sheet without changing the car URL", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/car?bookingType=DAY");

  const reviewTrigger = page
    .getByRole("button", { name: "12 reviews", exact: true })
    .filter({ visible: true });
  await clickUntilVisible(reviewTrigger, page.getByRole("dialog"));

  await expect(page).toHaveURL(/\/__visual\/car\?bookingType=DAY$/);
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

test("selects an add-on and includes it in preview and checkout FormData", async ({ page }) => {
  await setCookiePreference(page);
  const addonId = "cmaddonprotocol0000000001";
  await page.goto(
    "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM&pickupAddress=Lekki&sameLocation=true",
  );

  const addonHeading = page.getByRole("heading", { name: "Add-ons" }).filter({ visible: true });
  const guestHeading = page
    .getByRole("heading", { name: "Guest Details" })
    .filter({ visible: true });
  const costHeading = page
    .getByRole("heading", { name: "Cost Breakdown" })
    .filter({ visible: true })
    .first();
  const addon = page.getByRole("checkbox", { name: /Protocol service/ }).filter({ visible: true });
  await expect(addonHeading).toBeVisible();
  await expect(addon).toBeVisible();

  const addonsTop = (await addonHeading.boundingBox())?.y ?? 0;
  const costTop = (await costHeading.boundingBox())?.y ?? 0;
  expect(addonsTop).toBeLessThan(costTop);
  const addonSection = page.locator("section[aria-labelledby='booking-addons-heading']");
  const addonBorderTopWidth = await addonSection.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).borderTopWidth),
  );
  if ((page.viewportSize()?.width ?? 0) < 1024) {
    await expect(guestHeading).toBeVisible();
    const guestTop = (await guestHeading.boundingBox())?.y ?? 0;
    expect(guestTop).toBeLessThan(addonsTop);
    expect(addonBorderTopWidth).toBe(0);
  } else {
    expect(addonBorderTopWidth).toBeGreaterThan(0);
    const phone = page.getByLabel("Phone Number");
    const phoneBox = await phone.boundingBox();
    const addonsBox = await addonSection.boundingBox();
    expect((addonsBox?.y ?? 0) - ((phoneBox?.y ?? 0) + (phoneBox?.height ?? 0))).toBeGreaterThan(8);

    const [addonLuminance, footerLuminance] = await addonSection.evaluate((element) => {
      const sampleLuminance = (el: Element) => {
        const color = getComputedStyle(el).backgroundColor;
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return 0;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [red = 0, green = 0, blue = 0] = ctx.getImageData(0, 0, 1, 1).data;
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      };
      const footer = document.querySelector("[data-slot=card-footer]");
      return [sampleLuminance(element), footer ? sampleLuminance(footer) : 0];
    });
    expect(addonLuminance).toBeGreaterThan(footerLuminance);
  }

  const previewRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname.includes("booking-pricing-preview") &&
      url.searchParams.getAll("addonIds").includes(addonId)
    );
  });
  await addon.click();
  await expect(addon).toBeChecked();
  await previewRequest;

  const addonIds = await page
    .locator("form")
    .filter({ has: page.getByRole("checkbox", { name: /Protocol service/ }) })
    .evaluate((form) => [...new FormData(form as HTMLFormElement).getAll("addonIds")]);
  expect(addonIds).toEqual([addonId]);
});

test("returns 404 for a hireApp short slug the API cannot resolve", async ({ page }) => {
  await setCookiePreference(page);
  const response = await page.goto("/cars/2019-lexus-ux-f-sport-cmmz4f7x00000");

  expect(response?.status()).toBe(HTTP_STATUS.NOT_FOUND);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
