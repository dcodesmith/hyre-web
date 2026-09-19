import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import { ineligibleFleetVehicleMessage } from "../app/fleet/cars/fleet-car";
import {
  MOCK_FLEET_DRAFT_CAR_ID,
  MOCK_MINIMUM_VEHICLE_YEAR,
  MOCK_VEHICLE_VERIFICATION_ID,
  startMockFleetOwnerAuthApi,
  stopMockFleetOwnerAuthApi,
} from "./mock-fleet-owner-auth-api";

async function signInFleetOwner(context: BrowserContext, page: Page, baseURL: string) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "tripdly-cookie-consent:v1",
      JSON.stringify({ analytics: false, timestamp: 1 }),
    );
  });
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "e2e-session",
      url: baseURL,
    },
  ]);
}

const VALID_CHASSIS = "1HGCM82633A004352";

async function verifyEligibleVehicle(page: Page) {
  await page.getByLabel("Number plate").fill("kja-123ab");
  await page.getByLabel("Chassis number").fill(VALID_CHASSIS);
  await page.getByRole("button", { name: "Verify Vehicle" }).click();
  await expect(page.getByRole("heading", { name: "Vehicle Details Checked" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify Vehicle", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Number plate")).toHaveCount(0);
  await expect(page.getByLabel("Chassis number")).toHaveCount(0);
  await expect(page.getByText("Toyota Camry")).toBeVisible();
  await expect(page.getByText("KJA123AB")).toBeVisible();
  await expect(page.getByText(VALID_CHASSIS)).toBeVisible();
  await expect(page.getByText("Color")).toBeVisible();
  await expect(page.getByText("Black")).toBeVisible();
  await expect(page.getByText("Are these the correct vehicle details?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes, Add This Car" })).toBeVisible();
  await expect(page.getByRole("link", { name: "No, Check Another Car" })).toBeVisible();
}

