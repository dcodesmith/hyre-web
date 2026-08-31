import { createServer, type IncomingMessage, type Server } from "node:http";

export const MOCK_EXTENSION_BOOKING_ID = "booking-extension-e2e";
export const MOCK_EXTENSION_LEG_ID = "leg-extension-e2e";
export const MOCK_EXTENSION_ID = "extension-e2e";
export const MOCK_EXTENSION_TX_REF = "ext-e2e-payment";

export type MockBookingExtensionApi = {
  server: Server;
  requests: {
    extensionBody?: unknown;
    extensionIdempotencyKey?: string;
    confirmationBody?: unknown;
  };
};

const mockBooking = {
  id: MOCK_EXTENSION_BOOKING_ID,
  userId: "customer-e2e",
  bookingReference: "TD-EXT-001",
  status: "CONFIRMED",
  paymentStatus: "PAID",
  type: "DAY",
  startDate: "2026-09-21T08:00:00.000Z",
  endDate: "2026-09-21T20:00:00.000Z",
  pickupLocation: "Murtala Muhammed Airport, Ikeja",
  returnLocation: "12 Marina, Lagos Island",
  totalAmount: 150_000,
  currency: "NGN",
  netTotal: 130_435,
  platformCustomerServiceFeeAmount: 9_130,
  platformCustomerServiceFeeRatePercent: 7,
  vatAmount: 10_435,
  vatRatePercent: 7.5,
  securityDetailCost: 0,
  fuelUpgradeCost: 0,
  referralDiscountAmount: 0,
  referralCreditsUsed: 0,
  car: { make: "Lexus", model: "UX F-Sport", year: 2019 },
  chauffeur: { name: "Bola Adebayo" },
  flight: null,
  canEdit: false,
  canCancel: true,
  modificationCutoffAt: "2026-09-20T20:00:00.000Z",
  legs: [
    {
      id: MOCK_EXTENSION_LEG_ID,
      legDate: "2026-09-21T00:00:00.000Z",
      legStartTime: "2026-09-21T08:00:00.000Z",
      legEndTime: "2026-09-21T20:00:00.000Z",
      extensions: [],
      canExtend: true,
      maxExtendableHours: 3,
    },
  ],
};

function path(request: IncomingMessage) {
  return new URL(request.url ?? "/", "http://127.0.0.1").pathname;
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null;
}

function writeJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function hasSession(request: IncomingMessage) {
  return request.headers.cookie?.includes("better-auth.session_token=") === true;
}

function writePaymentStatus(response: import("node:http").ServerResponse, confirmed: boolean) {
  writeJson(response, 200, {
    txRef: MOCK_EXTENSION_TX_REF,
    status: confirmed ? "SUCCESSFUL" : "PENDING",
    amountExpected: 25_000,
    amountCharged: confirmed ? 25_000 : null,
    confirmedAt: confirmed ? new Date().toISOString() : null,
    extension: {
      id: MOCK_EXTENSION_ID,
      status: confirmed ? "ACTIVE" : "PENDING",
    },
  });
}

export function startMockBookingExtensionApi(port = 3100) {
  const requests: MockBookingExtensionApi["requests"] = {};
  let confirmed = false;
  const server = createServer(async (request, response) => {
    const requestPath = path(request);

    if (!hasSession(request)) {
      writeJson(response, 401, { status: 401, detail: "Unauthorized" });
      return;
    }

    if (request.method === "GET" && requestPath === "/auth/session") {
      writeJson(response, 200, {
        user: {
          id: "customer-e2e",
          email: "customer@example.com",
          name: "Ada Customer",
          roles: ["user"],
        },
        session: {},
      });
      return;
    }

    if (request.method === "GET" && requestPath === `/api/bookings/${MOCK_EXTENSION_BOOKING_ID}`) {
      writeJson(response, 200, mockBooking);
      return;
    }

    if (
      request.method === "POST" &&
      requestPath === `/api/bookings/${MOCK_EXTENSION_BOOKING_ID}/extensions`
    ) {
      requests.extensionBody = await readJson(request);
      requests.extensionIdempotencyKey = request.headers["idempotency-key"] as string | undefined;
      writeJson(response, 201, {
        extensionId: MOCK_EXTENSION_ID,
        paymentIntentId: MOCK_EXTENSION_TX_REF,
        checkoutUrl: "https://checkout.flutterwave.com/pay/mock-extension",
      });
      return;
    }

    if (request.method === "POST" && requestPath === "/api/payments/extension-confirmation") {
      requests.confirmationBody = await readJson(request);
      confirmed = true;
      writePaymentStatus(response, confirmed);
      return;
    }

    if (
      request.method === "GET" &&
      requestPath === `/api/payments/status/${MOCK_EXTENSION_TX_REF}`
    ) {
      writePaymentStatus(response, confirmed);
      return;
    }

    writeJson(response, 404, { status: 404, detail: "Not found" });
  });

  return new Promise<MockBookingExtensionApi>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, requests }));
  });
}

export function stopMockBookingExtensionApi(api: MockBookingExtensionApi) {
  return new Promise<void>((resolve, reject) => {
    api.server.close((error) => (error ? reject(error) : resolve()));
  });
}
