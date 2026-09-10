import { type BrowserContext, expect, type Page, test } from "@playwright/test";

import {
  MOCK_FLEET_DRAFT_CAR_ID,
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

async function verifyEligibleVehicle(page: Page) {
  await page.getByLabel("Number plate").fill("kja-123ab");
  await page.getByLabel("Insurance policy number").fill("POL-12345");
  await page.getByRole("button", { name: "Verify Vehicle" }).click();
  await expect(page.getByRole("heading", { name: "Vehicle and Insurance Verified" })).toBeVisible();
  await expect(page.getByText("Toyota Camry")).toBeVisible();
  await expect(page.getByText("KJA123AB")).toBeVisible();
  await expect(page.getByText("Color")).toBeVisible();
  await expect(page.getByText("Black")).toBeVisible();
  await expect(page.getByText("Seats")).toBeVisible();
  await expect(page.getByText("5", { exact: true })).toBeVisible();
  await expect(page.getByText("Are these the correct vehicle details?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Yes, Add This Car" })).toBeVisible();
  await expect(page.getByRole("button", { name: "No, Check Another Car" })).toBeVisible();
}

async function expectActiveOnboardingStep(
  page: Page,
  step: "documents" | "photos" | "pricing" | "submit",
  options: { insuranceRecovery?: boolean } = {},
) {
  const copy = {
    documents: { indicator: "Step 2 of 5 · Documents", heading: "Vehicle Documents" },
    photos: { indicator: "Step 3 of 5 · Photos", heading: "Vehicle Photos" },
    pricing: { indicator: "Step 4 of 5 · Pricing", heading: "Pricing" },
    submit: {
      indicator: "Step 5 of 5 · Submit",
      heading: options.insuranceRecovery ? "Renew Insurance" : "Submit for Approval",
    },
  } as const;

  await expect(page.getByRole("heading", { name: "Set Up Toyota Camry" })).toBeVisible();
  await expect(page.getByText(copy[step].indicator)).toBeVisible();
  await expect(page.getByRole("heading", { name: copy[step].heading })).toBeVisible();
  await expect(page.getByText("Step 6")).toHaveCount(0);

  if (step !== "documents") {
    await expect(page.getByRole("heading", { name: "Vehicle Documents" })).toHaveCount(0);
  }
  if (step !== "photos") {
    await expect(page.getByRole("heading", { name: "Vehicle Photos" })).toHaveCount(0);
  }
  if (step !== "pricing") {
    await expect(page.getByRole("heading", { name: "Pricing" })).toHaveCount(0);
  }
  if (step !== "submit" || options.insuranceRecovery) {
    await expect(page.getByRole("heading", { name: "Submit for Approval" })).toHaveCount(0);
  }
  if (!options.insuranceRecovery) {
    await expect(page.getByRole("heading", { name: "Renew Insurance" })).toHaveCount(0);
    await expect(page.getByLabel("Policy number")).toHaveCount(0);
  }
}

