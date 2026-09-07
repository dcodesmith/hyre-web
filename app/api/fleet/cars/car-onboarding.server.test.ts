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
  createFleetInsuranceVerification,
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

const fleetCar = {
  id: "car-1",
  make: "Toyota",
  model: "Camry",
  year: 2020,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "owner-1",
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
    id: "owner-1",
    name: "Fleet Owner",
    username: null,
    email: "owner@example.com",
  },
  images: [],
  documents: [],
  insuranceVerifications: [],
  promotion: null,
};

const insuranceVerification = {
  id: "ins-1",
  carId: "car-1",
  status: "SUCCEEDED",
  policyNumber: "POL-12345",
  policyStatus: "Active",
  policyExpiresAt: "2027-01-01T00:00:00.000Z",
  providerRef: "ins-ref",
  createdAt: "2026-09-07T12:00:00.000Z",
};

const submission = {
  success: true,
  requirements: {
    hasDocuments: true,
    hasImages: true,
    hasPricing: true,
    hasInsuranceVerification: true,
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
      body: { plateNumber: "KJA-123AB" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/vehicle-verifications");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("vehicle-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ plateNumber: "KJA-123AB" });
  });

  it("GETs vehicle verification and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(vehicleVerification));

    await getFleetVehicleVerification({ request, verificationId: "ver-1" });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/vehicle-verifications/ver-1");
    expect(init?.method).toBe("GET");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
  });

  it("POSTs a draft car from a verification", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));

    await createFleetDraftCar({ request, verificationId: "ver-1" });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/vehicle-verifications/ver-1/car");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
    expect(init?.body).toBeUndefined();
  });

  it("POSTs document multipart fields motCertificate and insuranceCertificate", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));
    const motCertificate = new File(["%PDF-1.4 mot"], "mot.pdf", { type: "application/pdf" });
    const insuranceCertificate = new File(["%PDF-1.4 ins"], "insurance.pdf", {
      type: "application/pdf",
    });

    await uploadFleetDraftCarDocuments({
      request,
      carId: "car-1",
      motCertificate,
      insuranceCertificate,
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/cars/car-1/documents");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
    const formData = init?.body as FormData;
    expect(formData.get("motCertificate")).toBe(motCertificate);
    expect(formData.get("insuranceCertificate")).toBe(insuranceCertificate);
  });

  it("POSTs images as a repeated multipart field named images", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));
    const images = [
      new File(["one"], "one.jpg", { type: "image/jpeg" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ];

    await uploadFleetDraftCarImages({ request, carId: "car-1", images });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/cars/car-1/images");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBeNull();
    const formData = init?.body as FormData;
    expect(formData.getAll("images")).toEqual(images);
  });

  it("PATCHes pricing JSON and forwards the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fleetCar));

    await updateFleetDraftCarPricing({ request, carId: "car-1", body: pricing });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/cars/car-1/pricing");
    expect(init?.method).toBe("PATCH");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(pricing);
  });

  it("POSTs insurance verification JSON with Idempotency-Key and the session cookie", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(insuranceVerification));

    await createFleetInsuranceVerification({
      request,
      carId: "car-1",
      idempotencyKey: "insurance-1",
      body: { policyNumber: "POL-12345" },
    });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/cars/car-1/insurance-verifications");
    expect(init?.method).toBe("POST");
    expect(headers.get("cookie")).toBe("better-auth.session_token=session-1");
    expect(headers.get("Idempotency-Key")).toBe("insurance-1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ policyNumber: "POL-12345" });
  });

  it("POSTs car submission without a body", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(submission));

    await submitFleetCar({ request, carId: "car-1" });

    const { url, init, headers } = capturedRequest();
    expect(url).toBe("https://api.example/api/fleet-owner/cars/car-1/submissions");
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
      "insurance verification POST",
      () =>
        createFleetInsuranceVerification({
          request,
          carId: "car/1+x",
          idempotencyKey: "insurance-1",
          body: { policyNumber: "POL-12345" },
        }),
      "https://api.example/api/fleet-owner/cars/car%2F1%2Bx/insurance-verifications",
      insuranceVerification,
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
