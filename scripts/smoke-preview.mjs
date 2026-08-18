const previewUrl = process.argv[2];

if (!previewUrl) {
  throw new Error("Usage: node scripts/smoke-preview.mjs <preview-url>");
}

const origin = new URL(previewUrl);

if (origin.protocol !== "https:") {
  throw new Error("Preview URL must use HTTPS");
}

const requestId = `smoke-${Date.now()}`;
const response = await fetchWithRetry(origin, {
  headers: { "x-request-id": requestId },
});
const html = await response.text();

assert(response.status === 200, `Expected home status 200, received ${response.status}`);
assert(response.headers.get("content-type")?.includes("text/html"), "Home response is not HTML");
assert(html.includes("Hyre Web"), "Home response does not contain the expected SSR content");
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
  response.headers.get("x-robots-tag")?.includes("noindex"),
  "Preview response is not marked noindex",
);
assert(response.headers.get("cache-control") === "no-store", "Preview home must not be cached");
assert(response.headers.has("server-timing"), "Server timing header is missing");

const assetPath = html.match(/(?:href|src)="(\/assets\/[^"]+)"/)?.[1];

if (assetPath) {
  const assetResponse = await fetchWithRetry(new URL(assetPath, origin));
  assert(assetResponse.ok, `Static asset returned ${assetResponse.status}: ${assetPath}`);
}

console.log(`Preview smoke checks passed: ${origin.origin}`);

async function fetchWithRetry(input, init) {
  let lastError;

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(15_000),
      });

      if (response.status < 500 || attempt === 8) {
        return response;
      }

      lastError = new Error(`Received ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
  }

  throw lastError;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
