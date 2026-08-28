import { createServer, type IncomingMessage, type Server } from "node:http";

type PortalRole = "admin" | "staff";

const ADMIN_SESSION_COOKIE = "better-auth.session_token=admin-e2e-session";

export const MOCK_ADMIN_CAR_ID = "cm12345678901234567890123";
export const MOCK_ADMIN_IMAGE_ID = "cm22345678901234567890123";
export const MOCK_ADMIN_DOCUMENT_ID = "cm32345678901234567890123";
export const MOCK_ADDON_RATE_ID = "cm42345678901234567890123";

type CapturedRequest = {
  body: unknown;
  origin?: string;
  referer?: string;
};

type CapturedCarAction = {
  body: unknown;
  method: string;
  path: string;
};

export type MockAdminAuthApi = {
  server: Server;
  requests: {
    carActions: CapturedCarAction[];
    carListQuery?: string;
    rateActions: CapturedCarAction[];
    sendOtp?: CapturedRequest;
    signOut?: CapturedRequest;
    verifyOtp?: CapturedRequest;
  };
};

const mockAdminCar = {
  id: MOCK_ADMIN_CAR_ID,
  make: "Lexus",
  model: "RX 350",
  year: 2023,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "owner-1",
  registrationNumber: "ABC123XY",
  status: "AVAILABLE",
  approvalStatus: "PENDING",
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
      id: MOCK_ADMIN_IMAGE_ID,
      url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
      status: "PENDING",
      isPrimary: false,
      notes: null,
      approvedById: null,
      approvedAt: null,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  ],
  documents: [
    {
      id: MOCK_ADMIN_DOCUMENT_ID,
      documentType: "MOT_CERTIFICATE",
      status: "PENDING",
      documentUrl: "owner-1/cm12345678901234567890123/documents/mot.pdf",
      notes: null,
      approvedById: null,
      approvedAt: null,
      carId: MOCK_ADMIN_CAR_ID,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      userId: null,
    },
  ],
};

const mockAdminRates = {
  platformFeeRates: [
    {
      id: "cm52345678901234567890123",
      feeType: "PLATFORM_SERVICE_FEE",
      ratePercent: 10,
      effectiveSince: "2026-01-01T00:00:00.000Z",
      effectiveUntil: "2026-12-31T23:59:59.000Z",
      description: "Customer service fee",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      active: true,
    },
    {
      id: "cm62345678901234567890123",
      feeType: "FLEET_OWNER_COMMISSION",
      ratePercent: 5,
      effectiveSince: "2026-01-01T00:00:00.000Z",
      effectiveUntil: "2026-12-31T23:59:59.000Z",
      description: "Fleet owner commission",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      active: true,
    },
  ],
  taxRates: [
    {
      id: "cm72345678901234567890123",
      ratePercent: 7.5,
      effectiveSince: "2026-01-01T00:00:00.000Z",
      effectiveUntil: "2026-12-31T23:59:59.000Z",
      description: "Nigerian VAT",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      active: true,
    },
  ],
  addonRates: [
    {
      id: MOCK_ADDON_RATE_ID,
      addonType: "SECURITY_DETAIL",
      rateAmount: 15_000,
      effectiveSince: "2026-01-01T00:00:00.000Z",
      effectiveUntil: "2026-12-31T23:59:59.000Z",
      description: "Security detail per booking leg",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      active: true,
    },
  ],
};

