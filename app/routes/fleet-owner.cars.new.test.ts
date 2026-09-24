import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const {
  createFleetDraftCar,
  createFleetVehicleVerification,
  getFleetCars,
  getFleetVehicleVerification,
} = vi.hoisted(() => ({
  createFleetDraftCar: vi.fn(),
  createFleetVehicleVerification: vi.fn(),
  getFleetCars: vi.fn(),
  getFleetVehicleVerification: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.invalid" },
}));

vi.mock("~/api/fleet/cars/cars.server", () => ({
  getFleetCars,
}));

vi.mock("~/api/fleet/cars/car-onboarding.server", () => ({
  createFleetDraftCar,
  createFleetVehicleVerification,
  getFleetVehicleVerification,
}));

import { ApiRequestError } from "~/api/api.server";
import { HTTP_STATUS } from "~/api/http-status";
import { carOnboardingPlateFormSchema } from "~/fleet/cars/car-onboarding-form-schema";
import { ineligibleFleetVehicleMessage } from "~/fleet/cars/fleet-car";
import type { FleetOwnerRequestContext } from "~/fleet/fleet-owner-context";
import { fleetOwnerContext } from "~/fleet/fleet-owner-context";
import { action, loader, shouldRevalidate } from "./fleet-owner.cars.new";

const IDEMPOTENCY_KEY = "18aa029c-4bb1-4ca7-b25e-cfc802c4bf8c";
const NEXT_IDEMPOTENCY_KEY = "2b0f4d6a-8c11-4e22-9f33-a1b2c3d4e5f6";
const CAR_ONBOARDING_RETRY = "Unable to complete this car onboarding step. Please try again.";
const DRAFT_RETRY = "Unable to save this car. Please try again.";
const UNPROCESSABLE_ENTITY = 422;

const eligibleVerification = {
  id: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
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
  eligibility: { isEligible: true, reasons: [], minimumYear: 2011 },
  expiresAt: "2026-09-08T12:00:00.000Z",
  carId: null,
};

const ineligibleVerification = {
  ...eligibleVerification,
  vehicle: { ...eligibleVerification.vehicle, year: 2010 },
  eligibility: { isEligible: false, reasons: ["VEHICLE_YEAR_BELOW_MINIMUM"], minimumYear: 2011 },
};

const fleetCar = { id: "018f47a2-7b3c-7d4e-8f90-123456789471" };

const validPlateFields = {
  intent: "verify-plate",
  plateNumber: "kja-123ab",
  chassisNumber: "  1hgcm82633a004352  ",
  idempotencyKey: IDEMPOTENCY_KEY,
} as const;

const validDraftFields = {
  intent: "create-draft",
  verificationId: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
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
  chassisNumber: "1HGCM82633A004352",
});
const INVALID_CHASSIS_MESSAGE = firstIssue(carOnboardingPlateFormSchema, {
  plateNumber: "KJA123AB",
  chassisNumber: "1HGCM82633A00435I",
});
const MISSING_CHASSIS_MESSAGE = firstIssue(carOnboardingPlateFormSchema, {
  plateNumber: "KJA123AB",
});
const INVALID_UUID_MESSAGE = firstIssue(z.uuid(), "not-a-uuid");

function actionData(result: unknown) {
  return (result as { data: Record<string, unknown> }).data;
}

function apiError(
  status: number,
  detail: string,
  kind: "http" | "network" | "contract" = "http",
  problem: { errorCode?: string } = {},
) {
  return new ApiRequestError(kind, status, {
    type: "FLEET_CAR_ONBOARDING_ERROR",
    title: "Car onboarding error",
    status,
    detail,
    ...problem,
  });
}

function formData(fields: Record<string, string>) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    body.set(name, value);
  }
  return body;
}

function fleetContext(isOwnerDriver = false) {
  const context = new RouterContextProvider();
  context.set(fleetOwnerContext, {
    onboarding: { isOwnerDriver },
    user: { id: "user-1", email: "owner@example.com", name: "Ada", roles: ["fleetOwner"] },
  } as FleetOwnerRequestContext);
  return context;
}

