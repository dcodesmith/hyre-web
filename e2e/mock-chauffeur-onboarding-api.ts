import { createServer, type IncomingMessage, type Server } from "node:http";

import { closeMockApiServer, listenOnMockApiPort } from "./mock-http-server";

export const MOCK_CHAUFFEUR_INVITE_TOKEN = "e2e-chauffeur-invite-token-32chars";
export const MOCK_CHAUFFEUR_SESSION_TOKEN = "e2e-chauffeur-onboarding-session";

export type MockChauffeurOnboardingApi = {
  server: Server;
  requests: {
    authorization: string[];
    drivingIdempotencyKeys: string[];
    invitationTokens: string[];
    ninIdempotencyKeys: string[];
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

function readBody(request: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function writeJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createOnboarding() {
  return {
    id: "chauffeur-e2e",
    name: "Bola Adebayo",
    email: "bola@example.com",
    phoneNumber: "+2348012345678",
    fleetOwnerName: "Ada Lovelace",
    status: "INVITED" as const,
    steps: { consent: false, phone: false, nin: false, driving: false },
    complianceRequirements: [
      { type: "LASDRI", label: "LASDRI card", required: false },
      { type: "LASRRA", label: "LASRRA card", required: false },
      { type: "DRIVER_BADGE", label: "Lagos driver badge", required: false },
    ],
  };
}

function bearerToken(request: IncomingMessage) {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    return undefined;
  }
  return header.slice("Bearer ".length);
}

type MockChauffeurOnboarding = ReturnType<typeof createOnboarding>;

function requireChauffeurSession(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  requests: MockChauffeurOnboardingApi["requests"],
) {
  const token = bearerToken(request);
  requests.authorization.push(
    typeof request.headers.authorization === "string" ? request.headers.authorization : "",
  );
  if (token === MOCK_CHAUFFEUR_SESSION_TOKEN) {
    return true;
  }
  writeJson(response, 401, { status: 401, detail: "Unauthorized" });
  return false;
}

function invitationToken(body: unknown) {
  if (
    typeof body === "object" &&
    body !== null &&
    "token" in body &&
    typeof body.token === "string"
  ) {
    return body.token;
  }
  return undefined;
}

function pushIdempotencyKey(request: IncomingMessage, keys: string[]) {
  const key = request.headers["idempotency-key"];
  keys.push(typeof key === "string" ? key : "");
}

async function handleInvitationExchange(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  requests: MockChauffeurOnboardingApi["requests"],
  onboarding: MockChauffeurOnboarding,
) {
  const token = invitationToken(await readJson(request));
  requests.invitationTokens.push(token ?? "");
  if (token !== MOCK_CHAUFFEUR_INVITE_TOKEN) {
    writeJson(response, 404, { status: 404, detail: "Invitation is invalid" });
    return;
  }
  writeJson(response, 200, {
    sessionToken: MOCK_CHAUFFEUR_SESSION_TOKEN,
    sessionExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    onboarding,
  });
}

async function handleStagedChauffeurRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockChauffeurOnboardingApi["requests"],
  onboarding: MockChauffeurOnboarding,
) {
  if (request.method === "GET" && path === "/api/chauffeur-onboarding") {
    writeJson(response, 200, onboarding);
    return true;
  }

  if (request.method === "PUT" && path === "/api/chauffeur-onboarding/consent") {
    onboarding.status = "CONSENTED";
    onboarding.steps.consent = true;
    writeJson(response, 200, onboarding);
    return true;
  }

  if (request.method === "POST" && path === "/api/chauffeur-onboarding/phone-verifications") {
    writeJson(response, 200, { status: "PENDING", phoneNumber: onboarding.phoneNumber });
    return true;
  }

  if (request.method === "POST" && path === "/api/chauffeur-onboarding/phone-verification-checks") {
    onboarding.status = "PHONE_VERIFIED";
    onboarding.steps.phone = true;
    writeJson(response, 200, { status: "VERIFIED", phoneNumber: onboarding.phoneNumber });
    return true;
  }

  if (request.method === "POST" && path === "/api/chauffeur-onboarding/nin-verifications") {
    pushIdempotencyKey(request, requests.ninIdempotencyKeys);
    await readJson(request);
    onboarding.status = "IDENTITY_VERIFIED";
    onboarding.steps.nin = true;
    writeJson(response, 200, onboarding);
    return true;
  }

  if (request.method === "POST" && path === "/api/chauffeur-onboarding/driving-verifications") {
    pushIdempotencyKey(request, requests.drivingIdempotencyKeys);
    await readBody(request);
    onboarding.status = "APPROVED";
    onboarding.steps.driving = true;
    writeJson(response, 200, onboarding);
    return true;
  }

  return false;
}

export async function startMockChauffeurOnboardingApi(port = 3100) {
  const requests: MockChauffeurOnboardingApi["requests"] = {
    authorization: [],
    drivingIdempotencyKeys: [],
    invitationTokens: [],
    ninIdempotencyKeys: [],
  };
  const onboarding = createOnboarding();
  const server = createServer(async (request, response) => {
    const path = requestUrl(request).pathname;

    if (request.method === "POST" && path === "/api/chauffeur-onboarding/invitation-exchanges") {
      await handleInvitationExchange(request, response, requests, onboarding);
      return;
    }

    if (!requireChauffeurSession(request, response, requests)) {
      return;
    }

    if (await handleStagedChauffeurRequest(request, response, path, requests, onboarding)) {
      return;
    }

    writeJson(response, 404, { status: 404, detail: "Not found" });
  });

  await listenOnMockApiPort(server, port);
  return { server, requests };
}

export function stopMockChauffeurOnboardingApi(api: MockChauffeurOnboardingApi) {
  return closeMockApiServer(api.server);
}
