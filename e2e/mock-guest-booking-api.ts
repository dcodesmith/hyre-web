import { createServer, type IncomingMessage, type Server } from "node:http";

export const MOCK_GUEST_BOOKING_ID = "guest-booking-e2e";
export const MOCK_GUEST_BOOKING_TOKEN = "a".repeat(43);

export type MockGuestBookingApi = {
  server: Server;
  requests: {
    accessBody?: unknown;
    token?: string;
  };
};

function requestUrl(request: IncomingMessage) {
  return new URL(request.url ?? "/", "http://127.0.0.1");
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

function guestBooking() {
  return {
    bookingId: MOCK_GUEST_BOOKING_ID,
    bookingReference: "BK-GUEST-001",
    status: "CONFIRMED",
    paymentStatus: "PAID",
    bookingType: "DAY",
    startDate: "2026-09-21T08:00:00.000Z",
    endDate: "2026-09-21T20:00:00.000Z",
    pickupLocation: "Murtala Muhammed Airport, Ikeja",
    returnLocation: "12 Marina, Lagos Island",
    specialRequests: null,
    cancellationReason: null,
    flightNumber: null,
    totalAmount: 150_000,
    currency: "NGN",
    accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    car: {
      make: "Lexus",
      model: "UX F-Sport",
      year: 2019,
      images: ["https://cdn.example.com/car.jpg"],
    },
    chauffeur: { name: "Bola Adebayo", phoneNumber: "08000000000" },
    legs: [
      {
        id: "guest-leg-e2e",
        legDate: "2026-09-21T00:00:00.000Z",
        legStartTime: "2026-09-21T08:00:00.000Z",
        legEndTime: "2026-09-21T20:00:00.000Z",
        extensions: [],
      },
    ],
  };
}

export function startMockGuestBookingApi(port = 3100) {
  const requests: MockGuestBookingApi["requests"] = {};
  const server = createServer(async (request, response) => {
    const url = requestUrl(request);

    if (request.method === "POST" && url.pathname === "/api/bookings/guest-access") {
      requests.accessBody = await readJson(request);
      writeJson(response, 202, {
        message: "If those booking details match, we sent an access link to the booking email.",
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/bookings/guest-access") {
      requests.token = url.searchParams.get("token") ?? undefined;

      if (requests.token === MOCK_GUEST_BOOKING_TOKEN) {
        writeJson(response, 200, guestBooking());
      } else {
        writeJson(response, 404, { status: 404, detail: "Booking not found" });
      }
      return;
    }

    writeJson(response, 404, { status: 404, detail: "Not found" });
  });

  return new Promise<MockGuestBookingApi>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve({ server, requests }));
  });
}

export function stopMockGuestBookingApi(api: MockGuestBookingApi) {
  return new Promise<void>((resolve, reject) => {
    api.server.close((error) => (error ? reject(error) : resolve()));
  });
}
