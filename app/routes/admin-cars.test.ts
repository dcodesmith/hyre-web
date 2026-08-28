import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  approveAdminCar,
  approveAdminCarDocument,
  approveAdminCarImage,
  getAdminCar,
  getAdminCars,
  getAdminDocument,
  rejectAdminCarDocument,
  rejectAdminCarImage,
  setAdminCarCover,
} = vi.hoisted(() => ({
  approveAdminCar: vi.fn(),
  approveAdminCarDocument: vi.fn(),
  approveAdminCarImage: vi.fn(),
  getAdminCar: vi.fn(),
  getAdminCars: vi.fn(),
  getAdminDocument: vi.fn(),
  rejectAdminCarDocument: vi.fn(),
  rejectAdminCarImage: vi.fn(),
  setAdminCarCover: vi.fn(),
}));

vi.mock("~/api/admin/documents/documents.server", () => ({ getAdminDocument }));

vi.mock("~/api/admin/cars/cars.server", () => ({
  approveAdminCar,
  approveAdminCarDocument,
  approveAdminCarImage,
  getAdminCar,
  getAdminCars,
  rejectAdminCarDocument,
  rejectAdminCarImage,
  setAdminCarCover,
}));

import type { Route as CarsRoute } from "./+types/admin.cars";
import type { Route as CarRoute } from "./+types/admin.cars.$carId";
import type { Route as DocumentRoute } from "./+types/admin.documents.$documentId";
import { loader as carsLoader } from "./admin.cars";
import { action as carAction, loader as carLoader } from "./admin.cars.$carId";
import { loader as documentLoader } from "./admin.documents.$documentId";

function carsLoaderArgs(request: Request): CarsRoute.LoaderArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/cars",
    params: {},
    context: new RouterContextProvider(),
  };
}

function carActionArgs(request: Request): CarRoute.ActionArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/cars/:carId",
    params: { carId: "car-1" },
    context: new RouterContextProvider(),
  };
}

function carLoaderArgs(request: Request): CarRoute.LoaderArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/cars/:carId",
    params: { carId: "car-1" },
    context: new RouterContextProvider(),
  };
}

function documentLoaderArgs(request: Request): DocumentRoute.LoaderArgs {
  return {
    request,
    url: new URL(request.url),
    pattern: "/admin/documents/:documentId",
    params: { documentId: "document-1" },
    context: new RouterContextProvider(),
  };
}

describe("admin cars routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the API-supported review filter and pagination", async () => {
    getAdminCars.mockResolvedValue({
      data: {
        cars: [],
        meta: { page: 2, limit: 50, total: 0, totalPages: 0 },
      },
    });
    const request = new Request(
      "https://tripdly.com/admin/cars?approvalStatus=PENDING&page=2&limit=50",
    );

    const result = await carsLoader(carsLoaderArgs(request));

    expect(getAdminCars).toHaveBeenCalledWith({
      request,
      approvalStatus: "PENDING",
      page: 2,
      limit: 50,
    });
    expect(result.query).toEqual({
      approvalStatus: "PENDING",
      page: 2,
      limit: 50,
    });
  });

  it("redirects an out-of-range page to the final available page", async () => {
    getAdminCars.mockResolvedValue({
      data: {
        cars: [],
        meta: { page: 999, limit: 20, total: 22, totalPages: 2 },
      },
    });
    const request = new Request("https://tripdly.com/admin/cars?approvalStatus=APPROVED&page=999");

    const response = await carsLoader(carsLoaderArgs(request)).catch((error) => error);

    expect(response).toBeInstanceOf(Response);
    if (!(response instanceof Response)) {
      throw new Error("Expected a redirect response");
    }
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/cars?approvalStatus=APPROVED&page=2");
  });

  it("returns only car details used by the review screen", async () => {
    getAdminCar.mockResolvedValue({
      data: {
        approvalNotes: null,
        approvalStatus: "PENDING",
        color: "Black",
        documents: [
          {
            documentType: "MOT_CERTIFICATE",
            documentUrl: "private/mot.pdf",
            id: "document-1",
            notes: null,
            status: "PENDING",
          },
        ],
        id: "car-1",
        images: [
          {
            id: "image-1",
            isPrimary: false,
            notes: null,
            status: "PENDING",
            url: "https://images.example.com/car.jpg",
          },
        ],
        make: "Lexus",
        model: "RX 350",
        owner: {
          email: "owner@example.com",
          name: "Fleet Owner",
          username: "owner",
        },
        passengerCapacity: 4,
        registrationNumber: "ABC 123",
        vehicleType: "SUV",
        year: 2023,
      },
    });

    const result = await carLoader(
      carLoaderArgs(new Request("https://tripdly.com/admin/cars/car-1")),
    );

    expect(result.car.documents[0]).not.toHaveProperty("documentUrl");
    expect(result.car).not.toHaveProperty("hourlyRate");
  });

  it("sends a trimmed image rejection reason to the API", async () => {
    rejectAdminCarImage.mockResolvedValue({ data: { success: true } });
    const request = new Request("https://tripdly.com/admin/cars/car-1", {
      method: "POST",
      body: new URLSearchParams({
        intent: "reject-image",
        assetId: "image-1",
        notes: "  Too dark  ",
      }),
    });

    const result = await carAction(carActionArgs(request));

    expect(rejectAdminCarImage).toHaveBeenCalledWith({
      request,
      carId: "car-1",
      imageId: "image-1",
      notes: "Too dark",
    });
    expect(result).toMatchObject({ data: { success: true } });
  });

  it("rejects an empty reason without calling the API", async () => {
    const request = new Request("https://tripdly.com/admin/cars/car-1", {
      method: "POST",
      body: new URLSearchParams({
        intent: "reject-document",
        assetId: "document-1",
        notes: " ",
      }),
    });

    const result = await carAction(carActionArgs(request));

    expect(rejectAdminCarDocument).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      data: { error: "Enter a rejection reason" },
      init: { status: 400 },
    });
  });

  it("uses the admin-only car approval endpoint", async () => {
    approveAdminCar.mockResolvedValue({ data: { success: true } });
    const request = new Request("https://tripdly.com/admin/cars/car-1", {
      method: "POST",
      body: new URLSearchParams({ intent: "approve-car" }),
    });

    await carAction(carActionArgs(request));

    expect(approveAdminCar).toHaveBeenCalledWith({ request, carId: "car-1" });
  });

  it("streams a guarded API document without caching it", async () => {
    getAdminDocument.mockResolvedValue(
      new Response("%PDF-1.4", {
        headers: {
          "cache-control": "max-age=300",
          "content-disposition": 'inline; filename="mot.pdf"',
          "content-type": "application/pdf",
        },
      }),
    );
    const request = new Request("https://tripdly.com/admin/documents/document-1");

    const response = await documentLoader(documentLoaderArgs(request));

    expect(getAdminDocument).toHaveBeenCalledWith({
      request,
      documentId: "document-1",
    });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="mot.pdf"');
    expect(await response.text()).toBe("%PDF-1.4");
  });
});
