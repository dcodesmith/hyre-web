import { check } from "k6";
import http from "k6/http";
import { Counter } from "k6/metrics";

const fixtureSkips = new Counter("fixture_skips");

const BLOCKED_HOSTS = new Set([
  "tripdly.com",
  "www.tripdly.com",
  "hyre-web-production.tripdly.workers.dev",
  "hyre-worker-nestjs-production.fly.dev",
]);

const FORBIDDEN_PATHS = [
  /^\/api\/auth(?:\/|$)/,
  /^\/auth(?:\/|$)/,
  /^\/api\/bookings(?:\/|$)/,
  /^\/api\/payments(?:\/|$)/,
  /verification/i,
  /^\/api\/places(?:\/|$)/,
  /^\/api\/calculate-trip-duration$/,
  /^\/api\/search-flight$/,
  /^\/api\/ai-search$/,
  /webhook/i,
  /notification/i,
];

const WEB_ORIGIN = previewOrigin(__ENV.WEB_BASE_URL, "web");
const API_ORIGIN = previewOrigin(__ENV.API_BASE_URL, "api");
const EXPECTED_WEB_COMMIT = requiredSha("EXPECTED_WEB_COMMIT");
const EXPECTED_WEB_VERSION = requiredValue("EXPECTED_WEB_VERSION");
const EXPECTED_API_COMMIT = requiredSha("EXPECTED_API_COMMIT");
const EXPECTED_API_VERSION = requiredValue("EXPECTED_API_VERSION");

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1"],
    http_req_failed: ["rate==0"],
  },
};

export default function () {
  const runId = `k6-web-smoke-${Date.now()}-${__VU}-${__ITER}`;
  const headers = { "x-request-id": runId };

  const apiRoot = safeGet("api", "/", headers, "deployment_identity");
  check(apiRoot, {
    "API identity is healthy": (response) => response.status === 200,
    "API preview environment is selected": (response) => response.json("environment") === "preview",
    "API commit matches": (response) => response.json("deployment.commit") === EXPECTED_API_COMMIT,
    "API version matches": (response) =>
      response.json("deployment.version") === EXPECTED_API_VERSION,
  });

  const health = safeGet("api", "/health", headers, "health");
  check(health, {
    "API health is OK": (response) => response.status === 200 && response.json("status") === "ok",
  });

  const home = safeGet("web", "/", headers, "homepage");
  check(home, {
    "homepage renders": (response) => response.status === 200 && response.body.includes("Tripdly"),
    "web commit matches": (response) =>
      responseHeader(response, "x-commit-sha") === EXPECTED_WEB_COMMIT,
    "web version matches": (response) =>
      responseHeader(response, "x-app-version") === EXPECTED_WEB_VERSION,
  });

  const search = safeGet("web", "/search?bookingType=DAY", headers, "search_page");
  check(search, {
    "search page renders": (response) =>
      response.status === 200 && response.body.includes("Tripdly"),
  });

  const categories = safeGet("api", "/api/cars/categories?limit=20", headers, "categories");
  check(categories, {
    "categories are readable": (response) =>
      response.status === 200 && Array.isArray(response.json("allCars")),
  });

  const rates = safeGet("api", "/api/rates", headers, "rates");
  check(rates, {
    "rates are readable": (response) =>
      response.status === 200 &&
      Number.isFinite(response.json("platformCustomerServiceFeeRatePercent")) &&
      Number.isFinite(response.json("vatRatePercent")),
  });

  const car = firstCar(categories);
  if (!car) {
    fixtureSkips.add(1, { flow: "car_detail_and_pricing" });
    console.warn("SKIP car detail and pricing preview: categories returned no fixture car");
    return;
  }

  const carSlug = generateCarSlug(car);
  const carDetail = safeGet("web", `/cars/${carSlug}?bookingType=DAY`, headers, "car_detail");
  check(carDetail, {
    "car detail renders": (response) =>
      response.status === 200 && response.body.includes("Tripdly"),
  });

  const preview = safeGet(
    "web",
    `/api/booking-pricing-preview?${pricingPreviewQuery(car.id)}`,
    headers,
    "pricing_preview",
  );
  check(preview, {
    "pricing preview is read-only and succeeds": (response) =>
      response.status === 200 &&
      response.json("error") === null &&
      Number.isFinite(response.json("preview.totalAmount")),
  });
}

