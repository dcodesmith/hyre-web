import { createServer, type IncomingMessage, type Server } from "node:http";

type PortalRole = "admin" | "staff";

const ADMIN_SESSION_COOKIE = "better-auth.session_token=admin-e2e-session";

export const MOCK_ADMIN_CAR_ID = "cm12345678901234567890123";
export const MOCK_ADMIN_IMAGE_ID = "cm22345678901234567890123";
export const MOCK_ADMIN_DOCUMENT_ID = "cm32345678901234567890123";
export const MOCK_ADDON_RATE_ID = "cm42345678901234567890123";
export const MOCK_ADMIN_REFUND_ID = "cm92345678901234567890123";
export const MOCK_ADMIN_PAYOUT_ID = "cma2345678901234567890123";

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
    financialActions: CapturedCarAction[];
    financialListQueries: string[];
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

const mockAdminRefund = {
  id: MOCK_ADMIN_REFUND_ID,
  txRef: "HYRE-REFUND-001",
  status: "REFUND_ERROR",
  amountCharged: 125_000,
  refundRequestedAmount: 120_000,
  currency: "NGN",
  refundProviderId: "refund-provider-001",
  refundProviderStatus: "processing",
  refundRequestedAt: "2026-08-25T09:30:00.000Z",
  refundLastCheckedAt: "2026-08-25T10:30:00.000Z",
  refundReconciliationAttempts: 2,
  refundVerificationFailures: 1,
  refundManualReviewNotifiedAt: "2026-08-25T11:00:00.000Z",
  canReconcile: true,
  booking: {
    id: "booking-refund-1",
    bookingReference: "HYR-REF-001",
  },
  extension: null,
};

const mockAdminPayout = {
  id: MOCK_ADMIN_PAYOUT_ID,
  status: "PROCESSING",
  fleetOwner: {
    id: "owner-payout-1",
    name: "Ada Fleet",
    email: "ada@example.com",
  },
  booking: {
    id: "booking-payout-1",
    bookingReference: "HYR-PAY-001",
    overallPayoutStatus: "PROCESSING",
  },
  extensionId: null,
  amountToPay: 92_500,
  amountPaid: null,
  currency: "NGN",
  payoutProviderReference: "payout-provider-001",
  payoutMethodDetails: "Bank transfer ending in 1234",
  initiatedAt: "2026-08-26T08:00:00.000Z",
  processedAt: "2026-08-26T08:05:00.000Z",
  completedAt: null,
  notes: null,
};

const mockFinancialAudit = {
  id: "audit-financial-1",
  actorUserId: "admin-1",
  outcome: "UNRESOLVED",
  providerReference: "provider-previous",
  providerStatus: "processing",
  error: null,
  createdAt: "2026-08-26T09:00:00.000Z",
  updatedAt: "2026-08-26T09:00:00.000Z",
};

type MockAdminRates = typeof mockAdminRates;
type MockAdminRefund = Omit<typeof mockAdminRefund, "refundProviderId"> & {
  refundProviderId: string | null;
};
type MockAdminFinancials = {
  refund: MockAdminRefund;
  payout: typeof mockAdminPayout;
  refundAudits: (typeof mockFinancialAudit)[];
  payoutAudits: (typeof mockFinancialAudit)[];
};

function isMockRateActive(effectiveSince: string, effectiveUntil: string | null, at = new Date()) {
  return (
    new Date(effectiveSince) <= at && (effectiveUntil === null || new Date(effectiveUntil) > at)
  );
}

function createdRateWindow(body: Record<string, unknown>, id: string) {
  const now = new Date().toISOString();
  const effectiveSince = typeof body.effectiveSince === "string" ? body.effectiveSince : now;
  const effectiveUntil = typeof body.effectiveUntil === "string" ? body.effectiveUntil : null;
  return {
    id,
    effectiveSince,
    effectiveUntil,
    description: typeof body.description === "string" ? body.description : null,
    createdAt: now,
    updatedAt: now,
    active: isMockRateActive(effectiveSince, effectiveUntil),
  };
}

function persistCreatedRate(path: string, body: unknown, rates: MockAdminRates) {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const id = `cm8${String(
    rates.platformFeeRates.length + rates.taxRates.length + rates.addonRates.length,
  ).padStart(23, "0")}`;
  const window = createdRateWindow(record, id);

  if (path === "/api/rates/platform-fee") {
    const created = {
      ...window,
      feeType:
        record.feeType === "FLEET_OWNER_COMMISSION"
          ? "FLEET_OWNER_COMMISSION"
          : "PLATFORM_SERVICE_FEE",
      ratePercent: typeof record.ratePercent === "number" ? record.ratePercent : 0,
    };
    rates.platformFeeRates.unshift(created);
    return created;
  }

  if (path === "/api/rates/vat") {
    const created = {
      ...window,
      ratePercent: typeof record.ratePercent === "number" ? record.ratePercent : 0,
    };
    rates.taxRates.unshift(created);
    return created;
  }

  const created = {
    ...window,
    addonType: "SECURITY_DETAIL" as const,
    rateAmount: typeof record.rateAmount === "number" ? record.rateAmount : 0,
  };
  rates.addonRates.unshift(created);
  return created;
}

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
  rates: MockAdminRates,
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
    writeJson(response, 200, rates);
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
    const created = persistCreatedRate(path, body, rates);
    const { active: _active, ...mutation } = created;
    writeJson(response, 201, mutation);
    return true;
  }

  const endAddonMatch = /^\/api\/rates\/addon\/([^/]+)\/end$/.exec(path);
  if (request.method === "PATCH" && endAddonMatch) {
    const addonRate = rates.addonRates.find((rate) => rate.id === endAddonMatch[1]);
    requests.rateActions.push({ body: null, method: request.method, path });
    if (!addonRate) {
      writeJson(response, 404, { status: 404, detail: "Rate not found" });
      return true;
    }

    const endedAt = new Date().toISOString();
    Object.assign(addonRate, {
      active: false,
      effectiveUntil: endedAt,
      updatedAt: endedAt,
    });
    const { active: _active, ...mutation } = addonRate;
    writeJson(response, 200, mutation);
    return true;
  }

  return false;
}

