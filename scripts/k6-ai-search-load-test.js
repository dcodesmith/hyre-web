import http from "k6/http";
import { check, sleep } from "k6";

/**
 * k6 load test for POST /api/ai-search
 *
 * Tests rate limiting (IP-based: tokenBucket 8/60s, burst 12).
 * Run with: k6 run scripts/k6-ai-search-load-test.js
 *
 * Options:
 *   - BASE_URL: target URL (default: http://localhost:5173)
 *   - VUS: virtual users (default: 1 - single IP to trigger rate limit)
 *   - DURATION: test duration (default: 30s)
 *
 * Example: k6 run -e BASE_URL=http://localhost:5173 scripts/k6-ai-search-load-test.js
 */

const BASE_URL = __ENV.BASE_URL || "http://localhost:5173";
const VUS = __ENV.VUS || 1;
const DURATION = __ENV.DURATION || "30s";

export const options = {
  scenarios: {
    // Scenario 1: Rapid fire from single IP to exhaust rate limit (8/60s token bucket)
    exhaust_rate_limit: {
      executor: "constant-vus",
      vus: Number.parseInt(VUS, 10),
      duration: DURATION,
      startTime: "0s",
    },
  },
  thresholds: {
    // We expect some 429s when rate limit is hit
    http_req_failed: ["rate<1"], // Allow failures (429s are expected)
    http_req_duration: ["p(95)<10000"], // AI calls can be slow
  },
};

const SAMPLE_QUERIES = [
  "Black Toyota Camry for 3 days next week",
  "SUV for airport pickup tomorrow 2 PM",
  "Luxury sedan for a day rental",
  "White Mercedes E-Class executive tier",
  "Van for 5 people full day",
];

export default function () {
  const query = SAMPLE_QUERIES[Math.floor(Math.random() * SAMPLE_QUERIES.length)];
  const url = `${BASE_URL}/api/ai-search`;
  const payload = JSON.stringify({ query });

  const res = http.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      // Uncomment to simulate different IPs (bypasses single-IP rate limit):
      // "X-Forwarded-For": `192.168.1.${Math.floor(Math.random() * 255)}`,
    },
  });

  const isRateLimited = res.status === 429 || res.status === 503;
  const retryAfter = res.headers["Retry-After"];
  const rateLimitRemaining = res.headers["RateLimit-Remaining"];

  // Log every request
  const logParts = [
    `[VU ${__VU} iter ${__ITER}]`,
    `POST ${url}`,
    `status=${res.status}`,
    `duration=${(res.timings.duration / 1000).toFixed(2)}s`,
  ];
  if (retryAfter !== undefined) logParts.push(`Retry-After=${retryAfter}`);
  if (rateLimitRemaining !== undefined) logParts.push(`RateLimit-Remaining=${rateLimitRemaining}`);
  if (isRateLimited) logParts.push(`body=${res.body?.slice(0, 100)}`);
  else if (res.status === 200)
    logParts.push(`query="${query.slice(0, 40)}${query.length > 40 ? "…" : ""}"`);

  console.log(logParts.join(" | "));

  check(res, {
    "status is 200 or 429/503": (r) => r.status === 200 || r.status === 429 || r.status === 503,
  });

  if (res.status === 400) {
    console.warn(`[BAD REQUEST] ${res.body}`);
  }

  // Small sleep to avoid overwhelming locally; remove or reduce for aggressive testing
  sleep(0.1);
}
