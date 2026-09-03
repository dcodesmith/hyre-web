const assetPathPattern = /(?:href|src)="(\/assets\/[A-Za-z0-9._-]+-[A-Za-z0-9_-]{8}\.(?:css|js))"/;
const previewUrl = process.argv[2];
const apiUrl = process.argv[3];
const environment = process.argv[4] ?? "preview";

if (!previewUrl || !apiUrl || !["development", "preview", "production"].includes(environment)) {
  throw new Error(
    "Usage: node scripts/smoke-preview.mjs <deployment-url> <api-origin> [development|preview|production]",
  );
}

const origin = new URL(previewUrl);
const apiOrigin = new URL(apiUrl);

if (origin.protocol !== "https:") {
  throw new Error("Preview URL must use HTTPS");
}

if (
  apiOrigin.protocol !== "https:" ||
  apiOrigin.username ||
  apiOrigin.password ||
  apiOrigin.pathname !== "/" ||
  apiOrigin.search ||
  apiOrigin.hash
) {
  throw new Error("API origin must be an HTTPS origin without credentials, path, query, or hash");
}

const requestId = `smoke-${Date.now()}`;
const healthRequestId = `${requestId}-health`;
const rejectedMutationRequestId = `${requestId}-cross-origin`;
const [response, healthResponse, rejectedMutationResponse] = await Promise.all([
  fetchWithRetry(origin, {
    headers: { "x-request-id": requestId },
  }),
  fetchWithRetry(new URL("/health", apiOrigin), {
    headers: { "x-request-id": healthRequestId },
  }),
  fetchWithRetry(origin, {
    method: "POST",
    headers: {
      Origin: "https://cross-origin-smoke.invalid",
      "Sec-Fetch-Site": "cross-site",
      "x-request-id": rejectedMutationRequestId,
    },
  }),
]);
const html = await response.text();

assert(response.status === 200, `Expected home status 200, received ${response.status}`);
assert(response.headers.get("content-type")?.includes("text/html"), "Home response is not HTML");
assert(html.includes("Tripdly"), "Home response does not contain the expected SSR content");
assert(
  html.includes("Your Ride, Your Choice") && html.includes('action="/search"'),
  "Home response does not contain the expected homepage search UI",
);
assert(
  !html.includes("Vehicles are temporarily unavailable") &&
    (html.includes("All vehicles") || html.includes("No vehicles available right now")),
  "Home response does not contain the expected API category data",
);
assert(response.headers.get("x-request-id") === requestId, "Request ID was not propagated");
assert(
  response.headers.get("content-security-policy")?.includes("default-src 'self'"),
  "Content-Security-Policy header is missing",
);
assert(
  response.headers.get("x-content-type-options") === "nosniff",
  "Security headers are missing",
);
assert(
  response.headers.get("strict-transport-security")?.includes("max-age=31536000"),
  "Strict-Transport-Security header is missing",
);
if (environment === "production") {
  assert(!response.headers.has("x-robots-tag"), "Production home must remain indexable");
} else {
  assert(
    response.headers.get("x-robots-tag")?.includes("noindex"),
    "Non-production response is not marked noindex",
  );
  assert(
    response.headers.get("cache-control") === "no-store",
    "Non-production home must not be cached",
  );
}
assert(response.headers.has("server-timing"), "Server timing header is missing");

assert(
  healthResponse.status === 200,
  `Expected API health status 200, received ${healthResponse.status}`,
);
const health = await healthResponse.json();
assert(health?.status === "ok", "API health response is not healthy");
assert(
  healthResponse.headers.get("x-request-id") === healthRequestId,
  "API health request ID was not propagated",
);

assert(
  rejectedMutationResponse.status === 403,
  `Expected cross-origin mutation status 403, received ${rejectedMutationResponse.status}`,
);
assert(
  rejectedMutationResponse.headers.get("cache-control") === "private, no-store",
  "Rejected mutation must not be cached",
);
assert(
  rejectedMutationResponse.headers.get("x-request-id") === rejectedMutationRequestId,
  "Rejected mutation request ID was not propagated",
);

const assetPath = assetPathPattern.exec(html)?.[1];
assert(assetPath, "Home response does not reference a fingerprinted static asset");

const assetResponse = await fetchWithRetry(
  new URL(assetPath, origin),
  { method: "HEAD" },
  hasImmutableAssetHeaders,
);
const assetCacheControl = assetResponse.headers.get("cache-control") ?? "";
assert(assetResponse.ok, `Static asset returned ${assetResponse.status}: ${assetPath}`);
assert(
  assetCacheControl.includes("public") &&
    assetCacheControl.includes("max-age=31536000") &&
    assetCacheControl.includes("immutable"),
  "Fingerprinted static asset is missing long-lived immutable caching",
);
assert(
  assetResponse.headers.get("x-content-type-options") === "nosniff",
  "Static asset security headers are missing",
);

console.log(`${environment} smoke checks passed: ${origin.origin}`);

function hasImmutableAssetHeaders(response) {
  const cacheControl = response.headers.get("cache-control") ?? "";

  return (
    response.ok &&
    cacheControl.includes("public") &&
    cacheControl.includes("max-age=31536000") &&
    cacheControl.includes("immutable")
  );
}

async function fetchWithRetry(input, init, shouldAccept = hasSettledStatus) {
  let lastError;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(15_000),
      });

      if (shouldAccept(response) || attempt === 8) {
        return response;
      }

      lastError = new Error(`Response did not satisfy smoke readiness (status ${response.status})`);
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }

  throw lastError;
}

function hasSettledStatus(response) {
  return response.status < 500;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