const mockRateTypeFields: Record<string, Record<string, string | number>> = {
  "/api/rates/platform-fee": { feeType: "PLATFORM_SERVICE_FEE", ratePercent: 12 },
  "/api/rates/vat": { ratePercent: 8 },
  "/api/rates/addon": { addonType: "SECURITY_DETAIL", rateAmount: 20_000 },
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

function capturedRequest(request: IncomingMessage, body: unknown): CapturedRequest {
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

function hasAdminSession(request: IncomingMessage) {
  return request.headers.cookie
    ?.split(";")
    .some((cookie) => cookie.trim() === ADMIN_SESSION_COOKIE);
}

async function handleAdminCarRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockAdminAuthApi["requests"],
) {
  const path = url.pathname;
  const isAdminCarPath =
    path === "/api/admin/cars" ||
    path.startsWith("/api/admin/cars/") ||
    path.startsWith("/api/admin/documents/") ||
    path.startsWith("/api/proxy-pdf/");

  if (!isAdminCarPath) {
    return false;
  }

  if (!hasAdminSession(request)) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (request.method === "GET" && path === "/api/admin/cars") {
    requests.carListQuery = url.search;
    writeJson(response, 200, {
      cars: [mockAdminCar],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    return true;
  }

  if (request.method === "GET" && path === `/api/admin/cars/${MOCK_ADMIN_CAR_ID}`) {
    writeJson(response, 200, mockAdminCar);
    return true;
  }

  if (request.method === "GET" && path === `/api/proxy-pdf/${MOCK_ADMIN_DOCUMENT_ID}`) {
    response.writeHead(200, {
      "content-disposition": 'inline; filename="mot.pdf"',
      "content-type": "application/pdf",
    });
    response.end("%PDF-1.4 mock");
    return true;
  }

  if (
    request.method === "POST" &&
    path === `/api/admin/cars/${MOCK_ADMIN_CAR_ID}/images/${MOCK_ADMIN_IMAGE_ID}/approve`
  ) {
    requests.carActions.push({ body: null, method: request.method, path });
    writeJson(response, 201, { success: true });
    return true;
  }

  if (
    request.method === "POST" &&
    path === `/api/admin/documents/${MOCK_ADMIN_DOCUMENT_ID}/reject`
  ) {
    requests.carActions.push({
      body: await readJson(request),
      method: request.method,
      path,
    });
    writeJson(response, 201, { success: true });
    return true;
  }

  return false;
}

async function handleAdminRateRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockAdminAuthApi["requests"],
  sessionRole: PortalRole,
) {
  const path = url.pathname;
  if (!path.startsWith("/api/rates")) {
    return false;
  }

  if (!hasAdminSession(request)) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }
  if (sessionRole !== "admin") {
    writeJson(response, 403, { status: 403, detail: "Forbidden" });
    return true;
  }

  if (request.method === "GET" && path === "/api/rates/admin") {
    writeJson(response, 200, mockAdminRates);
    return true;
  }

  if (
    request.method === "POST" &&
    ["/api/rates/platform-fee", "/api/rates/vat", "/api/rates/addon"].includes(path)
  ) {
    const body = await readJson(request);
    requests.rateActions.push({ body, method: request.method, path });
    if (
      path === "/api/rates/vat" &&
      typeof body === "object" &&
      body !== null &&
      "description" in body &&
      body.description === "Trigger overlap"
    ) {
      writeJson(response, 409, {
        type: "https://api.tripdly.com/problems/rate-date-overlap",
        title: "Rate date overlap",
        status: 409,
        detail: "The VAT rate overlaps an existing effective window.",
        instance: path,
        errorCode: "RATE_DATE_OVERLAP",
      });
      return true;
    }
    writeJson(response, 201, {
      id: "cm82345678901234567890123",
      effectiveSince: "2027-01-01T00:00:00.000Z",
      effectiveUntil: "2027-02-01T00:00:00.000Z",
      description: null,
      createdAt: "2026-08-28T00:00:00.000Z",
      updatedAt: "2026-08-28T00:00:00.000Z",
      ...mockRateTypeFields[path],
    });
    return true;
  }

  if (request.method === "PATCH" && path === `/api/rates/addon/${MOCK_ADDON_RATE_ID}/end`) {
    requests.rateActions.push({ body: null, method: request.method, path });
    writeJson(response, 200, {
      ...mockAdminRates.addonRates[0],
      effectiveUntil: "2026-08-28T20:00:00.000Z",
    });
    return true;
  }

  return false;
}

export function startMockAdminAuthApi(port = 3100) {
  const requests: MockAdminAuthApi["requests"] = { carActions: [], rateActions: [] };
  let sessionRole: PortalRole = "admin";
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    if (await handleAdminCarRequest(request, response, url, requests)) {
      return;
    }
    if (await handleAdminRateRequest(request, response, url, requests, sessionRole)) {
      return;
    }

    if (request.method === "POST" && path === "/api/auth/email-otp/send-verification-otp") {
      requests.sendOtp = capturedRequest(request, await readJson(request));
      writeJson(response, 200, { success: true });
      return;
    }

    if (request.method === "POST" && path === "/api/auth/sign-in/email-otp") {
      const body = (await readJson(request)) as { role: PortalRole };
      requests.verifyOtp = capturedRequest(request, body);
      sessionRole = body.role;
      response.setHeader(
        "Set-Cookie",
        "better-auth.session_token=admin-e2e-session; Path=/; HttpOnly; SameSite=Lax",
      );
      writeJson(response, 200, {
        user: {
          id: `${sessionRole}-1`,
          email: `${sessionRole}@example.com`,
          roles: [sessionRole],
        },
      });
      return;
    }

    if (request.method === "GET" && path === "/auth/session") {
      if (!hasAdminSession(request)) {
        writeJson(response, 401, { status: 401, detail: "Unauthorized" });
        return;
      }

      writeJson(response, 200, {
        user: {
          id: `${sessionRole}-1`,
          email: `${sessionRole}@example.com`,
          name: sessionRole === "admin" ? "Admin User" : "Staff User",
          roles: [sessionRole],
        },
        session: {},
      });
      return;
    }

    if (request.method === "POST" && path === "/api/auth/sign-out") {
      requests.signOut = capturedRequest(request, await readJson(request));
      writeJson(response, 200, null);
      return;
    }

    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
  });

  return new Promise<MockAdminAuthApi>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, requests }));
  });
}

export function stopMockAdminAuthApi(api: MockAdminAuthApi) {
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