function safeGet(surface, path, headers, name) {
  assertAllowed(surface, "GET", path);
  const origin = surface === "web" ? WEB_ORIGIN : API_ORIGIN;
  return http.get(`${origin}${path}`, {
    headers,
    redirects: 0,
    tags: { endpoint: name, surface },
    timeout: "15s",
  });
}

function assertAllowed(surface, method, path) {
  const url = new URL(path, "https://smoke.invalid");
  const pathname = url.pathname;
  const isPricingPreview =
    (surface === "web" && pathname === "/api/booking-pricing-preview") ||
    (surface === "api" && pathname === "/api/bookings/pricing-preview");

  if (!isPricingPreview && FORBIDDEN_PATHS.some((pattern) => pattern.test(pathname))) {
    throw new Error(`Refusing forbidden smoke endpoint: ${method} ${pathname}`);
  }

  const allowed =
    method === "GET" &&
    ((surface === "web" &&
      (pathname === "/" ||
        pathname === "/search" ||
        /^\/cars\/[a-z0-9-]+--[0-9a-f]{16}$/.test(pathname) ||
        pathname === "/api/booking-pricing-preview")) ||
      (surface === "api" &&
        (pathname === "/" ||
          pathname === "/health" ||
          pathname === "/api/cars/categories" ||
          pathname === "/api/rates")));

  if (!allowed) {
    throw new Error(`Endpoint is not on the read-only smoke allowlist: ${method} ${pathname}`);
  }
}

function previewOrigin(rawValue, kind) {
  const raw = requiredValue(kind === "web" ? "WEB_BASE_URL" : "API_BASE_URL", rawValue);
  const url = new URL(raw);

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${kind} base URL must be a bare HTTPS origin`);
  }

  if (BLOCKED_HOSTS.has(url.hostname) || url.hostname.includes("production")) {
    throw new Error(`Refusing production hostname: ${url.hostname}`);
  }

  const expectedHost =
    kind === "web"
      ? /^pr-\d+-hyre-web-preview\.[a-z0-9-]+\.workers\.dev$/
      : /^hyre-worker-nestjs-pr-\d+\.fly\.dev$/;

  if (!expectedHost.test(url.hostname)) {
    throw new Error(`Refusing non-preview ${kind} hostname: ${url.hostname}`);
  }

  return url.origin;
}

function requiredValue(name, suppliedValue = __ENV[name]) {
  const value = suppliedValue?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function requiredSha(name) {
  const value = requiredValue(name);
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    throw new Error(`${name} must be a full git SHA`);
  }
  return value;
}

function responseHeader(response, expectedName) {
  const entry = Object.entries(response.headers).find(
    ([name]) => name.toLowerCase() === expectedName,
  );
  return entry?.[1];
}

function firstCar(response) {
  if (response.status !== 200) {
    return null;
  }

  const cars = response.json("allCars");
  const car = Array.isArray(cars) ? cars[0] : null;
  if (
    !car ||
    typeof car.id !== "string" ||
    typeof car.publicRef !== "string" ||
    typeof car.make !== "string" ||
    typeof car.model !== "string" ||
    typeof car.color !== "string" ||
    typeof car.year !== "number"
  ) {
    return null;
  }
  return car;
}

function generateCarSlug(car) {
  const slug = `${car.year}-${car.color}-${car.make}-${car.model}`
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!/^[0-9a-f]{16}$/.test(car.publicRef)) {
    throw new Error("Fixture car publicRef is not safe");
  }
  return `${slug}--${car.publicRef}`;
}

function pricingPreviewQuery(carId) {
  const { startDate, endDate } = futureDayWindow();
  const params = new URLSearchParams({
    carId,
    bookingType: "DAY",
    startDate,
    endDate,
    pickupTime: "9 AM",
    requiresFullTank: "false",
    useCredits: "0",
  });
  return params.toString();
}

function futureDayWindow() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + 45);
  start.setUTCHours(8, 0, 0, 0);
  const end = new Date(start);
  end.setUTCHours(20, 0, 0, 0);
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}
