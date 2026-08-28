import { createServer, type IncomingMessage, type Server } from "node:http";

export const MOCK_FLEET_CAR_ID = "cm12345678901234567890123";

const mockFleetCar = {
  id: MOCK_FLEET_CAR_ID,
  make: "Lexus",
  model: "RX 350",
  year: 2023,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "owner-1",
  registrationNumber: "ABC123XY",
  status: "AVAILABLE",
  approvalStatus: "APPROVED",
  approvalNotes: null,
  hourlyRate: 10_000,
  dayRate: 80_000,
  nightRate: 60_000,
  fuelUpgradeRate: 20_000,
  fullDayRate: 150_000,
  airportPickupRate: 50_000,
  vehicleType: "SUV",
  serviceTier: "LUXURY",
  passengerCapacity: 4,
  pricingIncludesFuel: false,
  owner: {
    id: "owner-1",
    name: "Fleet Owner",
    username: null,
    email: "owner@example.com",
  },
  images: [
    {
      id: "image-1",
      url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
      status: "APPROVED",
      isPrimary: true,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  ],
  documents: [
    {
      id: "document-1",
      documentType: "MOT_CERTIFICATE",
      status: "APPROVED",
      documentUrl: "https://cdn.example.com/mot.pdf",
      notes: null,
      approvedById: "admin-1",
      approvedAt: "2026-08-02T10:00:00.000Z",
      carId: MOCK_FLEET_CAR_ID,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-02T10:00:00.000Z",
      userId: null,
    },
  ],
  promotion: null,
};

const mockFleetCars = [
  mockFleetCar,
  {
    ...mockFleetCar,
    id: "cm22345678901234567890123",
    make: "Toyota",
    model: "Camry",
    year: 2022,
    color: "Silver",
    registrationNumber: "KJA456AB",
    status: "HOLD",
    approvalStatus: "PENDING",
    approvalNotes: "Insurance certificate is under review.",
    hourlyRate: 8_000,
    dayRate: 65_000,
    nightRate: 50_000,
    fuelUpgradeRate: null,
    fullDayRate: 120_000,
    airportPickupRate: 40_000,
    vehicleType: "SEDAN",
    serviceTier: "STANDARD",
    images: [],
    documents: [],
  },
] as const;

const mockPayouts = Array.from({ length: 21 }, (_, index) => {
  const number = index + 1;
  const isProcessing = number === 1;

  return {
    id: `payout-${String(number).padStart(2, "0")}`,
    amountToPay: 40_000 + number * 1_000,
    amountPaid: isProcessing ? 0 : 39_500 + number * 1_000,
    currency: "NGN",
    status: isProcessing ? "PROCESSING" : "PAID_OUT",
    payoutProviderReference: isProcessing ? null : `provider-${number}`,
    initiatedAt: `2026-08-${String(number).padStart(2, "0")}T10:00:00.000Z`,
    processedAt: isProcessing ? null : `2026-08-${String(number).padStart(2, "0")}T11:00:00.000Z`,
    completedAt: isProcessing ? null : `2026-08-${String(number).padStart(2, "0")}T12:00:00.000Z`,
    notes: null,
    bookingId: `booking-${number}`,
    extensionId: null,
  };
});

const emptyPayoutStatus = { count: 0, amountToPay: 0, amountPaid: 0 };

const mockPayoutSummary = {
  totalPaidOut: 1_020_000,
  pendingPayouts: 41_000,
  failedPayouts: 0,
  lastPayoutAt: "2026-08-21T12:00:00.000Z",
  statusBreakdown: {
    PENDING_APPROVAL: emptyPayoutStatus,
    PENDING_DISBURSEMENT: emptyPayoutStatus,
    PROCESSING: { count: 1, amountToPay: 41_000, amountPaid: 0 },
    PAID_OUT: { count: 20, amountToPay: 1_030_000, amountPaid: 1_020_000 },
    FAILED: emptyPayoutStatus,
    REVERSED: emptyPayoutStatus,
  },
};

const mockDashboardOverview = {
  totalBookings: 18,
  completedBookings: 12,
  activeBookings: 4,
  cancelledBookings: 2,
  carsCount: 2,
  ownerDriverTrips: 7,
  chauffeurTrips: 5,
  totalEarnings: 920_000,
  pendingPayoutAmount: 80_000,
};

const mockDashboardEarnings = {
  range: {
    from: "2026-07-29T12:00:00.000Z",
    to: "2026-08-28T12:00:00.000Z",
    groupBy: "week",
  },
  totals: {
    gross: 600_000,
    net: 540_000,
    fees: 60_000,
    refunds: 0,
    rides: 8,
  },
  series: [
    {
      bucketStart: "2026-08-17T00:00:00.000Z",
      gross: 250_000,
      net: 225_000,
      fees: 25_000,
      refunds: 0,
      rides: 3,
    },
    {
      bucketStart: "2026-08-24T00:00:00.000Z",
      gross: 350_000,
      net: 315_000,
      fees: 35_000,
      refunds: 0,
      rides: 5,
    },
  ],
};

export type CapturedAuthRequest = {
  body: unknown;
  origin?: string;
  referer?: string;
};

export type MockFleetOwnerAuthApi = {
  server: Server;
  requests: {
    createPromotions: unknown[];
    dashboardOverviewRequests: number;
    deactivatedPromotionIds: string[];
    earningsQueries: Array<Record<string, string>>;
    fleetCarsRequests: number;
    payoutQueries: Array<Record<string, string>>;
    payoutSummaryRequests: number;
    updateCars: Array<{ carId: string; body: unknown }>;
    sendOtp?: CapturedAuthRequest;
    verifyOtp?: CapturedAuthRequest;
    signOut?: CapturedAuthRequest;
  };
};

function readJson(request: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function capturedRequest(request: IncomingMessage, body: unknown): CapturedAuthRequest {
  return {
    body,
    origin: request.headers.origin,
    referer: request.headers.referer,
  };
}

function writeJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function handleFleetCarsRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
  fleetCar: typeof mockFleetCar,
) {
  const isList = path === "/api/fleet-owner/cars";
  const isDetail = path === `/api/fleet-owner/cars/${MOCK_FLEET_CAR_ID}`;
  if (!isList && !isDetail) {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (request.method === "GET" && isList) {
    requests.fleetCarsRequests += 1;
    writeJson(response, 200, [fleetCar, mockFleetCars[1]]);
    return true;
  }

  if (request.method === "GET" && isDetail) {
    writeJson(response, 200, fleetCar);
    return true;
  }

  if (request.method === "PATCH" && isDetail) {
    const body = (await readJson(request)) as Partial<typeof mockFleetCar>;
    requests.updateCars.push({ carId: MOCK_FLEET_CAR_ID, body });
    Object.assign(fleetCar, body, { updatedAt: "2026-08-28T13:00:00.000Z" });
    writeJson(response, 200, fleetCar);
    return true;
  }

  return false;
}

type MockPromotion = Record<string, unknown> & {
  id: string;
  isActive: boolean;
};

async function handlePromotionsRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
  promotions: MockPromotion[],
) {
  if (!path.startsWith("/api/fleet-owner/promotions")) {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (path === "/api/fleet-owner/promotions" && request.method === "GET") {
    writeJson(response, 200, promotions);
    return true;
  }

  if (path === "/api/fleet-owner/promotions" && request.method === "POST") {
    const body = (await readJson(request)) as {
      name?: string;
      scope: "FLEET" | "CAR";
      carId?: string;
      discountValue: number;
      startDate: string;
      endDate: string;
    };
    requests.createPromotions.push(body);

    const endDate = new Date(`${body.endDate}T00:00:00+01:00`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const promotion = {
      id: `cm${String(promotions.length + 1).padStart(23, "0")}`,
      ownerId: "owner-1",
      carId: body.scope === "CAR" ? body.carId : null,
      name: body.name ?? null,
      discountValue: String(body.discountValue),
      startDate: new Date(`${body.startDate}T00:00:00+01:00`).toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      createdAt: "2026-08-28T09:00:00.000Z",
      updatedAt: "2026-08-28T09:00:00.000Z",
      car:
        body.scope === "CAR"
          ? {
              id: MOCK_FLEET_CAR_ID,
              make: mockFleetCar.make,
              model: mockFleetCar.model,
              year: mockFleetCar.year,
              registrationNumber: mockFleetCar.registrationNumber,
            }
          : null,
    };
    promotions.push(promotion);
    const mutationResponse = { ...promotion };
    delete mutationResponse.car;
    writeJson(response, 201, mutationResponse);
    return true;
  }

  const deactivateMatch = /^\/api\/fleet-owner\/promotions\/([^/]+)\/deactivate$/.exec(path);
  if (request.method === "POST" && deactivateMatch) {
    const promotionId = decodeURIComponent(deactivateMatch[1]);
    const promotion = promotions.find((item) => item.id === promotionId);
    requests.deactivatedPromotionIds.push(promotionId);

    if (!promotion) {
      writeJson(response, 404, { status: 404, detail: "Promotion not found" });
      return true;
    }

    promotion.isActive = false;
    const mutationResponse = { ...promotion };
    delete mutationResponse.car;
    writeJson(response, 200, mutationResponse);
    return true;
  }

  return false;
}

function handleDashboardPayoutsRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockFleetOwnerAuthApi["requests"],
) {
  if (!url.pathname.startsWith("/api/dashboard/payouts") || request.method !== "GET") {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (url.pathname === "/api/dashboard/payouts/summary") {
    requests.payoutSummaryRequests += 1;
    writeJson(response, 200, mockPayoutSummary);
    return true;
  }

  if (url.pathname !== "/api/dashboard/payouts") {
    return false;
  }

  requests.payoutQueries.push(Object.fromEntries(url.searchParams));
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const status = url.searchParams.get("status");
  const payouts = status ? mockPayouts.filter((payout) => payout.status === status) : mockPayouts;
  const start = (page - 1) * limit;

  writeJson(response, 200, {
    page,
    limit,
    total: payouts.length,
    items: payouts.slice(start, start + limit),
  });
  return true;
}

function handleDashboardRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockFleetOwnerAuthApi["requests"],
) {
  if (
    request.method !== "GET" ||
    (url.pathname !== "/api/dashboard/overview" && url.pathname !== "/api/dashboard/earnings")
  ) {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (url.pathname === "/api/dashboard/overview") {
    requests.dashboardOverviewRequests += 1;
    writeJson(response, 200, mockDashboardOverview);
    return true;
  }

  requests.earningsQueries.push(Object.fromEntries(url.searchParams));
  const groupBy = url.searchParams.get("groupBy") ?? "day";
  writeJson(response, 200, {
    ...mockDashboardEarnings,
    range: {
      ...mockDashboardEarnings.range,
      groupBy,
    },
    series:
      groupBy === "month"
        ? [{ bucketStart: "2026-08-01T00:00:00.000Z", ...mockDashboardEarnings.totals }]
        : mockDashboardEarnings.series,
  });
  return true;
}

export function startMockFleetOwnerAuthApi(port = 3100) {
  const requests: MockFleetOwnerAuthApi["requests"] = {
    createPromotions: [],
    dashboardOverviewRequests: 0,
    deactivatedPromotionIds: [],
    earningsQueries: [],
    fleetCarsRequests: 0,
    payoutQueries: [],
    payoutSummaryRequests: 0,
    updateCars: [],
  };
  const promotions: MockPromotion[] = [];
  const fleetCar = structuredClone(mockFleetCar);
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    if (request.method === "POST" && path === "/api/auth/email-otp/send-verification-otp") {
      requests.sendOtp = capturedRequest(request, await readJson(request));
      writeJson(response, 200, { success: true });
      return;
    }

    if (request.method === "POST" && path === "/api/auth/sign-in/email-otp") {
      requests.verifyOtp = capturedRequest(request, await readJson(request));
      response.setHeader(
        "Set-Cookie",
        "better-auth.session_token=e2e-session; Path=/; HttpOnly; SameSite=Lax",
      );
      writeJson(response, 200, {
        user: {
          id: "owner-1",
          email: "owner@example.com",
          roles: ["fleetOwner"],
        },
      });
      return;
    }

    if (request.method === "GET" && path === "/auth/session") {
      if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
        writeJson(response, 401, { status: 401, detail: "Unauthorized" });
        return;
      }

      writeJson(response, 200, {
        user: {
          id: "owner-1",
          email: "owner@example.com",
          name: "Fleet Owner",
          roles: ["fleetOwner"],
        },
        session: {},
      });
      return;
    }

    if (await handleFleetCarsRequest(request, response, path, requests, fleetCar)) {
      return;
    }

    if (await handlePromotionsRequest(request, response, path, requests, promotions)) {
      return;
    }

    if (handleDashboardPayoutsRequest(request, response, url, requests)) {
      return;
    }

    if (handleDashboardRequest(request, response, url, requests)) {
      return;
    }

    if (request.method === "POST" && path === "/api/auth/sign-out") {
      requests.signOut = capturedRequest(request, await readJson(request));
      writeJson(response, 200, null);
      return;
    }

    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
  });

  return new Promise<MockFleetOwnerAuthApi>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, requests }));
  });
}

export function stopMockFleetOwnerAuthApi(api: MockFleetOwnerAuthApi) {
  return new Promise<void>((resolve, reject) => {
    api.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