async function reconcileAdminFinancialRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockAdminAuthApi["requests"],
  sessionRole: PortalRole,
  financials: MockAdminFinancials,
) {
  const body = await readJson(request);
  requests.financialActions.push({ body, method: request.method, path });
  if (sessionRole !== "admin") {
    writeJson(response, 403, { status: 403, detail: "Administrator access is required." });
    return true;
  }

  const now = new Date().toISOString();
  if (path.includes("/refunds/")) {
    const record =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const providerReference =
      financials.refund.refundProviderId ??
      (typeof record.refundProviderId === "string" ? record.refundProviderId : null);
    if (!providerReference) {
      writeJson(response, 409, {
        status: 409,
        detail: "A refund provider ID is required for reconciliation.",
      });
      return true;
    }
    Object.assign(financials.refund, {
      status: "REFUNDED",
      refundProviderId: providerReference,
      refundProviderStatus: "completed",
      refundLastCheckedAt: now,
      refundReconciliationAttempts: financials.refund.refundReconciliationAttempts + 1,
      canReconcile: false,
    });
    financials.refundAudits.unshift({
      id: "audit-refund-new",
      actorUserId: "admin-1",
      outcome: "RECONCILED",
      providerReference,
      providerStatus: "completed",
      error: null,
      createdAt: now,
      updatedAt: now,
    });
    writeJson(response, 201, {
      reconciled: true,
      status: financials.refund.status,
      providerStatus: financials.refund.refundProviderStatus,
      refund: financials.refund,
    });
    return true;
  }

  Object.assign(financials.payout, {
    status: "PAID_OUT",
    amountPaid: financials.payout.amountToPay,
    completedAt: now,
  });
  financials.payoutAudits.unshift({
    id: "audit-payout-new",
    actorUserId: "admin-1",
    outcome: "RECONCILED",
    providerReference: financials.payout.payoutProviderReference,
    providerStatus: "SUCCESSFUL",
    error: null,
    createdAt: now,
    updatedAt: now,
  });
  writeJson(response, 201, {
    reconciled: true,
    status: financials.payout.status,
    providerStatus: "SUCCESSFUL",
    mismatchReason: null,
    payout: financials.payout,
  });
  return true;
}

async function handleAdminFinancialRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockAdminAuthApi["requests"],
  sessionRole: PortalRole,
  financials: MockAdminFinancials,
) {
  const path = url.pathname;
  const basePath = "/api/admin/financial-operations";
  if (!path.startsWith(basePath)) {
    return false;
  }

  if (!hasAdminSession(request)) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (request.method === "GET" && path === `${basePath}/refunds`) {
    requests.financialListQueries.push(url.search);
    writeJson(response, 200, {
      refunds: [financials.refund],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    return true;
  }

  if (request.method === "GET" && path === `${basePath}/payouts`) {
    requests.financialListQueries.push(url.search);
    writeJson(response, 200, {
      payouts: [financials.payout],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    return true;
  }

  if (request.method === "GET" && path === `${basePath}/refunds/${MOCK_ADMIN_REFUND_ID}`) {
    writeJson(response, 200, { ...financials.refund, audits: financials.refundAudits });
    return true;
  }

  if (request.method === "GET" && path === `${basePath}/payouts/${MOCK_ADMIN_PAYOUT_ID}`) {
    writeJson(response, 200, { ...financials.payout, audits: financials.payoutAudits });
    return true;
  }

  if (
    request.method === "POST" &&
    (path === `${basePath}/refunds/${MOCK_ADMIN_REFUND_ID}/reconcile` ||
      path === `${basePath}/payouts/${MOCK_ADMIN_PAYOUT_ID}/reconcile`)
  ) {
    return reconcileAdminFinancialRequest(
      request,
      response,
      path,
      requests,
      sessionRole,
      financials,
    );
  }

  return false;
}

export function startMockAdminAuthApi(
  port = 3100,
  refundProviderId: string | null = mockAdminRefund.refundProviderId,
) {
  const requests: MockAdminAuthApi["requests"] = {
    carActions: [],
    financialActions: [],
    financialListQueries: [],
    rateActions: [],
  };
  const rates = structuredClone(mockAdminRates);
  const financials: MockAdminFinancials = {
    refund: { ...structuredClone(mockAdminRefund), refundProviderId },
    payout: structuredClone(mockAdminPayout),
    refundAudits: [structuredClone(mockFinancialAudit)],
    payoutAudits: [structuredClone(mockFinancialAudit)],
  };
  let sessionRole: PortalRole = "admin";
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    if (await handleAdminCarRequest(request, response, url, requests)) {
      return;
    }
    if (await handleAdminRateRequest(request, response, url, requests, sessionRole, rates)) {
      return;
    }
    if (
      await handleAdminFinancialRequest(request, response, url, requests, sessionRole, financials)
    ) {
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