test("verifies a new fleet car with plate and policy, then opens the documents step", async ({
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
        "Enter the Nigerian number plate and insurance policy number to verify the vehicle.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Use the plate and policy number shown on your documents."),
    ).toBeVisible();

    const plateForm = page.locator("#fleet-car-plate-verification");
    const plateInput = page.getByLabel("Number plate");
    const policyInput = page.getByLabel("Insurance policy number");
    await expect(plateInput).toBeVisible();
    await expect(policyInput).toBeVisible();
    await expect(plateForm).toHaveAttribute("novalidate");
    await expect(plateInput).toHaveAttribute("required", "");
    await expect(policyInput).toHaveAttribute("required", "");
    await expect(policyInput).toHaveAttribute("minlength", "3");
    await expect(policyInput).toHaveAttribute("maxlength", "100");
    await expect(page.getByRole("button", { name: "Verify Vehicle" })).toBeEnabled();

    await plateInput.fill("ABC123");
    await policyInput.fill("POL-12345");
    await page.getByRole("button", { name: "Verify Vehicle" }).click();
    await expect(page.getByText("Enter a valid Nigerian number plate")).toBeVisible();
    await expect.poll(() => api.requests.vehicleVerifications).toEqual([]);

    await plateInput.fill("kja-123ab");
    await policyInput.fill("  POL-12345  ");
    await page.getByRole("button", { name: "Verify Vehicle" }).click();
    await expect(page.getByRole("button", { name: "Verifying Vehicle…" })).toBeDisabled();
    await expect(
      page.getByRole("heading", { name: "Vehicle and Insurance Verified" }),
    ).toBeVisible();
    await expect(page.getByText("KJA123AB")).toBeVisible();
    await expect(page.getByText("Toyota Camry")).toBeVisible();
    await expect(page.getByText("Color")).toBeVisible();
    await expect(page.getByText("Black")).toBeVisible();
    await expect(page.getByText("Seats")).toBeVisible();
    await expect(page.getByText("5", { exact: true })).toBeVisible();
    await expect(page.getByText("Are these the correct vehicle details?")).toBeVisible();
    await expect
      .poll(() => api.requests.vehicleVerifications.at(-1)?.body)
      .toEqual({ plateNumber: "KJA123AB", policyNumber: "POL-12345" });
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

    await page.getByRole("button", { name: "No, Check Another Car" }).click();
    await expect(page).toHaveURL("/fleet-owner/cars/new");
    await expect(page.getByRole("heading", { name: "Add a Verified Car" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vehicle and Insurance Verified" })).toHaveCount(
      0,
    );
    await expect(page.getByText("Are these the correct vehicle details?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Yes, Add This Car" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Verify Vehicle" })).toBeEnabled();
    await expect(page.getByLabel("Number plate")).toHaveValue("");
    await expect(page.getByLabel("Insurance policy number")).toHaveValue("");
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
    await page.getByLabel("Insurance policy number").fill("POL-12345");
    await page.getByRole("button", { name: "Verify Vehicle" }).click();
    await expect(
      page.getByText(
        "This vehicle is not eligible. Use a vehicle from 2015 or newer, or check the plate and try again.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Vehicle and Insurance Verified" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Yes, Add This Car" })).toHaveCount(0);
    await expect.poll(() => api.requests.draftCars).toEqual([]);
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});

test("recovers expired insurance inside step 5, then submits the car", async ({
  baseURL,
  context,
  page,
}) => {
  const api = await startMockFleetOwnerAuthApi({ expiredInsuranceDraft: true });

  try {
    await signInFleetOwner(context, page, baseURL ?? "http://localhost:5174");
    await page.goto(`/fleet-owner/cars/${MOCK_FLEET_DRAFT_CAR_ID}/onboarding`);
    await expectActiveOnboardingStep(page, "submit", { insuranceRecovery: true });
    await expect(
      page.getByText("Your insurance verification is missing or expired."),
    ).toBeVisible();
    await expect(page.getByLabel("Policy number")).toBeVisible();
    await expect(page.getByRole("button", { name: "Verify Insurance" })).toBeEnabled();

    await page.getByLabel("Policy number").fill("POL-RENEWED");
    await page.getByRole("button", { name: "Verify Insurance" }).click();
    await expectActiveOnboardingStep(page, "submit");
    await expect(page.getByRole("button", { name: "Submit Car for Approval" })).toBeVisible();

    await page.getByRole("button", { name: "Submit Car for Approval" }).click();
    await expect(page).toHaveURL(`/fleet-owner/cars/${MOCK_FLEET_DRAFT_CAR_ID}`);
    await expect(page.getByRole("heading", { name: "Toyota Camry" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit Car" })).toBeVisible();
  } finally {
    await stopMockFleetOwnerAuthApi(api);
  }
});
