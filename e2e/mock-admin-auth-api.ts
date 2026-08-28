import { createServer, type IncomingMessage, type Server } from "node:http";

type PortalRole = "admin" | "staff";

const ADMIN_SESSION_COOKIE = "better-auth.session_token=admin-e2e-session";

export const MOCK_ADMIN_CAR_ID = "cm12345678901234567890123";
export const MOCK_ADMIN_IMAGE_ID = "cm22345678901234567890123";
export const MOCK_ADMIN_DOCUMENT_ID = "cm32345678901234567890123";

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

export function startMockAdminAuthApi(port = 3100) {
  const requests: MockAdminAuthApi["requests"] = { carActions: [] };
  let sessionRole: PortalRole = "admin";
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    if (await handleAdminCarRequest(request, response, url, requests)) {
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
