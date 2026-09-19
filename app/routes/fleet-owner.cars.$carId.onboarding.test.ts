import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const {
  getFleetCar,
  submitFleetCar,
  updateFleetDraftCarPricing,
  uploadFleetDraftCarDocuments,
  uploadFleetDraftCarImages,
} = vi.hoisted(() => ({
  getFleetCar: vi.fn(),
  submitFleetCar: vi.fn(),
  updateFleetDraftCarPricing: vi.fn(),
  uploadFleetDraftCarDocuments: vi.fn(),
  uploadFleetDraftCarImages: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/fleet/cars/cars.server", () => ({ getFleetCar }));

vi.mock("~/api/fleet/cars/car-onboarding.server", () => ({
  submitFleetCar,
  updateFleetDraftCarPricing,
  uploadFleetDraftCarDocuments,
  uploadFleetDraftCarImages,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import {
  carOnboardingDocumentsFormSchema,
  carOnboardingImagesFormSchema,
  carOnboardingPricingFormSchema,
} from "~/fleet/cars/car-onboarding-form-schema";
import { action, loader } from "./fleet-owner.cars.$carId.onboarding";

const CAR_ID = "018f47a2-7b3c-7d4e-8f90-123456789471";
const CAR_ONBOARDING_RETRY = "Unable to complete this car onboarding step. Please try again.";
const ONBOARDING_PATH = `/fleet-owner/cars/${CAR_ID}/onboarding`;
const CAR_DETAIL_PATH = `/fleet-owner/cars/${CAR_ID}`;

const fleetCar = {
  id: CAR_ID,
  make: "Toyota",
  model: "Camry",
  year: 2020,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "018f47a2-7b3c-7d4e-8f90-123456789461",
  registrationNumber: "KJA123AB",
  status: "HOLD",
  approvalStatus: "PENDING",
  approvalNotes: null,
  hourlyRate: null,
  dayRate: null,
  nightRate: null,
  fuelUpgradeRate: null,
  fullDayRate: null,
  airportPickupRate: null,
  vehicleType: "SEDAN",
  serviceTier: "STANDARD",
  passengerCapacity: 5,
  pricingIncludesFuel: false,
  submittedAt: null,
  owner: {
    id: "018f47a2-7b3c-7d4e-8f90-123456789461",
    name: "Fleet Owner",
    username: null,
    email: "owner@example.com",
  },
  images: [],
  documents: [],
  promotion: null,
};

const pricing = {
  hourlyRate: 10_000,
  dayRate: 80_000,
  nightRate: 60_000,
  fullDayRate: 150_000,
  airportPickupRate: 50_000,
  fuelUpgradeRate: 20_000,
  pricingIncludesFuel: false,
  vehicleType: "SEDAN" as const,
  serviceTier: "STANDARD" as const,
  passengerCapacity: 5,
};

const validPricingFields = {
  intent: "save-pricing",
  hourlyRate: "10000",
  dayRate: "80000",
  nightRate: "60000",
  fullDayRate: "150000",
  airportPickupRate: "50000",
  fuelUpgradeRate: "20000",
  vehicleType: "SEDAN",
  serviceTier: "STANDARD",
  passengerCapacity: "5",
} as const;

function firstIssue(schema: z.ZodType, value: unknown) {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    throw new Error("expected invalid input");
  }
  return parsed.error.issues[0]?.message ?? "";
}

const INVALID_DOCUMENT_MESSAGE = firstIssue(carOnboardingDocumentsFormSchema, {
  vehicleRegistration: pdf("registration.pdf"),
  motCertificate: image("mot.jpg"),
  insuranceCertificate: pdf("insurance.pdf"),
});
const INVALID_IMAGE_MESSAGE = firstIssue(carOnboardingImagesFormSchema, {
  images: [
    image("car.gif", "image/gif"),
    image("car-2.gif", "image/gif"),
    image("car-3.gif", "image/gif"),
  ],
});
const INVALID_PRICING_MESSAGE = firstIssue(carOnboardingPricingFormSchema, {
  ...validPricingFields,
  hourlyRate: "0",
});

function actionData(result: unknown) {
  return (result as { data: Record<string, unknown> }).data;
}

function pdf(name: string) {
  return new File(["%PDF-1.4"], name, { type: "application/pdf" });
}

function image(name: string, type = "image/jpeg") {
  return new File(["img"], name, { type });
}

function apiError(status: number, detail: string, kind: "http" | "network" = "http") {
  return new ApiRequestError(kind, status, {
    type: "FLEET_CAR_ONBOARDING_ERROR",
    title: "Car onboarding error",
    status,
    detail,
  });
}

function formData(fields: Record<string, File | readonly File[] | string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === "string" || value instanceof File) {
      body.set(name, value);
    } else {
      for (const file of value) body.append(name, file);
    }
  }
  return body;
}

async function runAction(fields: Record<string, File | readonly File[] | string>) {
  const request = new Request(`https://tripdly.com${ONBOARDING_PATH}`, {
    method: "POST",
    body: formData(fields),
  });
  const result = await action({
    request,
    params: { carId: CAR_ID },
    context: {},
  } as never).catch((error: unknown) => error);
  return { request, result };
}

function expectRedirect(result: unknown, location: string) {
  expect(result).toBeInstanceOf(Response);
  expect((result as Response).status).toBe(302);
  expect((result as Response).headers.get("location")).toBe(location);
}

describe("fleet-owner car onboarding route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFleetCar.mockResolvedValue({ data: fleetCar });
    uploadFleetDraftCarDocuments.mockResolvedValue({ data: fleetCar });
    uploadFleetDraftCarImages.mockResolvedValue({ data: fleetCar });
    updateFleetDraftCarPricing.mockResolvedValue({ data: fleetCar });
    submitFleetCar.mockResolvedValue({
      data: {
        success: true,
        requirements: {
          hasDocuments: true,
          hasImages: true,
          hasPricing: true,
        },
      },
    });
  });

  it("loads the existing fleet car without an insurance-recovery key", async () => {
    const request = new Request(`https://tripdly.com${ONBOARDING_PATH}`);

    const result = await loader({
      request,
      params: { carId: CAR_ID },
      context: {},
    } as never);

    expect(getFleetCar).toHaveBeenCalledWith({ request, carId: CAR_ID });
    expect(result).toEqual({ car: fleetCar });
  });

  it("redirects already-submitted cars to car detail", async () => {
    getFleetCar.mockResolvedValueOnce({
      data: { ...fleetCar, submittedAt: "2026-09-07T12:00:00.000Z" },
    });
    const request = new Request(`https://tripdly.com${ONBOARDING_PATH}`);

    const result = await loader({
      request,
      params: { carId: CAR_ID },
      context: {},
    } as never);

    expectRedirect(result, CAR_DETAIL_PATH);
  });

  it("uploads registration, MOT, and insurance PDFs, then redirects back to onboarding", async () => {
    const { request, result } = await runAction({
      intent: "upload-documents",
      vehicleRegistration: pdf("registration.pdf"),
      motCertificate: pdf("mot.pdf"),
      insuranceCertificate: pdf("insurance.pdf"),
    });

    expect(uploadFleetDraftCarDocuments).toHaveBeenCalledWith({
      request,
      carId: CAR_ID,
      vehicleRegistration: expect.any(File),
      motCertificate: expect.any(File),
      insuranceCertificate: expect.any(File),
    });
    const sent = uploadFleetDraftCarDocuments.mock.calls[0][0];
    expect(sent.vehicleRegistration.name).toBe("registration.pdf");
    expect(sent.motCertificate.name).toBe("mot.pdf");
    expect(sent.motCertificate.type).toBe("application/pdf");
    expect(sent.insuranceCertificate.name).toBe("insurance.pdf");
    expectRedirect(result, ONBOARDING_PATH);
  });

  it("uploads images, then redirects back to onboarding", async () => {
    const { request, result } = await runAction({
      intent: "upload-images",
      images: [image("one.jpg"), image("two.png", "image/png"), image("three.webp", "image/webp")],
    });

    expect(uploadFleetDraftCarImages).toHaveBeenCalledWith({
      request,
      carId: CAR_ID,
      images: [expect.any(File), expect.any(File), expect.any(File)],
    });
    const sent = uploadFleetDraftCarImages.mock.calls[0][0].images as File[];
    expect(sent.map((file) => file.name)).toEqual(["one.jpg", "two.png", "three.webp"]);
    expect(sent.map((file) => file.type)).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expectRedirect(result, ONBOARDING_PATH);
  });

  it.each([
    [1, [image("one.jpg")]],
    [2, [image("one.jpg"), image("two.jpg")]],
  ] as const)("rejects an upload containing only %i image(s)", async (_count, images) => {
    const { result } = await runAction({ intent: "upload-images", images });

    expect(uploadFleetDraftCarImages).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        intent: "upload-images",
        revalidate: false,
        submission: expect.objectContaining({
          error: { images: ["Upload at least 3 images"] },
        }),
      },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
  });

  it("saves coerced pricing, then redirects back to onboarding", async () => {
    const { request, result } = await runAction(validPricingFields);

    expect(updateFleetDraftCarPricing).toHaveBeenCalledWith({
      request,
      carId: CAR_ID,
      body: pricing,
    });
    expectRedirect(result, ONBOARDING_PATH);
  });

  it("returns a 400 for an unsupported intent instead of a gateway error", async () => {
    const { result } = await runAction({ intent: "not-a-step" });

    expect(result).toMatchObject({
      data: { error: "Unsupported car onboarding step.", revalidate: false },
      init: { status: HTTP_STATUS.BAD_REQUEST },
    });
    expect(JSON.stringify(result)).not.toContain(CAR_ONBOARDING_RETRY);
  });

  it("submits the car and redirects to car detail", async () => {
    const { request, result } = await runAction({ intent: "submit-car" });

    expect(submitFleetCar).toHaveBeenCalledWith({ request, carId: CAR_ID });
    expectRedirect(result, CAR_DETAIL_PATH);
  });

  it.each([
    [
      "upload-documents files",
      {
        intent: "upload-documents",
        vehicleRegistration: pdf("registration.pdf"),
        motCertificate: image("mot.jpg"),
        insuranceCertificate: pdf("insurance.pdf"),
      },
      uploadFleetDraftCarDocuments,
      "upload-documents",
      { motCertificate: [INVALID_DOCUMENT_MESSAGE] },
    ],
    [
      "upload-images files",
      {
        intent: "upload-images",
        images: [
          image("car.gif", "image/gif"),
          image("car-2.gif", "image/gif"),
          image("car-3.gif", "image/gif"),
        ],
      },
      uploadFleetDraftCarImages,
      "upload-images",
      { images: [INVALID_IMAGE_MESSAGE, INVALID_IMAGE_MESSAGE, INVALID_IMAGE_MESSAGE] },
    ],
    [
      "save-pricing fields",
      { ...validPricingFields, hourlyRate: "0" },
      updateFleetDraftCarPricing,
      "save-pricing",
      { hourlyRate: [INVALID_PRICING_MESSAGE] },
    ],
  ] as const)(
    "returns Conform field errors for invalid %s",
    async (_label, fields, mutation, intent, fieldErrors) => {
      const { result } = await runAction({ ...fields });

      expect(mutation).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        data: {
          intent,
          revalidate: false,
          submission: expect.objectContaining({ error: fieldErrors }),
        },
        init: { status: HTTP_STATUS.BAD_REQUEST },
      });
    },
  );

  it.each([
    [
      "upload-documents",
      () => ({
        intent: "upload-documents",
        vehicleRegistration: pdf("registration.pdf"),
        motCertificate: pdf("mot.pdf"),
        insuranceCertificate: pdf("insurance.pdf"),
      }),
      uploadFleetDraftCarDocuments,
    ],
    [
      "upload-images",
      () => ({
        intent: "upload-images",
        images: [image("one.jpg"), image("two.jpg"), image("three.jpg")],
      }),
      uploadFleetDraftCarImages,
    ],
    ["save-pricing", () => validPricingFields, updateFleetDraftCarPricing],
    ["submit-car", () => ({ intent: "submit-car" }), submitFleetCar],
  ] as const)("surfaces the API 4xx detail for %s", async (_label, fields, mutation) => {
    mutation.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "This car already has documents."),
    );

    const { result } = await runAction(fields());

    expect(result).toMatchObject({
      data: { error: "This car already has documents." },
      init: { status: HTTP_STATUS.CONFLICT },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
  });

  it("hides 5xx details behind a generic retry message and omits revalidate so keys can rotate", async () => {
    submitFleetCar.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    const { result } = await runAction({ intent: "submit-car" });

    expect(result).toMatchObject({
      data: { error: CAR_ONBOARDING_RETRY },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
    expect(JSON.stringify(result)).not.toContain("database exploded");
  });

  it("hides network details behind a generic retry and keeps revalidate:false", async () => {
    submitFleetCar.mockRejectedValueOnce(
      apiError(HTTP_STATUS.BAD_GATEWAY, "socket hung up", "network"),
    );

    const { result } = await runAction({ intent: "submit-car" });

    expect(result).toMatchObject({
      data: { error: CAR_ONBOARDING_RETRY, revalidate: false },
      init: { status: HTTP_STATUS.BAD_GATEWAY },
    });
    expect(JSON.stringify(result)).not.toContain("socket hung up");
  });
});
