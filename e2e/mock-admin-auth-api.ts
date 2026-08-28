import { createServer, type IncomingMessage, type Server } from "node:http";

type PortalRole = "admin" | "staff";

type CapturedRequest = {
  body: unknown;
  origin?: string;
  referer?: string;
};

export type MockAdminAuthApi = {
  server: Server;
  requests: {
    sendOtp?: CapturedRequest;
    signOut?: CapturedRequest;
    verifyOtp?: CapturedRequest;
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

export function startMockAdminAuthApi(port = 3100) {
  const requests: MockAdminAuthApi["requests"] = {};
  let sessionRole: PortalRole = "admin";
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

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
      if (!request.headers.cookie?.includes("better-auth.session_token=admin-e2e-session")) {
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