async function runAction(fields: Record<string, string>, isOwnerDriver = false) {
  const request = new Request("https://tripdly.com/fleet-owner/cars/new", {
    method: "POST",
    body: formData(fields),
  });
  const result = await action({
    request,
    params: {},
    context: fleetContext(isOwnerDriver),
  } as never).catch((error: unknown) => error);
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

    expect(await loader({ request, params: {}, context: fleetContext() } as never)).toEqual({
      idempotencyKey: IDEMPOTENCY_KEY,
    });
    expect(await loader({ request, params: {}, context: fleetContext() } as never)).toEqual({
      idempotencyKey: NEXT_IDEMPOTENCY_KEY,
    });
    expect(createFleetDraftCar).not.toHaveBeenCalled();
    expect(createFleetVehicleVerification).not.toHaveBeenCalled();
    uuid.mockRestore();
  });

  it("sends an owner-driver who already has a car back to that car", async () => {
    getFleetCars.mockResolvedValue({ data: [fleetCar] });
    const request = new Request("https://tripdly.com/fleet-owner/cars/new");
    const result = await loader({
      request,
      params: {},
      context: fleetContext(true),
    } as never).catch((error: unknown) => error);

    expectRedirect(result, `/fleet-owner/cars/${fleetCar.id}`);
    expect(createFleetDraftCar).not.toHaveBeenCalled();
  });

  it("does not create a second car for an owner-driver", async () => {
    getFleetCars.mockResolvedValue({ data: [fleetCar] });
    const { result } = await runAction(validDraftFields, true);

    expectRedirect(result, `/fleet-owner/cars/${fleetCar.id}`);
    expect(createFleetDraftCar).not.toHaveBeenCalled();
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
      body: { plateNumber: "KJA123AB", chassisNumber: "1HGCM82633A004352" },
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
        error: ineligibleFleetVehicleMessage(2011),
        revalidate: false,
        verification: ineligibleVerification,
      },
      init: { status: UNPROCESSABLE_ENTITY },
    });
  });

  it("uses the API minimum year in the ineligible-vehicle message", async () => {
    const verification = {
      ...ineligibleVerification,
      eligibility: { ...ineligibleVerification.eligibility, minimumYear: 2012 },
    };
    createFleetVehicleVerification.mockResolvedValueOnce({ data: verification });

    const { result } = await runAction(validPlateFields);

    expect(actionData(result).error).toBe(ineligibleFleetVehicleMessage(2012));
    expect(createFleetDraftCar).not.toHaveBeenCalled();
  });

  it("retries verify-plate with a new key when the previous chassis used the same key", async () => {
    createFleetVehicleVerification
      .mockRejectedValueOnce(
        apiError(
          HTTP_STATUS.CONFLICT,
          "This Idempotency-Key was already used with a different request",
          "http",
          { errorCode: "VERIFICATION_IDEMPOTENCY_KEY_REUSED" },
        ),
      )
      .mockResolvedValueOnce({ data: eligibleVerification });
    const uuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(NEXT_IDEMPOTENCY_KEY);

    const { request, result } = await runAction(validPlateFields);

    expect(createFleetVehicleVerification).toHaveBeenNthCalledWith(1, {
      request,
      idempotencyKey: IDEMPOTENCY_KEY,
      body: { plateNumber: "KJA123AB", chassisNumber: "1HGCM82633A004352" },
    });
    expect(createFleetVehicleVerification).toHaveBeenNthCalledWith(2, {
      request,
      idempotencyKey: NEXT_IDEMPOTENCY_KEY,
      body: { plateNumber: "KJA123AB", chassisNumber: "1HGCM82633A004352" },
    });
    expect(result).toMatchObject({ data: { verification: eligibleVerification } });
    expect(JSON.stringify(result)).not.toContain("Idempotency-Key");
    uuid.mockRestore();
  });

  it("creates a draft from the verification and redirects to onboarding", async () => {
    const { request, result } = await runAction(validDraftFields);

    expect(createFleetDraftCar).toHaveBeenCalledWith({
      request,
      verificationId: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
    });
    expectRedirect(result, "/fleet-owner/cars/018f47a2-7b3c-7d4e-8f90-123456789471/onboarding");
  });

  it.each([
    [
      "plate",
      { ...validPlateFields, plateNumber: "ABC123" },
      { plateNumber: [INVALID_PLATE_MESSAGE] },
    ],
    [
      "chassis",
      { ...validPlateFields, chassisNumber: "1HGCM82633A00435I" },
      { chassisNumber: [INVALID_CHASSIS_MESSAGE] },
    ],
    [
      "missing chassis",
      {
        intent: "verify-plate",
        plateNumber: "kja-123ab",
        idempotencyKey: IDEMPOTENCY_KEY,
      },
      { chassisNumber: [MISSING_CHASSIS_MESSAGE] },
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
      INVALID_UUID_MESSAGE,
    ],
    [
      "create-draft non-UUID verification",
      { intent: "create-draft", verificationId: "verification-1" },
      createFleetDraftCar,
      INVALID_UUID_MESSAGE,
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

  it("surfaces the API 4xx detail for verify-plate", async () => {
    createFleetVehicleVerification.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "This plate is already registered."),
    );

    const { result } = await runAction(validPlateFields);

    expect(getFleetVehicleVerification).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: "This plate is already registered." },
      init: { status: HTTP_STATUS.CONFLICT },
    });
    expect(actionData(result)).not.toHaveProperty("revalidate");
  });

  it("keeps create-draft on the verification after a 4xx save failure", async () => {
    createFleetDraftCar.mockRejectedValueOnce(
      apiError(HTTP_STATUS.CONFLICT, "This plate is already registered."),
    );

    const { result } = await runAction(validDraftFields);

    expect(getFleetVehicleVerification).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      data: {
        error: "This plate is already registered.",
        revalidate: false,
        verification: eligibleVerification,
      },
      init: { status: HTTP_STATUS.CONFLICT },
    });
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

  it.each([
    ["network", "network", HTTP_STATUS.BAD_GATEWAY, "socket hung up"] as const,
    ["5xx", "http", HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"] as const,
    ["contract", "contract", HTTP_STATUS.BAD_GATEWAY, "unexpected response shape"] as const,
  ])(
    "redirects create-draft %s failure when the verification was consumed",
    async (_label, kind, status, detail) => {
      createFleetDraftCar.mockRejectedValueOnce(apiError(status, detail, kind));
      getFleetVehicleVerification.mockResolvedValueOnce({
        data: { ...eligibleVerification, carId: "018f47a2-7b3c-7d4e-8f90-123456789471" },
      });

      const { request, result } = await runAction(validDraftFields);

      expect(createFleetDraftCar).toHaveBeenCalledWith({
        request,
        verificationId: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
      });
      expect(getFleetVehicleVerification).toHaveBeenCalledWith({
        request,
        verificationId: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
      });
      expectRedirect(result, "/fleet-owner/cars/018f47a2-7b3c-7d4e-8f90-123456789471/onboarding");
    },
  );

  it.each([
    ["network", "network", HTTP_STATUS.BAD_GATEWAY, "socket hung up"] as const,
    ["5xx", "http", HTTP_STATUS.INTERNAL_SERVER_ERROR, "database exploded"] as const,
    ["contract", "contract", HTTP_STATUS.BAD_GATEWAY, "unexpected response shape"] as const,
  ])(
    "keeps create-draft on the verification after a %s save failure",
    async (_label, kind, status, detail) => {
      createFleetDraftCar.mockRejectedValueOnce(apiError(status, detail, kind));

      const { result } = await runAction(validDraftFields);

      expect(getFleetVehicleVerification).toHaveBeenCalledWith({
        request: expect.any(Request),
        verificationId: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
      });
      expect(result).not.toBeInstanceOf(Response);
      expect(result).toMatchObject({
        data: {
          error: DRAFT_RETRY,
          revalidate: false,
          verification: eligibleVerification,
        },
      });
      expect(JSON.stringify(result)).not.toContain(detail);
    },
  );
});
