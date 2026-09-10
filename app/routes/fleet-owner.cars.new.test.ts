import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { createFleetDraftCar, createFleetVehicleVerification, getFleetVehicleVerification } =
  vi.hoisted(() => ({
    createFleetDraftCar: vi.fn(),
    createFleetVehicleVerification: vi.fn(),
    getFleetVehicleVerification: vi.fn(),
  }));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/fleet/cars/car-onboarding.server", () => ({
  createFleetDraftCar,
  createFleetVehicleVerification,
  getFleetVehicleVerification,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { carOnboardingPlateFormSchema } from "~/fleet/cars/car-onboarding-form-schema";
import { action, loader, shouldRevalidate } from "./fleet-owner.cars.new";

const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";
const NEXT_IDEMPOTENCY_KEY = "2b0f4d6a-8c11-4e22-9f33-a1b2c3d4e5f6";
const CAR_ONBOARDING_RETRY = "Unable to complete this car onboarding step. Please try again.";
const UNPROCESSABLE_ENTITY = 422;

const eligibleVerification = {
  id: "ver-1",
  status: "SUCCEEDED",
  vehicle: {
    plateNumber: "KJA123AB",
    chassisNumber: "1HGCM82633A004352",
    make: "Toyota",
    model: "Camry",
    year: 2020,
    color: "Black",
    passengerCapacity: 5,
  },
  eligibility: { isEligible: true, reasons: [] },
  expiresAt: "2026-09-08T12:00:00.000Z",
  carId: null,
};

const ineligibleVerification = {
  ...eligibleVerification,
  vehicle: { ...eligibleVerification.vehicle, year: 2014 },
  eligibility: { isEligible: false, reasons: ["VEHICLE_YEAR_BELOW_MINIMUM"] },
};

const fleetCar = { id: "car-1" };

const validPlateFields = {
  intent: "verify-plate",
  plateNumber: "kja-123ab",
  policyNumber: "  POL-12345  ",
  idempotencyKey: IDEMPOTENCY_KEY,
} as const;

const validDraftFields = {
  intent: "create-draft",
  verificationId: "ver-1",
} as const;

function firstIssue(schema: z.ZodType, value: unknown) {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    throw new Error("expected invalid input");
  }
  return parsed.error.issues[0]?.message ?? "";
}

const INVALID_PLATE_MESSAGE = firstIssue(carOnboardingPlateFormSchema, {
  plateNumber: "ABC123",
  policyNumber: "POL-12345",
});
const INVALID_POLICY_MESSAGE = firstIssue(carOnboardingPlateFormSchema, {
  plateNumber: "KJA123AB",
  policyNumber: "AB",
});
const MISSING_POLICY_MESSAGE = firstIssue(carOnboardingPlateFormSchema, {
  plateNumber: "KJA123AB",
});
const INVALID_UUID_MESSAGE = firstIssue(z.uuid(), "not-a-uuid");
const INVALID_VERIFICATION_ID_MESSAGE = firstIssue(z.string().trim().min(1), "");

function actionData(result: unknown) {
  return (result as { data: Record<string, unknown> }).data;
}

function apiError(status: number, detail: string, kind: "http" | "network" = "http") {
  return new ApiRequestError(kind, status, {
    type: "FLEET_CAR_ONBOARDING_ERROR",
    title: "Car onboarding error",
    status,
    detail,
  });
}

function formData(fields: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return body;
}

async function runAction(fields: Record<string, string>) {
  const request = new Request("https://tripdly.com/fleet-owner/cars/new", {
    method: "POST",
    body: formData(fields),
  });
  const result = await action({ request, params: {}, context: {} } as never).catch(
    (error: unknown) => error,
  );
  return { request, result };
}

function expectRedirect(result: unknown, location: string) {
  expect(result).toBeInstanceOf(Response);
  expect((result as Response).status).toBe(302);
  expect((result as Response).headers.get("location")).toBe(location);
}

