const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

const MUTATION_METHODS = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const PRIVATE_PATH_PREFIXES = [
  "/account",
  "/admin",
  "/api",
  "/auth",
  "/bookings",
  "/chauffeur",
  "/debug",
  "/fleet-owner",
  "/logout",
  "/profile",
  "/referrals",
  "/verify",
] as const;

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "connect-src 'self' ws: wss:",
  "font-src 'self' https://fonts.gstatic.com",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https://*.s3.eu-west-1.amazonaws.com https://*.s3.eu-west-2.amazonaws.com",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
].join("; ");

export type DeploymentEnvironment = "local" | "preview" | "production";

export type PreparedRequest = {
  request: Request;
  requestId: string;
};

export function prepareRequest(request: Request): PreparedRequest {
  const requestId = getOrCreateRequestId(request.headers.get(REQUEST_ID_HEADER));
  const preparedRequest = new Request(request);

  preparedRequest.headers.set(REQUEST_ID_HEADER, requestId);

  return { request: preparedRequest, requestId };
}

export function validateMutationOrigin(request: Request): Response | undefined {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return undefined;
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (origin === requestOrigin && (!fetchSite || fetchSite === "same-origin")) {
    return undefined;
  }

  return Response.json(
    {
      type: "INVALID_REQUEST_ORIGIN",
      title: "Forbidden",
      status: 403,
      detail: "The request origin could not be verified.",
      instance: new URL(request.url).pathname,
    },
    { status: 403 },
  );
}

export function applyResponsePolicy(
  request: Request,
  response: Response,
  options: {
    environment: DeploymentEnvironment;
    requestId: string;
    durationMs?: number;
  },
) {
  const headers = new Headers(response.headers);
  const url = new URL(request.url);
  const pathname = normalizeDataPathname(url.pathname);
  const isProduction = options.environment === "production";
  const isPrivatePath = PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isDataRequest =
    url.pathname.endsWith(".data") ||
    url.searchParams.has("_routes") ||
    request.headers.get("sec-fetch-dest") === "empty";
  const hasSensitiveState =
    Boolean(request.headers.get("cookie")) ||
    Boolean(request.headers.get("authorization")) ||
    headers.has("set-cookie") ||
    MUTATION_METHODS.has(request.method.toUpperCase()) ||
    isPrivatePath ||
    isDataRequest;

  headers.set(REQUEST_ID_HEADER, options.requestId);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("X-Permitted-Cross-Domain-Policies", "none");

  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (!isProduction || isPrivatePath) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  } else {
    headers.delete("X-Robots-Tag");
  }

  if (hasSensitiveState) {
    headers.set("Cache-Control", "private, no-store");
  } else if (!isProduction) {
    // Preview and local HTML must stay uncached so PR deploys are immediately visible.
    headers.set("Cache-Control", "no-store");
  } else if (!headers.has("cache-control")) {
    // Public caching is opt-in per route once its complete cache key is known.
    headers.set("Cache-Control", "no-store");
  }

  if (options.durationMs !== undefined) {
    headers.append("Server-Timing", `app;dur=${Math.max(0, options.durationMs).toFixed(1)}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getOrCreateRequestId(value: string | null) {
  if (value && SAFE_REQUEST_ID.test(value)) {
    return value;
  }

  return crypto.randomUUID();
}

function normalizeDataPathname(pathname: string) {
  if (pathname.endsWith("/_.data")) {
    return pathname.slice(0, -"/_.data".length) || "/";
  }

  if (pathname.endsWith(".data")) {
    return pathname.slice(0, -".data".length) || "/";
  }

  return pathname;
}
