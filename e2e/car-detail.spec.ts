import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { HTTP_STATUS } from "../app/api/http-status";
import { clickUntilAttribute, clickUntilVisible } from "./click-until";
import {
  mockReferralSummary,
  startMockReferralApi,
  stopMockReferralApi,
} from "./mock-referral-api";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

async function signInCustomer(context: BrowserContext) {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-session",
      url: "http://localhost:5174",
    },
  ]);
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
  await expect(page.getByText("Same day").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("(12 hours) x 1").filter({ visible: true }).first()).toBeVisible();
  await expect(
    page.getByText("Platform Fee (5.0%)").filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("VAT (7.5%)").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByLabel("Full Name")).toBeVisible();
  await expect(page.getByLabel("Email Address")).toBeVisible();
  await expect(page.getByLabel("Phone Number")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Referral credit" })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: /Referral credit/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Pay Now", exact: true }).filter({ visible: true }),
  ).toBeDisabled();

  const fullDay = page
    .getByRole("group", { name: "Booking type" })
    .getByRole("button", { name: "Full Day" });
  await clickUntilAttribute(fullDay, "aria-pressed", "true");
  await expect(page).toHaveURL(/bookingType=FULL_DAY/);
  await expect(page.getByLabel("Pickup Time")).toBeVisible();
  await expect(page.getByLabel("Pickup Address")).toBeVisible();
  await expect(page.getByText("Full day", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("(24 hours) x 1").filter({ visible: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay Now", exact: true }).filter({ visible: true }),
  ).toBeDisabled();

  if ((viewport?.width ?? 0) >= 1024) {
    await expect(page.getByRole("link", { name: /Back to search results/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Car information and features" })).toBeVisible();
  }
});

test("shows referral credit on the visual credits fixture", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/car?bookingType=DAY&credits=true");

  await expect(page.getByRole("heading", { name: "Apply Referral Credit" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Referral credit/ })).toBeVisible();
  await expect(page.getByText("₦12,500 available to use")).toBeVisible();
  const referralCredit = page.getByRole("region", { name: "Apply Referral Credit" });
  await expect(referralCredit.getByText("₦15,000", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Your available credit is ₦15,000. You can use ₦12,500 for this booking.",
    }),
  ).toBeVisible();
});

test("shows referral credit after loading a signed-in customer's usable balance", async ({
  context,
  page,
}) => {
  const api = await startMockReferralApi({
    ...mockReferralSummary,
    stats: { ...mockReferralSummary.stats, maxCreditsPerBooking: 12_500 },
  });

  try {
    await setCookiePreference(page);
    await signInCustomer(context);
    const creditsResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.includes("/api/referral-credits"),
    );
    await page.goto(
      "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM",
    );
    await creditsResponse;

    await expect(page.getByRole("heading", { name: "Apply Referral Credit" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Referral credit/ })).toBeVisible();
    await expect(page.getByText("₦12,500 available to use")).toBeVisible();
    const referralCredit = page.getByRole("region", { name: "Apply Referral Credit" });
    await expect(referralCredit.getByText("₦15,000", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Your available credit is ₦15,000. You can use ₦12,500 for this booking.",
      }),
    ).toBeVisible();
  } finally {
    await stopMockReferralApi(api);
  }
});

test("hides referral credit when a signed-in customer has no balance", async ({
  context,
  page,
}) => {
  const api = await startMockReferralApi({
    ...mockReferralSummary,
    stats: { ...mockReferralSummary.stats, availableCredits: 0 },
  });

  try {
    await setCookiePreference(page);
    await signInCustomer(context);
    const creditsResponse = page.waitForResponse((response) =>
      new URL(response.url()).pathname.includes("/api/referral-credits"),
    );
    await page.goto(
      "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM",
    );
    await creditsResponse;

    await expect(page.getByRole("heading", { name: "Referral credit" })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /Referral credit/ })).toHaveCount(0);
  } finally {
    await stopMockReferralApi(api);
  }
});

test("uses Enter to send and verify a signed-in customer's phone", async ({ context, page }) => {
  const api = await startMockReferralApi(mockReferralSummary, 3100, {
    phoneVerified: false,
  });

  try {
    await setCookiePreference(page);
    await signInCustomer(context);
    await page.goto(
      "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM&pickupAddress=Lekki&sameLocation=true",
    );
    const bookingUrl = page.url();
    const payNow = page.getByRole("button", { name: "Pay Now", exact: true });

    await expect(page.getByText("Order Total:").filter({ visible: true })).toBeVisible();
    await expect(payNow).toBeDisabled();

    await page.getByLabel("Phone Number").press("Enter");
    await expect(page.getByLabel("Enter Verification Code")).toBeVisible();
    expect(page.url()).toBe(bookingUrl);

    const code = page.getByLabel("Enter Verification Code");
    await code.fill("123456");
    await expect(code).toHaveValue("123456");
    await code.press("Enter");
    await expect(payNow).toBeEnabled();
    await expect(code).toHaveCount(0);
    expect(page.url()).toBe(bookingUrl);
  } finally {
    await stopMockReferralApi(api);
  }
});