async function expectActiveOnboardingStep(
  page: Page,
  step: "documents" | "photos" | "pricing" | "submit",
) {
  const headings = {
    documents: "Vehicle Documents",
    photos: "Vehicle Photos",
    pricing: "Pricing",
    submit: "Submit for Approval",
  } as const;
  const labels = {
    documents: "Documents",
    photos: "Photos",
    pricing: "Pricing",
    submit: "Submit",
  } as const;

  await expect(page.getByRole("heading", { name: "Set Up Toyota Camry" })).toBeVisible();
  const progress = page.getByRole("list", { name: "Car onboarding progress" });
  await expect(progress).toBeVisible();
  await expect(progress.getByRole("listitem")).toHaveCount(5);
  await expect(progress.locator('[aria-current="step"]')).toContainText(labels[step]);
  await expect(page.getByRole("heading", { name: headings[step] })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Renew Insurance" })).toHaveCount(0);
  await expect(page.getByLabel("Policy number")).toHaveCount(0);

  if (step !== "documents") {
    await expect(page.getByRole("heading", { name: "Vehicle Documents" })).toHaveCount(0);
  }
  if (step !== "photos") {
    await expect(page.getByRole("heading", { name: "Vehicle Photos" })).toHaveCount(0);
  }
  if (step !== "pricing") {
    await expect(page.getByRole("heading", { name: "Pricing" })).toHaveCount(0);
  }
  if (step !== "submit") {
    await expect(page.getByRole("heading", { name: "Submit for Approval" })).toHaveCount(0);
  }
}

test("verifies a new fleet car with plate and chassis, then opens the documents step", async ({
  baseURL,
  context,
  page,
}) => {
  const api = await startMockFleetOwnerAuthApi();

  try {
    await signInFleetOwner(context, page, baseURL ?? "http://localhost:5174");
    await page.goto("/fleet-owner/cars");
    await page.getByRole("link", { name: "Add Car" }).click();
    await expect(page).toHaveURL("/fleet-owner/cars/new");

    await expect(page.getByRole("heading", { name: "Add a Verified Car" })).toBeVisible();
    await expect(
      page.getByText(
        "Enter the Nigerian number plate and chassis number to check the vehicle details.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Use the plate and 17-character chassis number shown on your vehicle documents.",
      ),
    ).toBeVisible();

    const plateForm = page.locator("#fleet-car-plate-verification");
    const plateInput = page.getByLabel("Number plate");
    const chassisInput = page.getByLabel("Chassis number");
    await expect(plateInput).toBeVisible();
    await expect(chassisInput).toBeVisible();
    await expect(plateForm).toHaveAttribute("novalidate");
    await expect(plateInput).toHaveAttribute("required", "");
    await expect(chassisInput).toHaveAttribute("required", "");
    await expect(page.getByRole("list", { name: "Car onboarding progress" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify Vehicle" })).toBeEnabled();

    await plateInput.fill("ABC123");
    await chassisInput.fill(VALID_CHASSIS);
    await page.getByRole("button", { name: "Verify Vehicle" }).click();
    await expect(page.getByText("Enter a valid Nigerian number plate")).toBeVisible();
    await expect.poll(() => api.requests.vehicleVerifications).toEqual([]);

    await plateInput.fill("kja-123ab");
    await chassisInput.fill(`  ${VALID_CHASSIS.toLowerCase()}  `);
    await page.getByRole("button", { name: "Verify Vehicle" }).click();
    await expect(page.getByRole("button", { name: "Verifying Vehicle…" })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Vehicle Details Checked" })).toBeVisible();
    await expect(page.getByText("KJA123AB")).toBeVisible();
    await expect(page.getByText("Toyota Camry")).toBeVisible();
    await expect(page.getByText(VALID_CHASSIS)).toBeVisible();
    await expect(page.getByText("Color")).toBeVisible();
    await expect(page.getByText("Black")).toBeVisible();
    await expect(page.getByText("Are these the correct vehicle details?")).toBeVisible();
    await expect
      .poll(() => api.requests.vehicleVerifications.at(-1)?.body)
      .toEqual({ plateNumber: "KJA123AB", chassisNumber: VALID_CHASSIS });
    expect(api.requests.vehicleVerifications.at(-1)?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    await page.getByRole("button", { name: "Yes, Add This Car" }).click();
    await expect(page).toHaveURL(`/fleet-owner/cars/${MOCK_FLEET_DRAFT_CAR_ID}/onboarding`);
    await expectActiveOnboardingStep(page, "documents");
    await expect
      .poll(() => api.requests.draftCars.at(-1))
      .toEqual({
        verificationId: MOCK_VEHICLE_VERIFICATION_ID,
      });
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
test("returns to a blank verification form without creating a draft", async ({
  baseURL,
  context,
  page,
}) => {
  const api = await startMockFleetOwnerAuthApi();

  try {
    await signInFleetOwner(context, page, baseURL ?? "http://localhost:5174");
    await page.goto("/fleet-owner/cars/new");
    await verifyEligibleVehicle(page);
    await expect.poll(() => api.requests.vehicleVerifications).toHaveLength(1);
    const firstIdempotencyKey = api.requests.vehicleVerifications[0]?.idempotencyKey;
    expect(firstIdempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    await page.getByRole("link", { name: "No, Check Another Car" }).click();
    await expect(page).toHaveURL("/fleet-owner/cars/new");
    await expect(page.getByRole("heading", { name: "Add a Verified Car" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vehicle Details Checked" })).toHaveCount(0);
    await expect(page.getByText("Are these the correct vehicle details?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yes, Add This Car" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Verify Vehicle" })).toBeEnabled();
    await expect(page.getByLabel("Number plate")).toHaveValue("");
    await expect(page.getByLabel("Chassis number")).toHaveValue("");
    await expect.poll(() => api.requests.draftCars).toEqual([]);
    await verifyEligibleVehicle(page);
    await expect.poll(() => api.requests.vehicleVerifications).toHaveLength(2);
    expect(api.requests.vehicleVerifications[1]?.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(api.requests.vehicleVerifications[1]?.idempotencyKey).not.toBe(firstIdempotencyKey);
    await expect.poll(() => api.requests.draftCars).toEqual([]);
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});

test("completes the five-step car onboarding flow and redirects to car detail", async ({
  baseURL,
  context,
  page,
}) => {
  const api = await startMockFleetOwnerAuthApi();

  try {
    await signInFleetOwner(context, page, baseURL ?? "http://localhost:5174");
    await page.goto("/fleet-owner/cars/new");
    await verifyEligibleVehicle(page);
    await page.getByRole("button", { name: "Yes, Add This Car" }).click();
    await expect(page).toHaveURL(`/fleet-owner/cars/${MOCK_FLEET_DRAFT_CAR_ID}/onboarding`);
    await expectActiveOnboardingStep(page, "documents");

    await page.getByLabel("Vehicle registration").setInputFiles({
      name: "registration.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 registration"),
    });
    await page.getByLabel("MOT certificate").setInputFiles({
      name: "mot.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 mot"),
    });
    await page.getByLabel("Insurance certificate").setInputFiles({
      name: "insurance.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 insurance"),
    });
    await page.getByRole("button", { name: "Upload Documents" }).click();
    await expectActiveOnboardingStep(page, "photos");

    await page.getByLabel("Car images").setInputFiles([
      { name: "camry-front.jpg", mimeType: "image/jpeg", buffer: Buffer.from("car-front") },
      { name: "camry-side.jpg", mimeType: "image/jpeg", buffer: Buffer.from("car-side") },
    ]);
    await expect(page.getByRole("img", { name: "camry-front.jpg" })).toBeVisible();
    await expect(page.getByRole("img", { name: "camry-side.jpg" })).toBeVisible();
    await page.getByRole("button", { name: "Remove camry-side.jpg" }).click();
    await expect(page.getByRole("img", { name: "camry-side.jpg" })).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .getByLabel("Car images")
          .evaluate((input: HTMLInputElement) => input.files?.length ?? 0),
      )
      .toBe(1);
    await page.getByRole("button", { name: "Upload Images" }).click();
    await expect(page.getByText("Upload at least 3 images")).toBeVisible();
    await expectActiveOnboardingStep(page, "photos");

    await page.getByLabel("Car images").setInputFiles([
      { name: "camry-front.jpg", mimeType: "image/jpeg", buffer: Buffer.from("car-front") },
      { name: "camry-side.jpg", mimeType: "image/jpeg", buffer: Buffer.from("car-side") },
      { name: "camry-rear.jpg", mimeType: "image/jpeg", buffer: Buffer.from("car-rear") },
    ]);
    await page.getByRole("button", { name: "Upload Images" }).click();
    await expectActiveOnboardingStep(page, "pricing");

    await page.getByLabel("Hourly rate").fill("10000");
    await page.getByLabel("Daily rate (12 hours)").fill("80000");
    await page.getByLabel("Nightly rate (11pm to 5am)").fill("60000");
    await page.getByLabel("Full day rate (24 hours)").fill("150000");
    await page.getByLabel("Airport pickup rate").fill("50000");
    await page.getByLabel("Fuel upgrade rate").fill("20000");
    await page.getByRole("button", { name: "Save Pricing" }).click();
    await expectActiveOnboardingStep(page, "submit");
    await expect(page.getByRole("button", { name: "Submit Car for Approval" })).toBeVisible();

    await page.getByRole("button", { name: "Submit Car for Approval" }).click();
    await expect(page).toHaveURL(`/fleet-owner/cars/${MOCK_FLEET_DRAFT_CAR_ID}`);
    await expect(page.getByRole("heading", { name: "Toyota Camry" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Car" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Set Up Toyota Camry" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Renew Insurance" })).toHaveCount(0);
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});

test("does not show the verified result card for an ineligible vehicle", async ({
  baseURL,
  context,
  page,
}) => {
  const api = await startMockFleetOwnerAuthApi({ ineligibleVehicle: true });

  try {
    await signInFleetOwner(context, page, baseURL ?? "http://localhost:5174");
    await page.goto("/fleet-owner/cars/new");
    await page.getByLabel("Number plate").fill("kja-123ab");
    await page.getByLabel("Chassis number").fill(VALID_CHASSIS);
    await page.getByRole("button", { name: "Verify Vehicle" }).click();
    await expect(
      page.getByText(ineligibleFleetVehicleMessage(MOCK_MINIMUM_VEHICLE_YEAR)),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vehicle Details Checked" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yes, Add This Car" })).toHaveCount(0);
    await expect.poll(() => api.requests.draftCars).toEqual([]);
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