describe("fleet-owner cars new route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createFleetVehicleVerification.mockResolvedValue({ data: eligibleVerification });
    createFleetDraftCar.mockResolvedValue({ data: fleetCar });
    getFleetVehicleVerification.mockResolvedValue({ data: eligibleVerification });
  });

  it("loads a fresh idempotency key on each GET", async () => {
    const uuid = vi
      .spyOn(crypto, "randomUUID")
      .mockReturnValueOnce(IDEMPOTENCY_KEY)
      .mockReturnValueOnce(NEXT_IDEMPOTENCY_KEY);
    const request = new Request("https://tripdly.com/fleet-owner/cars/new");

    expect(await loader({ request, params: {}, context: {} } as never)).toEqual({
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(await loader({ request, params: {}, context: {} } as never)).toEqual({
      idempotencyKey: NEXT_IDEMPOTENCY_KEY,
    });
    expect(createFleetDraftCar).not.toHaveBeenCalled();
    expect(createFleetVehicleVerification).not.toHaveBeenCalled();
    uuid.mockRestore();
  });

  it("revalidates GET navigations so No can remount the form with a new key", () => {
    expect(
      shouldRevalidate({
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
    expect(
      shouldRevalidate({
        actionResult: { revalidate: false },
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);
  });

  it("verifies and normalizes the plate, then returns an eligible verification for review", async () => {
    const { request, result } = await runAction(validPlateFields);

    expect(createFleetVehicleVerification).toHaveBeenCalledWith({
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { plateNumber: "KJA123AB", policyNumber: "POL-12345" },
    });
    expect(createFleetDraftCar).not.toHaveBeenCalled();
    expect(result).toMatchObject({ data: { verification: eligibleVerification } });
    expect(actionData(result).verification).toMatchObject({
      vehicle: { color: "Black", passengerCapacity: 5 },
    });
    expect(result).not.toBeInstanceOf(Response);
  });

  it("returns 422 for an ineligible verification and does not create a draft", async () => {
    createFleetVehicleVerification.mockResolvedValueOnce({ data: ineligibleVerification });

    const { result } = await runAction(validPlateFields);

    expect(createFleetVehicleVerification).toHaveBeenCalledOnce();
    expect(createFleetDraftCar).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: {
        error:
          "This vehicle is not eligible. Use a vehicle from 2015 or newer, or check the plate and try again.",
        revalidate: false,
        verification: ineligibleVerification,
      },
      init: { status: UNPROCESSABLE_ENTITY },
    });
  });

  it("creates a draft from the verification and redirects to onboarding", async () => {
    const { request, result } = await runAction(validDraftFields);

    expect(createFleetDraftCar).toHaveBeenCalledWith({
      request,
      verificationId: "ver-1",
    });
    expectRedirect(result, "/fleet-owner/cars/car-1/onboarding");
  });

  it.each([
    [
      "plate",
      { ...validPlateFields, plateNumber: "ABC123" },
      { plateNumber: [INVALID_PLATE_MESSAGE] },
    ],
    [
      "policy",
      { ...validPlateFields, policyNumber: "AB" },
      { policyNumber: [INVALID_POLICY_MESSAGE] },
    ],
    [
      "missing policy",
      {
        intent: "verify-plate",
        plateNumber: "kja-123ab",
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      { policyNumber: [MISSING_POLICY_MESSAGE] },
    ],
  ] as const)(
    "returns Conform field errors for an invalid verify-plate %s",
    async (_label, fields, fieldErrors) => {
      const { result } = await runAction({ ...fields });

      expect(createFleetVehicleVerification).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        data: {
          revalidate: false,
          submission: expect.objectContaining({ error: fieldErrors }),
        },
        init: { status: HTTP_STATUS.BAD_REQUEST },
      });
    },
  );

  it.each([
    [
      "verify-plate idempotency",
      { ...validPlateFields, idempotencyKey: "not-a-uuid" },
      createFleetVehicleVerification,
      INVALID_UUID_MESSAGE,
    ],
    [
      "create-draft verification",
      { intent: "create-draft", verificationId: "" },
      createFleetDraftCar,
      INVALID_VERIFICATION_ID_MESSAGE,
    ],
  ] as const)(
    "rejects invalid %s without calling the mutation API",
    async (_label, fields, mutation, error) => {
      const { result } = await runAction({ ...fields });

      expect(mutation).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        data: { error, revalidate: false },
        init: { status: HTTP_STATUS.BAD_REQUEST },
      });
    },
  );

  it.each([
    ["verify-plate", validPlateFields, createFleetVehicleVerification],
    ["create-draft", validDraftFields, createFleetDraftCar],
  ] as const)("surfaces the API 4xx detail for %s", async (_label, fields, mutation) => {
    mutation.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "This plate is already registered."),
    );

    const { result } = await runAction({ ...fields });

    expect(getFleetVehicleVerification).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: "This plate is already registered." },
      init: { status: HTTP_STATUS.CONFLICT },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
  });

  it("hides 5xx details behind a generic retry message and omits revalidate so keys can rotate", async () => {
    createFleetVehicleVerification.mockRejectedValueOnce(
      apiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"),
    );

    const { result } = await runAction(validPlateFields);

    expect(result).toMatchObject({
      data: { error: CAR_ONBOARDING_RETRY },
      init: { status: HTTP_STATUS.INTERNAL_SERVER_ERROR },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
    expect(JSON.stringify(result)).not.toContain("database exploded");
  });

  it("hides network details behind a generic retry and keeps revalidate:false", async () => {
    createFleetVehicleVerification.mockRejectedValueOnce(
      apiError(HTTP_STATUS.BAD_GATEWAY, "socket hung up", "network"),
    );

    const { result } = await runAction(validPlateFields);

    expect(getFleetVehicleVerification).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: CAR_ONBOARDING_RETRY, revalidate: false },
      init: { status: HTTP_STATUS.BAD_GATEWAY },
    });
    expect(JSON.stringify(result)).not.toContain("socket hung up");
  });

  it("redirects create-draft network ambiguity to the consumed car", async () => {
    createFleetDraftCar.mockRejectedValueOnce(
      apiError(HTTP_STATUS.BAD_GATEWAY, "socket hung up", "network"),
    );
    getFleetVehicleVerification.mockResolvedValueOnce({
      data: { ...eligibleVerification, carId: "car-1" },
    });

    const { request, result } = await runAction(validDraftFields);

    expect(createFleetDraftCar).toHaveBeenCalledWith({
      request,
      verificationId: "ver-1",
    });
    expect(getFleetVehicleVerification).toHaveBeenCalledWith({
      request,
      verificationId: "ver-1",
    });
    expectRedirect(result, "/fleet-owner/cars/car-1/onboarding");
  });

  it("returns the verification after create-draft network ambiguity when it is still unused", async () => {
    createFleetDraftCar.mockRejectedValueOnce(
      apiError(HTTP_STATUS.BAD_GATEWAY, "socket hung up", "network"),
    );

    const { request, result } = await runAction(validDraftFields);

    expect(getFleetVehicleVerification).toHaveBeenCalledWith({
      request,
      verificationId: "ver-1",
    });
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      data: { verification: eligibleVerification, revalidate: false },
    });
  });
});
