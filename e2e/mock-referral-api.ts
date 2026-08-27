import { createServer, type IncomingMessage, type Server } from "node:http";

export const MOCK_REFERRAL_CODE = "ABCD2345";

export const mockReferralSummary = {
  referralCode: MOCK_REFERRAL_CODE,
  shareLink: "https://api.example/auth?ref=ABCD2345",
  programEnabled: true,
  discountAmount: 10_000,
  hasUsedDiscount: false,
  referredBy: null,
  signupDate: null,
  stats: {
    totalReferrals: 2,
    totalRewardsGranted: 20_000,
    totalRewardsPending: 0,
    lastReferralAt: "2026-08-20T12:00:00.000Z",
    totalEarned: 20_000,
    totalUsed: 5_000,
    availableCredits: 15_000,
    maxCreditsPerBooking: 30_000,
  },
  referrals: [
    {
      id: "user-2",
      name: "Ada Friend",
      email: "friend@example.com",
      createdAt: "2026-08-20T12:00:00.000Z",
    },
  ],
  rewards: [
    {
      id: "reward-1",
      amount: 10_000,
      status: "RELEASED",
      createdAt: "2026-08-22T12:00:00.000Z",
      processedAt: "2026-08-23T12:00:00.000Z",
      refereeName: "Ada Friend",
    },
  ],
};

function requestPath(request: IncomingMessage) {
  return new URL(request.url ?? "/", "http://127.0.0.1").pathname;
}

function hasSessionCookie(request: IncomingMessage) {
  return request.headers.cookie?.includes("better-auth.session_token=") === true;
}

export function startMockReferralApi(port = 3000) {
  const server = createServer((request, response) => {
    if (request.method === "GET" && requestPath(request) === "/api/referrals/user") {
      if (!hasSessionCookie(request)) {
        response.writeHead(401, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: 401, detail: "Unauthorized" }));
        return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(mockReferralSummary));
      return;
    }

    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: 401, detail: "Unauthorized" }));
  });

  return new Promise<Server>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

export function stopMockReferralApi(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
