import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.mock("cloudflare:workers", () => ({
  env: { API_ORIGIN: "https://api.example" },
}));

vi.stubGlobal("fetch", fetchMock);

import {
  createFleetDraftCar,
  createFleetVehicleVerification,
  getFleetVehicleVerification,
  submitFleetCar,
  updateFleetDraftCarPricing,
  uploadFleetDraftCarDocuments,
  uploadFleetDraftCarImages,
} from "./car-onboarding.server";

const request = new Request("https://tripdly.com/fleet-owner/cars/new", {
  headers: { cookie: "better-auth.session_token=session-1" },
});

const vehicleVerification = {
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

const fleetCar = {
  id: "018f47a2-7b3c-7d4e-8f90-123456789471",
  publicRef: "0123456789abc471",
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
  submittedAt: null,
  hourlyRate: 10_000,
  dayRate: 80_000,
  nightRate: 60_000,
  fuelUpgradeRate: 20_000,
  fullDayRate: 150_000,
  airportPickupRate: 50_000,
  vehicleType: "SEDAN",
  serviceTier: "STANDARD",
  passengerCapacity: 5,
  pricingIncludesFuel: false,
  owner: {
    id: "018f47a2-7b3c-7d4e-8f90-123456789461",
    name: "Fleet Owner",
    username: null,
    email: "owner@example.com",
  },
  images: [],
  documents: [],
  insuranceVerifications: [],
  promotion: null,
};

const submission = {
  success: true,
  requirements: {
    hasDocuments: true,
    hasImages: true,
    hasPricing: true,
  },
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

function capturedRequest() {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return { url: String(url), init, headers: new Headers(init?.headers) };
}

describe("fleet car onboarding BFF", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("POSTs vehicle verification JSON with Idempotency-Key and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(vehicleVerification));

    await createFleetVehicleVerification({
      request,
      idempotencyKey: "vehicle-1",
      body: { plateNumber: "KJA-123AB", chassisNumber: "1HGCM82633A004352" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/vehicle-verifications");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("vehicle-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      plateNumber: "KJA-123AB",
      chassisNumber: "1HGCM82633A004352",
    });
  });

  it("GETs vehicle verification and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(vehicleVerification));

    await getFleetVehicleVerification({
      request,
      verificationId: "018f47a2-7b3c-7d4e-8f90-1234567894f5",
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(
      `https://api.example/api/fleet-owner/vehicle-verifications/${vehicleVerification.id}`,
    );
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
  });

  it("POSTs a draft car from a verification", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));

    await createFleetDraftCar({ request, verificationId: "018f47a2-7b3c-7d4e-8f90-1234567894f5" });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(
      `https://api.example/api/fleet-owner/vehicle-verifications/${vehicleVerification.id}/car`,
    );
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
    expect(init?.body).toBeUndefined();
  });

  it("POSTs document multipart fields for registration, MOT, and insurance", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));
    const vehicleRegistration = new File(["%PDF-1.4 reg"], "registration.pdf", {
      type: "application/pdf",
    });
    const motCertificate = new File(["%PDF-1.4 mot"], "mot.pdf", { type: "application/pdf" });
    const insuranceCertificate = new File(["%PDF-1.4 ins"], "insurance.pdf", {
      type: "application/pdf",
    });

    await uploadFleetDraftCarDocuments({
      request,
      carId: "018f47a2-7b3c-7d4e-8f90-123456789471",
      vehicleRegistration,
      motCertificate,
      insuranceCertificate,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(`https://api.example/api/fleet-owner/cars/${fleetCar.id}/documents`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
    const formData = init?.body as FormData;
    expect(formData.get("vehicleRegistration")).toBe(vehicleRegistration);
    expect(formData.get("motCertificate")).toBe(motCertificate);
    expect(formData.get("insuranceCertificate")).toBe(insuranceCertificate);
  });

  it("POSTs images as a repeated multipart field named images", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));
    const images = [
      new File(["one"], "one.jpg", { type: "image/jpeg" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ];

    await uploadFleetDraftCarImages({
      request,
      carId: "018f47a2-7b3c-7d4e-8f90-123456789471",
      images,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(`https://api.example/api/fleet-owner/cars/${fleetCar.id}/images`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
    const formData = init?.body as FormData;
    expect(formData.getAll("images")).toEqual(images);
  });

  it("PATCHes pricing JSON and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));

    await updateFleetDraftCarPricing({
      request,
      carId: "018f47a2-7b3c-7d4e-8f90-123456789471",
      body: pricing,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(`https://api.example/api/fleet-owner/cars/${fleetCar.id}/pricing`);
    expect(init?.method).toBe("PATCH");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(pricing);
  });

  it("POSTs car submission without a body", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(submission));

    await submitFleetCar({ request, carId: "018f47a2-7b3c-7d4e-8f90-123456789471" });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe(`https://api.example/api/fleet-owner/cars/${fleetCar.id}/submissions`);
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
    expect(init?.body).toBeUndefined();
  });

  it.each([
    [
      "vehicle verification GET",
      () => getFleetVehicleVerification({ request, verificationId: "ver/1+x" }),
      "https://api.example/api/fleet-owner/vehicle-verifications/ver%2F1%2Bx",
      vehicleVerification,
    ],
    [
      "draft car POST",
      () => createFleetDraftCar({ request, verificationId: "ver/1+x" }),
      "https://api.example/api/fleet-owner/vehicle-verifications/ver%2F1%2Bx/car",
      fleetCar,
    ],
    [
      "document upload",
      () =>
        uploadFleetDraftCarDocuments({
          request,
          carId: "car/1+x",
          vehicleRegistration: new File(["%PDF-1.4 reg"], "registration.pdf", {
            type: "application/pdf",
          }),
          motCertificate: new File(["%PDF-1.4 mot"], "mot.pdf", { type: "application/pdf" }),
          insuranceCertificate: new File(["%PDF-1.4 ins"], "insurance.pdf", {
            type: "application/pdf",
          }),
        }),
      "https://api.example/api/fleet-owner/cars/car%2F1%2Bx/documents",
      fleetCar,
    ],
    [
      "image upload",
      () =>
        uploadFleetDraftCarImages({
          request,
          carId: "car/1+x",
          images: [new File(["one"], "one.jpg", { type: "image/jpeg" })],
        }),
      "https://api.example/api/fleet-owner/cars/car%2F1%2Bx/images",
      fleetCar,
    ],
    [
      "pricing PATCH",
      () => updateFleetDraftCarPricing({ request, carId: "car/1+x", body: pricing }),
      "https://api.example/api/fleet-owner/cars/car%2F1%2Bx/pricing",
      fleetCar,
    ],
    [
      "car submission POST",
      () => submitFleetCar({ request, carId: "car/1+x" }),
      "https://api.example/api/fleet-owner/cars/car%2F1%2Bx/submissions",
      submission,
    ],
  ] as const)("URL-encodes %s path segments", async (_label, invoke, url, body) => {
    fetchMock.mockResolvedValueOnce(Response.json(body));

    await invoke();

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(url);
  });
});