test("uses Enter to verify a guest phone before Pay Now enables", async ({ page }) => {
  const api = await startMockReferralApi();

  try {
    await setCookiePreference(page);
    await page.goto(
      "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM&pickupAddress=Lekki&sameLocation=true",
    );
    const bookingUrl = page.url();
    const payNow = page.getByRole("button", { name: "Pay Now", exact: true });

    await expect(page.getByText("Order Total:").filter({ visible: true })).toBeVisible();
    await page.getByLabel("Full Name").fill("Ada Lovelace");
    await page.getByLabel("Email Address").fill("ada@example.com");
    await expect(payNow).toBeDisabled();

    const phone = page.getByLabel("Phone Number");
    await phone.fill("08012345678");
    await expect(phone).toHaveValue("08012345678");
    await phone.press("Enter");
    await expect(page.getByLabel("Enter Verification Code")).toBeVisible();
    expect(page.url()).toBe(bookingUrl);

    const code = page.getByLabel("Enter Verification Code");
    await code.fill("123456");
    await expect(code).toHaveValue("123456");
    await code.press("Enter");
    await expect(payNow).toBeEnabled();
    await expect(code).toHaveCount(0);
    expect(page.url()).toBe(bookingUrl);
  } finally {
    await stopMockReferralApi(api);
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
  await expect(page.getByText("Order Total:").filter({ visible: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pay Now", exact: true }).filter({ visible: true }),
  ).toBeDisabled();
  await expect(page.getByLabel("Full Name")).toBeVisible();
  await expect(page.getByLabel("Email Address")).toBeVisible();
  await expect(page.getByLabel("Phone Number")).toBeVisible();
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
    await expect(page.getByRole("option", { name: /British Airways/ })).toBeVisible();
  }).toPass();
});

test("keeps guest details when booking URL state changes", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto(
    "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM&pickupAddress=Lekki&sameLocation=true",
  );

  await page.getByLabel("Full Name").fill("Ada Lovelace");
  await page.getByLabel("Email Address").fill("ada@example.com");
  await page.getByLabel("Phone Number").fill("08012345678");
  await page.getByRole("button", { name: "24 Hours" }).click();

  await expect(page.getByLabel("Full Name")).toHaveValue("Ada Lovelace");
  await expect(page.getByLabel("Email Address")).toHaveValue("ada@example.com");
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

  const pay = page.getByRole("button", { name: "Pay Now", exact: true }).filter({ visible: true });
  await expect(pay).toBeDisabled();
});

test("selects an add-on and includes it in preview and checkout FormData", async ({ page }) => {
  await setCookiePreference(page);
  const addonId = "018f47a2-7b3c-7d4e-8f90-1234567890b1";
  await page.goto(
    "/__visual/car?bookingType=DAY&from=2026-09-01&to=2026-09-01&pickupTime=9%20AM&pickupAddress=Lekki&sameLocation=true",
  );

  const serviceHeading = page
    .getByRole("heading", { name: "Book a service" })
    .filter({ visible: true });
  const addonHeading = page.getByRole("heading", { name: "Add-ons" }).filter({ visible: true });
  const costHeading = page
    .getByRole("heading", { name: "Cost Breakdown" })
    .filter({ visible: true })
    .first();
  const addon = page.getByRole("checkbox", { name: /Protocol service/ }).filter({ visible: true });
  await expect(serviceHeading).toBeVisible();
  await expect(addonHeading).toBeVisible();
  await expect(addon).toBeVisible();

  const serviceTop = (await serviceHeading.boundingBox())?.y ?? 0;
  const addonsTop = (await addonHeading.boundingBox())?.y ?? 0;
  const costTop = (await costHeading.boundingBox())?.y ?? 0;
  const phone = page.getByLabel("Phone Number");
  const phoneTop = (await phone.boundingBox())?.y ?? 0;
  expect(serviceTop).toBeLessThan(phoneTop);
  expect(phoneTop).toBeLessThan(addonsTop);
  expect(addonsTop).toBeLessThan(costTop);
  await expect(page.locator("[data-slot=card-footer]")).toHaveCount(0);

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

  const orderTotal = page
    .locator('section[class~="lg:hidden"]')
    .filter({ hasText: "Order Total:" });
  const orderTotalSpacer = page.locator('div[aria-hidden="true"][class="lg:hidden"]');

  await page.getByRole("button", { name: "Book a service" }).click();
  await expect(page.getByRole("button", { name: "Book a service" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(orderTotal).toHaveClass(/\brelative\b/);
  await expect.poll(() => orderTotalSpacer.evaluate((element) => element.offsetHeight)).toBe(0);

  const addonInput = page.locator(`input[name="addonIds"][value="${addonId}"]`);
  await expect(addonInput).toBeHidden();
  await expect(addonInput).toBeChecked();

  const addonIds = await addonInput.evaluate((input) => [
    ...new FormData((input as HTMLInputElement).form ?? undefined).getAll("addonIds"),
  ]);
  expect(addonIds).toEqual([addonId]);

  await page.getByRole("button", { name: "Book a service" }).click();
  await expect(page.getByRole("button", { name: "Book a service" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(orderTotal).toHaveClass(/\bfixed\b/);
  await expect
    .poll(async () => {
      const [spacerHeight, panelHeight] = await Promise.all([
        orderTotalSpacer.evaluate((element) => element.offsetHeight),
        orderTotal.evaluate((element) => element.offsetHeight),
      ]);
      return spacerHeight === panelHeight;
    })
    .toBe(true);
});

test("returns 404 for a malformed public car ref", async ({ page }) => {
  await setCookiePreference(page);
  const response = await page.goto("/cars/2019-black-lexus-ux-f-sport--0123456789abcde");

  expect(response?.status()).toBe(HTTP_STATUS.NOT_FOUND);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});
