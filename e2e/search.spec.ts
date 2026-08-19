import { expect, type Page, test } from "@playwright/test";

const consentKey = "tripdly-cookie-consent:v1";

async function setCookiePreference(page: Page) {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ analytics: false, timestamp: 1 }));
  }, consentKey);
}

test("renders crawlable search metadata and booking chrome", async ({ page, viewport }) => {
  await setCookiePreference(page);
  const response = await page.goto("/search?vehicleType=SUV");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("SUV in Lagos | Tripdly");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://tripdly.com/search",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  if ((viewport?.width ?? 0) < 768) {
    await expect(
      page.getByRole("button", { name: /When do you need a ride|Airport|Day|Same Day/ }),
    ).toBeVisible();
  } else {
    await expect(page.locator('form[action="/search"]').first()).toBeVisible();
  }
});

test("carries homepage booking params onto /search", async ({ page, viewport }) => {
  await setCookiePreference(page);
  await page.goto("/");

  const searchForm = page.locator('form[action="/search"]').first();
  const airportTab = searchForm.getByRole("button", { name: "Airport" });
  await expect(searchForm.getByRole("button", { name: "Same Day" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(async () => {
    await airportTab.scrollIntoViewIfNeeded();
    await airportTab.click();
    await expect(airportTab).toHaveAttribute("aria-pressed", "true");
  }).toPass();
  await expect(searchForm.getByLabel("Flight Number")).toBeVisible();
  await expect(page).toHaveURL("/");
  await searchForm.getByLabel("Flight Number").fill("BA123");
  await searchForm.getByRole("button", { name: "Search for vehicles" }).click();

  await expect(page).toHaveURL(/\/search\?/);
  expect(new URL(page.url()).searchParams.get("bookingType")).toBe("AIRPORT_PICKUP");
  expect(new URL(page.url()).searchParams.get("flightNumber")).toBe("BA123");

  if ((viewport?.width ?? 0) < 768) {
    await expect(
      page.getByRole("button", { name: /When do you need a ride|Airport/ }),
    ).toBeVisible();
  } else {
    await expect(page.locator('form[action="/search"]').first()).toBeVisible();
  }
});

test("keeps filters and drops booking fields when booking type changes", async ({
  page,
  viewport,
}) => {
  await setCookiePreference(page);
  await page.goto("/search?from=2026-08-20&to=2026-08-21&bookingType=DAY&vehicleType=SUV");

  const nightTab =
    (viewport?.width ?? 0) < 768
      ? page.getByRole("dialog").getByRole("button", { name: "Night" })
      : page.locator('form[action="/search"]').first().getByRole("button", { name: "Night" });

  if ((viewport?.width ?? 0) < 768) {
    await page.getByRole("button", { name: /Same Day|When do you need a ride/ }).click();
  }

  await expect(async () => {
    await nightTab.click();
    await expect(nightTab).toHaveAttribute("aria-pressed", "true");
  }).toPass();

  await expect(page).toHaveURL(/bookingType=NIGHT/);
  const params = new URL(page.url()).searchParams;
  expect(params.get("vehicleType")).toBe("SUV");
  expect(params.get("from")).toBeNull();
  expect(params.get("to")).toBeNull();

  if ((viewport?.width ?? 0) < 768) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("matches the responsive search baseline", async ({ page }) => {
  await setCookiePreference(page);
  await page.goto("/__visual/search");
  await expect(page.getByRole("button", { name: "Filters" })).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => (image.complete ? undefined : image.decode())),
    );
  });

  await expect(page).toHaveScreenshot("search.png", {
    fullPage: true,
    mask: [page.locator("[data-visual-dynamic]")],
    maskColor: "#f3f4f6",
  });
});
